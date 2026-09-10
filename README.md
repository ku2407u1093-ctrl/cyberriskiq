# CyberRiskIQ

**AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform**
Built for AICTE Cyber Security Cell Hackathon — Problem Statement **26105**.

CyberRiskIQ turns "Low / Medium / High" cyber risk ratings into **₹-denominated financial exposure**, so CISOs, risk officers and boards can make investment decisions the same way they make every other capital allocation decision — with a number, not a color.

Everything in this repo runs **100% locally with zero paid APIs** — no OpenAI/Anthropic key required. The "AI" is genuine statistics and optimization (Monte Carlo simulation, linear regression, 0/1 knapsack, rule-based NLP), which is also a deliberate design choice: for board- and regulator-facing risk numbers, an auditable formula beats an unexplainable LLM call.

## What it does

| Problem statement requirement | Where it's implemented |
|---|---|
| Continuous aggregation from vuln scanners, SIEM, IAM, EDR, CSPM, asset inventory, threat intel | `backend/src/data/orgData.js` (mock connectors), re-computed on demand via `/api/rebuild` |
| Statistical/ML likelihood & impact estimation (EAL, VaR) | `backend/src/engine/riskEngine.js` — FAIR-lite Monte Carlo (5,000 trials) |
| Asset criticality modeling & control effectiveness evaluation | Built into the risk engine's loss-frequency/magnitude model |
| Predictive analytics & trend | `backend/src/ai/trendPredictor.js` — OLS linear regression forecast |
| AI-generated, quantified mitigation recommendations | `backend/src/ai/recommender.js` — reruns the engine per control to measure ₹ risk reduction |
| Natural-language query interface | `backend/src/ai/nlQuery.js` + the "Ask a question" panel in the UI |
| Scenario / what-if simulation | `backend/src/ai/scenarioSimulator.js` — Scenario Simulator tab |
| Budget-constrained investment optimization + ROSI | `backend/src/optimizer/investmentOptimizer.js` — 0/1 knapsack + efficient frontier |
| Executive & technical dashboards | `frontend/src/components/ExecutiveDashboard.jsx`, `TechnicalDashboard.jsx` |
| Framework mapping (ISO 27001, NIST CSF, CIS Controls, RBI CSF, SEBI CSCRF) | `backend/src/compliance/frameworks.js` + Compliance Mapping tab |

## Methodology (why the numbers are defensible)

For every asset, the engine estimates:

1. **Loss Event Frequency (LEF)** — a Poisson rate built from open-vulnerability severity/age/exploitability, IAM/CSPM/EDR/SIEM findings, internet exposure, and threat-intel sector relevance, then **discounted by control coverage × effectiveness** (this is the "control effectiveness evaluation" the problem statement asks for).
2. **Loss Magnitude (LM)** — a triangular (min / most-likely / max) distribution combining downtime cost (business-unit daily revenue × outage days), data-breach cost (records exposed × ₹/record benchmark), reputational cost, and — for regulated (RBI/SEBI) assets — a Bernoulli-gated regulatory-penalty band.
3. **Monte Carlo simulation** (5,000 trials): each trial samples a Poisson number of events per asset and a magnitude per event, summed across the organisation into a full annual-loss distribution.
   - **EAL** (Expected Annual Loss) = distribution mean
   - **VaR 95% / 99%** = 95th / 99th percentile — the "1-in-20-year" / "1-in-100-year" bad case

This is the same actuarial approach as the FAIR (Factor Analysis of Information Risk) model, simplified for a hackathon timebox but structurally sound — swap in real telemetry feeds and the math doesn't need to change.

## Architecture

```
backend/   Node.js + Express API. Computes the full baseline once at startup (~100ms)
           and caches it; /api/rebuild recomputes with a new random seed to simulate
           "continuous" ingestion of fresh telemetry.
frontend/  React + Vite + Tailwind + Recharts. Talks to the backend over /api (proxied
           by Vite in dev).
```

No database is used — this is an in-memory simulation layer designed to be swapped for real connectors (vulnerability scanner APIs, SIEM query APIs, CSPM APIs, etc.) without touching the risk engine, AI layer, or frontend.

## Running it

```bash
# Terminal 1
cd backend
npm install
npm start        # http://localhost:4001

# Terminal 2
cd frontend
npm install
npm run dev       # http://localhost:5174 (proxies /api to :4001)
```

## Deploying it

Split deployment: static frontend on one host, Node API on another, connected via an env var.

1. **Backend → [Render](https://render.com) (free tier)**: push this repo to GitHub, then in Render "New → Blueprint" and point it at the repo — `render.yaml` at the root configures the service (root dir `backend`, `npm install` / `npm start`) automatically. Note the resulting URL, e.g. `https://cyberriskiq-backend.onrender.com`.
2. **Frontend → [Vercel](https://vercel.com) or [Netlify](https://netlify.com)**: import the same repo, set root directory to `frontend`, framework preset "Vite". Add one environment variable: `VITE_API_BASE_URL` = the Render backend URL from step 1 (no trailing slash). Deploy.
3. CORS is open (`cors()` with no options) since this serves no secrets — every number is either synthetic demo data or a self-assessment the visitor explicitly triggers.

**Important caveat for "Live Scan (this machine)" mode**: it scans whichever machine is running the *backend* process. On a local `npm start`, that's your own laptop — the intended self-assessment use case. Deployed to Render, it scans the Render container instead (mostly a no-op on Linux, since the security-posture checks are macOS-specific commands). Live Scan is meant to be run with the backend on your own machine; the hosted deployment is best used to showcase Demo Data mode.

## Key screens

- **Executive Overview** — Enterprise Risk Score, Total Financial Exposure (EAL), VaR 95/99%, 12-month trend + 3-month forecast, top risk contributors, risk reduction opportunities.
- **Technical Drill-Down** — sortable asset risk register; click any asset to see the exact vulnerabilities/IAM findings/EDR detections/CSPM misconfigs driving its risk; control-effectiveness maturity view.
- **Investment Optimizer** — budget slider (₹10L–₹5Cr, defaults to the ₹1 Cr example from the problem statement), knapsack-optimized action list, and the "Investment vs. Risk Reduction" efficient-frontier curve.
- **Scenario Simulator** — one-click what-ifs ("Implement MFA everywhere", "Delay remediation 30 days", etc.) with instant before/after EAL, VaR and risk-score comparison.
- **Compliance Mapping** — ISO/IEC 27001, NIST CSF 2.0, CIS Controls v8, RBI Cyber Security Framework, SEBI CSCRF — coverage % computed from actual measured control maturity, not a manual checklist.
- **Ask a question** — natural-language panel answering things like *"What is our highest financial cyber risk today?"* or *"What should we prioritise with a ₹1 crore budget?"*, fully local.

## Live data mode (real, not synthetic)

Alongside the demo dataset above, CyberRiskIQ can run a **live scan of a real machine** — the one it's running on — and feed genuinely real data into the same FAIR-lite risk engine:

| Signal | Real source |
|---|---|
| Installed package inventory (npm global, pip, Homebrew) | Local read-only shell introspection |
| Known vulnerabilities for installed packages | [OSV.dev](https://osv.dev) API (free, keyless) |
| Actively-exploited-in-the-wild flag | [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) catalog (free JSON feed) |
| Real-world exploit probability | [FIRST.org EPSS](https://www.first.org/epss/) API (free, keyless) |
| OS security posture | FileVault / firewall / SIP status, listening ports, local accounts, SSH key hygiene (macOS `fdesetup`, `csrutil`, `socketfilterfw`, `lsof`, `dscl` — all read-only) |

This is **strictly self-assessment of the operator's own machine** — no external hosts are scanned, no credentials or private data leave the box, and no writes/installs/config changes are made. It's the honest way to show "real data" for a problem statement whose inputs (SIEM/IAM/EDR/CSPM telemetry) are normally private to a specific enterprise: we became the enterprise, scoped to hardware we actually own and are authorized to assess.

## Production Architecture / Scaling Roadmap

This repo is an MVP: one Express process, one React SPA, in-memory computation, no database — intentionally, to keep the hackathon build auditable and dependency-free. The methodology (FAIR-lite Monte Carlo, knapsack optimization, framework mapping) does not change at enterprise scale, only the data-plane around it. A production deployment would decompose into:

```
                         ┌──────────────────────────┐
                         │   API Gateway / BFF       │
                         │  (auth, rate limit, WAF)  │
                         └────────────┬──────────────┘
                                      │
        ┌───────────────┬────────────┼────────────┬───────────────┐
        │                │            │            │               │
  ┌─────▼─────┐   ┌──────▼─────┐ ┌────▼─────┐ ┌────▼──────┐ ┌──────▼──────┐
  │ Ingestion  │   │ Risk Engine│ │Optimizer │ │Compliance │ │ NL Query /   │
  │ Connectors │   │  Service   │ │ Service  │ │ Mapping   │ │ AI Service   │
  │(vuln, SIEM,│   │(Monte Carlo│ │(knapsack,│ │ Service   │ │(intent +     │
  │ IAM, EDR,  │   │ FAIR calc) │ │ frontier)│ │           │ │ optional LLM)│
  │ CSPM, CTI) │   │            │ │          │ │           │ │              │
  └─────┬──────┘   └─────┬──────┘ └────┬─────┘ └────┬──────┘ └──────┬───────┘
        │                │             │            │               │
        └────────┬───────┴──────┬──────┴─────┬──────┴───────┬───────┘
                  │              │            │              │
            ┌─────▼─────┐  ┌────▼────┐  ┌─────▼─────┐  ┌─────▼──────┐
            │ Event bus  │  │ Time-   │  │ Relational │  │  Object     │
            │ (Kafka) —  │  │ series  │  │ store      │  │  storage    │
            │ async      │  │ DB      │  │ (assets,   │  │  (scan      │
            │ ingestion  │  │ (EAL/   │  │  controls, │  │  artifacts, │
            │            │  │ VaR     │  │  findings) │  │  reports)   │
            │            │  │ trend)  │  │            │  │             │
            └────────────┘  └─────────┘  └────────────┘  └─────────────┘

  Each service: independently deployable (Kubernetes), containerized,
  scanner connectors run as scheduled jobs/CronJobs, infra as Terraform,
  observability via Prometheus/Grafana + centralized logging.
```

Key differences from this MVP, in priority order for a real rollout:

1. **Real connectors** replace mock/local data: vulnerability scanner APIs (Qualys/Tenable/OSV), SIEM query APIs (Splunk/Sentinel), IAM (Okta/Entra), EDR (CrowdStrike/Defender), CSPM (Wiz/Prisma or native AWS Security Hub / GCP SCC / Azure Defender), threat intel feeds (MISP, commercial CTI).
2. **Async ingestion** via a message bus (Kafka) so connector polling/webhooks don't block risk computation, and so the engine can recompute incrementally rather than from scratch.
3. **Persistent storage**: a relational store for asset/control/finding state, a time-series store for the EAL/VaR trend history that's currently synthesized, object storage for scan artifacts and generated board reports.
4. **Per-service scaling**: the Monte Carlo engine and optimizer are CPU-bound and horizontally scalable independently of the lightweight compliance/query services.
5. **AuthN/AuthZ and multi-tenancy**: gateway-level auth, per-org data isolation — required before this could serve more than one organization.

None of this is implemented — it's documented here as the target shape once real enterprise connectors and a compliance/security review are in place.
