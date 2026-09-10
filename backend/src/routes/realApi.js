import { Router } from "express";
import { getRealStore, rebuildReal } from "../realStore.js";
import { knapsackOptimize } from "../optimizer/investmentOptimizer.js";
import { runScenario, PRESETS } from "../ai/scenarioSimulator.js";
import { answerQuery } from "../ai/nlQuery.js";

const router = Router();

let scanInProgress = false;

function requireStore(req, res, next) {
  if (!getRealStore()) return res.status(409).json({ error: "No live scan has been run yet. POST /api/real/scan first." });
  next();
}

router.post("/scan", async (req, res) => {
  if (scanInProgress) return res.status(409).json({ error: "A scan is already in progress" });
  scanInProgress = true;
  try {
    const store = await rebuildReal();
    res.json({ ok: true, builtAt: store.builtAt, meta: store.orgData.meta });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    scanInProgress = false;
  }
});

router.get("/status", (req, res) => {
  const store = getRealStore();
  res.json({ scanned: !!store, builtAt: store?.builtAt ?? null, meta: store?.orgData?.meta ?? null, scanInProgress });
});

router.get("/overview", requireStore, (req, res) => {
  const { simulation, trend, orgData, builtAt } = getRealStore();
  res.json({
    builtAt,
    meta: orgData.meta,
    enterpriseRiskScore: simulation.enterpriseRiskScore,
    orgEAL: simulation.orgEAL,
    orgVaR95: simulation.orgVaR95,
    orgVaR99: simulation.orgVaR99,
    orgStdev: simulation.orgStdev,
    topRiskContributors: simulation.perAsset.slice(0, 8),
    perBU: simulation.perBU,
    trend,
    assetCount: orgData.assets.length,
    openVulnCount: orgData.vulnerabilities.filter((v) => v.status === "Open").length,
    businessUnits: orgData.businessUnits,
  });
});

router.get("/assets", requireStore, (req, res) => {
  const { simulation } = getRealStore();
  res.json(simulation.perAsset);
});

router.get("/assets/:id", requireStore, (req, res) => {
  const { simulation, orgData } = getRealStore();
  const asset = simulation.perAsset.find((a) => a.assetId === req.params.id);
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  const vulns = orgData.vulnerabilities.filter((v) => v.assetId === req.params.id);
  const iam = orgData.iamFindings.filter((f) => f.assetId === req.params.id);
  const edr = orgData.edrDetections.filter((f) => f.assetId === req.params.id);
  const cspm = orgData.cspmMisconfigs.filter((f) => f.assetId === req.params.id);
  const siem = orgData.siemAlerts.filter((f) => f.assetId === req.params.id);
  res.json({ ...asset, vulnerabilities: vulns, iamFindings: iam, edrDetections: edr, cspmMisconfigs: cspm, siemAlerts: siem });
});

router.get("/controls", requireStore, (req, res) => {
  const { orgData } = getRealStore();
  res.json(orgData.controls);
});

router.get("/vulnerabilities", requireStore, (req, res) => {
  const { orgData } = getRealStore();
  res.json(orgData.vulnerabilities);
});

router.get("/compliance", requireStore, (req, res) => {
  const { compliance } = getRealStore();
  res.json(compliance);
});

router.get("/recommendations", requireStore, (req, res) => {
  const { recommendations } = getRealStore();
  res.json(recommendations);
});

router.get("/investment/frontier", requireStore, (req, res) => {
  const { frontier } = getRealStore();
  res.json(frontier);
});

router.post("/investment/optimize", requireStore, (req, res) => {
  const { recommendations } = getRealStore();
  const budgetINR = Number(req.body?.budgetINR ?? 1_00_00_000);
  if (!Number.isFinite(budgetINR) || budgetINR < 0) return res.status(400).json({ error: "Invalid budgetINR" });
  res.json(knapsackOptimize(recommendations, budgetINR));
});

router.get("/scenario/presets", (req, res) => {
  res.json(Object.entries(PRESETS).map(([id, p]) => ({ id, label: p.label })));
});

router.post("/scenario/run", requireStore, (req, res) => {
  const { orgData, simulation } = getRealStore();
  try {
    const { presetId, customOverrides } = req.body || {};
    const result = runScenario(orgData, simulation, { presetId, customOverrides });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/query", requireStore, (req, res) => {
  const { orgData, simulation, recommendations, compliance, trend, defaultOptimized } = getRealStore();
  const question = String(req.body?.question || "").trim();
  if (!question) return res.status(400).json({ error: "question is required" });
  const result = answerQuery(question, { orgData, simulation, recommendations, compliance, trend, optimized: defaultOptimized });
  res.json(result);
});

export default router;
