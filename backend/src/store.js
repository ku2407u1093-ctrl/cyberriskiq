import { buildOrgData } from "./data/orgData.js";
import { runRiskSimulation } from "./engine/riskEngine.js";
import { buildRecommendations } from "./ai/recommender.js";
import { buildTrend } from "./ai/trendPredictor.js";
import { computeComplianceCoverage } from "./compliance/frameworks.js";
import { knapsackOptimize, buildEfficientFrontier } from "./optimizer/investmentOptimizer.js";

// Computes the full baseline once at startup (and on demand via rebuild())
// and caches it in memory — the "continuous" aggregation loop a real
// deployment would run on a schedule against live telemetry feeds.
let cache = null;

export function rebuild(seed = 42) {
  const orgData = buildOrgData(seed);
  const simulation = runRiskSimulation(orgData, { trials: 5000, seed: 7 });
  const recommendations = buildRecommendations(orgData, simulation.orgEAL, { seed: 7 });
  const trend = buildTrend(simulation.orgEAL, { seed: 99 });
  const compliance = computeComplianceCoverage(orgData.controls);
  const frontier = buildEfficientFrontier(recommendations);
  const defaultOptimized = knapsackOptimize(recommendations, 1_00_00_000);

  cache = { orgData, simulation, recommendations, trend, compliance, frontier, defaultOptimized, builtAt: new Date().toISOString() };
  return cache;
}

export function getStore() {
  if (!cache) rebuild();
  return cache;
}
