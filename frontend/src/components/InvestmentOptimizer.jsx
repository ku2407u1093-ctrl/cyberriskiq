import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from "recharts";
import { api } from "../lib/api.js";
import { fmtINR } from "../lib/format.js";
import { useApi } from "../hooks/useApi.js";
import { Card, Loading, ErrorBox, Badge } from "./ui.jsx";

const LAKH = 100_000;
const CRORE = 1_00_00_000;

export default function InvestmentOptimizer() {
  const { data: frontier, error: e1, loading: l1 } = useApi(() => api.frontier(), []);
  const [budgetLakhs, setBudgetLakhs] = useState(100); // ₹1 Cr default, matches problem statement example
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setBusy(true);
    setError(null);
    api
      .optimize(budgetLakhs * LAKH)
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, [budgetLakhs]);

  const chartData = frontier?.map((p) => ({ cost: p.cumulativeCostINR, reduction: p.cumulativeRiskReductionINR }));

  return (
    <div className="space-y-6">
      <Card title="Budget-Constrained Investment Optimizer" subtitle="0/1 knapsack over control-uplift actions, maximizing ₹ risk reduction for your budget">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
          <input
            type="range"
            min={10}
            max={500}
            step={5}
            value={budgetLakhs}
            onChange={(e) => setBudgetLakhs(Number(e.target.value))}
            className="flex-1 accent-blue-500"
          />
          <div className="text-sm font-semibold whitespace-nowrap">Budget: {fmtINR(budgetLakhs * LAKH)}</div>
        </div>
        {[[100, "₹1 Cr"], [250, "₹2.5 Cr"], [500, "₹5 Cr"]].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setBudgetLakhs(v)}
            className="text-[11px] mr-2 px-2 py-1 rounded-full bg-panel2 text-slate-300 hover:bg-slate-700"
          >
            {label}
          </button>
        ))}

        {busy && <Loading />}
        {error && <ErrorBox message={error} />}
        {result && !busy && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-panel2 rounded-lg p-3">
              <div className="text-[11px] text-slate-500">Recommended Spend</div>
              <div className="text-lg font-semibold">{fmtINR(result.totalCost)}</div>
              <div className="text-[11px] text-slate-500">Unspent: {fmtINR(result.unspent)}</div>
            </div>
            <div className="bg-panel2 rounded-lg p-3">
              <div className="text-[11px] text-slate-500">Total Risk Reduction</div>
              <div className="text-lg font-semibold text-green-400">{fmtINR(result.totalRiskReduction)}</div>
            </div>
            <div className="bg-panel2 rounded-lg p-3">
              <div className="text-[11px] text-slate-500">Overall ROSI</div>
              <div className="text-lg font-semibold text-accent">{(result.overallROSI * 100).toFixed(0)}%</div>
            </div>
          </div>
        )}
      </Card>

      {result && !busy && (
        <Card title="Recommended Actions" subtitle="Selected via knapsack optimization to maximize risk reduction within budget">
          <div className="space-y-2">
            {result.chosen.length === 0 && <p className="text-xs text-slate-500">Budget too small to fund any action — try increasing it.</p>}
            {result.chosen.map((c) => (
              <div key={c.id} className="flex items-center justify-between border border-slate-800 rounded-lg px-3 py-2">
                <div>
                  <div className="text-xs text-slate-200 font-medium">{c.name}</div>
                  <div className="text-[10px] text-slate-500">{c.category}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-300">{fmtINR(c.costINR)}</div>
                  <Badge tone="green">−{fmtINR(c.riskReductionINR)}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Investment vs. Risk Reduction Curve" subtitle="Efficient frontier — actions sorted by ROSI, revealing diminishing returns">
        {l1 && <Loading />}
        {e1 && <ErrorBox message={e1} />}
        {chartData && (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ left: 0, right: 10 }}>
              <defs>
                <linearGradient id="frontierGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="cost" tickFormatter={(v) => fmtINR(v, { digits: 1 })} tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tickFormatter={(v) => fmtINR(v, { digits: 0 })} tick={{ fontSize: 10, fill: "#64748b" }} width={60} />
              <Tooltip
                contentStyle={{ background: "#111a2e", border: "1px solid #1e293b", fontSize: 12 }}
                formatter={(v, name) => [fmtINR(v), name === "reduction" ? "Cumulative Risk Reduction" : "Cumulative Cost"]}
                labelFormatter={(v) => `Spend: ${fmtINR(v)}`}
              />
              <Area type="monotone" dataKey="reduction" stroke="#22c55e" fill="url(#frontierGrad)" strokeWidth={2} />
              {result && <ReferenceDot x={result.totalCost} y={result.totalRiskReduction} r={5} fill="#3b82f6" stroke="white" />}
            </AreaChart>
          </ResponsiveContainer>
        )}
        <p className="text-[11px] text-slate-500 mt-2">Blue dot marks your current budget selection. The flattening curve shows the optimal spend zone before returns diminish.</p>
      </Card>
    </div>
  );
}
