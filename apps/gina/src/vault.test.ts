import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { emptyState } from './domain';
import { VaultRepo } from './vault';
import type { FinanceState } from './types';

const PASSWORD = 'Mi contraseña privada 2026';
const OTHER_PASSWORD = 'Otra contraseña privada 2026';
const DB = 'orthomax-gina-vault';
let factory: IDBFactory;
let repos: VaultRepo[];
function repo(target = factory): VaultRepo {
  const value = new VaultRepo({ indexedDB: target, broadcast: false });
  repos.push(value);
  return value;
}
function state(name = 'Gina — información privada'): FinanceState {
  const value = emptyState();
  value.profile.name = name;
  return value;
}
async function connect(target = factory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = target.open(DB, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function readRaw(): Promise<Record<string, unknown>> {
  const db = await connect();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readonly');
    const request = tx.objectStore('records').get('main');
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
async function writeRaw(raw: unknown): Promise<void> {
  const db = await connect();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    tx.objectStore('records').put(raw, 'main');
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

beforeEach(() => { factory = new IDBFactory(); repos = []; });
afterEach(() => { vi.restoreAllMocks(); repos.forEach(value => value.close()); });

describe('VaultRepo: cifrado y conservación', () => {
  it('crea, cifra y desbloquea sin almacenar la contraseña ni información legible', async () => {
    const vault = repo();
    expect(await vault.exists()).toBe(false);
    const original = state();
    await vault.create(PASSWORD, original);
    expect(vault.unlocked).toBe(true);
    expect(vault.revision).toBe(1);
    const raw = await readRaw();
    const serialized = JSON.stringify(raw);
    expect(raw.iterations).toBe(600_000);
    expect(raw.cipher).toBe('AES-256-GCM');
    expect(serialized).not.toContain(PASSWORD);
    expect(serialized).not.toContain(original.profile.name);
    expect(serialized).not.toContain('movements');
    vault.lock();
    expect(vault.unlocked).toBe(false);
    await expect(vault.exportBackup()).rejects.toThrow('Desbloquea');
    expect(await vault.unlock(PASSWORD)).toEqual(original);
    expect(await vault.exists()).toBe(true);
  });

  it('rechaza contraseña incorrecta sin reemplazar los datos', async () => {
    const vault = repo();
    await vault.create(PASSWORD, state());
    const before = await readRaw();
    vault.lock();
    await expect(vault.unlock(OTHER_PASSWORD)).rejects.toThrow('Contraseña incorrecta');
    expect(vault.unlocked).toBe(false);
    expect(await readRaw()).toEqual(before);
    expect((await vault.unlock(PASSWORD)).profile.name).toBe(state().profile.name);
  });

  it('nunca crea una bóveda encima de otra y exige contraseña fuerte', async () => {
    const vault = repo();
    await expect(vault.create('corta', state())).rejects.toThrow('12 caracteres');
    expect(await vault.exists()).toBe(false);
    await vault.create(PASSWORD, state());
    const before = await readRaw();
    await expect(repo().create(OTHER_PASSWORD, state('Reemplazo'))).rejects.toThrow('Ya existe');
    expect(await readRaw()).toEqual(before);
  });

  it('cada guardado cambia IV y sólo confirma después de la transacción', async () => {
    const vault = repo();
    await vault.create(PASSWORD, state());
    const before = await readRaw();
    await vault.save(state('Cambio válido'));
    const after = await readRaw();
    expect(after.iv).not.toEqual(before.iv);
    expect(after.salt).toEqual(before.salt);
    expect(vault.revision).toBe(2);
    expect(after.revision).toBe(2);
    expect(await vault.listRecovery()).toHaveLength(1);
    vault.lock();
    expect((await vault.unlock(PASSWORD)).profile.name).toBe('Cambio válido');
  });

  it('un fallo de escritura revierte tanto main como recuperación', async () => {
    const vault = repo();
    await vault.create(PASSWORD, state());
    const before = await readRaw();
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof originalPut>) {
      if (this.name === 'records') throw new DOMException('Simulated quota', 'QuotaExceededError');
      return originalPut.apply(this, args);
    });
    await expect(vault.save(state('No debe persistir'))).rejects.toThrow('espacio');
    vi.restoreAllMocks();
    expect(await readRaw()).toEqual(before);
    expect(await vault.listRecovery()).toHaveLength(0);
    expect(vault.revision).toBe(1);
    vault.lock();
    expect(await vault.unlock(PASSWORD)).toEqual(state());
  });

  it('un aborto tardío no se confunde con un guardado exitoso', async () => {
    const vault = repo();
    await vault.create(PASSWORD, state());
    const before = await readRaw();
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof originalPut>) {
      const request = originalPut.apply(this, args);
      if (this.name === 'records') request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(vault.save(state('Abortado'))).rejects.toThrow('No se pudo');
    vi.restoreAllMocks();
    expect(await readRaw()).toEqual(before);
    expect(await vault.listRecovery()).toHaveLength(0);
    expect(vault.revision).toBe(1);
  });

  it('impide sobrescritura de cambios guardados desde otra pestaña', async () => {
    const first = repo();
    const second = repo();
    await first.create(PASSWORD, state());
    await second.unlock(PASSWORD);
    await first.save(state('Cambio primera pestaña'));
    await expect(second.save(state('Cambio obsoleto'))).rejects.toThrow('Conflicto');
    second.lock();
    expect((await second.unlock(PASSWORD)).profile.name).toBe('Cambio primera pestaña');
    await second.save(state('Cambio recargado'));
    expect(second.revision).toBe(3);
  });

  it('autentica metadatos, sal y contenido y rechaza versiones futuras', async () => {
    const vault = repo();
    await vault.create(PASSWORD, state());
    const backup = JSON.parse(await vault.exportBackup());
    await expect(vault.previewBackup(JSON.stringify({ ...backup, revision: 99 }), PASSWORD)).rejects.toThrow('dañado');
    await expect(vault.previewBackup(JSON.stringify({ ...backup, salt: 'AQEBAQEBAQEBAQEBAQEBAQ==' }), PASSWORD)).rejects.toThrow('dañado');
    const tampered = { ...backup, ciphertext: (backup.ciphertext[0] === 'A' ? 'B' : 'A') + backup.ciphertext.slice(1) };
    await expect(vault.previewBackup(JSON.stringify(tampered), PASSWORD)).rejects.toThrow('dañado');
    await expect(vault.previewBackup(JSON.stringify({ ...backup, schemaVersion: 2 }), PASSWORD)).rejects.toThrow('Versión');
    await expect(vault.previewBackup(JSON.stringify({ ...backup, iterations: 1_000_000_000 }), PASSWORD)).rejects.toThrow('parámetros');
    await expect(vault.previewBackup('x'.repeat(20 * 1024 * 1024), PASSWORD)).rejects.toThrow('20 MB');
    expect(await readRaw()).toEqual(backup);
  });

  it('previsualizar y cancelar no modifica la bóveda; restaurar guarda copia anterior', async () => {
    const vault = repo();
    await vault.create(PASSWORD, state('Origen de respaldo'));
    const backup = await vault.exportBackup();
    await vault.save(state('Estado antes de restaurar'));
    const beforePreview = await readRaw();
    expect((await vault.previewBackup(backup, PASSWORD)).profile.name).toBe('Origen de respaldo');
    expect(await readRaw()).toEqual(beforePreview);
    await expect(vault.restoreBackup(backup, OTHER_PASSWORD)).rejects.toThrow('Contraseña');
    expect(await readRaw()).toEqual(beforePreview);
    expect((await vault.restoreBackup(backup, PASSWORD)).profile.name).toBe('Origen de respaldo');
    expect(vault.revision).toBe(3);
    const recovery = await vault.listRecovery();
    expect(recovery).toHaveLength(2);
    expect((await vault.recover(recovery[0].id, PASSWORD)).profile.name).toBe('Estado antes de restaurar');
  });

  it('rechaza contenido grande alterado sin agotar la pila del validador base64', async () => {
    const vault = repo();
    await vault.create(PASSWORD, state());
    const envelope = JSON.parse(await vault.exportBackup());
    envelope.ciphertext = 'A'.repeat(4 * 1024 * 1024);
    await expect(vault.previewBackup(JSON.stringify(envelope), PASSWORD)).rejects.toThrow('Contraseña incorrecta o respaldo dañado');
  });

  it('no ofrece como actual un respaldo que quedó viejo durante su verificación', async () => {
    const vault = repo();
    await vault.create(PASSWORD, state('Antes'));
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const originalDecrypt = crypto.subtle.decrypt.bind(crypto.subtle);
    const decryptSpy = vi.spyOn(crypto.subtle, 'decrypt').mockImplementationOnce(async (...args) => {
      const plaintext = await originalDecrypt(...args);
      await barrier;
      return plaintext;
    });
    const exporting = vault.exportBackup();
    await vi.waitFor(() => expect(decryptSpy).toHaveBeenCalledOnce());
    await vault.save(state('Cambio mientras se verificaba'));
    release();
    await expect(exporting).rejects.toThrow('cambiaron mientras');
    vi.restoreAllMocks();
    vault.lock();
    expect((await vault.unlock(PASSWORD)).profile.name).toBe('Cambio mientras se verificaba');
  });

  it('importa en dispositivo vacío y mantiene contraseña actual en dispositivo existente', async () => {
    const source = repo();
    await source.create(PASSWORD, state('De otro dispositivo'));
    const backup = await source.exportBackup();
    const target = repo(new IDBFactory());
    expect((await target.restoreBackup(backup, PASSWORD)).profile.name).toBe('De otro dispositivo');
    target.lock();
    expect((await target.unlock(PASSWORD)).profile.name).toBe('De otro dispositivo');
    const existing = repo(new IDBFactory());
    await existing.create(OTHER_PASSWORD, state('Contraseña propia'));
    await existing.restoreBackup(backup, PASSWORD);
    existing.lock();
    await expect(existing.unlock(PASSWORD)).rejects.toThrow('Contraseña incorrecta');
    expect((await existing.unlock(OTHER_PASSWORD)).profile.name).toBe('De otro dispositivo');
  });

  it('conserva 12 copias y protege la última anterior a restaurar', async () => {
    const vault = repo();
    await vault.create(PASSWORD, state('Inicial'));
    const backup = await vault.exportBackup();
    await vault.save(state('Antes de restaurar: preservar'));
    await vault.restoreBackup(backup, PASSWORD);
    const pinnedId = (await vault.listRecovery())[0].id;
    for (let i = 0; i < 15; i++) await vault.save(state(`Posterior ${i}`));
    const records = await vault.listRecovery();
    expect(records).toHaveLength(12);
    expect(records.some(item => item.id === pinnedId)).toBe(true);
    expect((await vault.recover(pinnedId, PASSWORD)).profile.name).toBe('Antes de restaurar: preservar');
  });

  it('recupera main corrupto sin reset y con contraseña de la copia', async () => {
    const vault = repo();
    await vault.create(PASSWORD, state('Versión recuperable'));
    await vault.save(state('Versión dañada'));
    const copy = (await vault.listRecovery())[0];
    const corrupt = await readRaw();
    corrupt.ciphertext = 'AAAA';
    await writeRaw(corrupt);
    vault.lock();
    await expect(vault.unlock(PASSWORD)).rejects.toThrow('cifrado');
    expect((await vault.recover(copy.id, PASSWORD)).profile.name).toBe('Versión recuperable');
    vault.lock();
    expect((await vault.unlock(PASSWORD)).profile.name).toBe('Versión recuperable');
  });

  it('una actualización/reapertura conserva la misma base de datos', async () => {
    const original = repo();
    await original.create(PASSWORD, state('Persistente tras actualización'));
    original.close();
    const afterUpdate = repo();
    expect(await afterUpdate.exists()).toBe(true);
    expect((await afterUpdate.unlock(PASSWORD)).profile.name).toBe('Persistente tras actualización');
  });

  it('si falta main conserva las copias y exige recuperación explícita', async () => {
    const vault = repo();
    await vault.create(PASSWORD, state('Copia recuperable aunque falte main'));
    await vault.save(state('Principal que desapareció'));
    const id = (await vault.listRecovery())[0].id;
    const db = await connect();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite');
      tx.objectStore('records').delete('main');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
    vault.lock();
    expect(await vault.exists()).toBe(true);
    await expect(vault.create(PASSWORD, state('No permitido'))).rejects.toThrow('Ya existe');
    expect((await vault.recover(id, PASSWORD)).profile.name).toBe('Copia recuperable aunque falte main');
    expect(vault.unlocked).toBe(true);
  });

  it('bloquear durante una derivación no vuelve a dejar la clave disponible', async () => {
    const vault = repo();
    await vault.create(PASSWORD, state());
    vault.lock();
    const pending = vault.unlock(PASSWORD);
    vault.lock();
    await expect(pending).rejects.toThrow('bloqueó');
    expect(vault.unlocked).toBe(false);
  });
});
