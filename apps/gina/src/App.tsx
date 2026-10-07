import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeft,
  ArrowLeftRight,
  Bell,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  Eye,
  EyeOff,
  Home,
  Leaf,
  LockKeyhole,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Sprout,
  Target,
  Wallet,
  WifiOff,
  X,
} from "lucide-react";
import {
  emptyState,
  demoState,
  today,
  periodFor,
  totals,
  available,
  selectedMovements,
  chartSeries,
  pendingAmount,
  money,
  uid,
  validateState,
  shiftDate,
  pocketBalance,
} from "./domain";
import { VaultRepo } from "./vault";
import type { FinanceState, Goal, Movement, Period, Receivable } from "./types";
import {
  AccountForm,
  BudgetForm,
  GoalForm,
  MovementForm,
  ReceivableForm,
  SavingsForm,
} from "./Forms";
import {
  Amount,
  BarChart,
  Empty,
  GoalCard,
  Modal,
  MovementIcon,
  MovementList,
  PrivacyContext,
  SectionHead,
  movementLabels,
} from "./components";
import { download, exportCsv } from "./exports";
import { SettingsView, RestorePanel } from "./Settings";

type Page =
  | "summary"
  | "activities"
  | "goals"
  | "movements"
  | "pending"
  | "personal"
  | "settings"
  | "reports";
type Dialog =
  | { kind: "movement"; initial?: Partial<Movement> }
  | { kind: "goal"; initial?: Goal }
  | { kind: "account" }
  | { kind: "pending"; initial?:Receivable }
  | { kind: "savings" }
  | { kind: "budget" }
  | { kind: "detail"; movement: Movement }
  | { kind: "restore" }
  | null;
const areaLabels: Record<string, string> = {
  all: "General",
  professional: "Profesional",
  clinic: "Consultorio propio",
  collaborations: "Colaboraciones",
  personal: "Personal",
};
const sorted = (rows: Movement[]) =>
  [...rows].sort(
    (a, b) =>
      b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
const asset = (name: string) => import.meta.env.BASE_URL + name;
function Brand() {
  return (
    <div className="brand">
      <img src={asset("brand/symbol.png")} alt="" />
      <div>
        <strong>Gimo</strong>
        <span>FINANZAS PERSONALES</span>
      </div>
    </div>
  );
}
function Gate({
  repo,
  exists,
  onOpen,
  onDemo,
  onRestore,
  error: outerError,
}: {
  repo: VaultRepo;
  exists: boolean;
  onOpen: (s: FinanceState) => void;
  onDemo: () => void;
  onRestore: () => void;
  error: string;
}) {
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [name, setName] = useState("Dra. Gina"),
    [mode, setMode] = useState<"clinic" | "fees">("clinic"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (exists) {
        onOpen(await repo.unlock(password));
      } else {
        if (password.length < 12)
          throw Error("Usa una contraseña de al menos 12 caracteres.");
        if (password !== confirmation)
          throw Error("Las contraseñas no coinciden.");
        const initial = emptyState();
        initial.profile.name = name.trim() || "Dra. Gina";
        initial.profile.orthomaxMode = mode;
        await repo.create(password, initial);
        onOpen(initial);
      }
      setPassword("");
      setConfirmation("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="gate">
      <div className="gate-story">
        <Brand />
        <span className="gate-kicker">TU ESPACIO, TU TRANQUILIDAD</span>
        <h1>
          Tus números.
          <br />
          <em>Tus metas.</em>
          <br />
          Tu siguiente paso.
        </h1>
        <p>
          Un espacio para cuidar lo que ganas y dar forma a lo que quieres
          lograr.
        </p>
        <div className="gate-illustration" aria-hidden="true">
          <div className="illus-top">
            <span>
              <Sprout /> Crecer a tu ritmo
            </span>
            <Target />
          </div>
          <div className="illus-bars">
            {[36, 52, 45, 68, 86, 100].map((h, i) => (
              <i key={i} style={{ height: h + "%" }} />
            ))}
          </div>
          <div className="illus-line">
            <span>Pequeños pasos</span>
            <span>Grandes metas ↗</span>
          </div>
        </div>
        <div className="gate-signature">DRA. GINA · ORTHOMAX LA PAZ</div>
      </div>
      <main className="gate-form">
        <div className="gate-mobile-brand">
          <Brand />
        </div>
        <span className="round-icon mint">
          <LockKeyhole />
        </span>
        <h2>
          {exists ? "Qué gusto verte de nuevo." : "Empieza con tranquilidad."}
        </h2>
        <p>
          {exists
            ? "Desbloquea tu espacio para continuar."
            : "Configura tu espacio privado. Tus registros comienzan en cero."}
        </p>
        <form onSubmit={submit}>
          {!exists && (
            <>
              <label className="field">
                Tu nombre
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                />
              </label>
              <label className="field">
                En Orthomax registraré
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as "clinic" | "fees")}
                >
                  <option value="clinic">
                    La actividad completa del consultorio
                  </option>
                  <option value="fees">Solo mis honorarios</option>
                </select>
              </label>
            </>
          )}
          <label className="field">
            {exists ? "Contraseña" : "Crea una contraseña"}
            <input
              autoComplete={exists ? "current-password" : "new-password"}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={exists ? 1 : 12}
              maxLength={200}
            />
          </label>
          {!exists && (
            <>
              <label className="field">
                Repite la contraseña
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  required
                  maxLength={200}
                />
              </label>
              <label className="check-field">
                <input type="checkbox" required />
                Guardaré mi contraseña en un lugar seguro y exportaré respaldos.
                No existe recuperación de contraseña por correo.
              </label>
            </>
          )}
          {(error || outerError) && (
            <p className="error" role="alert">
              {error || outerError}
            </p>
          )}
          <button className="btn btn-primary full" disabled={busy}>
            {busy
              ? "Abriendo tu espacio…"
              : exists
                ? "Desbloquear"
                : "Crear mi espacio"}
            <ChevronRight size={19} />
          </button>
        </form>
        <div className="gate-links">
          <button className="text-btn" onClick={onDemo}>
            Explorar demostración
          </button>
          <button className="text-btn" onClick={onRestore}>
            Restaurar respaldo
          </button>
        </div>
        <div className="privacy-note">
          <ShieldCheck size={19} />
          <p>
            Cifrado en este dispositivo. Guarda una copia en Archivos o iCloud
            Drive para poder recuperar tus datos si pierdes el iPhone o borras
            Safari.
          </p>
        </div>
        <p className="gate-foot">
          Hecho para la Dra. Gina · Sin anuncios ni rastreadores
        </p>
      </main>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<FinanceState | null>(null),
    [exists, setExists] = useState(false),
    [loading, setLoading] = useState(true),
    [demo, setDemo] = useState(false),
    [error, setError] = useState(""),
    [page, setPage] = useState<Page>("summary"),
    [dialog, setDialog] = useState<Dialog>(null),
    [scope, setScope] = useState("all"),
    [periodMode, setPeriodMode] = useState<"week" | "month" | "year" | "range">(
      "month",
    ),
    [anchor, setAnchor] = useState(today()),
    [end, setEnd] = useState(today()),
    [hidden, setHidden] = useState(false),
    [toast, setToast] = useState(""),
    [undo, setUndo] = useState<FinanceState | null>(null),
    [showHistory,setShowHistory]=useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [waiting, setWaiting] = useState<ServiceWorker | null>(null),
    [offlineReady, setOfflineReady] = useState(false);
  const externalChange = useRef<() => void>(() => {});
  const repoRef = useRef<VaultRepo | null>(null);
  if (!repoRef.current) repoRef.current = new VaultRepo({onExternalChange:()=>externalChange.current()});
  const repo = repoRef.current;
  const saving = useRef(false),
    lastActive = useRef(Date.now()),
    latest = useRef(state);
  latest.current = state;
  const lock = useCallback(() => {
    if (saving.current) return;
    repo.lock();
    setState(null);
    setDemo(false);
    setDialog(null);
    setUndo(null);
    setPage("summary");
    setHidden(false);
    setToast("");
  }, [repo]);
  externalChange.current = () => {
    if(demo)return;
    repo.lock();
    setState(null);setDialog(null);setUndo(null);setToast("");setExists(true);
    setError("Los registros cambiaron en otra ventana. Vuelve a desbloquear para usar la versión más reciente.");
  };
  useEffect(() => {
    let cancelled = false;
    repo
      .exists()
      .then((v) => {
        if (!cancelled) setExists(v);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repo]);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  useEffect(() => {
    const check = () => {
      if(latest.current && !demo && Date.now()-lastActive.current>5*60*1000){
        lock();setError("Tu espacio se bloqueó por inactividad. Desbloquea para continuar.");return true;
      }
      return false;
    };
    const mark = () => {
      if(!check())lastActive.current = Date.now();
    };
    const resume = () => {if(document.visibilityState==='visible')check()};
    window.addEventListener("pointerdown", mark);
    window.addEventListener("keydown", mark);
    document.addEventListener('visibilitychange',resume);
    window.addEventListener('pageshow',resume);
    window.addEventListener('focus',resume);
    const t = setInterval(() => {
      if (
        latest.current &&
        !demo &&
        Date.now() - lastActive.current > 5 * 60 * 1000
      ) {
        lock();
        setError(
          "Tu espacio se bloqueó por inactividad. Desbloquea para continuar.",
        );
      }
    }, 15000);
    return () => {
      clearInterval(t);
      window.removeEventListener("pointerdown", mark);
      window.removeEventListener("keydown", mark);
      document.removeEventListener('visibilitychange',resume);
      window.removeEventListener('pageshow',resume);
      window.removeEventListener('focus',resume);
    };
  }, [demo, lock]);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let alive = true;
    navigator.serviceWorker
      .register(asset("sw.js"), { scope: asset(""), updateViaCache: "none" })
      .then((reg) => {
        if (!alive) return;
        if (reg.waiting) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            )
              setWaiting(worker);
          });
        });
        navigator.serviceWorker.ready.then(
          () => alive && setOfflineReady(true),
        );
        reg.update().catch(() => {});
      })
      .catch(() => setOfflineReady(false));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast("");
      setUndo(null);
    }, 7500);
    return () => clearTimeout(timer);
  }, [toast]);
  const commit = async (next: FinanceState) => {
    if (saving.current)
      throw Error("Espera a que termine el guardado anterior.");
    saving.current = true;
    try {
      const checked = validateState(next);
      if (!demo) await repo.save(checked);
      setUndo(latest.current);
      setState(checked);
      setToast(
        demo
          ? "Cambio de demostración · no se guarda en tu bóveda"
          : "Guardado y protegido en este dispositivo",
      );
    } finally {
      saving.current = false;
    }
  };
  const open = (s: FinanceState) => {
    setState(s);
    setExists(true);
    setDemo(false);
    setError("");
    setUndo(null);setToast("");setDialog(null);
    setScope('all');setPage('summary');
    lastActive.current = Date.now();
    void repo.requestPersistence().catch(()=>{});
  };
  const restored = (s:FinanceState) => {open(s);setToast('Respaldo restaurado y validado. No se duplicaron registros.')};
  const doUndo = async () => {
    if (!undo) return;
    try {
      const snapshot = undo;
      setUndo(null);
      await commit(snapshot);
      setUndo(null);
      setToast("Cambio deshecho");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const navigate = (next: Page) => {
    setPage(next);
    if (next === "personal") setScope("personal");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const newMovement = (initial?: Partial<Movement>) => {
    if (!state) return;
    if (!state.accounts.some((a) => !a.archived)) {
      setDialog({ kind: "account" });
      setToast("Primero crea la cuenta donde guardarás el dinero.");
      return;
    }
    setDialog({
      kind: "movement",
      initial: initial ?? state.draft ?? {
        sourceId: state.sources.some((s) => s.id === scope)
          ? scope
          : scope === "personal"
            ? "personal"
            : "orthomax",
      },
    });
  };
  const handleSave = async (next: FinanceState) => {
    await commit(next);
    setDialog(null);
  };
  if (loading)
    return (
      <div className="loading">
        <Brand />
        <span className="loader" />
        <p>Preparando tu espacio…</p>
      </div>
    );
  if (!state)
    return (
      <>
        <Gate
          repo={repo}
          exists={exists}
          onOpen={open}
          onDemo={() => {
            setState(demoState());
            setDemo(true);
            setError("");
          }}
          onRestore={() => setDialog({ kind: "restore" })}
          error={error}
        />
        {dialog?.kind === "restore" && (
          <Modal
            title="Recuperar mis registros"
            onClose={() => setDialog(null)}
          >
            <RestorePanel
              repo={repo}
              onRestored={(s) => {
                open(s);
                setDialog(null);
              }}
            />
          </Modal>
        )}
      </>
    );
  const period = periodFor(
      periodMode,
      anchor,
    periodMode === "range" ? (end<anchor?anchor:end) : undefined,
    ),
    sum = totals(state, period, scope),
    balances = available({...state,accounts:state.accounts.filter(a=>a.openingDate<=today())}, scope),
    rows = sorted(selectedMovements(state, period, scope));
  const title =
    page === "summary"
      ? "Tu resumen"
      : page === "activities"
        ? "Tus actividades"
        : page === "goals"
          ? "Un paso más cerca"
          : page === "movements"
            ? "Tus movimientos"
            : page === "pending"
              ? "Por cobrar"
              : page === "personal"
                ? "Tu espacio personal"
                : page === "reports"
                  ? "Cierre y reportes"
                  : "Tu configuración";
  const shiftPeriod = (n: number) => {
    if (periodMode === "week") setAnchor(shiftDate(anchor, 7 * n));
    else {
      const d = new Date(anchor + "T12:00:00");
      d.setDate(1);
      if (periodMode === "year") d.setFullYear(d.getFullYear() + n);
      else d.setMonth(d.getMonth() + n);
      setAnchor(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
      );
    }
  };
  const drill = (start: string, finish: string, type?: string) => {
    setAnchor(start);
    setEnd(finish);
    setPeriodMode("range");
    setPage("movements");
    setInitialType(type ?? "all");
  };
  // This state lives in a child below; a key carries drill-down type without duplicating financial data.
  function setInitialType(t: string) {
    sessionStorage.setItem("gina-view-type", t);
  }
  const panelProps = {
    state,
    onSave: handleSave,
    onClose: () => setDialog(null),
  };
  const activeGoals = state.goals.filter(
    (g) =>
      !g.archived &&
      g.start <= period.end &&
      g.end >= period.start &&
      (scope === "all" || g.scope === scope),
  );
  const due = state.receivables.filter(
    (r) => !r.archived && pendingAmount(state, r.id) > 0,
  );
  const visiblePending=state.receivables.filter(r=>{
    const source=state.sources.find(s=>s.id===r.sourceId);
    return (showHistory||!r.archived)&&(scope==='all'||scope==='professional'&&source?.area!=='personal'||source?.area===scope||source?.id===scope);
  });
  const status = (
    <span className="save-status">
      <span className={`status-dot ${online ? "" : "offline"}`} />
      {demo ? (
        "Demostración · datos de ejemplo"
      ) : !online ? (
        <>
          <WifiOff size={13} /> Sin conexión · guardado local
        </>
      ) : (
        <>Guardado en este dispositivo</>
      )}
    </span>
  );
  return (
    <PrivacyContext.Provider value={hidden}>
      <div className="app-shell">
        <aside className="sidebar">
          <Brand />
          <div className="sidebar-label">MI ESPACIO</div>
          <nav aria-label="Navegación principal">
            <button
              className={page === "summary" ? "active" : ""}
              onClick={() => navigate("summary")}
            >
              <Home />
              Resumen
            </button>
            <button
              className={
                page === "activities" || page === "personal" ? "active" : ""
              }
              onClick={() => navigate("activities")}
            >
              <ChartNoAxesColumnIncreasing />
              Actividades
            </button>
            <button
              className={page === "goals" ? "active" : ""}
              onClick={() => navigate("goals")}
            >
              <Target />
              Mis metas
            </button>
            <button
              className={page === "movements" ? "active" : ""}
              onClick={() => navigate("movements")}
            >
              <ArrowLeftRight />
              Movimientos
            </button>
            <button
              className={page === "pending" ? "active" : ""}
              onClick={() => navigate("pending")}
            >
              <CalendarDays />
              Por cobrar
              {due.length > 0 && <b className="nav-count">{due.length}</b>}
            </button>
            <button
              className={page === "reports" ? "active" : ""}
              onClick={() => navigate("reports")}
            >
              <Download />
              Reportes
            </button>
          </nav>
          <button className="btn btn-primary" onClick={() => newMovement()}>
            <Plus size={19} />
            Registrar movimiento
          </button>
          <div className="sidebar-bottom">
            <div className="small-note">
              <ShieldCheck />
              <p>
                Tu información, protegida.
                <span>Recuerda guardar un respaldo.</span>
              </p>
            </div>
            <button
              className={page === "settings" ? "active" : ""}
              onClick={() => navigate("settings")}
            >
              <Settings size={19} />
              Configuración
            </button>
            <div className="profile">
              <span>G</span>
              <div>
                <strong>{state.profile.name}</strong>
                <small>Orthomax · La Paz</small>
              </div>
              <button
                className="icon-btn"
                aria-label="Bloquear aplicación"
                onClick={lock}
              >
                <LockKeyhole size={17} />
              </button>
            </div>
          </div>
        </aside>
        <div className="app-content">
          <header className="topbar">
            <div className="breadcrumbs">
              MI ESPACIO <ChevronRight size={12} /> <span>{title}</span>
            </div>
            <div className="mobile-brand">
              <Brand />
            </div>
            <div className="header-tools">
              <button
                className="icon-btn"
                aria-label={hidden ? "Mostrar importes" : "Ocultar importes"}
                onClick={() => setHidden(!hidden)}
              >
                {hidden ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
              <button
                className="icon-btn"
                aria-label="Ir a cobros pendientes"
                onClick={() => navigate("pending")}
              >
                <Bell size={20} />
                {due.length > 0 && <i />}
              </button>
              <button
                className="icon-btn mobile-settings"
                aria-label="Configuración"
                onClick={() => navigate("settings")}
              >
                <Settings size={20} />
              </button>
              <button
                className="avatar"
                onClick={lock}
                aria-label="Bloquear aplicación"
              >
                G
              </button>
            </div>
          </header>
          {demo && (
            <div className="demo-banner">
              <span>
                DEMOSTRACIÓN · Los importes son ficticios y se borran al salir.
              </span>
              <button onClick={lock}>
                Ir a mi espacio <ArrowLeft size={14} />
              </button>
            </div>
          )}
          {waiting && (
            <div className="update-banner">
              <p>
                <strong>Hay una actualización lista.</strong> Guarda cualquier
                formulario y exporta tu respaldo antes de continuar.
              </p>
              <button
                className="btn btn-secondary"
                disabled={!!dialog}
                onClick={() => {
                  if(saving.current){setError('Espera a que termine el guardado antes de actualizar.');return;}
                  if (
                    window.confirm(
                      "¿Actualizar ahora? Tus registros guardados se conservarán.",
                    )
                  ) {
                    navigator.serviceWorker.addEventListener(
                      "controllerchange",
                      () => location.reload(),
                      { once: true },
                    );
                    waiting.postMessage("ACTIVATE_UPDATE");
                  }
                }}
              >
                Actualizar
              </button>
            </div>
          )}
          {error && (
            <div className="error global-error" role="alert">
              {error}
              <button
                className="icon-btn"
                aria-label="Cerrar aviso"
                onClick={() => setError("")}
              >
                <X size={18} />
              </button>
            </div>
          )}
          <main className="main">
            <div className="page-heading">
              <div>
                <p className="eyebrow">
                  {page === "summary"
                    ? `HOLA, ${state.profile.name.toUpperCase()}`
                    : "GIMO · TUS FINANZAS"}
                </p>
                <h1>
                  {title}
                  <span>.</span>
                </h1>
                <p>
                  {page === "summary"
                    ? "Un poco de claridad para seguir creciendo."
                    : page === "goals"
                      ? "Dale un destino a tu esfuerzo."
                      : page === "settings"
                        ? "A tu manera, con tus datos protegidos."
                        : "Cada movimiento cuenta una parte de tu historia."}
                </p>
              </div>
              {page !== "settings" && (
                <button
                  className="btn btn-primary heading-register"
                  onClick={() =>
                    page === "goals"
                      ? setDialog({ kind: "goal" })
                      : newMovement()
                  }
                >
                  <Plus size={18} />
                  {page === "goals" ? "Crear meta" : "Registrar"}
                </button>
              )}
            </div>
            {page !== "settings" && (
              <div className="filters">
                <div className="segmented" aria-label="Periodo">
                  {(["week", "month", "year", "range"] as const).map((v, i) => (
                    <button
                      key={v}
                      aria-pressed={periodMode === v}
                      className={periodMode === v ? "selected" : ""}
                      onClick={() => setPeriodMode(v)}
                    >
                      {["Semana", "Mes", "Año", "Rango"][i]}
                    </button>
                  ))}
                </div>
                <div className="date-switch">
                  <button
                    className="icon-btn"
                    aria-label="Periodo anterior"
                    onClick={() => shiftPeriod(-1)}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <label>
                    <CalendarDays size={16} />
                    <input
                      aria-label="Fecha del periodo"
                      type={periodMode === "month" ? "month" : "date"}
                      value={
                        periodMode === "month" ? anchor.slice(0, 7) : anchor
                      }
                      onChange={(e) => {
                        if (e.target.value)
                          setAnchor(
                            periodMode === "month"
                              ? e.target.value + "-01"
                              : e.target.value,
                          );
                      }}
                    />
                  </label>
                  {periodMode === "range" && (
                    <input
                      aria-label="Hasta"
                      type="date"
                      min={anchor}
                      value={end}
                      onChange={(e) => {
                        if (e.target.value) setEnd(e.target.value);
                      }}
                    />
                  )}
                  <button
                    className="icon-btn"
                    aria-label="Periodo siguiente"
                    onClick={() => shiftPeriod(1)}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <label className="scope-select">
                  <span className="sr-only">Filtrar actividad</span>
                  <select
                    value={scope}
                    onChange={(e) => {setScope(e.target.value);if(page==='personal'&&e.target.value!=='personal')setPage('summary')}}
                  >
                    {Object.entries(areaLabels).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                    <optgroup label="Por fuente">
                      {state.sources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.archived ? " (archivada)" : ""}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>
              </div>
            )}
            {state.draft&&page==='summary'&&<div className="draft-banner"><span>Tienes un movimiento en borrador. Todavía no cuenta en tus ingresos ni gastos.</span><button className="text-btn" onClick={()=>newMovement(state.draft!)}>Continuar borrador</button></div>}
            {(page==='goals'||page==='pending')&&<label className="check-field"><input type="checkbox" checked={showHistory} onChange={e=>setShowHistory(e.target.checked)}/>Mostrar también archivados</label>}
            {(page === "summary" || page === "personal") && (
              <>
                <div className="dashboard-top">
                  <section className="balance-hero">
                    <div>
                      <span className="hero-tag">
                        <span />{" "}
                        {scope === "all"
                          ? "VISTA GENERAL"
                          : areaLabels[scope] ||
                            state.sources.find((s) => s.id === scope)?.name}
                      </span>
                      <p>Ingresos cobrados</p>
                      <h2>
                        <Amount value={sum.income} />
                        <small>MXN</small>
                      </h2>
                      <span className="hero-period">{period.label}</span>
                    </div>
                    <div className="hero-orbit" aria-hidden="true">
                      <ArrowUpRight />
                    </div>
                    <div className="hero-bottom">
                      <span>
                        Resultado operativo{" "}
                        <strong>
                          <Amount value={sum.operating} />
                        </strong>
                      </span>
                      <button
                        onClick={() =>
                          drill(period.start, period.end, "income")
                        }
                      >
                        Ver ingresos <ChevronRight size={17} />
                      </button>
                    </div>
                  </section>
                  <div className="kpi-grid">
                    <button
                      className="kpi"
                      onClick={() => drill(period.start, period.end, "expense")}
                    >
                      <span className="kpi-top">
                        <span>Gastos pagados</span>
                        <span className="round-icon expense">
                          <ArrowDownRight size={18} />
                        </span>
                      </span>
                      <strong>
                        <Amount value={sum.expense} />
                      </strong>
                      <small>
                        Salidas del periodo <ChevronRight size={14} />
                      </small>
                    </button>
                    <button
                      className="kpi"
                      onClick={() =>
                        drill(period.start, period.end, "investment")
                      }
                    >
                      <span className="kpi-top">
                        <span>Inversión</span>
                        <span className="round-icon investment">
                          <Sprout size={18} />
                        </span>
                      </span>
                      <strong>
                        <Amount value={sum.investment} />
                      </strong>
                      <small>
                        Equipo y mejoras <ChevronRight size={14} />
                      </small>
                    </button>
                    <div className="kpi flow">
                      <span className="kpi-top">
                        <span>Flujo neto</span>
                        <span className="round-icon mint">
                          <Wallet size={18} />
                        </span>
                      </span>
                      <strong>
                        <Amount value={sum.flow} />
                      </strong>
                      <small>Ingresos − gastos − inversión</small>
                    </div>
                    <div className="kpi">
                      <span className="kpi-top">
                        <span>Dinero libre hoy</span>
                        <span className="round-icon mint">
                          <Leaf size={18} />
                        </span>
                      </span>
                      <strong>
                        {areaLabels[scope]?<Amount value={balances.free}/>:<span style={{fontSize:18}}>Por cuenta</span>}
                      </strong>
                      <small>{areaLabels[scope]?'Saldo − apartados de cuentas incluidas':'Consulta tus saldos en General'}</small>
                    </div>
                  </div>
                </div>
                {scope!=='all'&&<section className="transfer-note"><ArrowLeftRight size={20}/><div><span>Transferencias recibidas <strong><Amount value={sum.transfersIn}/></strong></span><span>Transferencias enviadas <strong><Amount value={sum.transfersOut}/></strong></span><small>Dinero movido entre tus cuentas. No aumenta lo ganado ni las metas.</small></div></section>}
                <div className="dashboard-columns">
                  <div className="primary-column">
                    <section className="card">
                      <SectionHead
                        title="Así va tu progreso"
                        subtitle={
                          periodMode === "month"
                            ? "Ingresos por tramos del mes"
                            : period.label
                        }
                      />
                      <BarChart
                        data={chartSeries(state, period, scope, "income")}
                        onSelect={(a, b) => drill(a, b, "income")}
                        suffix="Toca una barra para ver los movimientos."
                      />
                    </section>
                    <section className="card">
                      <SectionHead
                        title="Últimos movimientos"
                        action="Ver todos"
                        onAction={() => navigate("movements")}
                      />
                      {rows.length ? (
                        <MovementList
                          state={state}
                          rows={rows.slice(0, 5)}
                          onOpen={(m) =>
                            setDialog({ kind: "detail", movement: m })
                          }
                        />
                      ) : (
                        <Empty
                          title="Tu historia empieza aquí"
                          text="Registra tu primer ingreso o gasto. Lo verás reflejado en todo tu espacio."
                          action="Registrar movimiento"
                          onAction={() => newMovement()}
                        />
                      )}
                    </section>
                  </div>
                  <div className="secondary-column">
                    {activeGoals.slice(0, 2).map((g) => (
                      <GoalCard
                        key={g.id}
                        state={state}
                        goal={g}
                        onEdit={() => setDialog({ kind: "goal", initial: g })}
                      />
                    ))}
                    {!activeGoals.length && (
                      <section className="card new-goal">
                        <span className="round-icon mint">
                          <Target />
                        </span>
                        <h2>¿Qué quieres lograr?</h2>
                        <p>
                          Una meta pequeña es un gran comienzo. Define cuánto
                          quieres cobrar esta semana o este mes.
                        </p>
                        <button
                          className="btn btn-secondary"
                          onClick={() => setDialog({ kind: "goal" })}
                        >
                          <Plus size={16} />
                          Crear mi primera meta
                        </button>
                      </section>
                    )}
                    <section className="card">
                      <SectionHead title="Por actividad" />
                      <div className="source-summary">
                        {(
                          ["clinic", "collaborations", "personal"] as const
                        ).map((a, i) => (
                          <button
                            key={a}
                            onClick={() => {
                              setScope(a);
                              navigate(
                                a === "personal" ? "personal" : "activities",
                              );
                            }}
                          >
                            <span className={`source-mark color-${i}`}>
                              {i === 0 ? "O" : i === 1 ? "C" : "P"}
                            </span>
                            <span>{areaLabels[a]}</span>
                            <strong>
                              <Amount value={totals(state, period, a).income} />
                            </strong>
                          </button>
                        ))}
                      </div>
                    </section>
                    <button
                      className="backup-nudge"
                      onClick={() => navigate("settings")}
                    >
                      <ShieldCheck size={23} />
                      <span>
                        <strong>Cuida lo que has registrado</strong>
                        <small>
                          {state.lastExportAt
                            ? "Última exportación: " +
                              new Date(state.lastExportAt).toLocaleDateString(
                                "es-MX",
                              )
                            : "Guarda tu primer respaldo fuera del iPhone."}
                        </small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
                {page === "personal" && (
                  <PersonalDetails
                    state={state}
                    period={period}
                    anchor={anchor}
                    onSavings={() => setDialog({ kind: "savings" })}
                    onBudget={() => setDialog({ kind: "budget" })}
                  />
                )}
              </>
            )}
            {page === "activities" && (
              <Activities
                state={state}
                period={period}
                scope={scope}
                onSelect={(id) => {
                  setScope(id);
                }}
                onRegister={() => newMovement()}
                onPersonal={() => navigate("personal")}
                onDrill={(a, b, t) => drill(a, b, t)}
              />
            )}
            {page === "goals" && (
              <div className="goals-grid">
                {state.goals
                  .filter(
                    (g) =>
                      (showHistory||!g.archived) && (scope === "all" || g.scope === scope),
                  )
                  .map((g) => (
                    <GoalCard
                      key={g.id}
                      state={state}
                      goal={g}
                      onEdit={() => setDialog({ kind: "goal", initial: g })}
                    />
                  ))}
                <button
                  className="add-goal"
                  onClick={() => setDialog({ kind: "goal" })}
                >
                  <span className="round-icon mint">
                    <Plus />
                  </span>
                  <h3>Tu próxima meta</h3>
                  <p>Ingresos o ahorro, a tu propio ritmo.</p>
                </button>
              </div>
            )}
            {page === "movements" && (
              <Movements
                state={state}
                period={period}
                scope={scope}
                onOpen={(m) => setDialog({ kind: "detail", movement: m })}
                onAdd={() => newMovement()}
              />
            )}
            {page === "pending" && (
              <section className="card">
                <SectionHead
                  title="Honorarios por cobrar"
                  subtitle="Solo el dinero recibido se suma a tus ingresos."
                  action="Agregar pendiente"
                  onAction={() => setDialog({ kind: "pending" })}
                />
                {visiblePending.length ? (
                  <div className="receivable-grid">
                    {visiblePending
                      .map((r) => {
                        const remaining = pendingAmount(state, r.id),
                          late =
                            r.dueDate && r.dueDate < today() && remaining > 0;
                        return (
                          <article className="receivable-card" key={r.id}>
                            <span className={`pill ${late ? "danger" : ""}`}>
                              {r.archived?'Archivado':remaining === 0
                                ? "Cobrado"
                                : late
                                  ? "Vencido"
                                  : remaining < r.totalCents
                                    ? "Cobro parcial"
                                    : "Pendiente"}
                            </span>
                            <h3>{r.title}</h3>
                            <p>
                              {
                                state.sources.find((s) => s.id === r.sourceId)
                                  ?.name
                              }
                            </p>
                            <strong>
                              <Amount value={remaining} />
                            </strong>
                            <small>
                              Por cobrar de <Amount value={r.totalCents} />
                              {r.dueDate ? " · Vence " + r.dueDate : ""}
                            </small>
                            {remaining > 0 && !r.archived && (
                              <button
                                className="btn btn-secondary"
                                onClick={() =>
                                  newMovement({
                                    type: "income",
                                    sourceId: r.sourceId,
                                    receivableId: r.id,
                                    amountCents: remaining,
                                    note: r.title,
                                  })
                                }
                              >
                                Registrar cobro
                              </button>
                            )}
                            <button className="text-btn" onClick={()=>setDialog({kind:'pending',initial:r})}>Editar pendiente</button>
                          </article>
                        );
                      })}
                  </div>
                ) : (
                  <Empty
                    title="Todo en orden"
                    text="Anota los honorarios que aún no recibes y registra cada pago cuando llegue."
                    action="Agregar pendiente"
                    onAction={() => setDialog({ kind: "pending" })}
                  />
                )}
              </section>
            )}
            {page === "reports" && (
              <Reports
                state={state}
                period={period}
                anchor={anchor}
                scope={scope}
                onSave={commit}
              />
            )}
            {page === "settings" && (
              <><div className="settings-shortcuts"><button className="btn btn-secondary" onClick={()=>navigate('reports')}><Download size={17}/>Reportes y cierre mensual</button><button className="btn btn-secondary" onClick={()=>navigate('movements')}><ArrowLeftRight size={17}/>Todos mis movimientos</button></div><SettingsView
                state={state}
                repo={repo}
                demo={demo}
                offlineReady={offlineReady}
                onSave={commit}
                onLock={lock}
                onRestored={restored}
                onAccount={() => setDialog({ kind: "account" })}
                onRestore={() => setDialog({ kind: "restore" })}
                onUseFavorite={(f) => newMovement(f)}
              /></>
            )}
            <footer className="app-footer">
              {status}
              <span>
                Hecho para ti, Dra. Gina <Leaf size={12} />
              </span>
            </footer>
          </main>
          <nav className="bottom-nav" aria-label="Navegación móvil">
            <button
              className={page === "summary" ? "active" : ""}
              onClick={() => navigate("summary")}
            >
              <Home size={22} />
              <span>Resumen</span>
            </button>
            <button
              className={
                page === "activities" || page === "personal" ? "active" : ""
              }
              onClick={() => navigate("activities")}
            >
              <ChartNoAxesColumnIncreasing size={22} />
              <span>Actividades</span>
            </button>
            <button className="register-nav" onClick={() => newMovement()}>
              <i>
                <Plus size={25} />
              </i>
              <span>Registrar</span>
            </button>
            <button
              className={page === "goals" ? "active" : ""}
              onClick={() => navigate("goals")}
            >
              <Target size={22} />
              <span>Metas</span>
            </button>
          </nav>
        </div>
      </div>
      {dialog && dialog.kind !== "detail" && (
        <Modal
          title={
            {
              movement:
                dialog.kind === "movement" && dialog.initial?.id
                  ? "Editar movimiento"
                  : "Registrar movimiento",
              goal: "Tu meta",
              account: "Agregar cuenta",
              pending: "Nuevo cobro pendiente",
              savings: "Tu ahorro",
              budget: "Presupuesto mensual",
              restore: "Restaurar respaldo",
            }[dialog.kind]
          }
          onClose={() => setDialog(null)}
        >
          {dialog.kind === "movement" ? (
            <MovementForm {...panelProps} initial={dialog.initial} />
          ) : dialog.kind === "goal" ? (
            <><GoalForm {...panelProps} initial={dialog.initial}/>{dialog.initial&&<button className="text-btn danger-text" onClick={async()=>{try{const next=structuredClone(state);const item=next.goals.find(g=>g.id===dialog.initial!.id)!;item.archived=!item.archived;await handleSave(next)}catch(e){setError((e as Error).message)}}}>{dialog.initial.archived?'Reactivar meta':'Archivar meta'}</button>}</>
          ) : dialog.kind === "account" ? (
            <AccountForm {...panelProps} />
          ) : dialog.kind === "pending" ? (
            <><ReceivableForm {...panelProps} initial={dialog.initial}/>{dialog.initial&&<button className="text-btn danger-text" onClick={async()=>{try{const next=structuredClone(state);const item=next.receivables.find(g=>g.id===dialog.initial!.id)!;item.archived=!item.archived;await handleSave(next)}catch(e){setError((e as Error).message)}}}>{dialog.initial.archived?'Reactivar pendiente':'Archivar pendiente'}</button>}</>
          ) : dialog.kind === "savings" ? (
            <SavingsForm {...panelProps} />
          ) : dialog.kind === "budget" ? (
            <BudgetForm {...panelProps} />
          ) : (
            <RestorePanel
              repo={repo}
              onRestored={restored}
            />
          )}
        </Modal>
      )}
      {dialog?.kind === "detail" && (
        <Modal title="Detalle del movimiento" onClose={() => setDialog(null)}>
          <div className="movement-detail">
            <MovementIcon type={dialog.movement.type} />
            <span className="eyebrow">
              {movementLabels[dialog.movement.type]}
              {dialog.movement.voided ? " · ANULADO" : ""}
            </span>
            <h2>
              <Amount value={dialog.movement.amountCents} />
            </h2>
            <p>
              {dialog.movement.note ||
                state.categories.find(
                  (c) => c.id === dialog.movement.categoryId,
                )?.name}
            </p>
            <dl>
              <dt>Fecha</dt>
              <dd>{dialog.movement.date}</dd>
              <dt>Actividad</dt>
              <dd>
                {
                  state.sources.find((s) => s.id === dialog.movement.sourceId)
                    ?.name
                }
              </dd>
              <dt>Cuenta</dt>
              <dd>
                {
                  state.accounts.find((a) => a.id === dialog.movement.accountId)
                    ?.name
                }
              </dd>
              {dialog.movement.toAccountId && (
                <>
                  <dt>Destino</dt>
                  <dd>
                    {
                      state.accounts.find(
                        (a) => a.id === dialog.movement.toAccountId,
                      )?.name
                    }
                  </dd>
                </>
              )}
            </dl>
          </div>
          <div className="detail-actions">
            <button
              className="btn btn-primary"
              onClick={() =>
                setDialog({ kind: "movement", initial: dialog.movement })
              }
            >
              Editar movimiento
            </button>
            <button
              className="btn btn-secondary"
              onClick={() =>
                setDialog({
                  kind: "movement",
                  initial: {
                    ...dialog.movement,
                    id: undefined,
                    receivableId: undefined,
                    date: today(),
                    voided: false,
                  },
                })
              }
            >
              Duplicar
            </button>
            <button
              className="btn btn-secondary"
              onClick={async () => {
                try {
                  const m = dialog.movement;
                  const next = structuredClone(state);
                  next.favorites.push({
                    id: uid(),
                    title: m.note || movementLabels[m.type],
                    type: m.type,
                    sourceId: m.sourceId,
                    accountId: m.accountId,
                    toAccountId: m.toAccountId,
                    categoryId: m.categoryId,
                    note: m.note,
                    amountCents: m.amountCents,
                  });
                  await handleSave(next);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Guardar como favorito
            </button>
            <button
              className="text-btn danger-text"
              onClick={async () => {
                if (
                  !confirm(
                    dialog.movement.voided
                      ? "¿Reactivar este movimiento?"
                      : "¿Anular este movimiento? Se conservará en el historial.",
                  )
                )
                  return;
                try {
                  const next = structuredClone(state);
                  const m = next.movements.find(
                    (m) => m.id === dialog.movement.id,
                  )!;
                  m.voided = !m.voided;
                  m.updatedAt = new Date().toISOString();
                  next.audit.push({
                    id: uid(),
                    at: m.updatedAt,
                    action: m.voided
                      ? "Anular movimiento"
                      : "Reactivar movimiento",
                    entityId: m.id,
                  });
                  await handleSave(next);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {dialog.movement.voided
                ? "Reactivar movimiento"
                : "Anular movimiento"}
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
          {undo && <button onClick={doUndo}>Deshacer</button>}
          <button
            aria-label="Cerrar confirmación"
            onClick={() => {
              setToast("");
              setUndo(null);
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </PrivacyContext.Provider>
  );
}

function Activities({
  state,
  period,
  scope,
  onSelect,
  onRegister,
  onPersonal,
  onDrill,
}: {
  state: FinanceState;
  period: Period;
  scope: string;
  onSelect: (s: string) => void;
  onRegister: () => void;
  onPersonal: () => void;
  onDrill: (a: string, b: string, t?: string) => void;
}) {
  const [type, setType] = useState<"income" | "expense" | "investment">(
    "income",
  );
  const sources = state.sources.filter(
    (s) =>
      !s.archived &&
      (scope === "all" ||
        (scope === "professional" && s.area !== "personal") ||
        s.area === scope ||
        s.id === scope),
  );
  return (
    <>
      <section className="card">
        <SectionHead
          title="Cada actividad, una perspectiva"
          subtitle="Compara lo que aporta cada fuente en el periodo seleccionado."
        />
        <div className="segmented small">
          {(["income", "expense", "investment"] as const).map((t) => (
            <button
              key={t}
              className={type === t ? "selected" : ""}
              onClick={() => setType(t)}
            >
              {movementLabels[t]}s
            </button>
          ))}
        </div>
        <div className="activity-grid">
          {sources.map((s, i) => {
            const total = totals(state, period, s.id);
            return (
              <button
                className="activity-card"
                key={s.id}
                onClick={() =>
                  s.id === "personal" ? onPersonal() : onSelect(s.id)
                }
              >
                <span className={`source-mark color-${i % 5}`}>
                  {s.id === "orthomax"
                    ? "O"
                    : s.name.replace("Dr. ", "").slice(0, 1)}
                </span>
                <h3>{s.name}</h3>
                <p>{areaLabels[s.area]}</p>
                <strong>
                  <Amount value={total[type]} />
                </strong>
                <span className="activity-link">
                  Ver actividad <ChevronRight size={16} />
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <div className="dashboard-columns equal">
        <section className="card">
          <SectionHead title="Comparación por fuente" />
          <BarChart
            data={sources.map((s) => ({
              label: s.name
                .replace("Dr. ", "")
                .replace("Orthomax Consultorio propio", "Orthomax")
                .replace("Gastos profesionales compartidos", "Compartidos"),
              value: totals(state, period, s.id)[type],
              start: period.start,
              end: period.end,
            }))}
            label={`${movementLabels[type]}s por fuente`}
          />
        </section>
        <section className="card">
          <SectionHead
            title="A lo largo del periodo"
            action="Registrar"
            onAction={onRegister}
          />
          <BarChart
            data={chartSeries(state, period, scope, type)}
            onSelect={(a, b) => onDrill(a, b, type)}
          />
        </section>
      </div>
    </>
  );
}

function Movements({
  state,
  period,
  scope,
  onOpen,
  onAdd,
}: {
  state: FinanceState;
  period: Period;
  scope: string;
  onOpen: (m: Movement) => void;
  onAdd: () => void;
}) {
  const [query, setQuery] = useState(""),
    [type, setType] = useState(
      () => sessionStorage.getItem("gina-view-type") || "all",
    ),
    [account, setAccount] = useState("all"),
    [category, setCategory] = useState("all"),
    [status, setStatus] = useState("active"),
    [min, setMin] = useState(""),
    [max, setMax] = useState("");
  useEffect(() => () => sessionStorage.removeItem("gina-view-type"), []);
  const base = selectedMovements(
    {
      ...state,
      movements: state.movements.map((m) => ({ ...m, voided: false })),
    },
    period,
    scope,
  ).map((m) => state.movements.find((o) => o.id === m.id)!);
  const rows = sorted(
    base.filter(
      (m) =>
        (type === "all" || m.type === type) &&
        (category === "all" || m.categoryId === category) &&
        (account === "all" ||
          m.accountId === account ||
          m.toAccountId === account) &&
        (status === "all" || (status === "voided" ? m.voided : !m.voided)) &&
        (!min || m.amountCents >= Number(min) * 100) &&
        (!max || m.amountCents <= Number(max) * 100) &&
        `${m.note} ${state.sources.find((s) => s.id === m.sourceId)?.name} ${state.categories.find((c) => c.id === m.categoryId)?.name}`
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
          .includes(
            query
              .normalize("NFD")
              .replace(/\p{Diacritic}/gu, "")
              .toLowerCase(),
          ),
    ),
  );
  return (
    <section className="card">
      <SectionHead
        title="Tu registro, en orden"
        subtitle={`${rows.length} movimientos · ${period.label}`}
        action="Registrar"
        onAction={onAdd}
      />
      <div className="list-filters">
        <label className="search-box">
          <Search size={18} />
          <input
            aria-label="Buscar movimientos"
            placeholder="Buscar concepto o actividad"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Tipo de movimiento"
          value={type}
          onChange={(e) => { setType(e.target.value); setCategory("all"); }}
        >
          <option value="all">Todos los tipos</option>
          {Object.entries(movementLabels).map(([t, l]) => (
            <option value={t} key={t}>
              {l}
            </option>
          ))}
        </select>
        <select aria-label="Filtrar categoría" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">Todas las categorías</option>
          {state.categories.filter((c) => type === "all" || c.type === type).map((c) => <option key={c.id} value={c.id}>{c.name}{c.archived ? " · archivada" : ""}</option>)}
        </select>
        <select
          aria-label="Cuenta"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        >
          <option value="all">Todas las cuentas</option>
          {state.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Estado"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="active">Registrados</option>
          <option value="voided">Anulados</option>
          <option value="all">Todos los estados</option>
        </select>
      </div>
      <details className="advanced-filters">
        <summary>Filtrar por importe</summary>
        <div className="form-grid">
          <label className="field">
            Desde MXN
            <input
              inputMode="decimal"
              type="number"
              min="0"
              value={min}
              onChange={(e) => setMin(e.target.value)}
            />
          </label>
          <label className="field">
            Hasta MXN
            <input
              inputMode="decimal"
              type="number"
              min="0"
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
          </label>
        </div>
      </details>
      {rows.length ? (
        <MovementList state={state} rows={rows} onOpen={onOpen} />
      ) : (
        <Empty
          title="Sin movimientos en esta vista"
          text="Prueba con otro periodo o registra tu primer movimiento."
        />
      )}
      <div className="card-bottom">
        <small>La exportación CSV contiene datos legibles.</small>
        <button
          className="text-btn"
          disabled={!rows.length}
          onClick={() =>
            download(
              exportCsv(state, rows),
              `movimientos-${period.start}.csv`,
              "text/csv;charset=utf-8",
            )
          }
        >
          <Download size={16} />
          Exportar CSV
        </button>
      </div>
    </section>
  );
}

function PersonalDetails({
  state,
  period,
  anchor,
  onSavings,
  onBudget,
}: {
  state: FinanceState;
  period: Period;
  anchor?: string;
  onSavings: () => void;
  onBudget: () => void;
}) {
  const expenses = selectedMovements(state, period, "personal").filter(
    (m) => m.type === "expense",
  );
  const budgetPeriod = periodFor("month", anchor || period.start);
  const budgetMonth = budgetPeriod.start.slice(0, 7);
  const monthlyExpenses = selectedMovements(state, budgetPeriod, "personal").filter(
    (movement) => movement.type === "expense",
  );
  const personalAccounts = new Set(
    state.accounts.filter((account) => account.area === "personal").map((account) => account.id),
  );
  const personalPockets = state.pockets.filter(
    (pocket) => !pocket.archived && personalAccounts.has(pocket.accountId),
  );
  const grouped = state.categories
    .filter((c) => c.type === "expense")
    .map((c) => ({
      ...c,
      value: expenses
        .filter((m) => m.categoryId === c.id)
        .reduce((a, m) => a + m.amountCents, 0),
      monthlyValue: monthlyExpenses
        .filter((movement) => movement.categoryId === c.id)
        .reduce((amount, movement) => amount + movement.amountCents, 0),
    }));
  return (
    <div className="dashboard-columns equal">
      <section className="card">
        <SectionHead
          title="Gastos por categoría"
          subtitle={`Importes del periodo: ${period.label}`}
          action="Presupuesto"
          onAction={onBudget}
        />
        {grouped
          .filter(
            (c) =>
              c.value > 0 || state.budgets.some((b) => b.categoryId === c.id && b.month === budgetMonth),
          )
          .map((c, i) => {
            const budget = state.budgets.find(
              (b) =>
                b.categoryId === c.id && b.month === budgetMonth,
            );
            return (
              <div className="category-row" key={c.id}>
                <span className={`source-mark color-${i % 5}`}>
                  {c.name.slice(0, 1)}
                </span>
                <div>
                  <strong>{c.name}</strong>
                  {budget && (
                    <>
                      <small>
                        {budgetPeriod.label}: <Amount value={c.monthlyValue} /> de <Amount value={budget.limitCents} />
                      </small>
                      <div className="progress-track" role="progressbar" aria-label={`Presupuesto de ${c.name} en ${budgetPeriod.label}`} aria-valuenow={Math.round(Math.min(100, c.monthlyValue / budget.limitCents * 100))} aria-valuemin={0} aria-valuemax={100}>
                        <i
                          className={
                            c.monthlyValue > budget.limitCents ? "over-budget" : ""
                          }
                          style={{
                            width:
                              Math.min(
                                100,
                                (c.monthlyValue / budget.limitCents) * 100,
                              ) + "%",
                          }}
                        />
                      </div>
                      {c.monthlyValue >= budget.limitCents * 0.8 && <small className={c.monthlyValue > budget.limitCents ? "danger-text" : ""}>{c.monthlyValue > budget.limitCents ? <>Superaste el presupuesto por <Amount value={c.monthlyValue - budget.limitCents} />.</> : c.monthlyValue === budget.limitCents ? "Llegaste a tu límite mensual." : "Te acercas a tu límite mensual."}</small>}
                    </>
                  )}
                </div>
                <b>
                  <Amount value={c.value} />
                </b>
              </div>
            );
          })}
        {!expenses.length && (
          <p className="hint">No hay gastos personales en el periodo seleccionado.</p>
        )}
        <p className="hint">Las barras de presupuesto siempre comparan el mes completo de {budgetPeriod.label}; los importes de la derecha corresponden al periodo seleccionado.</p>
      </section>
      <section className="card">
        <SectionHead
          title="Un espacio para tu ahorro"
          subtitle="Saldo actual de apartados en tus cuentas personales."
          action="Apartar"
          onAction={onSavings}
        />
        {personalPockets.map((p) => (
            <div className="category-row" key={p.id}>
              <span className="round-icon mint">
                <Sprout />
              </span>
              <div>
                <strong>{p.name}</strong>
                <small>
                  {state.accounts.find((a) => a.id === p.accountId)?.name}
                </small>
              </div>
              <b>
                <Amount value={pocketBalance(state, p.id)} />
              </b>
            </div>
          ))}
        {!personalPockets.length && (
          <Empty
            title="Dale nombre a tu ahorro"
            text="Un viaje, una tranquilidad, un nuevo comienzo. Aparta dinero sin perder de vista tu saldo."
            action="Crear apartado"
            onAction={onSavings}
          />
        )}
        <p className="hint">Apartar dinero no es un gasto. Aquí solo aparecen cuentas del área Personal; las cuentas mixtas pertenecen a General.</p>
      </section>
    </div>
  );
}

function Reports({
  state,
  period,
  anchor,
  scope,
  onSave,
}: {
  state: FinanceState;
  period: Period;
  anchor?: string;
  scope: string;
  onSave: (s: FinanceState) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const savingReview = useRef(false);
  const sum = totals(state, period, scope);
  const rows = selectedMovements(state, period, scope);
  const reviewPeriod = periodFor("month", anchor || period.start);
  const monthTotals = totals(state, reviewPeriod, "all");
  const reviewRows = selectedMovements(state, reviewPeriod, "all");
  // Compact deterministic change marker, not a security primitive. AES-GCM protects the saved state.
  const canonical = JSON.stringify([...reviewRows].sort((a, b) => a.id.localeCompare(b.id)).map((movement) => [
    movement.id, movement.type, movement.amountCents, movement.date, movement.sourceId,
    movement.accountId, movement.toAccountId || "", movement.categoryId, movement.note,
    movement.receivableId || "", movement.createdAt, movement.updatedAt,
  ]));
  let hashA = 0x811c9dc5, hashB = 0x9e3779b9;
  for (let index = 0; index < canonical.length; index++) {
    hashA = Math.imul(hashA ^ canonical.charCodeAt(index), 0x01000193);
    hashB = Math.imul(hashB ^ canonical.charCodeAt(index), 0x85ebca6b);
  }
  const fingerprint = `review-v1-${(hashA >>> 0).toString(16).padStart(8, "0")}${(hashB >>> 0).toString(16).padStart(8, "0")}`;
  const review = state.monthReviews.find(
    (r) => r.month === reviewPeriod.start.slice(0, 7),
  );
  const wholeMonth = period.start === reviewPeriod.start && period.end === reviewPeriod.end;
  return (
    <section className="card report">
      <SectionHead
        title="Un cierre con claridad"
        subtitle={`${period.label} · ${areaLabels[scope] || state.sources.find((s) => s.id === scope)?.name}`}
      />
      <div className="report-values">
        {[
          ["Ingresos cobrados", sum.income],
          ["Gastos pagados", sum.expense],
          ["Inversión en equipo", sum.investment],
          ["Resultado operativo", sum.operating],
          ["Flujo neto del periodo", sum.flow],
        ].map(([label, v]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>
              <Amount value={Number(v)} />
            </strong>
          </div>
        ))}
      </div>
      <p className="hint">
        Flujo neto = ingresos − gastos − inversión. El saldo de tus cuentas
        incluye movimientos anteriores y se consulta por separado. Este reporte
        es de control administrativo.
      </p>
      {review && (
        <section className="review-snapshot" aria-label="Comparación con el mes revisado">
          <h3>Tu revisión de {reviewPeriod.label} · General</h3>
          <p className="success-note">Guardada el {new Date(review.reviewedAt).toLocaleDateString("es-MX", { timeZone: "America/Mazatlan" })}{review.fingerprint !== fingerprint ? " · Hay cambios posteriores en los registros; revisa el mes de nuevo." : " · Sin cambios desde esta revisión."}</p>
          <div className="report-values">
            {([
              ["Ingresos cobrados", review.incomeCents, monthTotals.income],
              ["Gastos pagados", review.expenseCents, monthTotals.expense],
              ["Inversión en equipo", review.investmentCents, monthTotals.investment],
              ["Resultado operativo", review.incomeCents - review.expenseCents, monthTotals.operating],
              ["Flujo neto", review.incomeCents - review.expenseCents - review.investmentCents, monthTotals.flow],
            ] as [string, number, number][]).map(([label, saved, current]) => (
              <div key={label}><span>{label}<small>Guardado: <Amount value={saved} /></small></span><span>Actual: <Amount value={current} /><small>Cambio: <Amount value={current - saved} /></small></span></div>
            ))}
          </div>
          <p className="hint">Esta comparación conserva los importes de la última revisión del mes completo y los compara con los registros actuales de General. No congela el mes ni impide corregir movimientos.</p>
        </section>
      )}
      {error && <p className="error">{error}</p>}
      <div className="form-actions no-print">
        <button className="btn btn-secondary" onClick={() => window.print()}>
          Imprimir / Guardar PDF
        </button>
        <button
          className="btn btn-secondary"
          onClick={() =>
            download(
              exportCsv(state, rows),
              `reporte-${period.start}.csv`,
              "text/csv;charset=utf-8",
            )
          }
        >
          Exportar CSV
        </button>
        <button
          className="btn btn-primary"
          disabled={
            busy || scope !== "all" || !wholeMonth
          }
          onClick={async () => {
            if (savingReview.current || scope !== "all" || !wholeMonth) return;
            savingReview.current = true;
            setBusy(true);
            setError("");
            try {
              const next = structuredClone(state);
              next.monthReviews = next.monthReviews.filter(
                (r) => r.month !== reviewPeriod.start.slice(0, 7),
              );
              const reviewedAt = new Date().toISOString();
              next.monthReviews.push({
                month: reviewPeriod.start.slice(0, 7),
                reviewedAt,
                incomeCents: monthTotals.income,
                expenseCents: monthTotals.expense,
                investmentCents: monthTotals.investment,
                fingerprint,
              });
              next.audit.push({ id: uid(), at: reviewedAt, action: "Revisar mes completo", entityId: reviewPeriod.start.slice(0, 7) });
              await onSave(next);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              savingReview.current = false;
              setBusy(false);
            }
          }}
        >
          {busy ? "Guardando revisión…" : "Marcar mes revisado"}
        </button>
      </div>
      <small>
        Para marcar un cierre, selecciona General y un mes completo.
      </small>
    </section>
  );
}
