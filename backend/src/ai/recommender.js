import { runRiskSimulation } from "../engine/riskEngine.js";

// AI Decision Support: generates prioritised, quantified mitigation
// recommendations by re-running the risk engine with each control "invested
// in" (coverage/effectiveness raised toward its ceiling) and measuring the
// resulting drop in Expected Annual Loss (EAL). This gives every
// recommendation a defensible ₹ risk-reduction number and a ROSI
// (Return on Security Investment) figure instead of a qualitative label.

const RERUN_TRIALS = 3000;

export function buildRecommendations(orgData, baselineEAL, opts = {}) {
  const seed = opts.seed ?? 7;

  return orgData.controls.map((control) => {
    const targetCoverage = Math.min(0.95, control.currentCoverage + 0.35);
    const targetEffectiveness = Math.min(control.baseEffectiveness, control.currentEffectiveness * 1.25);

    const overrides = { [control.id]: { currentCoverage: targetCoverage, currentEffectiveness: targetEffectiveness } };
    const result = runRiskSimulation(orgData, { trials: RERUN_TRIALS, seed, controlOverrides: overrides });

    const riskReductionINR = Math.max(0, baselineEAL - result.orgEAL);
    const costINR = control.improveCostINR;
    const rosi = costINR > 0 ? (riskReductionINR - costINR) / costINR : 0;

    return {
      id: control.id,
      name: control.name,
      category: control.category,
      action: `Invest in ${control.name.toLowerCase()} — raise coverage from ${Math.round(control.currentCoverage * 100)}% to ${Math.round(targetCoverage * 100)}%`,
      costINR,
      riskReductionINR,
      newOrgEAL: result.orgEAL,
      rosi,
      currentCoverage: control.currentCoverage,
      targetCoverage,
    };
  }).sort((a, b) => b.riskReductionINR - a.riskReductionINR);
}
