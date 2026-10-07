import type { FinanceState } from './types';
import { validateState } from './domain';

const DB_NAME = 'orthomax-gina-vault';
const ITERATIONS = 600_000;
const MAX_BYTES = 20 * 1024 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

interface Envelope {
  format: 'orthomax-gina-encrypted'; version: 1; schemaVersion: 1;
  cipher: 'AES-256-GCM'; kdf: 'PBKDF2-SHA256'; iterations: number;
  vaultId: string; revision: number; createdAt: string; savedAt: string;
  salt: string; iv: string; ciphertext: string;
}
interface RecoveryRecord {
  id: string; savedAt: string; recordedAt: string;
  reason: 'previous' | 'before-restore'; envelope: unknown;
}
function newestRecovery(a: RecoveryRecord, b: RecoveryRecord): number {
  const dateOrder = b.recordedAt.localeCompare(a.recordedAt);
  if (dateOrder) return dateOrder;
  const aRevision = (a.envelope as Partial<Envelope> | undefined)?.revision;
  const bRevision = (b.envelope as Partial<Envelope> | undefined)?.revision;
  return (Number.isSafeInteger(bRevision) ? bRevision! : 0) - (Number.isSafeInteger(aRevision) ? aRevision! : 0);
}
export interface PersistenceInfo {
  supported: boolean; persisted: boolean; usage?: number; quota?: number;
}
export interface VaultOptions {
  onExternalChange?: () => void;
  /** Injection for isolated tests; production always uses the stable database name. */
  indexedDB?: IDBFactory;
  broadcast?: boolean;
}

function vaultError(message: string): Error { return new Error(message); }
function storageError(error: unknown): Error {
  if (error instanceof Error && error.name === 'QuotaExceededError') {
    return vaultError('No hay espacio suficiente. El guardado no se completó; conserva esta pantalla y exporta un respaldo. Los datos anteriores se mantienen.');
  }
  if (error instanceof Error && error.name === 'VersionError') {
    return vaultError('La bóveda pertenece a una versión más reciente. Actualiza la aplicación; no se modificaron los datos.');
  }
  return vaultError('No se pudo completar el acceso al almacenamiento. No se borraron los datos anteriores. Intenta de nuevo o usa un respaldo.');
}
function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}
function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  // A simple linear character check avoids regexp stack exhaustion on large backups.
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw vaultError('El respaldo contiene datos cifrados inválidos.');
  }
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value));
}
function parseEnvelope(value: unknown): Envelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw vaultError('No es un respaldo válido de Gimo.');
  const item = value as Record<string, unknown>;
  const keys = ['format', 'version', 'schemaVersion', 'cipher', 'kdf', 'iterations', 'vaultId', 'revision', 'createdAt', 'savedAt', 'salt', 'iv', 'ciphertext'];
  if (Object.keys(item).length !== keys.length || keys.some(key => !(key in item))) throw vaultError('La estructura del respaldo no es válida.');
  if (item.format !== 'orthomax-gina-encrypted' || item.version !== 1 || item.schemaVersion !== 1) throw vaultError('Versión de respaldo no compatible. Conserva el archivo y utiliza la versión correcta de la aplicación.');
  if (item.cipher !== 'AES-256-GCM' || item.kdf !== 'PBKDF2-SHA256' || item.iterations !== ITERATIONS) throw vaultError('Los parámetros de protección del respaldo no son compatibles.');
  if (typeof item.vaultId !== 'string' || !/^[0-9a-f-]{36}$/i.test(item.vaultId) || !Number.isSafeInteger(item.revision) || (item.revision as number) < 1) throw vaultError('La identificación o revisión de la bóveda no es válida.');
  if (!isDate(item.createdAt) || !isDate(item.savedAt)) throw vaultError('Las fechas del respaldo no son válidas.');
  if (typeof item.salt !== 'string' || item.salt.length !== 24 || fromBase64(item.salt).length !== 16 || typeof item.iv !== 'string' || item.iv.length !== 16 || fromBase64(item.iv).length !== 12) throw vaultError('Los parámetros de cifrado están dañados.');
  if (typeof item.ciphertext !== 'string' || item.ciphertext.length < 24 || item.ciphertext.length >= MAX_BYTES || fromBase64(item.ciphertext).length < 16) throw vaultError('El contenido cifrado está incompleto o excede el tamaño permitido.');
  return item as unknown as Envelope;
}
function parseBackup(text: string): Envelope {
  if (typeof text !== 'string' || text.length >= MAX_BYTES || encoder.encode(text).byteLength >= MAX_BYTES) throw vaultError('El respaldo debe ocupar menos de 20 MB.');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw vaultError('No se pudo leer el archivo de respaldo. Conserva el original.'); }
  return parseEnvelope(parsed);
}
function aad(value: Envelope): Uint8Array<ArrayBuffer> {
  // Canonical order authenticates version, KDF, salt, identity and revision as well as ciphertext.
  return encoder.encode(JSON.stringify({
    format: value.format, version: value.version, schemaVersion: value.schemaVersion,
    cipher: value.cipher, kdf: value.kdf, iterations: value.iterations,
    vaultId: value.vaultId, revision: value.revision, createdAt: value.createdAt,
    savedAt: value.savedAt, salt: value.salt, iv: value.iv,
  }));
}
function checkPassword(password: string, creating = false): void {
  if (typeof password !== 'string' || !password.trim() || password.length > 1024) throw vaultError('Introduce una contraseña válida de hasta 1024 caracteres.');
  if (creating && password.length < 12) throw vaultError('Usa una contraseña de al menos 12 caracteres. Guárdala fuera de este dispositivo; no se puede recuperar.');
}
async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
  checkPassword(password);
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: fromBase64(salt), iterations: ITERATIONS, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function decrypt(envelope: Envelope, key: CryptoKey): Promise<FinanceState> {
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(envelope.iv), additionalData: aad(envelope), tagLength: 128 }, key, fromBase64(envelope.ciphertext));
  } catch { throw vaultError('Contraseña incorrecta o respaldo dañado. Los datos no se modificaron.'); }
  try {
    return validateState(JSON.parse(decoder.decode(plaintext)));
  } catch { throw vaultError('El contenido del respaldo es incompatible o contiene datos inválidos. No se modificó la bóveda.'); }
  finally { new Uint8Array(plaintext).fill(0); }
}
async function encrypt(state: FinanceState, key: CryptoKey, metadata: Omit<Envelope, 'iv' | 'ciphertext'>): Promise<Envelope> {
  if (!Number.isSafeInteger(metadata.revision) || metadata.revision < 1) throw vaultError('No se puede asignar una revisión segura. Conserva tu respaldo.');
  const plaintext = encoder.encode(JSON.stringify(validateState(state)));
  // Reserve enough room for base64 expansion and metadata to keep every export importable.
  if (plaintext.byteLength * 4 / 3 + 2048 >= MAX_BYTES) throw vaultError('La bóveda se acerca al límite de 20 MB. Exporta un respaldo antes de continuar.');
  const envelope: Envelope = { ...metadata, iv: base64(crypto.getRandomValues(new Uint8Array(12))), ciphertext: '' };
  try {
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: fromBase64(envelope.iv), additionalData: aad(envelope), tagLength: 128 }, key, plaintext);
    envelope.ciphertext = base64(new Uint8Array(encrypted));
    return envelope;
  } finally { plaintext.fill(0); }
}

/** Local encrypted storage. Exported backups are files, not cloud synchronization.
 * All mutations are atomic and compare the last observed revision. No automatic resets exist.
 * restoreBackup on an empty device creates a fresh vault protected by the backup password;
 * on an existing device it requires an unlocked session and retains that session's password.
 */
export class VaultRepo {
  private dbPromise?: Promise<IDBDatabase>;
  private key: CryptoKey | null = null;
  private envelope: Envelope | null = null;
  private epoch = 0;
  private writing = false;
  private stale = false;
  private channel?: BroadcastChannel;
  private readonly instance = crypto.randomUUID();
  private readonly options: VaultOptions;

  constructor(options: VaultOptions = {}) {
    this.options = options;
    if (options.broadcast !== false && typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(`${DB_NAME}:changes`);
      this.channel.onmessage = (event: MessageEvent) => {
        if (event.data?.sender !== this.instance && event.data?.type === 'committed') {
          this.stale = true;
          this.options.onExternalChange?.();
        }
      };
    }
  }
  get revision(): number { return this.envelope?.revision ?? 0; }
  get unlocked(): boolean { return this.key !== null && this.envelope !== null; }

  private db(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const factory = this.options.indexedDB ?? globalThis.indexedDB;
      if (!factory || !globalThis.crypto?.subtle) { reject(vaultError('Este navegador no permite almacenamiento seguro. Abre la aplicación mediante HTTPS en Safari actualizado.')); return; }
      const request = factory.open(DB_NAME, 1);
      let failed = false;
      request.onupgradeneeded = event => {
        // Only initialize a truly new database. Never rebuild or clear an existing store.
        if ((event as IDBVersionChangeEvent).oldVersion !== 0) { request.transaction?.abort(); return; }
        request.result.createObjectStore('records');
        request.result.createObjectStore('recovery', { keyPath: 'id' });
      };
      request.onerror = () => { failed = true; reject(storageError(request.error)); };
      request.onblocked = () => { failed = true; reject(vaultError('Cierra las otras pestañas de Gimo para abrir la bóveda. No se borraron datos.')); };
      request.onsuccess = () => {
        const db = request.result;
        if (failed) { db.close(); return; }
        if (!db.objectStoreNames.contains('records') || !db.objectStoreNames.contains('recovery')) { db.close(); reject(vaultError('La estructura del almacenamiento está dañada. Conserva los datos y utiliza un respaldo.')); return; }
        db.onversionchange = () => { db.close(); this.lock(); this.dbPromise = undefined; this.options.onExternalChange?.(); };
        resolve(db);
      };
    }).catch(error => { this.dbPromise = undefined; throw error; });
    return this.dbPromise;
  }
  private async readMain(): Promise<unknown> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readonly');
      const request = tx.objectStore('records').get('main');
      let result: unknown;
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(storageError(tx.error));
      tx.onerror = () => { /* onabort reports the actual outcome. */ };
    });
  }
  private async recoveryRecords(): Promise<RecoveryRecord[]> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('recovery', 'readonly');
      const request = tx.objectStore('recovery').getAll();
      let result: RecoveryRecord[] = [];
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(storageError(tx.error));
    });
  }
  private checkSession(): { key: CryptoKey; envelope: Envelope; epoch: number } {
    if (!this.key || !this.envelope) throw vaultError('Desbloquea la bóveda para continuar.');
    if (this.stale) throw vaultError('Otra pestaña cambió los datos. Bloquea y vuelve a desbloquear para cargar la última versión antes de guardar.');
    return { key: this.key, envelope: this.envelope, epoch: this.epoch };
  }
  private assertEpoch(epoch: number): void { if (this.epoch !== epoch) throw vaultError('La bóveda se bloqueó. Desbloquéala y vuelve a intentarlo.'); }
  private beginWrite(): void {
    if (this.writing) throw vaultError('Hay un guardado en curso. Espera a que termine antes de continuar.');
    this.writing = true;
  }

  private async commit(next: Envelope, expected: unknown, reason: RecoveryRecord['reason'] = 'previous'): Promise<void> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction;
      try { tx = db.transaction(['records', 'recovery'], 'readwrite', { durability: 'strict' }); }
      catch (error) {
        if (error instanceof TypeError) tx = db.transaction(['records', 'recovery'], 'readwrite');
        else { reject(storageError(error)); return; }
      }
      let failure: Error | undefined;
      const fail = (error: Error) => { failure = error; tx.abort(); };
      tx.oncomplete = () => {
        this.channel?.postMessage({ type: 'committed', sender: this.instance });
        resolve();
      };
      tx.onabort = () => reject(failure ?? storageError(tx.error));
      tx.onerror = () => { /* Never resolve until the entire transaction commits. */ };
      const records = tx.objectStore('records');
      const recovery = tx.objectStore('recovery');
      const read = records.get('main');
      read.onsuccess = () => {
        const current = read.result as unknown;
        // Compare full authenticated envelope as well as its revision. This also protects recovery of a damaged main record.
        if (JSON.stringify(current) !== JSON.stringify(expected)) {
          this.stale = true;
          fail(vaultError('Conflicto: otra pestaña guardó cambios. No se sobrescribió nada. Bloquea y vuelve a desbloquear la bóveda.'));
          return;
        }
        const historyRequest = recovery.getAll();
        historyRequest.onsuccess = () => {
          const history = historyRequest.result as RecoveryRecord[];
          if (current === undefined && history.length && reason !== 'before-restore') { fail(vaultError('Existen copias recuperables sin bóveda principal. Recupera una copia; no se creará una bóveda encima.')); return; }
          try {
            let restoredFrom: string | undefined;
            if (current !== undefined) {
              const previous: RecoveryRecord = { id: crypto.randomUUID(), savedAt: (current as Envelope)?.savedAt ?? new Date().toISOString(), recordedAt: new Date().toISOString(), reason, envelope: current };
              recovery.add(previous);
              history.push(previous);
              if (reason === 'before-restore') restoredFrom = previous.id;
            }
            records.put(next, 'main');
            // Keep twelve revisions and pin the latest pre-restore snapshot until another restore takes its place.
            const ordered = history.sort(newestRecovery);
            const pinned = restoredFrom ?? ordered.find(item => item.reason === 'before-restore')?.id;
            const keep = new Set(ordered.filter(item => item.id !== pinned).slice(0, pinned ? 11 : 12).map(item => item.id));
            if (pinned) keep.add(pinned);
            for (const item of ordered) if (!keep.has(item.id)) recovery.delete(item.id);
          } catch (error) { fail(storageError(error)); }
        };
      };
    });
  }

  async exists(): Promise<boolean> {
    return (await this.readMain()) !== undefined || (await this.recoveryRecords()).length > 0;
  }
  async create(password: string, state: FinanceState): Promise<void> {
    checkPassword(password, true);
    const checked = validateState(state);
    this.beginWrite();
    const epoch = this.epoch;
    try {
      if (await this.exists()) throw vaultError('Ya existe una bóveda. Desbloquéala o restaura explícitamente un respaldo; no se sobrescribió.');
      const salt = base64(crypto.getRandomValues(new Uint8Array(16)));
      const key = await deriveKey(password, salt);
      const now = new Date().toISOString();
      const envelope = await encrypt(checked, key, { format: 'orthomax-gina-encrypted', version: 1, schemaVersion: 1, cipher: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, vaultId: crypto.randomUUID(), revision: 1, createdAt: now, savedAt: now, salt });
      this.assertEpoch(epoch);
      await this.commit(envelope, undefined);
      if (this.epoch === epoch) { this.key = key; this.envelope = envelope; this.stale = false; }
    } finally { this.writing = false; }
  }
  async unlock(password: string): Promise<FinanceState> {
    const epoch = this.epoch;
    const raw = await this.readMain();
    if (raw === undefined) throw vaultError('No se encontró la bóveda principal. Puedes importar un respaldo o recuperar una copia disponible.');
    const envelope = parseEnvelope(raw);
    const key = await deriveKey(password, envelope.salt);
    const state = await decrypt(envelope, key);
    this.assertEpoch(epoch);
    // A second tab may have written during the password derivation.
    if (JSON.stringify(await this.readMain()) !== JSON.stringify(envelope)) throw vaultError('Los datos cambiaron mientras se desbloqueaba. Vuelve a introducir tu contraseña.');
    this.assertEpoch(epoch);
    this.key = key;
    this.envelope = envelope;
    this.stale = false;
    return state;
  }
  async save(state: FinanceState): Promise<void> {
    const session = this.checkSession();
    const checked = validateState(state);
    this.beginWrite();
    try {
      if (session.envelope.revision >= Number.MAX_SAFE_INTEGER) throw vaultError('Se alcanzó el límite de revisiones. Conserva y exporta tu respaldo.');
      const next = await encrypt(checked, session.key, { ...session.envelope, revision: session.envelope.revision + 1, savedAt: new Date().toISOString() });
      this.assertEpoch(session.epoch);
      await this.commit(next, session.envelope);
      if (this.epoch === session.epoch) this.envelope = next;
    } finally { this.writing = false; }
  }
  lock(): void { this.key = null; this.envelope = null; this.epoch++; }
  close(): void { this.lock(); this.channel?.close(); this.channel = undefined; void this.dbPromise?.then(db => db.close()).catch(() => undefined); this.dbPromise = undefined; }

  async exportBackup(): Promise<string> {
    const session = this.checkSession();
    const current = parseEnvelope(await this.readMain());
    if (JSON.stringify(current) !== JSON.stringify(session.envelope)) throw vaultError('Hay una revisión más reciente. Desbloquea de nuevo antes de exportar.');
    await decrypt(current, session.key);
    // Verification may yield to another tab or a local save. Do not label an older export as current.
    if (JSON.stringify(await this.readMain()) !== JSON.stringify(current)) throw vaultError('Los datos cambiaron mientras se preparaba el respaldo. Prepara uno nuevo.');
    this.assertEpoch(session.epoch);
    return JSON.stringify(current);
  }
  async previewBackup(text: string, password: string): Promise<FinanceState> {
    const backup = parseBackup(text);
    return decrypt(backup, await deriveKey(password, backup.salt));
  }
  async restoreBackup(text: string, password: string): Promise<FinanceState> {
    const state = await this.previewBackup(text, password);
    if (!(await this.exists())) { await this.create(password, state); return state; }
    const session = this.checkSession();
    this.beginWrite();
    try {
      const next = await encrypt(state, session.key, { ...session.envelope, revision: session.envelope.revision + 1, savedAt: new Date().toISOString() });
      this.assertEpoch(session.epoch);
      await this.commit(next, session.envelope, 'before-restore');
      if (this.epoch === session.epoch) this.envelope = next;
      return state;
    } finally { this.writing = false; }
  }
  async listRecovery(): Promise<{ id: string; savedAt: string }[]> {
    const records = await this.recoveryRecords();
    return records.sort(newestRecovery).map(({ id, savedAt }) => ({ id, savedAt }));
  }
  async recover(id: string, password: string): Promise<FinanceState> {
    const record = (await this.recoveryRecords()).find(item => item.id === id);
    if (!record) throw vaultError('No se encontró esa copia de recuperación.');
    const backup = parseEnvelope(record.envelope);
    const backupKey = await deriveKey(password, backup.salt);
    const state = await decrypt(backup, backupKey);
    if (this.unlocked) return this.restoreBackup(JSON.stringify(backup), password);
    // Explicit recovery can repair a corrupt main envelope even when normal unlock is impossible.
    this.beginWrite();
    const epoch = this.epoch;
    try {
      const current = await this.readMain();
      const revision = (current as Partial<Envelope> | undefined)?.revision;
      const nextRevision = Math.max(Number.isSafeInteger(revision) && (revision as number) > 0 ? revision as number : 0, backup.revision) + 1;
      if (!Number.isSafeInteger(nextRevision)) throw vaultError('No se puede asignar una revisión segura. Conserva tu respaldo.');
      const next = await encrypt(state, backupKey, { ...backup, revision: nextRevision, savedAt: new Date().toISOString() });
      this.assertEpoch(epoch);
      await this.commit(next, current, 'before-restore');
      if (this.epoch === epoch) { this.key = backupKey; this.envelope = next; this.stale = false; }
      return state;
    } finally { this.writing = false; }
  }
  async requestPersistence(): Promise<PersistenceInfo> {
    if (typeof navigator === 'undefined' || !navigator.storage) return { supported: false, persisted: false };
    const storage = navigator.storage;
    let persisted = false;
    let estimate: StorageEstimate = {};
    try { persisted = await storage.persisted?.() ?? false; if (!persisted && storage.persist) persisted = await storage.persist(); } catch { /* Denial does not mean the already saved data was erased. */ }
    try { estimate = await storage.estimate?.() ?? {}; } catch { /* Estimate is optional. */ }
    return { supported: typeof storage.persist === 'function', persisted, usage: estimate.usage, quota: estimate.quota };
  }
}
