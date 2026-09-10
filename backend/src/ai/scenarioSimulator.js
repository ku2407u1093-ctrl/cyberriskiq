import { runRiskSimulation } from "../engine/riskEngine.js";

const SIM_TRIALS = 3000;

// Named "what-if" presets matching the kinds of questions execs actually
// ask (mirrors the presets listed in the problem statement). Each preset is
// just a set of control overrides — the same lever the Investment Optimizer
// uses — so results stay internally consistent across the whole app.
export const PRESETS = {
  "mfa-everywhere": {
    label: "Implement MFA across all privileged accounts",
    overrides: { "ctl-mfa": { currentCoverage: 0.98, currentEffectiveness: 0.55 } },
  },
  "patch-sla-7d": {
    label: "Enforce 7-day critical patch SLA",
    overrides: { "ctl-patch": { currentCoverage: 0.95, currentEffectiveness: 0.4 } },
  },
  "network-segmentation": {
    label: "Complete network micro-segmentation rollout",
    overrides: { "ctl-segmentation": { currentCoverage: 0.95, currentEffectiveness: 0.35 } },
  },
  "delay-remediation-30d": {
    label: "Delay remediation backlog by 30 days",
    overrides: { "ctl-patch": { currentCoverage: 0.3, currentEffectiveness: 0.2 } },
  },
  "cspm-autoremediate": {
    label: "Enable CSPM auto-remediation for all cloud assets",
    overrides: { "ctl-cspm": { currentCoverage: 0.95, currentEffectiveness: 0.3 } },
  },
  "soc-24x7": {
    label: "Stand up 24x7 SOC with tuned SIEM use-cases",
    overrides: { "ctl-monitoring": { currentCoverage: 0.95, currentEffectiveness: 0.3 } },
  },
};

export function runScenario(orgData, baseline, { presetId, customOverrides, seed = 7 } = {}) {
  const overrides = presetId ? PRESETS[presetId]?.overrides : customOverrides;
  if (!overrides) throw new Error("Unknown scenario preset or missing overrides");

  const result = runRiskSimulation(orgData, { trials: SIM_TRIALS, seed, controlOverrides: overrides });

  const reduction = baseline.orgEAL - result.orgEAL;
  return {
    label: presetId ? PRESETS[presetId].label : "Custom scenario",
    beforeEAL: baseline.orgEAL,
    afterEAL: result.orgEAL,
    reductionINR: reduction,
    reductionPct: baseline.orgEAL ? (reduction / baseline.orgEAL) * 100 : 0,
    beforeVar95: baseline.orgVaR95,
    afterVar95: result.orgVaR95,
    beforeRiskScore: baseline.enterpriseRiskScore,
    afterRiskScore: result.enterpriseRiskScore,
    perBU: result.perBU,
  };
}
