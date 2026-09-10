// Investment Optimization Module.
//
// Treats each control-uplift recommendation as an item in a 0/1 knapsack:
// pick the subset of actions that maximises total ₹ risk reduction without
// exceeding a given budget. Costs are discretised to the nearest ₹1 lakh
// bucket to keep the DP table small while staying accurate to typical
// procurement/budgeting granularity.

const LAKH = 100_000;

export function knapsackOptimize(candidates, budgetINR) {
  const budgetLakhs = Math.floor(budgetINR / LAKH);
  const items = candidates.map((c) => ({ ...c, costLakhs: Math.max(1, Math.round(c.costINR / LAKH)) }));

  const dp = new Array(budgetLakhs + 1).fill(0);
  const keep = items.map(() => new Array(budgetLakhs + 1).fill(false));

  items.forEach((item, i) => {
    for (let b = budgetLakhs; b >= item.costLakhs; b--) {
      const candidateValue = dp[b - item.costLakhs] + item.riskReductionINR;
      if (candidateValue > dp[b]) {
        dp[b] = candidateValue;
        keep[i][b] = true;
      }
    }
  });

  let b = budgetLakhs;
  const chosen = [];
  for (let i = items.length - 1; i >= 0; i--) {
    if (keep[i][b]) {
      chosen.push(items[i]);
      b -= items[i].costLakhs;
    }
  }
  chosen.reverse();

  const totalCost = chosen.reduce((s, c) => s + c.costINR, 0);
  const totalRiskReduction = chosen.reduce((s, c) => s + c.riskReductionINR, 0);

  return {
    budgetINR,
    chosen,
    totalCost,
    totalRiskReduction,
    unspent: budgetINR - totalCost,
    overallROSI: totalCost > 0 ? (totalRiskReduction - totalCost) / totalCost : 0,
  };
}

// Investment-vs-Risk-Reduction efficient frontier: greedily sort by ROSI
// (bang-per-buck) and accumulate — reveals the diminishing-returns curve
// executives use to find the optimal spend zone.
export function buildEfficientFrontier(candidates) {
  const sorted = [...candidates].sort((a, b) => b.rosi - a.rosi);
  let cumCost = 0;
  let cumReduction = 0;
  const points = [{ cumulativeCostINR: 0, cumulativeRiskReductionINR: 0, label: "Baseline" }];
  sorted.forEach((c) => {
    cumCost += c.costINR;
    cumReduction += c.riskReductionINR;
    points.push({ cumulativeCostINR: cumCost, cumulativeRiskReductionINR: cumReduction, label: c.name });
  });
  return points;
}
