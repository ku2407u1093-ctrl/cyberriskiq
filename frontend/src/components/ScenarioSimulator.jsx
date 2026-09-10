import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api } from "../lib/api.js";
import { fmtINR } from "../lib/format.js";
import { useApi } from "../hooks/useApi.js";
import { Card, Loading, ErrorBox } from "./ui.jsx";

export default function ScenarioSimulator() {
  const { data: presets, error: e1, loading: l1 } = useApi(() => api.scenarioPresets(), []);
  const [activeId, setActiveId] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = (presetId) => {
    setActiveId(presetId);
    setBusy(true);
    setError(null);
    api
      .runScenario({ presetId })
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  };

  const chartData = result
    ? [
        { name: "Before", eal: result.beforeEAL, var95: result.beforeVar95 },
        { name: "After", eal: result.afterEAL, var95: result.afterVar95 },
      ]
    : [];

  return (
    <div className="space-y-6">
      <Card title="What-If Scenario Simulator" subtitle="Apply a control change and instantly see the re-quantified financial impact">
        {l1 && <Loading />}
        {e1 && <ErrorBox message={e1} />}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {presets?.map((p) => (
            <button
              key={p.id}
              onClick={() => run(p.id)}
              className={`text-left text-xs border rounded-lg p-3 transition-colors ${
                activeId === p.id ? "border-accent bg-accent/10" : "border-slate-800 hover:bg-panel2"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Card>

      {busy && <Loading label="Re-running Monte Carlo simulation…" />}
      {error && <ErrorBox message={error} />}

      {result && !busy && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card title={result.label} subtitle="Before vs. after Expected Annual Loss">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tickFormatter={(v) => fmtINR(v, { digits: 0 })} tick={{ fontSize: 10, fill: "#64748b" }} width={60} />
                <Tooltip contentStyle={{ background: "#111a2e", border: "1px solid #1e293b", fontSize: 12 }} formatter={(v) => fmtINR(v)} />
                <Bar dataKey="eal" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={i === 0 ? "#ef4444" : "#22c55e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Impact Summary">
            <div className="space-y-3">
              <Metric label="EAL Reduction" value={fmtINR(result.reductionINR)} sub={`${result.reductionPct.toFixed(1)}% lower`} tone={result.reductionINR >= 0 ? "text-green-400" : "text-red-400"} />
              <Metric label="VaR 95% shift" value={`${fmtINR(result.beforeVar95)} → ${fmtINR(result.afterVar95)}`} />
              <Metric label="Enterprise Risk Score" value={`${result.beforeRiskScore} → ${result.afterRiskScore}`} tone={result.afterRiskScore <= result.beforeRiskScore ? "text-green-400" : "text-red-400"} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub, tone = "text-slate-100" }) {
  return (
    <div className="border border-slate-800 rounded-lg p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`text-base font-semibold ${tone}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}
