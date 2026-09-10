// FIRST.org EPSS (Exploit Prediction Scoring System) — free, keyless API
// giving a real, model-based 0-1 probability that a given CVE will be
// exploited in the next 30 days. Used in place of a synthetic "exploitable"
// flag.

const EPSS_URL = "https://api.first.org/data/v1/epss";
const BATCH_SIZE = 90; // API accepts comma-separated CVE lists; keep URLs modest

export async function fetchEpssScores(cveList) {
  const unique = [...new Set(cveList)].filter(Boolean);
  const result = {};
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    try {
      const url = `${EPSS_URL}?cve=${batch.join(",")}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const json = await res.json();
      (json.data || []).forEach((d) => {
        result[d.cve] = { epss: Number(d.epss), percentile: Number(d.percentile) };
      });
    } catch {
      continue;
    }
  }
  return result;
}
