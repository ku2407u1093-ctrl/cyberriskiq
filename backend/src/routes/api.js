import { Router } from "express";
import { getStore, rebuild } from "../store.js";
import { knapsackOptimize } from "../optimizer/investmentOptimizer.js";
import { runScenario, PRESETS } from "../ai/scenarioSimulator.js";
import { answerQuery } from "../ai/nlQuery.js";
import { runRiskSimulation } from "../engine/riskEngine.js";

const router = Router();

router.get("/overview", (req, res) => {
  const { simulation, trend, orgData, builtAt } = getStore();
  res.json({
    builtAt,
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

router.get("/assets", (req, res) => {
  const { simulation } = getStore();
  res.json(simulation.perAsset);
});

router.get("/assets/:id", (req, res) => {
  const { simulation, orgData } = getStore();
  const asset = simulation.perAsset.find((a) => a.assetId === req.params.id);
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  const vulns = orgData.vulnerabilities.filter((v) => v.assetId === req.params.id);
  const iam = orgData.iamFindings.filter((f) => f.assetId === req.params.id);
  const edr = orgData.edrDetections.filter((f) => f.assetId === req.params.id);
  const cspm = orgData.cspmMisconfigs.filter((f) => f.assetId === req.params.id);
  const siem = orgData.siemAlerts.filter((f) => f.assetId === req.params.id);
  res.json({ ...asset, vulnerabilities: vulns, iamFindings: iam, edrDetections: edr, cspmMisconfigs: cspm, siemAlerts: siem });
});

router.get("/controls", (req, res) => {
  const { orgData } = getStore();
  res.json(orgData.controls);
});

router.get("/vulnerabilities", (req, res) => {
  const { orgData } = getStore();
  res.json(orgData.vulnerabilities);
});

router.get("/compliance", (req, res) => {
  const { compliance } = getStore();
  res.json(compliance);
});

router.get("/recommendations", (req, res) => {
  const { recommendations } = getStore();
  res.json(recommendations);
});

router.get("/investment/frontier", (req, res) => {
  const { frontier } = getStore();
  res.json(frontier);
});

router.post("/investment/optimize", (req, res) => {
  const { recommendations } = getStore();
  const budgetINR = Number(req.body?.budgetINR ?? 1_00_00_000);
  if (!Number.isFinite(budgetINR) || budgetINR < 0) return res.status(400).json({ error: "Invalid budgetINR" });
  res.json(knapsackOptimize(recommendations, budgetINR));
});

router.get("/scenario/presets", (req, res) => {
  res.json(Object.entries(PRESETS).map(([id, p]) => ({ id, label: p.label })));
});

router.post("/scenario/run", (req, res) => {
  const { orgData, simulation } = getStore();
  try {
    const { presetId, customOverrides } = req.body || {};
    const result = runScenario(orgData, simulation, { presetId, customOverrides });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/query", (req, res) => {
  const { orgData, simulation, recommendations, compliance, trend, defaultOptimized } = getStore();
  const question = String(req.body?.question || "").trim();
  if (!question) return res.status(400).json({ error: "question is required" });
  const result = answerQuery(question, { orgData, simulation, recommendations, compliance, trend, optimized: defaultOptimized });
  res.json(result);
});

router.post("/rebuild", (req, res) => {
  const seed = Number(req.body?.seed ?? Date.now() % 100000);
  const store = rebuild(seed);
  res.json({ ok: true, seed, builtAt: store.builtAt });
});

export default router;
