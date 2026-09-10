import { makeRng } from "../utils/random.js";

// Generates a realistic mock enterprise (mid-size Indian BFSI-style org) with
// business units, assets, vulnerabilities, controls and raw security telemetry
// (SIEM / IAM / EDR / CSPM / threat intel). All numbers are synthetic but
// dimensionally realistic so the risk engine produces plausible INR figures.

const BUSINESS_UNITS = [
  { id: "bu-retail-banking", name: "Retail Banking", dailyRevenueINR: 42_00_000, regulated: true, regulator: "RBI" },
  { id: "bu-capital-markets", name: "Capital Markets & Broking", dailyRevenueINR: 28_00_000, regulated: true, regulator: "SEBI" },
  { id: "bu-payments", name: "Digital Payments", dailyRevenueINR: 55_00_000, regulated: true, regulator: "RBI" },
  { id: "bu-corporate-it", name: "Corporate IT & Shared Services", dailyRevenueINR: 6_00_000, regulated: false, regulator: null },
  { id: "bu-hr-finance", name: "HR & Finance", dailyRevenueINR: 4_00_000, regulated: false, regulator: null },
];

const ASSET_TEMPLATES = [
  { type: "Core Banking App", sensitivity: 5, recordsBase: 2_500_000 },
  { type: "Payment Gateway", sensitivity: 5, recordsBase: 4_000_000 },
  { type: "Trading Platform", sensitivity: 5, recordsBase: 800_000 },
  { type: "Customer DB (PII)", sensitivity: 5, recordsBase: 3_200_000 },
  { type: "Internal API Gateway", sensitivity: 3, recordsBase: 50_000 },
  { type: "Employee Endpoint Fleet", sensitivity: 2, recordsBase: 12_000 },
  { type: "Cloud Storage Bucket", sensitivity: 4, recordsBase: 900_000 },
  { type: "HR/Payroll System", sensitivity: 3, recordsBase: 60_000 },
  { type: "Email & Collaboration", sensitivity: 2, recordsBase: 15_000 },
  { type: "Vendor Portal", sensitivity: 3, recordsBase: 40_000 },
  { type: "Kubernetes Cluster (Prod)", sensitivity: 4, recordsBase: 1_000_000 },
  { type: "Legacy File Server", sensitivity: 2, recordsBase: 200_000 },
];

const VULN_CATALOG = [
  { cve: "CVE-2024-3094", desc: "XZ Utils backdoor (supply chain)", cvss: 10.0 },
  { cve: "CVE-2023-4966", desc: "Citrix NetScaler sensitive info disclosure (Citrix Bleed)", cvss: 9.4 },
  { cve: "CVE-2024-21762", desc: "FortiOS SSL-VPN out-of-bounds write (RCE)", cvss: 9.8 },
  { cve: "CVE-2023-34362", desc: "MOVEit Transfer SQL injection", cvss: 9.8 },
  { cve: "CVE-2021-44228", desc: "Log4Shell RCE in Log4j", cvss: 10.0 },
  { cve: "CVE-2024-27198", desc: "JetBrains TeamCity auth bypass", cvss: 9.8 },
  { cve: "CVE-2023-22515", desc: "Atlassian Confluence broken access control", cvss: 9.1 },
  { cve: "CVE-2022-1388", desc: "F5 BIG-IP iControl REST auth bypass", cvss: 9.8 },
  { cve: "CVE-2024-3400", desc: "Palo Alto GlobalProtect command injection", cvss: 10.0 },
  { cve: "CVE-2023-27350", desc: "PaperCut NG/MF improper access control", cvss: 9.8 },
  { cve: "CVE-2024-6387", desc: "OpenSSH regreSSHion RCE", cvss: 8.1 },
  { cve: "CVE-2023-20887", desc: "VMware Aria command injection", cvss: 9.8 },
  { cve: "CVE-2024-23897", desc: "Jenkins CLI arbitrary file read", cvss: 7.5 },
  { cve: "CVE-2023-46604", desc: "Apache ActiveMQ RCE", cvss: 10.0 },
  { cve: "CVE-2022-22965", desc: "Spring4Shell RCE", cvss: 9.8 },
];

const IAM_FINDING_TYPES = [
  { type: "Privileged account without MFA", severity: "Critical" },
  { type: "Stale/orphaned admin account", severity: "High" },
  { type: "Excessive standing privileges (non-JIT)", severity: "High" },
  { type: "Shared service account credentials", severity: "Medium" },
  { type: "Password policy non-compliant", severity: "Medium" },
  { type: "No conditional access / geo-fencing", severity: "Medium" },
];

const CSPM_MISCONFIGS = [
  { type: "Publicly exposed storage bucket", severity: "Critical" },
  { type: "Overly permissive IAM role (wildcard *)", severity: "High" },
  { type: "Unencrypted data at rest", severity: "High" },
  { type: "Security group open to 0.0.0.0/0", severity: "Critical" },
  { type: "Missing CloudTrail / audit logging", severity: "Medium" },
  { type: "Default credentials on managed service", severity: "High" },
];

const EDR_MALWARE = ["Emotet-variant", "Cobalt Strike beacon", "LockBit precursor loader", "Qakbot", "Living-off-the-land (PowerShell)", "IcedID"];

const THREAT_ACTORS = [
  { name: "FIN7-aligned group", sector: "BFSI", ttp: "Spear-phishing + POS malware", relevance: 0.82 },
  { name: "SEABORGIUM", sector: "BFSI/Gov", ttp: "Credential harvesting via fake portals", relevance: 0.55 },
  { name: "LockBit ransomware affiliate", sector: "Cross-sector", ttp: "Double extortion ransomware", relevance: 0.78 },
  { name: "APT41-style actor", sector: "Financial services", ttp: "Supply-chain compromise", relevance: 0.4 },
];

const CONTROL_CATALOG = [
  { id: "ctl-mfa", name: "Multi-Factor Authentication (privileged + remote access)", category: "Identity", baseEffectiveness: 0.55, improveCostINR: 18_00_000 },
  { id: "ctl-patch", name: "Vulnerability & Patch Management SLA (critical <7d)", category: "Vulnerability Mgmt", baseEffectiveness: 0.4, improveCostINR: 35_00_000 },
  { id: "ctl-segmentation", name: "Network Micro-segmentation", category: "Network", baseEffectiveness: 0.35, improveCostINR: 60_00_000 },
  { id: "ctl-edr", name: "EDR/XDR Coverage & Tuning", category: "Endpoint", baseEffectiveness: 0.45, improveCostINR: 25_00_000 },
  { id: "ctl-cspm", name: "CSPM Auto-Remediation", category: "Cloud", baseEffectiveness: 0.3, improveCostINR: 15_00_000 },
  { id: "ctl-dlp", name: "Data Loss Prevention on Sensitive Stores", category: "Data", baseEffectiveness: 0.25, improveCostINR: 22_00_000 },
  { id: "ctl-iam-jit", name: "Just-in-Time Privileged Access Management", category: "Identity", baseEffectiveness: 0.4, improveCostINR: 30_00_000 },
  { id: "ctl-monitoring", name: "24x7 SOC / SIEM Use-Case Tuning", category: "Detection", baseEffectiveness: 0.3, improveCostINR: 40_00_000 },
  { id: "ctl-secure-sdlc", name: "Secure SDLC / SAST-DAST Gate", category: "AppSec", baseEffectiveness: 0.28, improveCostINR: 20_00_000 },
  { id: "ctl-vendor-risk", name: "Third-Party / Supply-Chain Risk Program", category: "Governance", baseEffectiveness: 0.2, improveCostINR: 12_00_000 },
  { id: "ctl-backup-dr", name: "Immutable Backup & Ransomware Recovery Drills", category: "Resilience", baseEffectiveness: 0.35, improveCostINR: 28_00_000 },
  { id: "ctl-awareness", name: "Security Awareness & Phishing Simulation", category: "Human", baseEffectiveness: 0.18, improveCostINR: 8_00_000 },
];

function buildOrgData(seed = 42) {
  const rng = makeRng(seed);
  const assets = [];
  let assetCounter = 1;

  BUSINESS_UNITS.forEach((bu) => {
    const numAssets = rng.int(4, 6);
    for (let i = 0; i < numAssets; i++) {
      const tmpl = rng.pick(ASSET_TEMPLATES);
      const id = `AST-${String(assetCounter).padStart(3, "0")}`;
      assetCounter++;
      const internetFacing = rng.bool(0.4);
      assets.push({
        id,
        name: `${tmpl.type} — ${bu.name}`,
        type: tmpl.type,
        businessUnitId: bu.id,
        criticality: Math.min(5, Math.max(1, tmpl.sensitivity + rng.int(-1, 1))),
        dataSensitivity: tmpl.sensitivity,
        recordCount: Math.round(tmpl.recordsBase * rng.float(0.5, 1.3)),
        internetFacing,
        regulated: bu.regulated,
      });
    }
  });

  const vulnerabilities = [];
  let vulnCounter = 1;
  assets.forEach((asset) => {
    const numVulns = rng.int(1, 6);
    for (let i = 0; i < numVulns; i++) {
      const base = rng.pick(VULN_CATALOG);
      vulnerabilities.push({
        id: `VUL-${String(vulnCounter).padStart(4, "0")}`,
        assetId: asset.id,
        cve: base.cve,
        description: base.desc,
        cvss: base.cvss,
        exploitAvailable: rng.bool(0.45),
        ageInDays: rng.int(2, 240),
        patchAvailable: rng.bool(0.8),
        status: rng.bool(0.65) ? "Open" : "Remediated",
      });
      vulnCounter++;
    }
  });

  const controls = CONTROL_CATALOG.map((c) => ({
    ...c,
    currentCoverage: rng.float(0.35, 0.85), // fraction of estate covered today
    currentEffectiveness: c.baseEffectiveness * rng.float(0.7, 1.0),
  }));

  const siemAlerts = [];
  for (let i = 1; i <= 30; i++) {
    const asset = rng.pick(assets);
    siemAlerts.push({
      id: `SIEM-${String(i).padStart(4, "0")}`,
      assetId: asset.id,
      severity: rng.pick(["Low", "Medium", "High", "Critical"]),
      type: rng.pick(["Anomalous login", "Lateral movement", "C2 beacon", "Data exfil pattern", "Brute force"]),
      timestamp: new Date(Date.now() - rng.int(0, 30) * 86400000).toISOString(),
    });
  }

  const iamFindings = [];
  for (let i = 1; i <= 20; i++) {
    const asset = rng.pick(assets);
    const f = rng.pick(IAM_FINDING_TYPES);
    iamFindings.push({ id: `IAM-${String(i).padStart(4, "0")}`, assetId: asset.id, ...f });
  }

  const edrDetections = [];
  for (let i = 1; i <= 15; i++) {
    const asset = rng.pick(assets);
    edrDetections.push({
      id: `EDR-${String(i).padStart(4, "0")}`,
      assetId: asset.id,
      malwareFamily: rng.pick(EDR_MALWARE),
      severity: rng.pick(["Medium", "High", "Critical"]),
      timestamp: new Date(Date.now() - rng.int(0, 20) * 86400000).toISOString(),
    });
  }

  const cspmMisconfigs = [];
  const cloudAssets = assets.filter((a) => a.type.includes("Cloud") || a.type.includes("Kubernetes"));
  const pool = cloudAssets.length ? cloudAssets : assets;
  for (let i = 1; i <= 18; i++) {
    const asset = rng.pick(pool);
    const m = rng.pick(CSPM_MISCONFIGS);
    cspmMisconfigs.push({ id: `CSPM-${String(i).padStart(4, "0")}`, assetId: asset.id, ...m });
  }

  const threatIntel = THREAT_ACTORS.map((a, i) => ({ id: `TI-${i + 1}`, ...a }));

  return { businessUnits: BUSINESS_UNITS, assets, vulnerabilities, controls, siemAlerts, iamFindings, edrDetections, cspmMisconfigs, threatIntel };
}

export { buildOrgData, BUSINESS_UNITS, CONTROL_CATALOG };
