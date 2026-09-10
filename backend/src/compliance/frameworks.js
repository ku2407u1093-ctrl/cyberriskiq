// Static mapping of internal controls to clauses/functions in major
// cybersecurity & regulatory frameworks. Coverage % per framework domain is
// computed as the average normalised maturity (coverage x effectiveness /
// baseEffectiveness) of the controls mapped to that domain — giving an
// audit-ready, evidence-based rollup instead of a manual checklist.

export const FRAMEWORKS = {
  "ISO/IEC 27001:2022": {
    domains: {
      "A.8.8 Vulnerability Management": ["ctl-patch"],
      "A.8.5 Secure Authentication": ["ctl-mfa"],
      "A.8.2 Privileged Access Rights": ["ctl-iam-jit"],
      "A.8.20 Network Security": ["ctl-segmentation"],
      "A.8.16 Monitoring Activities": ["ctl-monitoring", "ctl-edr"],
      "A.8.12 Data Leakage Prevention": ["ctl-dlp"],
      "A.8.23 Web Filtering / Cloud Security": ["ctl-cspm"],
      "A.8.25 Secure Development Lifecycle": ["ctl-secure-sdlc"],
      "A.5.19 Supplier Relationships": ["ctl-vendor-risk"],
      "A.5.29 ICT Readiness for Business Continuity": ["ctl-backup-dr"],
      "A.6.3 Awareness, Education & Training": ["ctl-awareness"],
    },
  },
  "NIST CSF 2.0": {
    domains: {
      "Govern (GV)": ["ctl-vendor-risk"],
      "Identify (ID)": ["ctl-cspm", "ctl-vendor-risk"],
      "Protect (PR)": ["ctl-mfa", "ctl-segmentation", "ctl-dlp", "ctl-secure-sdlc", "ctl-awareness", "ctl-iam-jit"],
      "Detect (DE)": ["ctl-monitoring", "ctl-edr"],
      "Respond (RS)": ["ctl-monitoring"],
      "Recover (RC)": ["ctl-backup-dr"],
    },
  },
  "CIS Controls v8": {
    domains: {
      "CIS 3 — Data Protection": ["ctl-dlp"],
      "CIS 4 — Secure Configuration": ["ctl-cspm"],
      "CIS 5/6 — Account & Access Control Mgmt": ["ctl-iam-jit", "ctl-mfa"],
      "CIS 7 — Continuous Vulnerability Mgmt": ["ctl-patch"],
      "CIS 8 — Audit Log Management": ["ctl-monitoring"],
      "CIS 11 — Data Recovery": ["ctl-backup-dr"],
      "CIS 12/13 — Network Infra & Monitoring": ["ctl-segmentation", "ctl-edr"],
      "CIS 14 — Security Awareness": ["ctl-awareness"],
      "CIS 15 — Service Provider Mgmt": ["ctl-vendor-risk"],
      "CIS 16 — Application Software Security": ["ctl-secure-sdlc"],
    },
  },
  "RBI Cyber Security Framework": {
    domains: {
      "Baseline Cyber Security Controls": ["ctl-patch", "ctl-mfa"],
      "Cyber Security Operations Centre (C-SOC)": ["ctl-monitoring"],
      "Incident Response & Recovery": ["ctl-backup-dr"],
      "Network / IT Architecture": ["ctl-segmentation"],
      "Vendor Risk Management": ["ctl-vendor-risk"],
      "Employee & Customer Awareness": ["ctl-awareness"],
    },
  },
  "SEBI CSCRF": {
    domains: {
      "Governance": ["ctl-vendor-risk"],
      "Identification": ["ctl-cspm"],
      "Protection": ["ctl-mfa", "ctl-dlp", "ctl-secure-sdlc", "ctl-segmentation", "ctl-iam-jit"],
      "Detection": ["ctl-monitoring", "ctl-edr"],
      "Response & Recovery": ["ctl-backup-dr"],
    },
  },
};

export function computeComplianceCoverage(controls) {
  const controlMap = {};
  controls.forEach((c) => (controlMap[c.id] = c));

  const results = {};
  Object.entries(FRAMEWORKS).forEach(([frameworkName, { domains }]) => {
    const domainResults = Object.entries(domains).map(([domainName, controlIds]) => {
      const maturities = controlIds.map((id) => {
        const c = controlMap[id];
        if (!c) return 0;
        return Math.min(1, (c.currentCoverage * c.currentEffectiveness) / c.baseEffectiveness);
      });
      const coveragePct = (maturities.reduce((s, m) => s + m, 0) / maturities.length) * 100;
      return { domain: domainName, coveragePct, controlIds };
    });
    const overallPct = domainResults.reduce((s, d) => s + d.coveragePct, 0) / domainResults.length;
    results[frameworkName] = { overallPct, domains: domainResults };
  });
  return results;
}
