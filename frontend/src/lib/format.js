export function fmtINR(n, opts = {}) {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(opts.digits ?? 2)} Cr`;
  if (abs >= 1_00_000) return `₹${(n / 1_00_000).toFixed(opts.digits ?? 2)} L`;
  if (abs >= 1_000) return `₹${(n / 1_000).toFixed(opts.digits ?? 1)} K`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function fmtPct(n, digits = 0) {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function riskScoreColor(score) {
  if (score >= 70) return "#ef4444";
  if (score >= 40) return "#f59e0b";
  return "#22c55e";
}
