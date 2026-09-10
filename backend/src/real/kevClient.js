// CISA Known Exploited Vulnerabilities catalog — free, keyless JSON feed of
// CVEs confirmed to be actively exploited in the wild. Used as a real
// "exploitAvailable / actively exploited" signal instead of a coin-flip.

const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — KEV updates a few times a week at most

let cache = { set: null, fetchedAt: 0 };

export async function fetchKevSet() {
  if (cache.set && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.set;
  try {
    const res = await fetch(KEV_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`KEV fetch failed: ${res.status}`);
    const json = await res.json();
    const set = new Set((json.vulnerabilities || []).map((v) => v.cveID));
    cache = { set, fetchedAt: Date.now() };
    return set;
  } catch {
    // Network hiccup or feed unavailable — fall back to whatever we had, or empty.
    return cache.set || new Set();
  }
}

export async function isKnownExploited(cve) {
  const set = await fetchKevSet();
  return set.has(cve);
}
