import { buildRealOrgData } from "./real/buildRealOrgData.js";
import { runRiskSimulation } from "./engine/riskEngine.js";
import { buildRecommendations } from "./ai/recommender.js";
import { buildTrend } from "./ai/trendPredictor.js";
import { computeComplianceCoverage } from "./compliance/frameworks.js";
import { knapsackOptimize, buildEfficientFrontier } from "./optimizer/investmentOptimizer.js";

// Mirrors store.js but sources data from a live scan of this machine
// (buildRealOrgData) instead of the synthetic demo dataset. Not built at
// startup — only on explicit POST /api/real/scan, since it makes outbound
// calls to OSV.dev/CISA KEV/FIRST.org and reads local system state.
let cache = null;

export async function rebuildReal() {
  const orgData = await buildRealOrgData();
  const simulation = runRiskSimulation(orgData, { trials: 5000, seed: 7 });
  const recommendations = buildRecommendations(orgData, simulation.orgEAL, { seed: 7 });
  const trend = buildTrend(simulation.orgEAL, { seed: 99 });
  const compliance = computeComplianceCoverage(orgData.controls);
  const frontier = buildEfficientFrontier(recommendations);
  const defaultOptimized = knapsackOptimize(recommendations, 1_00_00_000);

  cache = { orgData, simulation, recommendations, trend, compliance, frontier, defaultOptimized, builtAt: new Date().toISOString() };
  return cache;
}

export function getRealStore() {
  return cache;
}
