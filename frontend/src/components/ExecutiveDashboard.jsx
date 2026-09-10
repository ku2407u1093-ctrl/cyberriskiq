import { useMemo } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { api } from "../lib/api.js";
import { fmtINR, riskScoreColor } from "../lib/format.js";
import { useApi } from "../hooks/useApi.js";
import { Card, StatCard, Loading, ErrorBox, Badge } from "./ui.jsx";

const BU_COLORS = ["#3b82f6", "#f59e0b", "#ef4444", "#22c55e", "#a855f7", "#06b6d4"];

export default function ExecutiveDashboard() {
  const { data: overview, error: err1, loading: l1 } = useApi(() => api.overview(), []);
  const { data: recs, error: err2, loading: l2 } = useApi(() => api.recommendations(), []);

  const trendData = useMemo(() => {
    if (!overview) return [];
    const hist = overview.trend.history.map((h) => ({ month: h.month, actual: h.eal }));
    const fc = overview.trend.forecast.map((h) => ({ month: h.month, forecast: h.eal }));
    if (hist.length) fc.unshift({ month: hist[hist.length - 1].month, forecast: hist[hist.length - 1].actual });
    return [...hist, ...fc];
  }, [overview]);

  if (l1 || l2) return <Loading label="Computing enterprise risk posture…" />;
  if (err1 || err2) return <ErrorBox message={err1 || err2} />;
  if (!overview) return null;

  const scoreColor = riskScoreColor(overview.enterpriseRiskScore);
  const topRecs = (recs || []).slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-panel border border-slate-800 rounded-xl p-4 flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Enterprise Risk Score</span>
          <span className="text-2xl font-bold" style={{ color: scoreColor }}>{overview.enterpriseRiskScore}<span className="text-sm text-slate-500">/100</span></span>
          <span className="text-[11px] text-slate-500">Blends exposure vs. board risk ceiling + loss volatility</span>
        </div>
        <StatCard label="Total Financial Exposure (EAL)" value={fmtINR(overview.orgEAL)} sub="Expected Annual Loss — Monte Carlo mean" accent="text-white" />
        <StatCard label="Value at Risk (95%)" value={fmtINR(overview.orgVaR95)} sub="1-in-20-year bad case" accent="text-amber-400" />
        <StatCard label="Value at Risk (99%)" value={fmtINR(overview.orgVaR99)} sub="1-in-100-year tail case" accent="text-red-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <StatCard label="Assets Monitored" value={overview.assetCount} sub="Continuous telemetry ingestion" />
        <StatCard label="Open Vulnerabilities" value={overview.openVulnCount} sub="Across vuln scanners" />
        <StatCard
          label="Risk Trend"
          value={overview.trend.trendDirection === "rising" ? "▲ Rising" : overview.trend.trendDirection === "falling" ? "▼ Falling" : "▬ Stable"}
          sub={`${overview.trend.monthlySlopePct >= 0 ? "+" : ""}${overview.trend.monthlySlopePct.toFixed(1)}%/month projected`}
          accent={overview.trend.trendDirection === "rising" ? "text-red-400" : overview.trend.trendDirection === "falling" ? "text-green-400" : "text-slate-200"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card title="Risk Trend Analysis" subtitle="12-month history + 3-month linear-regression forecast (dashed)" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trendData} margin={{ left: 0, right: 10 }}>
              <defs>
                <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => fmtINR(v, { digits: 0 })} width={60} />
              <Tooltip
                contentStyle={{ background: "#111a2e", border: "1px solid #1e293b", fontSize: 12 }}
                formatter={(v) => fmtINR(v)}
              />
              <Area type="monotone" dataKey="actual" stroke="#3b82f6" fill="url(#actualGrad)" strokeWidth={2} name="Actual EAL" />
              <Area type="monotone" dataKey="forecast" stroke="#f59e0b" fill="none" strokeWidth={2} strokeDasharray="5 5" name="Forecast" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Risk by Business Unit" subtitle="Expected Annual Loss share">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={overview.perBU} dataKey="eal" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                {overview.perBU.map((_, i) => (
                  <Cell key={i} fill={BU_COLORS[i % BU_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#111a2e", border: "1px solid #1e293b", fontSize: 12 }} formatter={(v) => fmtINR(v)} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card title="Top Risk Contributors" subtitle="Highest Expected Annual Loss by asset" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={overview.topRiskContributors} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => fmtINR(v, { digits: 0 })} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ background: "#111a2e", border: "1px solid #1e293b", fontSize: 12 }} formatter={(v) => fmtINR(v)} />
              <Bar dataKey="eal" radius={[0, 4, 4, 0]}>
                {overview.topRiskContributors.map((a, i) => (
                  <Cell key={i} fill={a.criticality >= 5 ? "#ef4444" : a.criticality >= 4 ? "#f59e0b" : "#3b82f6"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Risk Reduction Opportunities" subtitle="Top 3 quantified mitigation actions">
          <div className="space-y-3">
            {topRecs.map((r) => (
              <div key={r.id} className="border border-slate-800 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium text-slate-200">{r.name}</span>
                  <Badge tone={r.rosi > 1 ? "green" : "blue"}>ROSI {(r.rosi * 100).toFixed(0)}%</Badge>
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                  <span>Cost: {fmtINR(r.costINR)}</span>
                  <span className="text-green-400">−{fmtINR(r.riskReductionINR)} EAL</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
