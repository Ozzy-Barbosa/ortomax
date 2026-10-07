import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  X,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Sprout,
  Plus,
  ChevronRight,
  Check,
} from "lucide-react";
import { money, goalProgress } from "./domain";
import type { FinanceState, Goal, Movement } from "./types";
export const PrivacyContext = createContext(false);
export function Amount({ value }: { value: number }) {
  const hidden = useContext(PrivacyContext);
  return <span className="amount">{hidden ? "••••" : money(value)}</span>;
}
export const movementLabels = {
  income: "Ingreso",
  expense: "Gasto",
  investment: "Inversión",
  transfer: "Transferencia",
};
export function MovementIcon({ type }: { type: string }) {
  const Icon =
    type === "income"
      ? ArrowUpRight
      : type === "expense"
        ? ArrowDownRight
        : type === "transfer"
          ? ArrowLeftRight
          : Sprout;
  return (
    <span className={`round-icon ${type}`}>
      <Icon size={20} />
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    document.body.classList.add("dialog-open");
    return () => {
      d?.close();
      document.body.classList.remove("dialog-open");
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={title}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Cerrar ventana"
        >
          <X />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function Empty({
  title,
  text,
  action,
  onAction,
}: {
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <span className="empty-symbol">
        <Sprout size={28} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="btn btn-secondary" onClick={onAction}>
          <Plus size={17} />
          {action}
        </button>
      )}
    </div>
  );
}
export function SectionHead({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && (
        <button className="text-btn" onClick={onAction}>
          {action}
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}
export function MovementList({
  state,
  rows,
  onOpen,
}: {
  state: FinanceState;
  rows: Movement[];
  onOpen: (m: Movement) => void;
}) {
  return (
    <div className="movement-list">
      {rows.map((m) => (
        <button
          className={`movement-row ${m.voided ? "voided" : ""}`}
          key={m.id}
          onClick={() => onOpen(m)}
        >
          <MovementIcon type={m.type} />
          <span className="movement-copy">
            <strong>
              {m.note ||
                state.categories.find((c) => c.id === m.categoryId)?.name ||
                movementLabels[m.type]}
            </strong>
            <span>
              {state.sources.find((s) => s.id === m.sourceId)?.name} ·{" "}
              {new Date(m.date + "T12:00:00").toLocaleDateString("es-MX", {
                day: "numeric",
                month: "short",
              })}
              {m.voided ? " · Anulado" : ""}
            </span>
          </span>
          <span className={`movement-value ${m.type}`}>
            {m.type === "income" ? "+" : m.type === "transfer" ? "" : "−"}
            <Amount value={m.amountCents} />
            <ChevronRight size={15} />
          </span>
        </button>
      ))}
    </div>
  );
}
export function GoalCard({
  state,
  goal,
  onEdit,
}: {
  state: FinanceState;
  goal: Goal;
  onEdit: () => void;
}) {
  const p = goalProgress(state, goal);
  return (
    <article className="goal-card">
      <div className="goal-heading">
        <span className="eyebrow">
          {goal.metric === "income" ? "META DE INGRESOS" : "META DE AHORRO"}
        </span>
        <button className="text-btn" onClick={onEdit}>
          Editar
        </button>
      </div>
      <h3>{goal.title}</h3>
      <div className="goal-value">
        <strong>
          <Amount value={p.actual} />
        </strong>
        <span>
          de <Amount value={goal.targetCents} />
        </span>
        <b>{Math.round(p.percent)}%</b>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={goal.title}
        aria-valuenow={Math.max(0, Math.min(100, Math.round(p.percent)))}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i style={{ width: `${Math.max(0, Math.min(100, p.percent))}%` }} />
      </div>
      <p className="goal-foot">
        {p.remaining <= 0 ? (
          <>
            <Check size={15} /> ¡Meta alcanzada!
          </>
        ) : (
          <>
            Faltan <Amount value={p.remaining} />
            {p.daysLeft > 0 ? (
              <>
                {" "}
                · <Amount value={p.daily} /> por día restante
              </>
            ) : (
              " · Periodo terminado"
            )}
          </>
        )}
      </p>
      <small>
        {goal.start} al {goal.end}
      </small>
    </article>
  );
}
export function BarChart({
  data,
  onSelect,
  label = "Ingresos",
  suffix = "",
}: {
  data: { label: string; value: number; start: string; end: string }[];
  onSelect?: (start: string, end: string) => void;
  label?: string;
  suffix?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 100);
  return (
    <div className="chart">
      <div className="chart-bars" role="group" aria-label={label}>
        {data.map((d, i) => (
          <button
            key={i}
            className="chart-col"
            onClick={() => onSelect?.(d.start, d.end)}
            aria-label={`${d.label}, ver movimientos`}
            disabled={!onSelect}
          >
            <span className="bar-value">
              <Amount value={d.value} />
            </span>
            <span className="bar-space">
              <i
                className="bar"
                style={{
                  height: `${d.value ? Math.max(3, (d.value / max) * 100) : 0}%`,
                }}
              />
            </span>
            <span className="bar-label">{d.label}</span>
          </button>
        ))}
      </div>
      {suffix && <p className="chart-note">{suffix}</p>}
      <details className="chart-data">
        <summary>Ver valores del gráfico</summary>
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th>Periodo</th>
              <th>Importe MXN</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i}>
                <th>
                  {d.label} · {d.start} — {d.end}
                </th>
                <td>
                  <Amount value={d.value} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
