import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Archive, Download, FolderOpen, LockKeyhole, Share2, ShieldCheck } from 'lucide-react';
import { AccountForm } from './Forms';
import { Amount, Modal, SectionHead, movementLabels } from './components';
import { accountBalance, money, today, uid, validateState } from './domain';
import { download } from './exports';
import type { Account, Category, Favorite, FinanceState, Movement, Recurring, Source } from './types';
import type { PersistenceInfo, VaultRepo } from './vault';
import { version } from '../package.json';

interface SettingsProps {
  state: FinanceState;
  repo: VaultRepo;
  demo: boolean;
  offlineReady: boolean;
  onSave: (next: FinanceState) => Promise<void>;
  onLock: () => void;
  onRestored: (state: FinanceState) => void;
  onAccount: () => void;
  onRestore: () => void;
  onUseFavorite: (favorite: Partial<Movement>) => void;
}

const errorText = (error: unknown) => error instanceof Error ? error.message : 'No se pudo completar la operación. Tus datos anteriores se conservan.';
const dateTime = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('es-MX', { timeZone: 'America/Mazatlan', dateStyle: 'medium', timeStyle: 'short' }) : 'Fecha no disponible';
};
const appendAudit = (state: FinanceState, action: string, entityId: string) => ({
  ...state, audit: [...state.audit, { id: uid(), at: new Date().toISOString(), action, entityId }],
});

function favoriteMovement(favorite: Favorite): Partial<Movement> {
  return { type: favorite.type, amountCents: favorite.amountCents, date: today(), sourceId: favorite.sourceId, accountId: favorite.accountId,
    ...(favorite.toAccountId ? { toAccountId: favorite.toAccountId } : {}), categoryId: favorite.categoryId, note: favorite.note };
}
function nextMonth(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay), 12)).toISOString().slice(0, 10);
}

export function SettingsView(props: SettingsProps) {
  const { state, repo, demo, offlineReady, onSave, onLock, onRestored, onAccount, onRestore, onUseFavorite } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [prepared, setPrepared] = useState<{ text: string; file: File; revision: number } | null>(null);
  const [persistence, setPersistence] = useState<PersistenceInfo | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [recurringFavorite, setRecurringFavorite] = useState('');
  const [recurringDate, setRecurringDate] = useState(today());
  const lock = useRef(false);

  const run = async (work: () => Promise<void>) => {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await work(); return true; } catch (failure) { setError(errorText(failure)); return false; }
    finally { lock.current = false; setBusy(false); }
  };
  const save = async (next: FinanceState, action: string, entityId: string) => {
    await onSave(validateState(appendAudit(next, action, entityId)));
    setNotice(demo ? 'Cambios aplicados a la demostración.' : 'Cambios guardados de forma cifrada en este dispositivo.');
  };
  const backupStale = !!prepared && prepared.revision !== repo.revision;
  const requirePrepared = () => {
    if (!prepared || prepared.revision !== repo.revision) throw new Error('Los datos cambiaron. Prepara un respaldo nuevo antes de descargarlo o compartirlo.');
    return prepared;
  };
  const prepareBackup = () => void run(async () => {
    if (demo) throw new Error('Los datos de demostración no se exportan a la bóveda real.');
    // First prove a valid encrypted export can be generated, then record generation and include that date in the final file.
    const startingRevision = repo.revision;
    await repo.exportBackup();
    if (repo.revision !== startingRevision) throw new Error('Los datos cambiaron durante la preparación. Prepara un respaldo nuevo.');
    await onSave({ ...state, lastExportAt: new Date().toISOString() });
    const exportedRevision = repo.revision;
    const text = await repo.exportBackup();
    if (repo.revision !== exportedRevision) throw new Error('Hay cambios posteriores. Prepara de nuevo el respaldo para incluirlos.');
    const filename = `Gimo-${today()}-${new Date().toISOString().slice(11, 19).replaceAll(':', '')}.ginabackup`;
    const file = new File([text], filename, { type: 'application/json' });
    setPrepared({ text, file, revision: exportedRevision });
    setNotice('Respaldo preparado. Ahora descárgalo o usa Compartir para guardarlo en Archivos, iCloud Drive u otro lugar que elijas.');
  });
  const shareBackup = () => void run(async () => {
    const data = requirePrepared();
    if (!navigator.share || !navigator.canShare?.({ files: [data.file] })) throw new Error('Este navegador no permite compartir este archivo. Usa Descargar respaldo.');
    try { await navigator.share({ files: [data.file], title: 'Respaldo cifrado de Gimo' }); }
    catch (failure) { if (failure instanceof DOMException && failure.name === 'AbortError') { setNotice('Se cerró Compartir. El respaldo sigue preparado.'); return; } throw failure; }
    setNotice('El archivo se entregó a Compartir. Comprueba que quedó guardado en el destino que elegiste. La aplicación no puede verificar ese destino.');
  });

  return <div className="settings-grid">
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="success-note" role="status">{notice}</p>}
    <section className="card">
      <SectionHead title="Tus datos, a salvo contigo" subtitle="Guardado local cifrado y respaldo fuera del dispositivo." />
      <p>Los registros se guardan en este dispositivo. No hay sincronización ni copia automática en la nube. Una actualización de la app conserva la bóveda; borrar los datos del navegador, perder el teléfono o dañar su almacenamiento requiere un respaldo externo para recuperar la información.</p>
      <p className="hint">La contraseña no se puede recuperar. Guárdala en un lugar seguro fuera de este dispositivo. El archivo de respaldo también está cifrado y necesita su contraseña.</p>
      <p><strong>Último respaldo generado:</strong> {state.lastExportAt ? dateTime(state.lastExportAt) : 'Todavía no has generado uno.'}</p>
      <div className="form-actions">
        <button className="btn btn-primary" disabled={busy || demo} onClick={prepareBackup}><ShieldCheck size={18} />{busy ? 'Preparando…' : 'Preparar respaldo cifrado'}</button>
        <button className="btn btn-secondary" disabled={busy || demo} onClick={onRestore}><FolderOpen size={18} />Restaurar respaldo</button>
      </div>
      {prepared && <div className="backup-ready">
        <p className="hint">{backupStale ? 'Hay cambios posteriores. Prepara un respaldo nuevo.' : `Archivo listo: ${prepared.file.name}. No contiene datos financieros legibles.`}</p>
        <div className="form-actions">
          <button className="btn btn-secondary" disabled={busy || backupStale} onClick={() => void run(async () => { const data = requirePrepared(); download(data.text, data.file.name); setNotice('Descarga iniciada. Comprueba el archivo en Archivos o Descargas y conserva una copia fuera de este dispositivo.'); })}><Download size={17} />Descargar respaldo</button>
          <button className="btn btn-secondary" disabled={busy || backupStale} onClick={shareBackup}><Share2 size={17} />Compartir / Guardar en Archivos</button>
        </div>
      </div>}
      {demo && <p className="hint">Los respaldos y la recuperación están desactivados en esta demostración para mantenerla separada de tus registros reales.</p>}
      <details className="advanced-filters"><summary>Copias locales y protección del almacenamiento</summary>
        <p className="hint">La app conserva hasta doce versiones cifradas anteriores para resolver errores. Están en este mismo dispositivo: no sustituyen el respaldo externo.</p>
        <div className="form-actions">
          <button className="btn btn-secondary" disabled={busy || demo} onClick={() => setRecovery(true)}>Ver copias locales anteriores</button>
          <button className="btn btn-secondary" disabled={busy || demo} onClick={() => void run(async () => { setPersistence(await repo.requestPersistence()); })}>Solicitar conservación al navegador</button>
        </div>
        {persistence && <p className="hint" role="status">{persistence.persisted ? 'El navegador concedió almacenamiento persistente. Mantén de todos modos tu respaldo externo.' : persistence.supported ? 'El navegador no concedió almacenamiento persistente. Esto no borra lo guardado; conserva un respaldo externo actualizado.' : 'Este navegador no ofrece una solicitud de almacenamiento persistente. Conserva un respaldo externo actualizado.'}</p>}
      </details>
    </section>

    <ProfileSettings state={state} busy={busy} onSubmit={next => void run(() => save(next, 'Actualizar perfil y días de trabajo', 'profile'))} />

    <section className="card"><SectionHead title="Cuentas" subtitle="La actividad dice de dónde viene el dinero; la cuenta indica dónde está." action="Agregar cuenta" onAction={onAccount} />
      {state.accounts.length ? <div className="settings-list">{state.accounts.map(item => {
        let balance: number | null = null; try { balance = accountBalance(state, item.id); } catch { /* A future opening cut has no current balance yet. */ }
        return <div className="settings-row" key={item.id}><div><strong>{item.name}{item.archived ? ' · archivada' : ''}</strong><small>{item.area === 'mixed' ? 'Mixta · saldo solo en General' : item.area === 'clinic' ? 'Consultorio propio' : item.area === 'personal' ? 'Personal' : 'Colaboraciones'} · {item.spendable ? 'Incluida en dinero libre' : 'Fuera de dinero libre'}</small><small>Saldo actual: {balance === null ? 'Fecha de corte futura' : <Amount value={balance} />}</small></div><div className="form-actions"><button className="text-btn" disabled={busy} onClick={() => setAccount(item)}>Editar</button><button className="text-btn" disabled={busy} onClick={() => void run(async () => { if (!item.archived && !confirm(`¿Archivar «${item.name}»? Su saldo e historial se conservarán.`)) return; await save({ ...state, accounts: state.accounts.map(value => value.id === item.id ? { ...value, archived: !value.archived } : value) }, item.archived ? 'Reactivar cuenta' : 'Archivar cuenta', item.id); })}>{item.archived ? 'Reactivar' : 'Archivar'}</button></div></div>;
      })}</div> : <p className="hint">Agrega una cuenta de efectivo o banco para registrar tus primeros movimientos.</p>}
    </section>

    <CatalogSettings state={state} busy={busy} kind="sources" onSave={(next, action, id) => run(() => save(next, action, id))} />
    <CatalogSettings state={state} busy={busy} kind="categories" onSave={(next, action, id) => run(() => save(next, action, id))} />

    <section className="card"><SectionHead title="Tus registros frecuentes" subtitle="Abre una plantilla y confirma importe y fecha antes de registrar." />
      {state.favorites.length ? <div className="settings-list">{state.favorites.map(favorite => <div className="settings-row" key={favorite.id}><div><strong>{favorite.title}</strong><small>{movementLabels[favorite.type]} · {state.sources.find(item => item.id === favorite.sourceId)?.name} · <Amount value={favorite.amountCents} /></small></div><div className="form-actions"><button className="text-btn" onClick={() => onUseFavorite(favoriteMovement(favorite))} disabled={busy}>Usar</button><button className="text-btn" disabled={busy} onClick={() => void run(async () => { if (!confirm('¿Quitar este favorito? Los movimientos ya registrados se conservan.')) return; await save({ ...state, favorites: state.favorites.filter(item => item.id !== favorite.id) }, 'Quitar favorito', favorite.id); })}>Quitar</button></div></div>)}</div> : <p className="hint">Abre un movimiento y elige “Guardar como favorito” para reutilizar sus datos.</p>}
    </section>

    <section className="card"><SectionHead title="Recordatorios mensuales" subtitle="Una sugerencia nunca se convierte automáticamente en ingreso o gasto." />
      {state.recurring.filter(item => !item.archived).map(item => <div className="settings-row" key={item.id}><div><strong>{item.title}</strong><small>Próxima revisión: {item.nextDate}{item.nextDate <= today() ? ' · por revisar' : ''}</small><small><Amount value={item.amountCents} /> · {movementLabels[item.type]}</small></div><div className="form-actions"><button className="btn btn-secondary" disabled={busy} onClick={() => onUseFavorite(favoriteMovement(item))}>Preparar registro</button><button className="text-btn" disabled={busy} onClick={() => void run(async () => { const nextDate = nextMonth(item.nextDate); await save({ ...state, recurring: state.recurring.map(value => value.id === item.id ? { ...value, nextDate } : value) }, 'Revisar recordatorio mensual sin registrar dinero', item.id); })}>He revisado este recordatorio</button><button className="text-btn" disabled={busy} onClick={() => void run(async () => { await save({ ...state, recurring: state.recurring.map(value => value.id === item.id ? { ...value, archived: true } : value) }, 'Archivar recordatorio', item.id); })}><Archive size={15} />Archivar</button></div></div>)}
      <p className="hint">“Preparar registro” abre el formulario y requiere guardar para registrar dinero. “He revisado este recordatorio” mueve su fecha un mes; no guarda un movimiento ni confirma un cobro.</p>
      {state.favorites.length ? <form onSubmit={event => { event.preventDefault(); void run(async () => { const favorite = state.favorites.find(item => item.id === recurringFavorite); if (!favorite) throw new Error('Selecciona un favorito.'); const recurring: Recurring = { ...favorite, id: uid(), nextDate: recurringDate, frequency: 'monthly', archived: false }; await save({ ...state, recurring: [...state.recurring, recurring] }, 'Crear recordatorio mensual', recurring.id); setRecurringFavorite(''); }); }}><div className="form-grid"><label className="field"><span>Crear desde favorito</span><select required value={recurringFavorite} onChange={event => setRecurringFavorite(event.target.value)} disabled={busy}><option value="">Selecciona un favorito</option>{state.favorites.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className="field"><span>Primera fecha de revisión</span><input type="date" required value={recurringDate} onChange={event => setRecurringDate(event.target.value)} disabled={busy} /></label></div><button className="btn btn-secondary" disabled={busy} type="submit">Crear recordatorio mensual</button></form> : <p className="hint">Crea primero un favorito para convertirlo en un recordatorio.</p>}
    </section>

    <section className="card"><SectionHead title="Tu app en el iPhone" subtitle={offlineReady ? 'Recursos disponibles para abrir sin conexión.' : 'Completa la primera carga con conexión antes de usarla sin internet.'} />
      <ol className="help-steps"><li>Abre la dirección de Gimo en Safari.</li><li>Abre Compartir y elige “Agregar a inicio”. Si no aparece, revisa las acciones del menú.</li><li>Confirma el nombre y pulsa Agregar. Si aparece la opción “Abrir como app web”, actívala.</li><li>Abre el nuevo icono con conexión y comprueba después que puedes abrirlo en modo avión.</li></ol>
      <p className="hint">Los nombres del menú pueden variar con iOS. Safari, la app instalada y otro dispositivo no deben asumirse como la misma bóveda. Usa el icono elegido como acceso principal y verifica tus registros antes de continuar. Para trasladarlos, exporta y restaura el respaldo; la importación reemplaza, no sincroniza.</p>
      <p className="hint">Antes de actualizar, termina o guarda tu borrador. Las actualizaciones reemplazan recursos de la aplicación y no eliminan la base de datos. Mantén un respaldo externo al día.</p>
      <button className="btn btn-secondary" onClick={onLock}><LockKeyhole size={17} />{demo ? 'Salir de la demostración' : 'Bloquear mi bóveda'}</button>
    </section>

    <section className="card"><SectionHead title="Actividad y versión" subtitle={`Gimo ${version} · Dra. Gina`} />
      <p className="hint">Control administrativo en MXN · Fechas de La Paz, B.C.S. · Tus registros no se envían a clínicas ni se publican en la web.</p>
      <details><summary>Últimos cambios guardados</summary>{state.audit.length ? <ul className="audit-list">{state.audit.slice(-30).reverse().map(item => <li key={item.id}><strong>{item.action}</strong><small>{dateTime(item.at)}</small></li>)}</ul> : <p className="hint">Los cambios aparecerán aquí al empezar a usar tu bóveda.</p>}</details>
    </section>

    {account && <Modal title="Editar cuenta" onClose={() => setAccount(null)}><AccountForm state={state} initial={account} onSave={onSave} onClose={() => setAccount(null)} /></Modal>}
    {recovery && !demo && <Modal title="Recuperar una copia local" onClose={() => setRecovery(false)}><LocalRecovery repo={repo} onRestored={next => { setRecovery(false); setPrepared(null); onRestored(next); }} /></Modal>}
  </div>;
}

function ProfileSettings({ state, busy, onSubmit }: { state: FinanceState; busy: boolean; onSubmit: (state: FinanceState) => void }) {
  const [name, setName] = useState(state.profile.name);
  const [mode, setMode] = useState(state.profile.orthomaxMode);
  const [days, setDays] = useState(state.profile.workDays);
  useEffect(() => { setName(state.profile.name); setMode(state.profile.orthomaxMode); setDays(state.profile.workDays); }, [state.profile.name, state.profile.orthomaxMode, state.profile.workDays.join(',')]);
  const weekdays = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']] as const;
  return <section className="card"><SectionHead title="Hecha a tu medida" subtitle="Tu actividad y tus días de trabajo." /><form onSubmit={event => { event.preventDefault(); onSubmit({ ...state, profile: { ...state.profile, name: name.trim(), orthomaxMode: mode, workDays: days } }); }}><div className="form-grid"><label className="field"><span>Tu nombre</span><input required maxLength={100} autoComplete="name" value={name} onChange={event => setName(event.target.value)} disabled={busy} /></label><label className="field"><span>Qué representa Orthomax</span><select value={mode} onChange={event => setMode(event.target.value as typeof mode)} disabled={busy}><option value="clinic">Actividad completa del consultorio</option><option value="fees">Solo mis honorarios</option></select></label></div><p className="hint">En Secom y las otras colaboraciones registra únicamente los honorarios que te corresponden.</p><fieldset className="workdays"><legend>Días de trabajo para calcular el ritmo de tus metas</legend>{weekdays.map(([number, label]) => <label key={number}><input type="checkbox" checked={days.includes(number)} onChange={event => setDays(event.target.checked ? [...days, number].sort() : days.filter(day => day !== number))} disabled={busy} />{label}</label>)}</fieldset><div className="form-actions"><button className="btn btn-primary" type="submit" disabled={busy}>Guardar preferencias</button></div></form></section>;
}

function CatalogSettings({ state, busy, kind, onSave }: { state: FinanceState; busy: boolean; kind: 'sources' | 'categories'; onSave: (next: FinanceState, action: string, id: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState('');
  const [name, setName] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<Category['type']>('expense');
  const [localError, setLocalError] = useState('');
  const items: (Source | Category)[] = kind === 'sources' ? state.sources : state.categories;
  const replace = (id: string, values: { name?: string; archived?: boolean }) => kind === 'sources' ? { ...state, sources: state.sources.map(item => item.id === id ? { ...item, ...values } : item) } : { ...state, categories: state.categories.map(item => item.id === id ? { ...item, ...values } : item) };
  const rename = async (event: FormEvent, item: Source | Category) => {
    event.preventDefault(); setLocalError('');
    if (!name.trim()) { setLocalError('Escribe un nombre.'); return; }
    const saved = await onSave(replace(item.id, { name: name.trim() }), kind === 'sources' ? 'Renombrar actividad' : 'Renombrar categoría', item.id);
    if (saved) setEditing('');
  };
  return <section className="card"><SectionHead title={kind === 'sources' ? 'Actividades y fuentes' : 'Categorías'} subtitle="Renombrar y archivar conserva los movimientos y su historial." />
    {localError && <p className="error" role="alert">{localError}</p>}
    <div className="settings-list">{items.map(item => <div className="settings-row" key={item.id}>{editing === item.id ? <form onSubmit={event => void rename(event, item)}><label className="field"><span>Nuevo nombre</span><input required maxLength={100} value={name} onChange={event => setName(event.target.value)} disabled={busy} /></label><div className="form-actions"><button type="submit" className="btn btn-secondary" disabled={busy}>Guardar nombre</button><button type="button" className="text-btn" disabled={busy} onClick={() => setEditing('')}>Cancelar</button></div></form> : <><div><strong>{item.name}{item.archived ? ' · archivada' : ''}</strong>{'type' in item && <small>{movementLabels[item.type]}</small>}</div><div className="form-actions"><button className="text-btn" disabled={busy} onClick={() => { setEditing(item.id); setName(item.name); }}>Renombrar</button><button className="text-btn" disabled={busy} onClick={() => { if (!item.archived && !confirm(`¿Archivar «${item.name}»? No se eliminará ningún movimiento.`)) return; void onSave(replace(item.id, { archived: !item.archived }), item.archived ? 'Reactivar elemento de catálogo' : 'Archivar elemento de catálogo', item.id); }}>{item.archived ? 'Reactivar' : 'Archivar'}</button></div></>}</div>)}</div>
    {kind === 'categories' && <details className="advanced-filters"><summary>Crear una categoría</summary><form onSubmit={event => { event.preventDefault(); setLocalError(''); if (!newName.trim()) { setLocalError('Escribe el nombre de la categoría.'); return; } const category: Category = { id: uid(), name: newName.trim(), type: newType, archived: false }; void onSave({ ...state, categories: [...state.categories, category] }, 'Crear categoría', category.id).then(saved => { if (saved) setNewName(''); }); }}><div className="form-grid"><label className="field"><span>Nombre de categoría</span><input required maxLength={100} value={newName} onChange={event => setNewName(event.target.value)} disabled={busy} /></label><label className="field"><span>Tipo</span><select value={newType} onChange={event => setNewType(event.target.value as Category['type'])} disabled={busy}><option value="income">Ingreso</option><option value="expense">Gasto</option><option value="investment">Inversión en equipo o mejoras</option></select></label></div><button type="submit" className="btn btn-secondary" disabled={busy}>Crear categoría</button></form></details>}
  </section>;
}

function LocalRecovery({ repo, onRestored }: { repo: VaultRepo; onRestored: (state: FinanceState) => void }) {
  const [copies, setCopies] = useState<{ id: string; savedAt: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState('');
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const act = async (task: () => Promise<void>) => {
    if (locked.current) return; locked.current = true; setBusy(true); setError('');
    try { await task(); } catch (failure) { setError(errorText(failure)); } finally { locked.current = false; setBusy(false); }
  };
  return <div className="local-recovery"><p>Recupera una versión anterior de este dispositivo. Esto reemplaza el conjunto actual; los cambios posteriores a esa copia dejarán de mostrarse. Antes del reemplazo se conserva una copia recuperable del estado anterior.</p><p className="hint">También puedes usar esta opción si la bóveda principal no abre. Necesitas la contraseña de la copia seleccionada.</p><button className="btn btn-secondary" disabled={busy} onClick={() => void act(async () => { const list = await repo.listRecovery(); setCopies(list); setLoaded(true); setSelected(''); setConfirmed(false); })}>{loaded ? 'Actualizar lista de copias' : 'Buscar copias locales'}</button>
    {loaded && !copies.length && <p className="hint">No hay versiones anteriores disponibles en este dispositivo. Usa un respaldo externo si lo tienes.</p>}
    {!!copies.length && <form onSubmit={event => { event.preventDefault(); void act(async () => { if (!confirmed || !selected) throw new Error('Selecciona una copia y confirma el reemplazo.'); const restored = await repo.recover(selected, password); setPassword(''); setConfirmed(false); onRestored(restored); }); }}><label className="field"><span>Copia anterior que quieres recuperar</span><select required value={selected} onChange={event => { setSelected(event.target.value); setConfirmed(false); }} disabled={busy}><option value="">Selecciona fecha y hora</option>{copies.map((copy, index) => <option key={copy.id} value={copy.id}>{dateTime(copy.savedAt)} · copia {index + 1}</option>)}</select></label><label className="field"><span>Contraseña de esa copia</span><input type="password" required autoComplete="current-password" value={password} onChange={event => { setPassword(event.target.value); setConfirmed(false); }} disabled={busy} /></label><label className="field checkbox-field"><span><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy || !selected} /> Confirmo que quiero reemplazar mis datos por la copia seleccionada.</span></label><button className="btn btn-primary" type="submit" disabled={busy || !confirmed || !selected}>{busy ? 'Recuperando…' : 'Recuperar esta copia'}</button></form>}
    {error && <p className="error" role="alert">{error}</p>}
  </div>;
}

export function RestorePanel({ repo, onRestored }: { repo: VaultRepo; onRestored: (state: FinanceState) => void }) {
  const [text, setText] = useState('');
  const [filename, setFilename] = useState('');
  const [password, setPassword] = useState('');
  const [preview, setPreview] = useState<FinanceState | null>(null);
  const [existing, setExisting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const fileGeneration = useRef(0);
  const act = async (task: () => Promise<void>) => {
    if (locked.current) return; locked.current = true; setBusy(true); setError('');
    try { await task(); } catch (failure) { setError(errorText(failure)); } finally { locked.current = false; setBusy(false); }
  };
  const inspect = (event: FormEvent) => {
    event.preventDefault();
    void act(async () => {
      setPreview(null); setConfirmed(false);
      if (!text) throw new Error('Selecciona un archivo de respaldo.');
      const state = await repo.previewBackup(text, password);
      const hasExisting = await repo.exists();
      setExisting(hasExisting); setPreview(state);
    });
  };
  const restore = () => void act(async () => {
    if (!preview || !confirmed) throw new Error('Revisa el respaldo y confirma antes de restaurar.');
    if (await repo.exists() && !repo.unlocked) throw new Error('Primero desbloquea tu bóveda actual para reemplazarla con un archivo. Si no abre, revisa las copias locales disponibles debajo.');
    const restored = await repo.restoreBackup(text, password);
    setPassword(''); setText(''); setPreview(null); setConfirmed(false);
    onRestored(restored);
  });
  const previewDates = preview?.movements.map(item => item.date).sort() || [];
  const previewTotal = (type: Movement['type']) => {
    const value = preview?.movements.filter(item => !item.voided && item.type === type).reduce((sum, item) => sum + item.amountCents, 0) || 0;
    return Number.isSafeInteger(value) ? money(value) : 'El total excede el rango de visualización';
  };

  return <div className="restore-panel"><p>Restaura un archivo cifrado de Gimo. Primero se revisan su contraseña, integridad, formato y registros. La revisión no modifica tus datos.</p>
    <form onSubmit={inspect} aria-busy={busy}><label className="field"><span>Archivo de respaldo</span><input type="file" accept=".ginabackup,.json,application/json" required disabled={busy} onChange={event => {
      const file = event.target.files?.[0]; const generation = ++fileGeneration.current;
      setText(''); setPreview(null); setConfirmed(false); setError(''); setFilename(file?.name || '');
      if (!file) return;
      if (file.size >= 20 * 1024 * 1024) { setError('El archivo debe ocupar menos de 20 MB. No se modificaron los datos.'); return; }
      void file.text().then(value => { if (fileGeneration.current === generation) setText(value); }).catch(() => { if (fileGeneration.current === generation) setError('No se pudo leer el archivo. Conserva el original e inténtalo de nuevo.'); });
    }} /></label><label className="field"><span>Contraseña del respaldo</span><input type="password" required autoComplete="current-password" value={password} onChange={event => { setPassword(event.target.value); setPreview(null); setConfirmed(false); }} disabled={busy} /></label><p className="hint">Si este dispositivo ya tiene una bóveda desbloqueada, conservará su contraseña actual después de restaurar. En un dispositivo nuevo se usará la contraseña del respaldo.</p><button className="btn btn-secondary" type="submit" disabled={busy || !text || !password}>{busy ? 'Revisando…' : 'Revisar respaldo sin importar'}</button></form>
    {error && <p className="error" role="alert">{error}</p>}
    {preview && <section className="backup-preview"><h3>Respaldo validado</h3><p className="hint">{filename} · Perfil: {preview.profile.name}</p><dl className="report-values"><div><dt>Movimientos</dt><dd>{preview.movements.length} ({preview.movements.filter(item => item.voided).length} anulados)</dd></div><div><dt>Cuentas / metas</dt><dd>{preview.accounts.length} / {preview.goals.length}</dd></div><div><dt>Pendientes / apartados</dt><dd>{preview.receivables.length} / {preview.pockets.length}</dd></div><div><dt>Ingresos registrados</dt><dd>{previewTotal('income')}</dd></div><div><dt>Gastos registrados</dt><dd>{previewTotal('expense')}</dd></div><div><dt>Inversión registrada</dt><dd>{previewTotal('investment')}</dd></div><div><dt>Fechas de movimientos</dt><dd>{previewDates.length ? `${previewDates[0]} a ${previewDates.at(-1)}` : 'Sin movimientos'}</dd></div><div><dt>Última exportación anotada</dt><dd>{preview.lastExportAt ? dateTime(preview.lastExportAt) : 'Sin fecha registrada'}</dd></div></dl>
      {existing && !repo.unlocked ? <p className="error">Ya existe una bóveda en este dispositivo. Desbloquéala antes de reemplazarla con este archivo. Si la bóveda principal está dañada, intenta recuperar una copia local abajo.</p> : <><p><strong>{existing ? 'Esto reemplazará todos los datos actuales por los de este respaldo.' : 'Esto creará tu bóveda en este dispositivo con los datos del respaldo.'}</strong> No fusiona ni sincroniza registros. {existing && 'Se conservará una copia local del conjunto anterior.'}</p><label className="field checkbox-field"><span><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} /> {existing ? 'He revisado el contenido y confirmo reemplazar mis datos.' : 'He revisado el contenido y confirmo restaurar este respaldo.'}</span></label><button className="btn btn-primary" disabled={busy || !confirmed} onClick={restore}>{busy ? 'Restaurando…' : 'Restaurar el respaldo revisado'}</button></>}
    </section>}
    <details className="advanced-filters"><summary>Recuperar una copia anterior de este dispositivo</summary><LocalRecovery repo={repo} onRestored={onRestored} /></details>
  </div>;
}
