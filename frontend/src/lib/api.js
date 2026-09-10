let currentMode = "demo"; // "demo" | "real"

// In dev, Vite proxies /api to the local backend (see vite.config.js). In a
// split hosted deployment (e.g. frontend on Vercel, backend on Render), set
// VITE_API_BASE_URL to the backend's origin at build time so requests go
// cross-origin instead of to the static host.
const API_ORIGIN = import.meta.env.VITE_API_BASE_URL || "";

export function setApiMode(mode) {
  currentMode = mode === "real" ? "real" : "demo";
}
export function getApiMode() {
  return currentMode;
}

async function rawReq(url, opts) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function req(path, opts) {
  const base = currentMode === "real" ? "/api/real" : "/api";
  return rawReq(`${API_ORIGIN}${base}${path}`, opts);
}

// Live-scan control endpoints — always target /api/real regardless of the
// currently selected display mode, so the UI can check/trigger a scan even
// while viewing demo data.
export const realApi = {
  status: () => rawReq(`${API_ORIGIN}/api/real/status`),
  scan: () => rawReq(`${API_ORIGIN}/api/real/scan`, { method: "POST" }),
};

export const api = {
  overview: () => req("/overview"),
  assets: () => req("/assets"),
  asset: (id) => req(`/assets/${id}`),
  controls: () => req("/controls"),
  vulnerabilities: () => req("/vulnerabilities"),
  compliance: () => req("/compliance"),
  recommendations: () => req("/recommendations"),
  frontier: () => req("/investment/frontier"),
  optimize: (budgetINR) => req("/investment/optimize", { method: "POST", body: JSON.stringify({ budgetINR }) }),
  scenarioPresets: () => req("/scenario/presets"),
  runScenario: (payload) => req("/scenario/run", { method: "POST", body: JSON.stringify(payload) }),
  query: (question) => req("/query", { method: "POST", body: JSON.stringify({ question }) }),
  rebuild: (seed) => req("/rebuild", { method: "POST", body: JSON.stringify({ seed }) }),
};
