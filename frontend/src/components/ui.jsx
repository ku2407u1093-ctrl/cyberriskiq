export function Card({ title, subtitle, children, className = "" }) {
  return (
    <div className={`bg-panel border border-slate-800 rounded-xl p-4 sm:p-5 ${className}`}>
      {title && (
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub, accent = "text-white" }) {
  return (
    <div className="bg-panel border border-slate-800 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`text-2xl font-bold ${accent}`}>{value}</span>
      {sub && <span className="text-[11px] text-slate-500">{sub}</span>}
    </div>
  );
}

export function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-700/40 text-slate-300",
    red: "bg-red-500/15 text-red-400",
    amber: "bg-amber-500/15 text-amber-400",
    green: "bg-green-500/15 text-green-400",
    blue: "bg-blue-500/15 text-blue-400",
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tones[tone]}`}>{children}</span>;
}

export function Loading({ label = "Loading…" }) {
  return (
    <div className="flex items-center justify-center py-16 text-slate-500 text-sm gap-2">
      <div className="h-4 w-4 border-2 border-slate-600 border-t-accent rounded-full animate-spin" />
      {label}
    </div>
  );
}

export function ErrorBox({ message }) {
  return <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{message}</div>;
}

export function ProgressBar({ pct, tone = "blue" }) {
  const tones = { blue: "bg-accent", green: "bg-safe", amber: "bg-warn", red: "bg-risk" };
  return (
    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
      <div className={`h-full ${tones[tone]}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}
