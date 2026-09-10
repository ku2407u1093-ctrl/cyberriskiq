// Natural-language query interface for non-technical stakeholders.
// A lightweight, fully local intent classifier (keyword/regex scoring) maps
// free-text questions onto the already-computed risk store and renders a
// templated business-language answer. No LLM/API call required — every
// number quoted traces directly back to the Monte Carlo simulation output,
// which matters for board/regulator-facing explainability.

const fmtINR = (n) => {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};

const INTENTS = [
  {
    name: "top_risk",
    test: (q) => /(highest|biggest|top|largest).*(risk|exposure|loss)/.test(q) || /which asset.*risk/.test(q),
    handle: (ctx) => {
      const top = ctx.simulation.perAsset[0];
      return {
        answer: `Your highest financial cyber risk today is **${top.name}** (${top.businessUnitName}), with an Expected Annual Loss of ${fmtINR(top.eal)} and a 95% Value-at-Risk of ${fmtINR(top.var95)}. Key drivers: ${top.breakdown.openVulnCount} open vulnerabilities, internet-facing: ${top.internetFacing ? "yes" : "no"}.`,
        data: { type: "asset-list", items: ctx.simulation.perAsset.slice(0, 5) },
      };
    },
  },
  {
    name: "total_exposure",
    test: (q) => /(total|overall|enterprise).*(exposure|risk|loss)|expected annual loss|how much.*(risk|exposure|lose)/.test(q),
    handle: (ctx) => ({
      answer: `Enterprise-wide, your Expected Annual Loss (EAL) is ${fmtINR(ctx.simulation.orgEAL)}. At the 95th percentile (Value-at-Risk), a bad year could cost ${fmtINR(ctx.simulation.orgVaR95)}, and at 99% up to ${fmtINR(ctx.simulation.orgVaR99)}. Your Enterprise Risk Score is ${ctx.simulation.enterpriseRiskScore}/100.`,
      data: { type: "exposure-summary", eal: ctx.simulation.orgEAL, var95: ctx.simulation.orgVaR95, var99: ctx.simulation.orgVaR99, riskScore: ctx.simulation.enterpriseRiskScore },
    }),
  },
  {
    name: "vuln_contributors",
    test: (q) => /vulnerabilit|cve|patch/.test(q) && /(contribut|driv|caus|most)/.test(q),
    handle: (ctx) => {
      const ranked = [...ctx.simulation.perAsset].sort((a, b) => b.breakdown.vulnScoreM - a.breakdown.vulnScoreM).slice(0, 5);
      return {
        answer: `The vulnerabilities contributing most to expected losses sit on: ${ranked.map((a) => `${a.name} (${a.breakdown.openVulnCount} open, EAL ${fmtINR(a.eal)})`).join("; ")}.`,
        data: { type: "asset-list", items: ranked },
      };
    },
  },
  {
    name: "recommendations",
    test: (q) => /(recommend|mitigat|reduce risk|what should|prioriti)/.test(q),
    handle: (ctx) => {
      const top = ctx.recommendations.slice(0, 3);
      return {
        answer: `Top prioritised actions by risk reduction: ${top.map((r, i) => `${i + 1}) ${r.name} — reduces EAL by ${fmtINR(r.riskReductionINR)} for a cost of ${fmtINR(r.costINR)} (ROSI ${(r.rosi * 100).toFixed(0)}%)`).join(". ")}.`,
        data: { type: "recommendation-list", items: top },
      };
    },
  },
  {
    name: "budget_investment",
    test: (q) => /(budget|invest|₹|crore|lakh|rosi|roi|spend)/.test(q),
    handle: (ctx) => {
      const budget = 1_00_00_000;
      return {
        answer: `With a ₹1 crore budget, the optimizer recommends: ${ctx.optimized.chosen.map((c) => c.name).join(", ")} — for a total risk reduction of ${fmtINR(ctx.optimized.totalRiskReduction)} against a spend of ${fmtINR(ctx.optimized.totalCost)} (ROSI ${(ctx.optimized.overallROSI * 100).toFixed(0)}%).`,
        data: { type: "optimizer-result", ...ctx.optimized },
      };
    },
  },
  {
    name: "compliance",
    test: (q) => /(complian|framework|iso|nist|cis|rbi|sebi|audit)/.test(q),
    handle: (ctx) => {
      const summary = Object.entries(ctx.compliance).map(([fw, v]) => `${fw}: ${v.overallPct.toFixed(0)}%`).join(", ");
      return {
        answer: `Current framework coverage — ${summary}. Lowest-maturity domain overall is ${
          Object.values(ctx.compliance).flatMap((v) => v.domains).sort((a, b) => a.coveragePct - b.coveragePct)[0]?.domain
        }.`,
        data: { type: "compliance-summary", frameworks: ctx.compliance },
      };
    },
  },
  {
    name: "trend",
    test: (q) => /trend|increasing|decreasing|forecast|next month|next quarter/.test(q),
    handle: (ctx) => ({
      answer: `Your risk exposure trend is **${ctx.trend.trendDirection}**, moving roughly ${ctx.trend.monthlySlopePct.toFixed(1)}% per month. Projected EAL 3 months out: ${fmtINR(ctx.trend.forecast[2].eal)}.`,
      data: { type: "trend", ...ctx.trend },
    }),
  },
  {
    name: "business_unit",
    test: (q) => /business unit|\bbu\b|banking|payments|capital markets|hr|finance/.test(q),
    handle: (ctx) => ({
      answer: `Risk by business unit: ${ctx.simulation.perBU.map((b) => `${b.name}: ${fmtINR(b.eal)}`).join(", ")}.`,
      data: { type: "bu-list", items: ctx.simulation.perBU },
    }),
  },
];

export function answerQuery(question, ctx) {
  const q = question.toLowerCase().trim();
  for (const intent of INTENTS) {
    if (intent.test(q)) return { intent: intent.name, ...intent.handle(ctx) };
  }
  return {
    intent: "fallback",
    answer:
      "I can answer questions like: \"What is our highest financial cyber risk today?\", \"What is our total risk exposure?\", \"Which vulnerabilities contribute most to our losses?\", \"What should we prioritise with a ₹1 crore budget?\", \"How compliant are we with NIST CSF?\", or \"What's our risk trend?\"",
    data: null,
  };
}
