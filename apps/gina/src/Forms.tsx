import { cloneElement, isValidElement, useId, useRef, useState, type FormEvent, type ReactNode, type ReactElement } from 'react';
import { accountBalance, money, parseMoney, pendingAmount, periodFor, pocketBalance, today, uid, validateState } from './domain';
import type { Account, Area, Budget, FinanceState, Goal, Movement, MovementType, Pocket, Receivable, Scope } from './types';

export interface FormProps {
  state: FinanceState;
  onSave: (next: FinanceState) => Promise<void>;
  onClose: () => void;
}

const areaNames: Record<Area | 'mixed', string> = {
  clinic: 'Consultorio propio', collaborations: 'Colaboraciones', personal: 'Personal', mixed: 'Mixta · saldo en General',
};
const typeNames: Record<MovementType, string> = {
  income: 'Ingreso', expense: 'Gasto', investment: 'Inversión', transfer: 'Transferencia',
};
const inputAmount = (cents?: number) => cents === undefined ? '' : (cents / 100).toFixed(2);
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'No fue posible guardar. Tus datos anteriores se conservan.';
const audit = (state: FinanceState, action: string, entityId: string): FinanceState => ({
  ...state, audit: [...state.audit, { id: uid(), at: new Date().toISOString(), action, entityId }],
});
const upsert = <T extends { id: string }>(items: T[], item: T): T[] => items.some(current => current.id === item.id)
  ? items.map(current => current.id === item.id ? item : current) : [...items, item];

function useCommit({ onSave, onClose }: FormProps) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const locked = useRef(false);
  const commit = async (build: () => FinanceState, close = true) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = validateState(build());
      await onSave(next);
      if (close) onClose();
      else setNotice('Borrador guardado de forma cifrada en este dispositivo. Todavía no cuenta como movimiento.');
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  return { error, busy, notice, commit };
}

function Field({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  const fieldId = useId();
  const control = children as ReactElement<{ id?: string; 'aria-describedby'?: string }>;
  const id = isValidElement(control) && control.props.id ? control.props.id : fieldId;
  return <div className="field"><label htmlFor={id}>{title}</label>{isValidElement(control) ? cloneElement(control, { id, 'aria-describedby': hint ? `${fieldId}-hint` : undefined }) : children}{hint && <small id={`${fieldId}-hint`} className="hint">{hint}</small>}</div>;
}

function FormFooter({ busy, error, notice, onClose, submitLabel, disabled = false, extra }: {
  busy: boolean; error: string; notice?: string; onClose: () => void; submitLabel: string; disabled?: boolean; extra?: ReactNode;
}) {
  return <>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="hint" role="status">{notice}</p>}
    <div className="form-actions">
      <button className="btn btn-primary" type="submit" disabled={busy || disabled}>{busy ? 'Guardando…' : submitLabel}</button>
      {extra}
      <button className="btn btn-secondary" type="button" onClick={onClose} disabled={busy}>Cancelar</button>
    </div>
  </>;
}

export function MovementForm(props: FormProps & { initial?: Partial<Movement>; sourceId?: string }) {
  const { state, initial, sourceId: preferredSource, onClose } = props;
  const [id] = useState(() => initial?.id || uid());
  const [type, setType] = useState<MovementType>(initial?.type || 'income');
  const [amount, setAmount] = useState(inputAmount(initial?.amountCents));
  const [date, setDate] = useState(initial?.date || today());
  const [sourceId, setSourceId] = useState(initial?.sourceId || preferredSource || state.sources.find(source => !source.archived && source.id !== 'shared-professional')?.id || '');
  const [accountId, setAccountId] = useState(initial?.accountId || state.accounts.find(account => !account.archived)?.id || '');
  const [toAccountId, setToAccountId] = useState(initial?.toAccountId || '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId || state.categories.find(category => !category.archived && category.type === (initial?.type || 'income'))?.id || '');
  const [note, setNote] = useState(initial?.note || '');
  const [receivableId, setReceivableId] = useState(initial?.receivableId || '');
  const { error, busy, notice, commit } = useCommit(props);
  const formId = useId();
  const existing = state.movements.find(movement => movement.id === id);
  const accounts = state.accounts.filter(account => !account.archived || account.id === accountId || account.id === toAccountId);
  const sources = state.sources.filter(source => (!source.archived || source.id === sourceId) && (source.id !== 'shared-professional' || type === 'expense' || type === 'investment'));
  const categories = state.categories.filter(category => category.type === type && (!category.archived || category.id === categoryId));
  const receivables = state.receivables.filter(item => (!item.archived && pendingAmount(state, item.id) > 0) || item.id === receivableId);
  const linked = state.receivables.find(item => item.id === receivableId);
  const pending = linked ? pendingAmount(state, linked.id) + (existing?.receivableId === linked.id && !existing.voided ? existing.amountCents : 0) : 0;

  const changeType = (next: MovementType) => {
    setType(next);
    setCategoryId(next === 'transfer' ? '' : state.categories.find(category => !category.archived && category.type === next)?.id || '');
    if (next !== 'income') setReceivableId('');
    if (next === 'income' || next === 'transfer') {
      if (sourceId === 'shared-professional') setSourceId(state.sources.find(source => !source.archived && source.id !== 'shared-professional')?.id || '');
    }
    if (next === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      setToAccountId(accounts.find(account => account.id !== accountId)?.id || '');
    }
  };

  const buildMovement = (): Movement => {
    const amountCents = parseMoney(amount);
    if (amountCents <= 0) throw new Error('El importe debe ser mayor que cero.');
    if (!date) throw new Error('Elige la fecha del movimiento.');
    if (!sourceId || !accountId) throw new Error('Selecciona una actividad y una cuenta.');
    if (type === 'transfer' && (!toAccountId || accountId === toAccountId)) throw new Error('La cuenta de destino debe ser diferente de la cuenta de origen.');
    if (type !== 'transfer' && !categoryId) throw new Error('Selecciona una categoría.');
    if (linked && linked.sourceId !== sourceId) throw new Error('La actividad debe coincidir con el cobro pendiente.');
    const now = new Date().toISOString();
    return {
      id, type, amountCents, date, sourceId, accountId,
      ...(type === 'transfer' ? { toAccountId } : {}),
      categoryId: type === 'transfer' ? '' : categoryId, note: note.trim(),
      ...(type === 'income' && receivableId ? { receivableId } : {}),
      voided: existing?.voided || false, createdAt: existing?.createdAt || now, updatedAt: now,
    };
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void commit(() => {
      const movement = buildMovement();
      return audit({ ...state, movements: upsert(state.movements, movement), draft: null }, existing ? 'Editar movimiento' : 'Registrar movimiento', id);
    });
  };

  const saveDraft = () => void commit(() => {
    const parsedAmount = amount.trim() ? parseMoney(amount) : undefined;
    const draft: Partial<Movement> = {
      id, type, date, sourceId, accountId, categoryId: type === 'transfer' ? '' : categoryId, note,
      ...(parsedAmount !== undefined ? { amountCents: parsedAmount } : {}),
      ...(type === 'transfer' && toAccountId ? { toAccountId } : {}),
      ...(type === 'income' && receivableId ? { receivableId } : {}),
    };
    return { ...state, draft };
  }, false);

  return <form onSubmit={submit} aria-label={existing ? 'Editar movimiento' : 'Registrar movimiento'} aria-busy={busy}>
    <div className="type-picker" aria-label="Tipo de movimiento">
      {(Object.keys(typeNames) as MovementType[]).map(value => <button key={value} type="button" className={type === value ? 'active' : ''} aria-pressed={type === value} onClick={() => changeType(value)} disabled={busy}>{typeNames[value]}</button>)}
    </div>
    <div className="form-grid">
      <Field title="Importe en pesos (MXN)"><input id={`${formId}-amount`} className="amount-input" type="text" inputMode="decimal" autoComplete="off" required maxLength={18} placeholder="0.00" value={amount} onChange={event => setAmount(event.target.value)} disabled={busy} /></Field>
      <Field title="Fecha"><input type="date" required value={date} onChange={event => setDate(event.target.value)} disabled={busy} /></Field>
      <Field title={type === 'transfer' ? 'Actividad de referencia' : 'Actividad'} hint={sourceId === 'shared-professional' ? 'Se incluye en Profesional y General, sin atribuirse a una clínica.' : undefined}>
        <select value={sourceId} required disabled={busy} onChange={event => { setSourceId(event.target.value); if (linked?.sourceId !== event.target.value) setReceivableId(''); }}>
          {!sources.length && <option value="">No hay actividades disponibles</option>}
          {sources.map(source => <option key={source.id} value={source.id}>{source.name}{source.archived ? ' · archivada' : ''}</option>)}
        </select>
      </Field>
      <Field title={type === 'transfer' ? 'Cuenta de origen' : 'Cuenta'}>
        <select value={accountId} required disabled={busy} onChange={event => { setAccountId(event.target.value); if (toAccountId === event.target.value) setToAccountId(accounts.find(account => account.id !== event.target.value)?.id || ''); }}>
          {!accounts.length && <option value="">Primero crea una cuenta</option>}
          {accounts.map(account => <option key={account.id} value={account.id}>{account.name}{account.archived ? ' · archivada' : ''}</option>)}
        </select>
      </Field>
      {type === 'transfer' ? <Field title="Cuenta de destino" hint="Mueve dinero entre tus cuentas. No aumenta ingresos ni metas.">
        <select value={toAccountId} required disabled={busy} onChange={event => setToAccountId(event.target.value)}>
          <option value="">Selecciona la cuenta de destino</option>
          {accounts.filter(account => account.id !== accountId).map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </Field> : <Field title="Categoría">
        <select value={categoryId} required disabled={busy} onChange={event => setCategoryId(event.target.value)}>
          {!categories.length && <option value="">Primero crea una categoría</option>}
          {categories.map(category => <option key={category.id} value={category.id}>{category.name}{category.archived ? ' · archivada' : ''}</option>)}
        </select>
      </Field>}
      {type === 'income' && receivables.length > 0 && <Field title="Cobro pendiente vinculado" hint={linked ? `Disponible por cobrar: ${money(pending)}. Registra únicamente lo recibido.` : 'Opcional. Enlaza este ingreso para reducir un cobro pendiente.'}>
        <select value={receivableId} disabled={busy} onChange={event => {
          const next = state.receivables.find(item => item.id === event.target.value);
          setReceivableId(event.target.value);
          if (next) { setSourceId(next.sourceId); if (!amount.trim()) setAmount(inputAmount(pendingAmount(state, next.id))); }
        }}>
          <option value="">Sin vínculo</option>
          {receivables.map(item => <option key={item.id} value={item.id}>{item.title} · {state.sources.find(source => source.id === item.sourceId)?.name}</option>)}
        </select>
      </Field>}
      <Field title="Nota (opcional)" hint="Describe el concepto financiero; evita nombres de pacientes o información clínica."><textarea rows={3} maxLength={500} value={note} onChange={event => setNote(event.target.value)} disabled={busy} placeholder="Por ejemplo: honorarios de la semana" /></Field>
    </div>
    {type === 'investment' && <p className="hint">Inversión registra equipo o mejoras pagadas para el negocio. Para mover capital a una cuenta de inversión, usa Transferencia.</p>}
    {accounts.length === 0 && <p className="hint">Agrega una cuenta desde Ajustes antes de guardar tu primer movimiento.</p>}
    <FormFooter busy={busy} error={error} notice={notice} onClose={onClose} disabled={accounts.length === 0} submitLabel={existing ? 'Guardar cambios' : `Guardar ${typeNames[type].toLocaleLowerCase('es-MX')}`} extra={<button type="button" className="btn btn-secondary" disabled={busy} onClick={saveDraft}>Guardar borrador</button>} />
  </form>;
}

export function GoalForm(props: FormProps & { initial?: Goal }) {
  const { state, initial, onClose } = props;
  const [id] = useState(() => initial?.id || uid());
  const [title, setTitle] = useState(initial?.title || '');
  const [metric, setMetric] = useState<Goal['metric']>(initial?.metric || 'income');
  const [scope, setScope] = useState<Scope>(initial?.scope || 'all');
  const [target, setTarget] = useState(inputAmount(initial?.targetCents));
  const [mode, setMode] = useState<'week' | 'month' | 'range'>(initial ? 'range' : 'month');
  const [anchor, setAnchor] = useState(initial?.start || today());
  const [end, setEnd] = useState(initial?.end || periodFor('month', today()).end);
  const { error, busy, commit } = useCommit(props);
  let periodLabel = '';
  try { periodLabel = periodFor(mode, anchor, end).label; } catch { /* The submit validates incomplete dates. */ }

  return <form aria-label={initial ? 'Editar meta' : 'Crear meta'} aria-busy={busy} onSubmit={event => {
    event.preventDefault();
    void commit(() => {
      const targetCents = parseMoney(target);
      if (targetCents <= 0) throw new Error('La meta debe ser mayor que cero.');
      if (!title.trim()) throw new Error('Escribe un nombre para la meta.');
      const period = periodFor(mode, anchor, end);
      const goal: Goal = { id, title: title.trim(), metric, scope, targetCents, start: period.start, end: period.end, archived: initial?.archived || false };
      return audit({ ...state, goals: upsert(state.goals, goal) }, initial ? 'Editar meta' : 'Crear meta', id);
    });
  }}>
    <div className="form-grid">
      <Field title="Nombre de la meta"><input required maxLength={80} value={title} onChange={event => setTitle(event.target.value)} placeholder="Por ejemplo: ingresos de este mes" disabled={busy} /></Field>
      <Field title="Qué quieres lograr"><select value={metric} onChange={event => {
        const next = event.target.value as Goal['metric']; setMetric(next);
        if (next === 'savings' && !['all', 'professional', 'clinic', 'collaborations', 'personal'].includes(scope)) setScope('all');
      }} disabled={busy}><option value="income">Ingresos cobrados</option><option value="savings">Ahorro aportado en el periodo</option></select></Field>
      <Field title="Ámbito"><select value={scope} onChange={event => setScope(event.target.value)} disabled={busy}>
        <option value="all">General</option><option value="professional">Profesional</option>
        {(Object.keys(areaNames) as (Area | 'mixed')[]).filter(area => area !== 'mixed').map(area => <option key={area} value={area}>{areaNames[area]}</option>)}
        {metric === 'income' && state.sources.filter(source => (!source.archived || source.id === scope) && source.id !== 'shared-professional').map(source => <option key={source.id} value={source.id}>{source.name}</option>)}
      </select></Field>
      <Field title="Importe objetivo (MXN)"><input type="text" required inputMode="decimal" maxLength={18} value={target} onChange={event => setTarget(event.target.value)} placeholder="0.00" disabled={busy} /></Field>
      <Field title="Periodo"><select value={mode} onChange={event => setMode(event.target.value as typeof mode)} disabled={busy}><option value="week">Semanal · lunes a domingo</option><option value="month">Mensual</option><option value="range">Fechas personalizadas</option></select></Field>
      <Field title={mode === 'range' ? 'Fecha inicial' : 'Fecha dentro del periodo'}><input type="date" required value={anchor} onChange={event => setAnchor(event.target.value)} disabled={busy} /></Field>
      {mode === 'range' && <Field title="Fecha final"><input type="date" required min={anchor} value={end} onChange={event => setEnd(event.target.value)} disabled={busy} /></Field>}
    </div>
    {periodLabel && <p className="hint">Periodo: {periodLabel}.</p>}
    <p className="hint">{metric === 'income' ? 'Solo los ingresos efectivamente cobrados avanzan esta meta. Los pendientes y las transferencias no cuentan.' : 'Cuenta lo apartado menos lo liberado dentro del periodo. El saldo ahorrado antes no se vuelve a sumar. Por área se consideran sus cuentas dedicadas; las mixtas aparecen en General.'}</p>
    <FormFooter busy={busy} error={error} onClose={onClose} submitLabel={initial ? 'Guardar meta' : 'Crear meta'} />
  </form>;
}

export function AccountForm(props: FormProps & { initial?: Account }) {
  const { state, initial, onClose } = props;
  const [id] = useState(() => initial?.id || uid());
  const [name, setName] = useState(initial?.name || '');
  const [area, setArea] = useState<Account['area']>(initial?.area || 'mixed');
  const [kind, setKind] = useState<Account['kind']>(initial?.kind || 'cash');
  const [opening, setOpening] = useState(inputAmount(initial?.openingCents ?? 0));
  const [openingDate, setOpeningDate] = useState(initial?.openingDate || today());
  const [spendable, setSpendable] = useState(initial?.spendable ?? true);
  const { error, busy, commit } = useCommit(props);
  const hasHistory = state.movements.some(item => item.accountId === id || item.toAccountId === id);

  return <form aria-label={initial ? 'Editar cuenta' : 'Crear cuenta'} aria-busy={busy} onSubmit={event => {
    event.preventDefault();
    void commit(() => {
      if (!name.trim()) throw new Error('Escribe el nombre de la cuenta.');
      if (openingDate > today()) throw new Error('La fecha de corte inicial no puede ser posterior a hoy. Elige una fecha cuyo saldo ya conozcas.');
      const account: Account = { id, name: name.trim(), area, kind, openingCents: parseMoney(opening), openingDate, spendable, archived: initial?.archived || false };
      return audit({ ...state, accounts: upsert(state.accounts, account) }, initial ? 'Editar cuenta' : 'Crear cuenta', id);
    });
  }}>
    <div className="form-grid">
      <Field title="Nombre de la cuenta"><input required maxLength={60} autoComplete="off" value={name} onChange={event => setName(event.target.value)} placeholder="Por ejemplo: Banco personal" disabled={busy} /></Field>
      <Field title="Área" hint={area === 'mixed' ? 'Su saldo aparece solo en General, para no atribuir el mismo dinero a varias áreas.' : 'Su saldo se atribuye a esta área.'}><select value={area} onChange={event => setArea(event.target.value as Account['area'])} disabled={busy}>{(Object.keys(areaNames) as Account['area'][]).map(value => <option value={value} key={value}>{areaNames[value]}</option>)}</select></Field>
      <Field title="Tipo de cuenta"><select value={kind} onChange={event => { const next = event.target.value as Account['kind']; setKind(next); if (next === 'savings' || next === 'investment') setSpendable(false); }} disabled={busy}><option value="cash">Efectivo</option><option value="bank">Banco</option><option value="savings">Ahorro</option><option value="investment">Inversión</option></select></Field>
      <Field title="Saldo inicial (MXN)"><input type="text" required inputMode="decimal" maxLength={18} value={opening} onChange={event => setOpening(event.target.value)} disabled={busy} /></Field>
      <Field title="Fecha de corte inicial" hint="El saldo corresponde al comienzo de esta fecha. Los movimientos de ese día y posteriores se acumulan; los anteriores sirven para reportes."><input type="date" required max={today()} value={openingDate} onChange={event => setOpeningDate(event.target.value)} disabled={busy} /></Field>
      <label className="field checkbox-field"><span><input type="checkbox" checked={spendable} onChange={event => setSpendable(event.target.checked)} disabled={busy} /> Incluir esta cuenta en dinero libre</span><small className="hint">Desactívalo si este dinero está reservado fuera de tus gastos diarios.</small></label>
    </div>
    {hasHistory && <p className="hint">Esta cuenta tiene movimientos. Cambiar su saldo o fecha inicial recalcula los saldos; conserva el corte que corresponda a tus registros.</p>}
    <FormFooter busy={busy} error={error} onClose={onClose} submitLabel={initial ? 'Guardar cuenta' : 'Crear cuenta'} />
  </form>;
}

export function ReceivableForm(props: FormProps & { initial?: Receivable }) {
  const { state, initial, onClose } = props;
  const [id] = useState(() => initial?.id || uid());
  const [title, setTitle] = useState(initial?.title || '');
  const [sourceId, setSourceId] = useState(initial?.sourceId || state.sources.find(source => !source.archived && source.id !== 'shared-professional')?.id || '');
  const [total, setTotal] = useState(inputAmount(initial?.totalCents));
  const [date, setDate] = useState(initial?.date || today());
  const [dueDate, setDueDate] = useState(initial?.dueDate || '');
  const { error, busy, commit } = useCommit(props);
  const hasPayments = state.movements.some(item => item.receivableId === id);

  return <form aria-label={initial ? 'Editar cobro pendiente' : 'Crear cobro pendiente'} aria-busy={busy} onSubmit={event => {
    event.preventDefault();
    void commit(() => {
      if (!title.trim()) throw new Error('Escribe el concepto del cobro pendiente.');
      const totalCents = parseMoney(total);
      if (totalCents <= 0) throw new Error('El importe esperado debe ser mayor que cero.');
      if (dueDate && dueDate < date) throw new Error('El vencimiento no puede ser anterior a la fecha del pendiente.');
      const receivable: Receivable = { id, title: title.trim(), sourceId, totalCents, date, dueDate, archived: initial?.archived || false };
      return audit({ ...state, receivables: upsert(state.receivables, receivable) }, initial ? 'Editar cobro pendiente' : 'Crear cobro pendiente', id);
    });
  }}>
    <div className="form-grid">
      <Field title="Concepto"><input required maxLength={100} value={title} onChange={event => setTitle(event.target.value)} placeholder="Por ejemplo: honorarios de la semana" disabled={busy} /></Field>
      <Field title="Actividad" hint={hasPayments ? 'Conserva la actividad de los cobros ya vinculados.' : undefined}><select required value={sourceId} onChange={event => setSourceId(event.target.value)} disabled={busy || hasPayments}>{state.sources.filter(source => (!source.archived || source.id === sourceId) && source.id !== 'shared-professional').map(source => <option key={source.id} value={source.id}>{source.name}</option>)}</select></Field>
      <Field title="Total esperado (MXN)"><input type="text" required inputMode="decimal" maxLength={18} value={total} onChange={event => setTotal(event.target.value)} placeholder="0.00" disabled={busy} /></Field>
      <Field title="Fecha"><input type="date" required value={date} onChange={event => setDate(event.target.value)} disabled={busy} /></Field>
      <Field title="Vencimiento (opcional)"><input type="date" min={date} value={dueDate} onChange={event => setDueDate(event.target.value)} disabled={busy} /></Field>
    </div>
    <p className="hint">Un pendiente no aumenta tus ingresos ni tu saldo. Registra cada pago cuando lo recibas, completo o parcial.</p>
    <FormFooter busy={busy} error={error} onClose={onClose} submitLabel={initial ? 'Guardar pendiente' : 'Crear pendiente'} />
  </form>;
}

export function SavingsForm(props: FormProps & { initial?: Pocket }) {
  const { state, initial, onClose } = props;
  const [newId] = useState(uid);
  const [mode, setMode] = useState<'create' | 'add' | 'release'>(initial ? 'add' : 'create');
  const [pocketId, setPocketId] = useState(initial?.id || state.pockets.find(item => !item.archived)?.id || '');
  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState(initial?.accountId || state.accounts.find(account => !account.archived)?.id || '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const { error, busy, commit } = useCommit(props);
  const pocket = state.pockets.find(item => item.id === pocketId);
  const account = state.accounts.find(item => item.id === (mode === 'create' ? accountId : pocket?.accountId));
  const activePockets = state.pockets.filter(item => !item.archived);
  let balanceHint = '';
  try {
    if (account && date) {
      const reserved = state.pockets.filter(item => item.accountId === account.id).reduce((sum, item) => sum + pocketBalance(state, item.id, date), 0);
      balanceHint = mode === 'release' && pocket ? `Apartado a esta fecha: ${money(pocketBalance(state, pocket.id, date))}.` : `Disponible para apartar a esta fecha: ${money(accountBalance(state, account.id, date) - reserved)}.`;
    }
  } catch { balanceHint = 'Elige una fecha a partir del corte inicial de la cuenta.'; }

  return <form aria-label="Gestionar ahorro" aria-busy={busy} onSubmit={event => {
    event.preventDefault();
    void commit(() => {
      const targetPocketId = mode === 'create' ? newId : pocketId;
      if (!targetPocketId) throw new Error('Selecciona un apartado.');
      if (mode === 'create' && !name.trim()) throw new Error('Escribe el nombre del apartado.');
      if (!account) throw new Error('Selecciona una cuenta para el apartado.');
      if (date < account.openingDate) throw new Error('La fecha debe ser igual o posterior al corte inicial de la cuenta.');
      const amountCents = mode === 'create' && !amount.trim() ? 0 : parseMoney(amount);
      if (amountCents < 0 || (mode !== 'create' && amountCents === 0)) throw new Error('Introduce un importe mayor que cero.');
      if (mode === 'release' && amountCents > pocketBalance(state, targetPocketId, date)) throw new Error('No puedes liberar más dinero del que tiene este apartado en la fecha elegida.');
      if (mode !== 'release') {
        const reserved = state.pockets.filter(item => item.accountId === account.id).reduce((sum, item) => sum + pocketBalance(state, item.id, date), 0);
        if (amountCents > accountBalance(state, account.id, date) - reserved) throw new Error('El importe supera el saldo disponible para apartar en esta cuenta.');
      }
      const pockets = mode === 'create' ? [...state.pockets, { id: newId, accountId: account.id, name: name.trim(), archived: false }] : state.pockets;
      const savingEvents = amountCents > 0 ? [...state.savingEvents, { id: uid(), pocketId: targetPocketId, amountCents: mode === 'release' ? -amountCents : amountCents, date, note: note.trim() }] : state.savingEvents;
      return audit({ ...state, pockets, savingEvents }, mode === 'create' ? 'Crear apartado' : mode === 'add' ? 'Aportar a apartado' : 'Liberar apartado', targetPocketId);
    });
  }}>
    <div className="form-grid">
      <Field title="Qué quieres hacer"><select value={mode} onChange={event => setMode(event.target.value as typeof mode)} disabled={busy}><option value="create">Crear apartado</option><option value="add" disabled={!activePockets.length}>Apartar más dinero</option><option value="release" disabled={!activePockets.length}>Liberar dinero apartado</option></select></Field>
      {mode === 'create' ? <>
        <Field title="Nombre del apartado"><input required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Por ejemplo: fondo de tranquilidad" disabled={busy} /></Field>
        <Field title="Cuenta donde está el dinero"><select value={accountId} required onChange={event => setAccountId(event.target.value)} disabled={busy}>{!state.accounts.some(item => !item.archived) && <option value="">Primero crea una cuenta</option>}{state.accounts.filter(item => !item.archived).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
      </> : <Field title="Apartado"><select required value={pocketId} onChange={event => setPocketId(event.target.value)} disabled={busy}>{activePockets.map(item => <option value={item.id} key={item.id}>{item.name} · {state.accounts.find(value => value.id === item.accountId)?.name}</option>)}</select></Field>}
      <Field title={mode === 'create' ? 'Primera aportación (opcional, MXN)' : mode === 'release' ? 'Importe a liberar (MXN)' : 'Importe a apartar (MXN)'} hint={balanceHint}><input type="text" inputMode="decimal" required={mode !== 'create'} value={amount} maxLength={18} onChange={event => setAmount(event.target.value)} placeholder="0.00" disabled={busy} /></Field>
      <Field title="Fecha"><input type="date" required min={account?.openingDate} value={date} onChange={event => setDate(event.target.value)} disabled={busy} /></Field>
      <Field title="Nota (opcional)"><textarea rows={2} maxLength={500} value={note} onChange={event => setNote(event.target.value)} disabled={busy} /></Field>
    </div>
    <p className="hint">Apartar o liberar dinero no es un ingreso ni un gasto y no cambia el saldo de la cuenta. Solo cambia cuánto está reservado.</p>
    {account && !account.spendable && <p className="hint">Esta cuenta ya está excluida del dinero libre. El apartado no se descontará una segunda vez.</p>}
    <FormFooter busy={busy} error={error} onClose={onClose} submitLabel={mode === 'create' ? 'Crear apartado' : mode === 'release' ? 'Liberar dinero' : 'Guardar aportación'} disabled={!account} />
  </form>;
}

export function BudgetForm(props: FormProps & { initial?: Budget }) {
  const { state, initial, onClose } = props;
  const [id] = useState(() => initial?.id || uid());
  const [categoryId, setCategoryId] = useState(initial?.categoryId || state.categories.find(item => !item.archived && item.type === 'expense')?.id || '');
  const [month, setMonth] = useState(initial?.month || today().slice(0, 7));
  const [limit, setLimit] = useState(inputAmount(initial?.limitCents));
  const { error, busy, commit } = useCommit(props);
  const categories = state.categories.filter(item => item.type === 'expense' && (!item.archived || item.id === categoryId));

  return <form aria-label={initial ? 'Editar presupuesto' : 'Crear presupuesto'} aria-busy={busy} onSubmit={event => {
    event.preventDefault();
    void commit(() => {
      const limitCents = parseMoney(limit);
      if (limitCents <= 0) throw new Error('El límite debe ser mayor que cero.');
      if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Elige un mes válido.');
      if (state.budgets.some(item => item.id !== id && item.categoryId === categoryId && item.month === month)) throw new Error('Ya existe un presupuesto para esta categoría y mes. Edita el existente para cambiar su límite.');
      const budget: Budget = { id, categoryId, month, limitCents };
      return audit({ ...state, budgets: upsert(state.budgets, budget) }, initial ? 'Editar presupuesto' : 'Crear presupuesto', id);
    });
  }}>
    <div className="form-grid">
      <Field title="Categoría de gasto personal"><select value={categoryId} required onChange={event => setCategoryId(event.target.value)} disabled={busy}>{!categories.length && <option value="">Primero crea una categoría</option>}{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
      <Field title="Mes"><input type="month" required value={month} onChange={event => setMonth(event.target.value)} disabled={busy} /></Field>
      <Field title="Límite mensual (MXN)"><input type="text" inputMode="decimal" required maxLength={18} value={limit} onChange={event => setLimit(event.target.value)} placeholder="0.00" disabled={busy} /></Field>
    </div>
    <p className="hint">Este presupuesto compara los gastos del área Personal en la categoría y mes elegidos. No aparta ni mueve dinero.</p>
    <FormFooter busy={busy} error={error} onClose={onClose} submitLabel={initial ? 'Guardar presupuesto' : 'Crear presupuesto'} disabled={!categories.length} />
  </form>;
}
