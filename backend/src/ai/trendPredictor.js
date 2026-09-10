import { makeRng } from "../utils/random.js";

// Predictive analytics for the "Risk Trend Analysis" widget. We synthesize a
// trailing 12-month EAL series anchored to today's computed EAL (a stand-in
// for what would normally be historical scan/telemetry snapshots), then fit
// an ordinary least-squares linear regression to project the next 3 months.
// This is a genuine statistical forecast (not a canned number) — swap the
// synthetic history for real historical snapshots and the same regression
// keeps working unchanged.

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function linearRegression(points) {
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export function buildTrend(currentEAL, opts = {}) {
  const rng = makeRng(opts.seed ?? 99);
  const now = new Date();
  const history = [];

  // Walk backwards from current EAL with a mild historical upward drift +
  // noise, then reverse so the series reads chronologically.
  let val = currentEAL;
  for (let i = 0; i < 12; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    history.push({ month: `${MONTH_NAMES[monthDate.getMonth()]} '${String(monthDate.getFullYear()).slice(2)}`, eal: Math.max(0, val) });
    const drift = val * rng.float(-0.06, 0.09);
    val = val - drift;
  }
  history.reverse();

  const points = history.map((h, i) => ({ x: i, y: h.eal }));
  const { slope, intercept } = linearRegression(points);

  const forecast = [];
  for (let i = 1; i <= 3; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const x = points.length - 1 + i;
    forecast.push({ month: `${MONTH_NAMES[monthDate.getMonth()]} '${String(monthDate.getFullYear()).slice(2)}`, eal: Math.max(0, slope * x + intercept), projected: true });
  }

  const trendDirection = slope > currentEAL * 0.005 ? "rising" : slope < -currentEAL * 0.005 ? "falling" : "stable";
  const monthlySlopePct = currentEAL ? (slope / currentEAL) * 100 : 0;

  return { history, forecast, slope, monthlySlopePct, trendDirection };
}
