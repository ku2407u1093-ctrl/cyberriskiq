import { parseCvssVector } from "./cvss.js";

// OSV.dev — free, keyless open-source vulnerability database. We batch-query
// every installed package (npm + PyPI ecosystems) against real advisory data,
// then fetch full records for each unique vulnerability hit to extract a
// CVSS score, publish date and fixed-version info.

const OSV_BATCH_URL = "https://api.osv.dev/v1/querybatch";
const OSV_VULN_URL = "https://api.osv.dev/v1/vulns";
const BATCH_CHUNK = 500; // OSV allows up to 1000 queries per batch call

const vulnDetailCache = new Map();

async function fetchVulnDetail(id) {
  if (vulnDetailCache.has(id)) return vulnDetailCache.get(id);
  try {
    const res = await fetch(`${OSV_VULN_URL}/${id}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const json = await res.json();
    vulnDetailCache.set(id, json);
    return json;
  } catch {
    return null;
  }
}

function extractCve(vuln) {
  const aliases = vuln.aliases || [];
  return aliases.find((a) => /^CVE-\d{4}-\d+$/.test(a)) || (vuln.id?.startsWith("CVE-") ? vuln.id : null);
}

function extractCvss(vuln) {
  const sev = (vuln.severity || []).find((s) => s.type === "CVSS_V3" || s.type === "CVSS_V4");
  if (sev?.score) {
    const parsed = parseCvssVector(sev.score);
    if (parsed != null) return parsed;
  }
  const dbSev = vuln.database_specific?.severity;
  const map = { CRITICAL: 9.5, HIGH: 8.0, MODERATE: 5.5, MEDIUM: 5.5, LOW: 2.5 };
  if (dbSev && map[dbSev.toUpperCase()]) return map[dbSev.toUpperCase()];
  return null;
}

function extractFixedVersion(vuln, ecosystem, pkgName) {
  for (const affected of vuln.affected || []) {
    if (affected.package?.ecosystem !== ecosystem || affected.package?.name !== pkgName) continue;
    for (const range of affected.ranges || []) {
      const fixEvent = (range.events || []).find((e) => e.fixed);
      if (fixEvent) return fixEvent.fixed;
    }
  }
  return null;
}

// packages: [{name, version, ecosystem}] → returns [{package, vulnId, cve, summary, cvss, publishedAt, fixedVersion}]
export async function findVulnerabilities(packages) {
  if (!packages.length) return [];
  const findings = [];

  for (let i = 0; i < packages.length; i += BATCH_CHUNK) {
    const chunk = packages.slice(i, i + BATCH_CHUNK);
    const queries = chunk.map((p) => ({ version: p.version, package: { name: p.name, ecosystem: p.ecosystem } }));
    let batchResults;
    try {
      const res = await fetch(OSV_BATCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      batchResults = json.results || [];
    } catch {
      continue;
    }

    const detailFetches = [];
    batchResults.forEach((result, idx) => {
      const pkg = chunk[idx];
      (result.vulns || []).forEach((v) => {
        detailFetches.push(
          fetchVulnDetail(v.id).then((detail) => {
            if (!detail) return null;
            const cve = extractCve(detail);
            return {
              package: pkg,
              vulnId: detail.id,
              cve: cve || detail.id,
              summary: detail.summary || detail.details?.slice(0, 200) || "No summary available",
              cvss: extractCvss(detail),
              publishedAt: detail.published || null,
              fixedVersion: extractFixedVersion(detail, pkg.ecosystem, pkg.name),
            };
          })
        );
      });
    });

    const resolved = (await Promise.all(detailFetches)).filter(Boolean);
    findings.push(...resolved);
  }

  return findings;
}
