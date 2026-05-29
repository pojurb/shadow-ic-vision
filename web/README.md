# JP Family Office — AI PM Portfolio & Investment Cockpit

An interactive product case study built to demonstrate **AI Product Management** skills: product thinking, AI-UX design, and quantitative business validation.

**Live demo:** https://demo-vercel-nu-peach.vercel.app/

---

## 🎯 Problem & Solution

- **Problem:** Investors deploying capital across multiple asset classes (Equities, Startups/VC, Real Businesses) must judge wildly different metrics per vertical. Manual research is slow (~8 hrs/asset) and prone to **confirmation bias**.
- **Solution:** A decision-support cockpit where numbers are validated by a **deterministic quantitative engine**, then an LLM acts as a **red team** (Bull vs Bear) and presents **3 advisory lenses** (Operator / Risk Manager / Predator). The AI never makes the final call — every decision is gated to a human and logged for audit.

The core product decision is to **separate the numbers from the narrative**: all figures are computed by deterministic code (zero numeric hallucination), and the LLM may only narrate and debate locked figures.

---

## ⚙️ Prototype Note (Honest Scope)

The agent debate in this demo is a **UX simulation with curated output** — built to demonstrate the interaction flow and product design without live LLM cost/latency. The **AI DESIGN** tab in the app documents the production architecture (LLM orchestration, grounding, structured output, eval harness, guardrails, and model/cost trade-offs) that this prototype is designed to power.

---

## 📂 Structure (Zero-Dependency Static App)

Built with fundamental web tech only — no frameworks, no build step:

```text
web/
├── index.html   # Everything inline: markup + portfolio data + finance engine + app logic
├── style.css    # Industrial / grunge cockpit design system
└── README.md    # This file
```

The finance engine (DCF, NPV, BEP, IRR, LTV/CAC, Runway) and all interaction logic live inline in `index.html`, so the app runs from a single file with no external scripts.

---

## 🚀 Run Locally

The app is fully `file://` compatible — **no web server required**:

1. Open the `web/` folder.
2. Double-click `index.html`.

Or, to simulate production over HTTP, open `web/` in VS Code and use the **Live Server** extension.

---

## 🌐 Deployment

Deployed as a static site on **Vercel** with **Root Directory** set to `web`, no build command, and Framework Preset `Other`. Every push to `main` triggers an automatic redeploy.
