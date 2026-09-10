import { api } from "../lib/api.js";
import { fmtPct } from "../lib/format.js";
import { useApi } from "../hooks/useApi.js";
import { Card, Loading, ErrorBox, ProgressBar } from "./ui.jsx";

function toneFor(pct) {
  if (pct >= 70) return "green";
  if (pct >= 40) return "amber";
  return "red";
}

export default function ComplianceMapping() {
  const { data: compliance, error, loading } = useApi(() => api.compliance(), []);

  if (loading) return <Loading label="Mapping controls to frameworks…" />;
  if (error) return <ErrorBox message={error} />;

  return (
    <div className="space-y-6">
      <Card title="Regulatory & Framework Coverage" subtitle="Evidence-based mapping from measured control maturity to each framework's domains — ready for audit / board reporting">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(compliance).map(([fw, v]) => (
            <div key={fw} className="border border-slate-800 rounded-lg p-3 text-center">
              <div className="text-[11px] text-slate-400">{fw}</div>
              <div className="text-2xl font-bold mt-1" style={{ color: v.overallPct >= 70 ? "#22c55e" : v.overallPct >= 40 ? "#f59e0b" : "#ef4444" }}>
                {fmtPct(v.overallPct)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {Object.entries(compliance).map(([fw, v]) => (
        <Card key={fw} title={fw} subtitle="Domain-level maturity">
          <div className="space-y-2">
            {v.domains.map((d) => (
              <div key={d.domain}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">{d.domain}</span>
                  <span className="text-slate-500">{fmtPct(d.coveragePct)}</span>
                </div>
                <ProgressBar pct={d.coveragePct} tone={toneFor(d.coveragePct)} />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
