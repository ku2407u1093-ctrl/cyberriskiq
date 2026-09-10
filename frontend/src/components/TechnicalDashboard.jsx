import { useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { fmtINR, fmtPct } from "../lib/format.js";
import { useApi } from "../hooks/useApi.js";
import { Card, Loading, ErrorBox, Badge, ProgressBar } from "./ui.jsx";

const SEV_TONE = { Critical: "red", High: "amber", Medium: "blue", Low: "slate" };

function AssetDrilldown({ assetId, onClose }) {
  const { data, loading, error } = useApi(() => api.asset(assetId), [assetId]);
  return (
    <div className="fixed inset-0 z-30 bg-black/60 flex items-start sm:items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-panel border border-slate-800 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        {loading && <Loading />}
        {error && <ErrorBox message={error} />}
        {data && (
          <>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-base font-semibold">{data.name}</h3>
                <p className="text-[11px] text-slate-500">{data.businessUnitName} • Criticality {data.criticality}/5</p>
              </div>
              <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-sm">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-panel2 rounded-lg p-2 text-center">
                <div className="text-[10px] text-slate-500">EAL</div>
                <div className="text-sm font-semibold">{fmtINR(data.eal)}</div>
              </div>
              <div className="bg-panel2 rounded-lg p-2 text-center">
                <div className="text-[10px] text-slate-500">VaR 95%</div>
                <div className="text-sm font-semibold">{fmtINR(data.var95)}</div>
              </div>
              <div className="bg-panel2 rounded-lg p-2 text-center">
                <div className="text-[10px] text-slate-500">Loss Freq/yr</div>
                <div className="text-sm font-semibold">{data.lambdaEffective.toFixed(2)}</div>
              </div>
            </div>

            <Section title={`Vulnerabilities (${data.vulnerabilities.length})`}>
              {data.vulnerabilities.map((v) => (
                <Row key={v.id} left={`${v.cve} — ${v.description}`} right={<Badge tone={v.cvss >= 9 ? "red" : v.cvss >= 7 ? "amber" : "blue"}>CVSS {v.cvss}</Badge>} sub={`${v.status} • ${v.ageInDays}d old • exploit ${v.exploitAvailable ? "available" : "n/a"}`} />
              ))}
            </Section>
            <Section title={`IAM Findings (${data.iamFindings.length})`}>
              {data.iamFindings.map((f) => (
                <Row key={f.id} left={f.type} right={<Badge tone={SEV_TONE[f.severity]}>{f.severity}</Badge>} />
              ))}
            </Section>
            <Section title={`EDR Detections (${data.edrDetections.length})`}>
              {data.edrDetections.map((f) => (
                <Row key={f.id} left={f.malwareFamily} right={<Badge tone={SEV_TONE[f.severity]}>{f.severity}</Badge>} />
              ))}
            </Section>
            <Section title={`CSPM Misconfigurations (${data.cspmMisconfigs.length})`}>
              {data.cspmMisconfigs.map((f) => (
                <Row key={f.id} left={f.type} right={<Badge tone={SEV_TONE[f.severity]}>{f.severity}</Badge>} />
              ))}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  if (!children || (Array.isArray(children) && children.length === 0)) return null;
  return (
    <div className="mb-3">
      <div className="text-[11px] font-medium text-slate-400 mb-1.5">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ left, right, sub }) {
  return (
    <div className="flex items-center justify-between bg-panel2 rounded-md px-2.5 py-1.5">
      <div>
        <div className="text-xs text-slate-200">{left}</div>
        {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export default function TechnicalDashboard() {
  const { data: assets, error: e1, loading: l1 } = useApi(() => api.assets(), []);
  const { data: controls, error: e2, loading: l2 } = useApi(() => api.controls(), []);
  const [sortKey, setSortKey] = useState("eal");
  const [selected, setSelected] = useState(null);

  const sortedAssets = useMemo(() => {
    if (!assets) return [];
    return [...assets].sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0));
  }, [assets, sortKey]);

  if (l1 || l2) return <Loading label="Loading technical telemetry…" />;
  if (e1 || e2) return <ErrorBox message={e1 || e2} />;

  return (
    <div className="space-y-6">
      <Card title="Asset Risk Register" subtitle="Click a row to drill into findings mapped from vuln scanners, SIEM, IAM, EDR, CSPM">
        <div className="flex gap-2 mb-3 text-[11px]">
          <span className="text-slate-500">Sort by:</span>
          {[["eal", "EAL"], ["var95", "VaR 95%"], ["criticality", "Criticality"], ["lambdaEffective", "Loss Freq"]].map(([k, label]) => (
            <button key={k} onClick={() => setSortKey(k)} className={`px-2 py-0.5 rounded-full ${sortKey === k ? "bg-accent text-white" : "bg-panel2 text-slate-400"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-800">
                <th className="py-2 pr-2">Asset</th>
                <th className="py-2 pr-2">Business Unit</th>
                <th className="py-2 pr-2">Criticality</th>
                <th className="py-2 pr-2">Internet-facing</th>
                <th className="py-2 pr-2">EAL</th>
                <th className="py-2 pr-2">VaR 95%</th>
                <th className="py-2 pr-2">Open Vulns</th>
              </tr>
            </thead>
            <tbody>
              {sortedAssets.map((a) => (
                <tr key={a.assetId} onClick={() => setSelected(a.assetId)} className="border-b border-slate-800/50 hover:bg-panel2 cursor-pointer">
                  <td className="py-2 pr-2 text-slate-200">{a.name}</td>
                  <td className="py-2 pr-2 text-slate-400">{a.businessUnitName}</td>
                  <td className="py-2 pr-2">{a.criticality}/5</td>
                  <td className="py-2 pr-2">{a.internetFacing ? <Badge tone="red">Yes</Badge> : <Badge>No</Badge>}</td>
                  <td className="py-2 pr-2 font-medium text-slate-100">{fmtINR(a.eal)}</td>
                  <td className="py-2 pr-2 text-amber-400">{fmtINR(a.var95)}</td>
                  <td className="py-2 pr-2">{a.breakdown.openVulnCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Control Effectiveness" subtitle="Coverage x effectiveness across the estate, evaluated from telemetry">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {controls.map((c) => {
            const maturity = Math.min(100, (c.currentCoverage * c.currentEffectiveness / c.baseEffectiveness) * 100);
            return (
              <div key={c.id} className="border border-slate-800 rounded-lg p-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-200">{c.name}</span>
                  <span className="text-slate-500">{c.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ProgressBar pct={maturity} tone={maturity >= 70 ? "green" : maturity >= 40 ? "amber" : "red"} />
                  <span className="text-[10px] text-slate-500 w-10 text-right">{fmtPct(maturity)}</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Coverage {fmtPct(c.currentCoverage * 100)} • Effectiveness {fmtPct(c.currentEffectiveness * 100)}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {selected && <AssetDrilldown assetId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
