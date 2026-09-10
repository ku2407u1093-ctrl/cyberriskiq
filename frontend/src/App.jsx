import { useEffect, useState } from "react";
import ExecutiveDashboard from "./components/ExecutiveDashboard.jsx";
import TechnicalDashboard from "./components/TechnicalDashboard.jsx";
import InvestmentOptimizer from "./components/InvestmentOptimizer.jsx";
import ScenarioSimulator from "./components/ScenarioSimulator.jsx";
import ComplianceMapping from "./components/ComplianceMapping.jsx";
import QueryAssistant from "./components/QueryAssistant.jsx";
import { realApi, setApiMode } from "./lib/api.js";

const TABS = [
  { id: "executive", label: "Executive Overview" },
  { id: "technical", label: "Technical Drill-Down" },
  { id: "investment", label: "Investment Optimizer" },
  { id: "scenario", label: "Scenario Simulator" },
  { id: "compliance", label: "Compliance Mapping" },
];

export default function App() {
  const [tab, setTab] = useState("executive");
  const [queryOpen, setQueryOpen] = useState(false);
  const [mode, setMode] = useState("demo"); // "demo" | "real"
  const [scanStatus, setScanStatus] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanVersion, setScanVersion] = useState(0);

  useEffect(() => {
    realApi.status().then(setScanStatus).catch(() => {});
  }, []);

  const switchMode = (m) => {
    setMode(m);
    setApiMode(m);
    setScanVersion((v) => v + 1);
  };

  const runScan = async () => {
    setScanning(true);
    setScanError(null);
    try {
      const result = await realApi.scan();
      setScanStatus({ scanned: true, builtAt: result.builtAt, meta: result.meta });
      setApiMode("real");
      setMode("real");
      setScanVersion((v) => v + 1);
    } catch (e) {
      setScanError(e.message);
    } finally {
      setScanning(false);
    }
  };

  const showLiveGate = mode === "real" && !scanStatus?.scanned;

  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <header className="border-b border-slate-800 bg-panel/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-accent to-blue-700 flex items-center justify-center font-bold text-white">CR</div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold leading-tight">CyberRiskIQ</h1>
              <p className="text-[11px] text-slate-400 leading-tight">Continuous Cyber Risk Quantification &amp; Investment Optimization</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex text-[11px] bg-panel2 rounded-lg p-0.5 border border-slate-700">
              <button
                onClick={() => switchMode("demo")}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${mode === "demo" ? "bg-accent text-white" : "text-slate-400 hover:text-slate-200"}`}
              >
                Demo Data
              </button>
              <button
                onClick={() => switchMode("real")}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${mode === "real" ? "bg-accent text-white" : "text-slate-400 hover:text-slate-200"}`}
              >
                Live Scan (this machine)
              </button>
            </div>
            <button
              onClick={() => setQueryOpen(true)}
              className="text-xs sm:text-sm bg-accent hover:bg-blue-600 transition-colors px-3 py-2 rounded-lg font-medium whitespace-nowrap"
            >
              Ask a question ✨
            </button>
          </div>
        </div>
        {mode === "real" && scanStatus?.scanned && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-2 text-[11px] text-emerald-400">
            ● Live data — {scanStatus.meta?.hostname} scanned {new Date(scanStatus.builtAt).toLocaleString()} · {scanStatus.meta?.totalVulnFindings} real findings from OSV.dev/CISA KEV/FIRST.org EPSS ·{" "}
            <button onClick={runScan} disabled={scanning} className="underline hover:text-emerald-300 disabled:opacity-50">
              {scanning ? "Rescanning…" : "Rescan"}
            </button>
          </div>
        )}
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-xs sm:text-sm px-3 py-2 rounded-t-md whitespace-nowrap transition-colors ${
                tab === t.id ? "bg-panel text-white border-b-2 border-accent" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {showLiveGate ? (
          <div className="max-w-xl mx-auto text-center py-16 space-y-4">
            <h2 className="text-lg font-semibold">Run a live scan of this machine</h2>
            <p className="text-sm text-slate-400">
              This authorizes a read-only self-assessment of the machine running this backend: installed npm/pip packages are matched against
              OSV.dev's real vulnerability database, cross-referenced with CISA's Known Exploited Vulnerabilities catalog and FIRST.org's EPSS
              exploit-probability scores. OS security posture (FileVault, firewall, SIP, Time Machine) is read directly. No external hosts are
              scanned, and nothing is installed, changed, or deleted.
            </p>
            <p className="text-xs text-amber-400/80">
              Note: this scans whatever machine is running the <em>backend</em> server — if this site is deployed to a cloud host, that's the
              cloud server, not your personal device. Run the backend on your own laptop for a self-assessment of your own hardware.
            </p>
            <button
              onClick={runScan}
              disabled={scanning}
              className="bg-accent hover:bg-blue-600 transition-colors px-4 py-2.5 rounded-lg font-medium text-sm disabled:opacity-50"
            >
              {scanning ? "Scanning…" : "Run Live Scan"}
            </button>
            {scanError && <p className="text-xs text-red-400">{scanError}</p>}
          </div>
        ) : (
          <div key={`${tab}-${mode}-${scanVersion}`}>
            {tab === "executive" && <ExecutiveDashboard />}
            {tab === "technical" && <TechnicalDashboard />}
            {tab === "investment" && <InvestmentOptimizer />}
            {tab === "scenario" && <ScenarioSimulator />}
            {tab === "compliance" && <ComplianceMapping />}
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-[11px] text-slate-500">
        Built for AICTE Cyber Security Cell Hackathon — Problem Statement 26105. All computations run locally (Monte Carlo simulation, statistical regression, knapsack optimization) — no external AI API required.
      </footer>

      {queryOpen && <QueryAssistant onClose={() => setQueryOpen(false)} />}
    </div>
  );
}
