// Minimal CVSS v3.0/3.1 base-score calculator. OSV.dev vulnerability records
// often carry a CVSS *vector string* (e.g. "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/
// C:H/I:H/A:H") without a precomputed numeric score, so we implement the
// official base-score formula to derive one deterministically instead of
// guessing.

const WEIGHTS = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  UI: { N: 0.85, R: 0.62 },
  C: { H: 0.56, L: 0.22, N: 0 },
  I: { H: 0.56, L: 0.22, N: 0 },
  A: { H: 0.56, L: 0.22, N: 0 },
  PR: {
    unchanged: { N: 0.85, L: 0.62, H: 0.27 },
    changed: { N: 0.85, L: 0.68, H: 0.5 },
  },
};

function roundUp1(x) {
  return Math.ceil(x * 10) / 10;
}

export function parseCvssVector(vector) {
  if (!vector || typeof vector !== "string") return null;
  const parts = {};
  vector.split("/").forEach((p) => {
    const [k, v] = p.split(":");
    if (k && v) parts[k] = v;
  });
  const { AV, AC, PR, UI, S, C, I, A } = parts;
  if (!AV || !AC || !PR || !UI || !S || !C || !I || !A) return null;

  const av = WEIGHTS.AV[AV];
  const ac = WEIGHTS.AC[AC];
  const ui = WEIGHTS.UI[UI];
  const c = WEIGHTS.C[C];
  const i = WEIGHTS.I[I];
  const a = WEIGHTS.A[A];
  const pr = S === "C" ? WEIGHTS.PR.changed[PR] : WEIGHTS.PR.unchanged[PR];
  if ([av, ac, ui, c, i, a, pr].some((v) => v === undefined)) return null;

  const iss = 1 - (1 - c) * (1 - i) * (1 - a);
  const impact = S === "C" ? 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15 : 6.42 * iss;
  const exploitability = 8.22 * av * ac * pr * ui;

  if (impact <= 0) return 0;
  const base = S === "C" ? 1.08 * (impact + exploitability) : impact + exploitability;
  return roundUp1(Math.min(base, 10));
}

export function severityLabelForScore(score) {
  if (score == null) return "Unknown";
  if (score >= 9) return "Critical";
  if (score >= 7) return "High";
  if (score >= 4) return "Medium";
  if (score > 0) return "Low";
  return "None";
}
