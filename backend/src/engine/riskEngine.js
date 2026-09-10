import { makeRng } from "../utils/random.js";

// ---------------------------------------------------------------------------
// FAIR-lite Risk Quantification Engine
//
// For every asset we estimate:
//   1. Loss Event Frequency (LEF)  — expected number of loss events / year,
//      derived from open vulnerabilities, IAM/CSPM/EDR/SIEM telemetry,
//      internet exposure and threat-intel relevance, then discounted by
//      control coverage x effectiveness (this is the "control effectiveness
//      evaluation" component).
//   2. Loss Magnitude (LM)         — a triangular (min, most-likely, max)
//      distribution combining downtime cost, data-breach cost and
//      reputational cost, plus a Bernoulli-gated regulatory-penalty band for
//      regulated (RBI/SEBI) assets.
//
// We then run a Monte Carlo simulation (default 5,000 trials): each trial
// samples a Poisson number of events per asset from LEF, and a magnitude per
// event from LM, and sums across the organisation to build a full annual
// loss distribution. EAL = mean of the distribution, VaR95/VaR99 = the
// 95th/99th percentiles — a standard actuarial way to turn "Low/Medium/High"
// into money.
// ---------------------------------------------------------------------------

const SEV_WEIGHT = { Critical: 1.0, High: 0.7, Medium: 0.4, Low: 0.2 };
const COST_PER_RECORD_INR = 178; // benchmark assumption (India avg cost/record, Ponemon/IBM-style)

function ageFactor(days) {
  return Math.min(1.5, 0.5 + days / 180);
}

function mitigate(rawScore, control, weight = 1) {
  if (!control) return rawScore;
  const reduction = control.currentCoverage * control.currentEffectiveness * weight;
  return rawScore * (1 - Math.min(0.95, reduction));
}

function controlsById(controls) {
  const map = {};
  controls.forEach((c) => (map[c.id] = c));
  return map;
}

export function computeAssetProfile(asset, orgData, controlsMap, opts = {}) {
  const { vulnerabilities, iamFindings, cspmMisconfigs, edrDetections, siemAlerts, threatIntel, businessUnits } = orgData;
  const bu = businessUnits.find((b) => b.id === asset.businessUnitId);

  const openVulns = vulnerabilities.filter((v) => v.assetId === asset.id && v.status === "Open");
  const vulnScore = openVulns.reduce((sum, v) => sum + (v.cvss / 10) * (v.exploitAvailable ? 1.6 : 1) * ageFactor(v.ageInDays), 0);

  const iamScore = iamFindings.filter((f) => f.assetId === asset.id).reduce((s, f) => s + SEV_WEIGHT[f.severity], 0);
  const cspmScore = cspmMisconfigs.filter((f) => f.assetId === asset.id).reduce((s, f) => s + SEV_WEIGHT[f.severity], 0);
  const edrScore = edrDetections.filter((f) => f.assetId === asset.id).reduce((s, f) => s + SEV_WEIGHT[f.severity], 0);
  const siemScore = siemAlerts.filter((f) => f.assetId === asset.id).reduce((s, f) => s + SEV_WEIGHT[f.severity] * 0.5, 0);

  const vulnScoreM = mitigate(vulnScore, controlsMap["ctl-patch"]);
  const iamScoreM = mitigate(mitigate(iamScore, controlsMap["ctl-mfa"]), controlsMap["ctl-iam-jit"], 0.6);
  const cspmScoreM = mitigate(cspmScore, controlsMap["ctl-cspm"]);
  const edrSiemScoreM = mitigate(mitigate(edrScore + siemScore, controlsMap["ctl-edr"]), controlsMap["ctl-monitoring"], 0.5);

  const segControl = controlsMap["ctl-segmentation"];
  const segFactor = 1 - (segControl ? segControl.currentCoverage * segControl.currentEffectiveness * 0.5 : 0);
  const awareControl = controlsMap["ctl-awareness"];
  const awareFactor = 1 - (awareControl ? awareControl.currentCoverage * awareControl.currentEffectiveness * 0.3 : 0);
  const sdlcControl = controlsMap["ctl-secure-sdlc"];
  const sdlcFactor = 1 - (sdlcControl ? sdlcControl.currentCoverage * sdlcControl.currentEffectiveness * 0.25 : 0);

  const exposureMultiplier = asset.internetFacing ? 1.8 : 1.0;
  const sectorRelevance = Math.max(0, ...threatIntel.filter((t) => t.sector.includes("BFSI") || t.sector === "Cross-sector").map((t) => t.relevance));
  const threatMultiplier = 1 + (asset.regulated ? sectorRelevance * 0.5 : sectorRelevance * 0.15);

  const rawScore = vulnScoreM * 0.35 + iamScoreM * 0.25 + cspmScoreM * 0.15 + edrSiemScoreM * 0.25;
  let lambdaEffective = (0.05 + rawScore * 0.12) * exposureMultiplier * threatMultiplier * segFactor * awareFactor * sdlcFactor;
  lambdaEffective = Math.min(4, Math.max(0.02, lambdaEffective));

  // --- Loss magnitude ---
  const downtimeDaysMode = asset.criticality * 0.8;
  const backupControl = controlsMap["ctl-backup-dr"];
  const downtimeReduction = backupControl ? backupControl.currentCoverage * backupControl.currentEffectiveness * 0.6 : 0;
  const downtimeDays = { min: 0.5, mode: downtimeDaysMode * (1 - downtimeReduction), max: asset.criticality * 3 * (1 - downtimeReduction * 0.7) };
  const downtimeCost = {
    min: downtimeDays.min * bu.dailyRevenueINR,
    mode: downtimeDays.mode * bu.dailyRevenueINR,
    max: downtimeDays.max * bu.dailyRevenueINR,
  };

  const dlpControl = controlsMap["ctl-dlp"];
  const dlpReduction = dlpControl ? dlpControl.currentCoverage * dlpControl.currentEffectiveness * 0.5 : 0;
  const exposureFrac = { min: 0.02, mode: 0.15 * (1 - dlpReduction), max: 0.45 * (1 - dlpReduction) };
  const perRecordCost = COST_PER_RECORD_INR * (asset.dataSensitivity / 3);
  const breachCost = {
    min: asset.recordCount * exposureFrac.min * perRecordCost,
    mode: asset.recordCount * exposureFrac.mode * perRecordCost,
    max: asset.recordCount * exposureFrac.max * perRecordCost,
  };

  const baseMin = downtimeCost.min + breachCost.min;
  const baseMode = downtimeCost.mode + breachCost.mode;
  const baseMax = downtimeCost.max + breachCost.max;
  const repFactor = 0.15 + (asset.criticality / 5) * 0.15;
  const magnitude = {
    min: baseMin * (1 + repFactor * 0.5),
    mode: baseMode * (1 + repFactor),
    max: baseMax * (1 + repFactor * 1.5),
  };

  let regulatory = null;
  if (asset.regulated) {
    const severityFactor = Math.min(1, rawScore / 3);
    regulatory = {
      probability: Math.min(0.6, 0.15 + severityFactor * 0.35),
      min: 50_00_000,
      mode: 3_00_00_000 * (0.5 + severityFactor * 0.5),
      max: 25_00_00_000,
    };
  }

  return {
    assetId: asset.id,
    name: asset.name,
    businessUnitId: asset.businessUnitId,
    businessUnitName: bu.name,
    criticality: asset.criticality,
    internetFacing: asset.internetFacing,
    regulated: asset.regulated,
    lambdaEffective,
    magnitude,
    regulatory,
    breakdown: {
      vulnScore, vulnScoreM, iamScore, iamScoreM, cspmScore, cspmScoreM, edrSiemScoreM,
      exposureMultiplier, threatMultiplier, segFactor, awareFactor, sdlcFactor,
      openVulnCount: openVulns.length,
    },
  };
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.ceil((p / 100) * sortedArr.length) - 1);
  return sortedArr[Math.max(0, idx)];
}

export function runRiskSimulation(orgData, opts = {}) {
  const { trials = 5000, seed = 7, controlOverrides = {} } = opts;
  const rng = makeRng(seed);

  const controls = orgData.controls.map((c) => (controlOverrides[c.id] ? { ...c, ...controlOverrides[c.id] } : c));
  const cMap = controlsById(controls);

  const profiles = orgData.assets.map((a) => computeAssetProfile(a, orgData, cMap, opts));

  const totalLossTrials = new Float64Array(trials);
  const assetLossSum = {};
  const assetLossTrials = {};
  const buLossSum = {};
  profiles.forEach((p) => {
    assetLossSum[p.assetId] = 0;
    assetLossTrials[p.assetId] = new Float64Array(trials);
    buLossSum[p.businessUnitId] = buLossSum[p.businessUnitId] || 0;
  });

  for (let t = 0; t < trials; t++) {
    let orgTotal = 0;
    for (const p of profiles) {
      const numEvents = rng.poisson(p.lambdaEffective);
      let assetTotal = 0;
      for (let e = 0; e < numEvents; e++) {
        let loss = rng.triangular(p.magnitude.min, p.magnitude.mode, p.magnitude.max);
        if (p.regulatory && rng.next() < p.regulatory.probability) {
          loss += rng.triangular(p.regulatory.min, p.regulatory.mode, p.regulatory.max);
        }
        assetTotal += loss;
      }
      assetLossTrials[p.assetId][t] = assetTotal;
      assetLossSum[p.assetId] += assetTotal;
      buLossSum[p.businessUnitId] += assetTotal;
      orgTotal += assetTotal;
    }
    totalLossTrials[t] = orgTotal;
  }

  const sortedTotal = Float64Array.from(totalLossTrials).sort();
  const orgEAL = sortedTotal.reduce((s, v) => s + v, 0) / trials;
  const orgVaR95 = percentile(sortedTotal, 95);
  const orgVaR99 = percentile(sortedTotal, 99);
  const mean = orgEAL;
  const variance = sortedTotal.reduce((s, v) => s + (v - mean) ** 2, 0) / trials;
  const orgStdev = Math.sqrt(variance);

  const perAsset = profiles.map((p) => {
    const sorted = Float64Array.from(assetLossTrials[p.assetId]).sort();
    return {
      assetId: p.assetId,
      name: p.name,
      businessUnitId: p.businessUnitId,
      businessUnitName: p.businessUnitName,
      criticality: p.criticality,
      internetFacing: p.internetFacing,
      regulated: p.regulated,
      lambdaEffective: p.lambdaEffective,
      eal: assetLossSum[p.assetId] / trials,
      var95: percentile(sorted, 95),
      breakdown: p.breakdown,
    };
  }).sort((a, b) => b.eal - a.eal);

  const perBU = orgData.businessUnits.map((bu) => ({
    businessUnitId: bu.id,
    name: bu.name,
    eal: buLossSum[bu.id] / trials,
  })).sort((a, b) => b.eal - a.eal);

  // Enterprise Risk Score: 0-100, blends normalised EAL exposure (relative to
  // a nominal risk-tolerance ceiling) with volatility (stdev/mean = tail risk).
  const RISK_TOLERANCE_CEILING = 150_00_00_000; // ₹150 Cr — illustrative board-set ceiling
  const exposureComponent = Math.min(1, orgEAL / RISK_TOLERANCE_CEILING);
  const volatilityComponent = Math.min(1, orgStdev / (orgEAL || 1) / 2);
  const enterpriseRiskScore = Math.round((0.7 * exposureComponent + 0.3 * volatilityComponent) * 100);

  return { orgEAL, orgVaR95, orgVaR99, orgStdev, enterpriseRiskScore, perAsset, perBU, profiles, trials };
}

export { controlsById, COST_PER_RECORD_INR };
