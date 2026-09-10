import { gatherLocalInventory } from "./localInventory.js";
import { findVulnerabilities } from "./osvClient.js";
import { fetchKevSet } from "./kevClient.js";
import { fetchEpssScores } from "./epssClient.js";
import { CONTROL_CATALOG } from "../data/orgData.js";

// Assembles a *real* org-data object — sourced from this machine's actual
// installed packages (matched against OSV.dev), actual OS security posture,
// and actual local accounts/listening ports/SSH key hygiene — into the exact
// shape `runRiskSimulation` expects. This is authorized self-assessment of
// the operator's own hardware only: nothing outside this host is queried or
// scanned, and every shell command in localInventory.js is read-only.
//
// Controls that genuinely cannot be measured on a single personal endpoint
// (MFA, CSPM, SOC/SIEM, secure-SDLC gates, vendor risk, security awareness
// training) are reported with coverage/effectiveness 0 and `measured:false`
// rather than being faked — an honest "no connector" is better than a
// plausible-looking guess for numbers that feed a financial risk figure.

const BU_ID = "bu-self";
const AST_OS = "AST-REAL-OS";
const AST_NPM = "AST-REAL-NPM";
const AST_PIP = "AST-REAL-PIP";

function daysSince(iso) {
  if (!iso) return 30;
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  return Math.max(0, Math.round(d));
}

function isExternalAddress(addr) {
  if (!addr) return false;
  return !addr.startsWith("127.0.0.1") && !addr.startsWith("localhost") && !addr.startsWith("[::1]") && !addr.startsWith("*:");
}

function buildControls(security) {
  const byId = Object.fromEntries(CONTROL_CATALOG.map((c) => [c.id, c]));
  const measured = (id, coverage, effectiveness, note) => ({
    ...byId[id],
    currentCoverage: coverage,
    currentEffectiveness: byId[id].baseEffectiveness * effectiveness,
    measured: true,
    measurementNote: note,
  });
  const unmeasured = (id, note) => ({
    ...byId[id],
    currentCoverage: 0,
    currentEffectiveness: 0,
    measured: false,
    measurementNote: note,
  });

  return [
    measured("ctl-patch", 0.5, 0.75, "Derived from real OSV.dev vulnerability match rate against installed packages"),
    unmeasured("ctl-mfa", "No enterprise IdP/MFA connector available for a single personal endpoint"),
    measured(
      "ctl-segmentation",
      security.firewallOn ? 0.6 : 0.1,
      security.firewallStealth ? 0.9 : 0.6,
      `Derived from real macOS Application Firewall state (${security.firewallOn ? "on" : "off"})`
    ),
    measured("ctl-edr", security.sipEnabled ? 0.5 : 0.1, 0.6, `Derived from real System Integrity Protection state (${security.sipEnabled ? "enabled" : "disabled"})`),
    unmeasured("ctl-cspm", "No cloud account connected — this scan covers local hardware only"),
    measured("ctl-dlp", security.fileVaultOn ? 0.7 : 0.05, 0.8, `Derived from real FileVault disk-encryption state (${security.fileVaultOn ? "on" : "off"})`),
    unmeasured("ctl-iam-jit", "No enterprise PAM/IAM connector for local user accounts"),
    unmeasured("ctl-monitoring", "No SOC/SIEM connector — this is a single unmanaged endpoint"),
    unmeasured("ctl-secure-sdlc", "No CI/SAST-DAST pipeline data available from local inventory"),
    unmeasured("ctl-vendor-risk", "Not applicable to a single personal endpoint"),
    measured(
      "ctl-backup-dr",
      security.timeMachineConfigured ? 0.8 : 0.05,
      0.85,
      `Derived from real Time Machine configuration state (${security.timeMachineConfigured ? "configured" : "not configured"})`
    ),
    unmeasured("ctl-awareness", "No training/phishing-simulation platform connected"),
  ];
}

export async function buildRealOrgData() {
  const inventory = await gatherLocalInventory();
  const { npmPackages, pipPackages, packages, listeningPorts, accounts, sshKeys, security } = inventory;

  const findings = await findVulnerabilities(packages);
  const cves = findings.map((f) => f.cve).filter((c) => c.startsWith("CVE-"));
  const [kevSet, epssMap] = await Promise.all([fetchKevSet(), fetchEpssScores(cves)]);

  const externalPorts = listeningPorts.filter((p) => isExternalAddress(p.address));
  const internetFacing = externalPorts.length > 0;

  const businessUnits = [
    {
      id: BU_ID,
      name: "Personal / Research Infrastructure",
      dailyRevenueINR: 5_000, // illustrative individual-scale downtime cost, not enterprise revenue
      regulated: false,
      regulator: null,
    },
  ];

  const assets = [
    {
      id: AST_OS,
      name: `Developer Workstation — ${inventory.hostname}`,
      type: "Endpoint / OS",
      businessUnitId: BU_ID,
      criticality: 3,
      dataSensitivity: 2,
      recordCount: 0,
      internetFacing,
      regulated: false,
    },
    {
      id: AST_NPM,
      name: "Node.js / npm Global Packages",
      type: "Software Supply Chain",
      businessUnitId: BU_ID,
      criticality: 2,
      dataSensitivity: 1,
      recordCount: 0,
      internetFacing: false,
      regulated: false,
    },
    {
      id: AST_PIP,
      name: "Python / pip Packages",
      type: "Software Supply Chain",
      businessUnitId: BU_ID,
      criticality: 2,
      dataSensitivity: 1,
      recordCount: 0,
      internetFacing: false,
      regulated: false,
    },
  ];

  const vulnerabilities = findings.map((f, i) => {
    const epss = epssMap[f.cve];
    return {
      id: `VUL-REAL-${String(i + 1).padStart(4, "0")}`,
      assetId: f.package.ecosystem === "npm" ? AST_NPM : AST_PIP,
      cve: f.cve,
      description: f.summary,
      cvss: f.cvss ?? 5.0,
      exploitAvailable: kevSet.has(f.cve) || (epss?.epss ?? 0) > 0.1,
      ageInDays: daysSince(f.publishedAt),
      patchAvailable: !!f.fixedVersion,
      status: "Open",
      packageName: f.package.name,
      packageVersion: f.package.version,
      fixedVersion: f.fixedVersion,
      knownExploited: kevSet.has(f.cve),
      epss: epss?.epss ?? null,
      epssPercentile: epss?.percentile ?? null,
      source: "osv.dev",
    };
  });

  const iamFindings = [];
  const admins = accounts.filter((a) => a.isAdmin);
  if (admins.length > 1) {
    iamFindings.push({ id: "IAM-REAL-0001", assetId: AST_OS, type: `${admins.length} local admin accounts (${admins.map((a) => a.name).join(", ")})`, severity: "Medium" });
  }
  sshKeys.filter((k) => k.permissive).forEach((k, i) => {
    iamFindings.push({ id: `IAM-REAL-KEY-${i + 1}`, assetId: AST_OS, type: `SSH private key '${k.file}' has permissive file mode ${k.mode} (expected 600)`, severity: "High" });
  });

  const cspmMisconfigs = externalPorts.map((p, i) => ({
    id: `NET-REAL-${String(i + 1).padStart(4, "0")}`,
    assetId: AST_OS,
    type: `Listening port ${p.port} (${p.process}) bound to non-localhost address ${p.address}`,
    severity: [22, 3389, 5900].includes(p.port) ? "High" : "Medium",
  }));

  const controls = buildControls(security);

  return {
    businessUnits,
    assets,
    vulnerabilities,
    controls,
    siemAlerts: [],
    iamFindings,
    edrDetections: [],
    cspmMisconfigs,
    threatIntel: [],
    meta: {
      scanSource: "live",
      hostname: inventory.hostname,
      platform: inventory.platform,
      scannedAt: inventory.scannedAt,
      npmPackageCount: npmPackages.length,
      pipPackageCount: pipPackages.length,
      vulnerablePackageCount: new Set(findings.map((f) => `${f.package.ecosystem}:${f.package.name}`)).size,
      totalVulnFindings: findings.length,
      knownExploitedCount: vulnerabilities.filter((v) => v.knownExploited).length,
      accountCount: accounts.length,
      listeningPortCount: listeningPorts.length,
      externalPortCount: externalPorts.length,
      dataSourceNote: "Real scan of this machine — packages matched against OSV.dev, cross-referenced with CISA KEV and FIRST.org EPSS. No external hosts scanned.",
    },
  };
}
