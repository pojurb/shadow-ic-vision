# CODE ANATOMY — web/

> Read this when you return after time away and need to re-orient quickly.
> It covers what the product is, where to find things in the code, and why key decisions were made.
> Last updated: 2026-06-11

---

## What This Is

Current status: `web/` is frozen as a legacy demo. New product work, including
live AI, thesis memory, portfolio analysis, intake grounding, and the
eval/self-improvement harness, lives in `../app/`.

This is the demo version of the JP Family Office investment cockpit. It runs entirely in a web browser — you open the `index.html` file and it works immediately. There is no installation, no server running in the background, and no internet connection required. Everything the page needs is already inside the two files in this folder (`index.html` and `style.css`).

**What it does:** You pick an asset (a stock, a startup, or a conventional business), adjust the financial numbers using sliders, and the page instantly calculates metrics, shows a Bull vs Bear debate, and presents three advisory perspectives (Operator, Risk, Predator). You then log your investment decision at the end. The whole flow demonstrates how an AI-assisted investment decision process would work — even though the AI debate in this demo is simulated, not live.

---

## File Map

| File | Role | Size |
|---|---|---|
| `index.html` | HTML structure + all JavaScript logic | ~830 lines |
| `style.css` | All visual styles — colours, fonts, layout, spacing | ~1003 lines |
| `README.md` | Project overview | |

---

## Architecture in One Sentence

The financial data for each asset is hardcoded inside the file. When you move a slider, JavaScript recalculates the numbers using math formulas, then immediately updates the chart and the metric boxes on screen — all without loading anything from the internet or talking to a server.

---

## Data Flow

This diagram shows the chain of events from the moment you click an asset to the moment something appears on screen. Read it top to bottom. Each arrow means "triggers" or "feeds into".

```
portfolioData  (all asset data — hardcoded in the file)
      │
      ▼
loadPreset(id)  ◄── user clicks a preset button (e.g. "BBCA", "PayGuard")
      │
      ├──► renderForm()  →  slider fields appear on screen
      │         │
      │         └──► user moves a slider
      │                        │
      │                        ▼
      ├──────────────► calculate()
      │                  ├── calcStocks()        ──► updates metric boxes + redraws chart
      │                  ├── calcStartups()      ──► updates metric boxes + redraws chart
      │                  └── calcConventional()  ──► updates metric boxes + redraws chart
      │
      ├──► runDebate()
      │         │
      │         └──► writeLog()  (called once per debate line, plays back with typewriter effect)
      │
      └──► renderLens()  ◄── also re-triggered when user clicks Operator / Risk / Predator tab
                │
                └──► updates the advisory text panel on screen

--- Separate flow, triggered by user filling in the decision form ---

User clicks Commit
      │
      ▼
commitDecision() ──► saves to browser storage ──► loadLedger() ──► refreshes the log display
```

---

## JS Section Index

*Where to go when you need to change something.*

Each section name below matches a large comment block inside `index.html`. To jump directly to it, open the file in your editor and search (Ctrl+F) for the section name — e.g. search `CALCULATORS` and you will land exactly at that block.

| Section | Approx. Lines | Touch when… |
|---|---|---|
| **DATA** | 225–354 | Adding or editing assets, debate scripts, or advisory text |
| **CALCULATORS** | 359–410 | Fixing or adding financial formulas (BEP, IRR, DCF, LTV) |
| **STATE** | 415–423 | Adding a new value the app needs to track while the page is open (e.g. a new toggle or selected state) |
| **DOM REFS** | 427–428 | Adding a pointer to a new HTML element so JavaScript can read or control it |
| **INIT** | 433–458 | Connecting a new HTML element to JavaScript when the page first loads |
| **EVENTS** | 463–489 | Adding a new user interaction — e.g. a button click or a new input field |
| **VERTICAL LOADING** | 500–534 | Changing how assets load when you switch between Stocks, Startups, or Conventional |
| **PARAMETER FORM** | 539–601 | Adding or removing slider fields for a vertical |
| **CALCULATIONS** | 607–659 | Changing what gets computed and displayed when a slider moves |
| **SVG CHARTS** | 664–741 | Editing the visual charts. SVG is a browser-native format for drawing shapes with code — not image files |
| **DEBATE SIMULATION** | 746–783 | Editing the debate animation speed or how the log messages appear |
| **ADVISORY LENSES** | 788–793 | Changing how the Operator / Risk / Predator text is displayed |
| **DECISION LEDGER** | 798–822 | Changing how decisions are saved or shown in the log |
| **BOOT** | 827 | The single line that starts the whole app when the page finishes loading |

---

## State Object

"State" is a single JavaScript object that holds everything the app needs to remember while the page is open — which asset is selected, what the current slider values are, which lens tab is active, etc. Think of it as the app's short-term memory. When you switch assets or move a slider, the relevant value in `state` is updated first, and then the page re-renders based on whatever is now in `state`.

```js
state = {
    activeVertical,      // 'stocks' | 'startups' | 'conventional'
    activeAssetId,       // e.g. 'bbca'
    activeAssetData,     // full asset object ref from portfolioData
    parameters,          // live copy of asset.parameters — mutated by sliders
    activeLens,          // 'operator' | 'risk' | 'predator'
    isSidebarCollapsed,  // boolean
    debateTimers         // setTimeout IDs — cleared on re-run to prevent leaks
}
```

---

## Data Schema

`portfolioData` is the object in the code that holds all the hardcoded asset data — the financial numbers, the debate scripts, and the advisory texts for every asset in every vertical. A "schema" just means the expected structure: what fields every asset must have and what type of data goes in each field. This is useful to know when you want to add a new asset — you need to follow this exact structure or the page will break.

Every asset in `portfolioData` follows this structure:

```js
{
    id, name,
    parameters: { /* vertical-specific numbers, varies per vertical */ },
    debate: {
        confidence,          // number 0–100, shown as confidence score
        bull: [{ agent, text }],
        bear: [{ agent, text }]
    },
    advisory: {
        operator:  { title, text },
        risk:      { title, text },
        predator:  { title, text }
    }
}
```

Parameters by vertical:

| Vertical | Keys |
|---|---|
| stocks | `price, eps, pb, roe, discountRate, terminalMult, invested, cashflows[]` |
| startups | `cash, burn, cac, arpu, margin, churn` |
| conventional | `fixed, price, variable, invested` |

---

## Design Decisions (the "why")

**No external tools or installation required.**
This demo was built to open directly from a file on your computer, with no setup. Using a framework like React (a popular JavaScript library for building web apps) or a build tool like Vite (a tool that compiles and bundles code before it can run) would require you to install software, run commands, and maintain dependencies — adding complexity with no visible benefit for a demo this size. If the project grows large enough to justify it, that migration can happen then.

**All calculator functions are self-contained.**
Functions like `calcBEP`, `calcIRR`, `calcDCF`, `calcLTV` only take in numbers and return numbers. They do not read from or write to the screen, and they do not depend on anything outside themselves. This matters because if a calculation gives the wrong result, you can test that one function in isolation — you don't have to load the whole page to debug it.

**`state.parameters` is a live copy, not the original data.**
When you load an asset, the app copies its numbers into `state.parameters`. Sliders then modify that copy — not the original `portfolioData`. This means the original data is always intact. Switching to a different asset or re-loading the page always resets cleanly to the original preset values.

**Debate content is pre-written, not generated by AI.**
The Bull and Bear debate text you see in the UI was written by hand and stored in `portfolioData`. The "SIM" badge next to the panel title in the UI makes this visible to anyone reading the demo. The AI DESIGN tab in the sidebar explains what the live AI version would look like when built in `app/`.

**Decision log saves to the browser, not a server.**
When you commit a decision, it is saved in your browser's built-in local storage (a small database every browser has for storing data per website). This means it persists when you refresh the page, but it does not sync across devices and it will be lost if you clear your browser data. If local storage is blocked (which happens when opening the file directly from your computer in some browsers), the save silently fails — the page does not crash.

---

## CSS Design System (quick ref)

This section is for when you want to change the visual appearance of the cockpit — colours, fonts, or the overall feel. Instead of writing the same colour code (e.g. `#06b6d4`) in hundreds of places across the file, the entire visual identity is defined once as a set of named variables at the very top of `style.css`. These named variables are called "design tokens". To change the cyan colour across the whole page, you only update it in one place and everything updates automatically.

These variables are declared inside a block called `:root` — which is just CSS's way of saying "make these variables available everywhere on the page."

| Token (variable name) | Colour | Used for |
|---|---|---|
| `--cyan-active` | `#06b6d4` | AI-related elements, live/active values |
| `--yellow-caution` | `#d97706` | Primary accent colour — buttons, borders, highlights |
| `--bull-green` | `#22c55e` | Positive / profit indicators |
| `--bear-red` | `#ef4444` | Negative / risk indicators |
| `--font-mono` | JetBrains Mono | Body text, data values, labels (monospace font — fixed-width, like a terminal) |
| `--font-heading` | Space Grotesk | Headings, button labels, titles |

---

## Roadmap Status

**What is this `web/` folder?**
This is the demo version of the investment cockpit. When you open it in a browser, it looks fully functional — but the AI debate you see is not real AI. The text from the Bull and Bear agents was written by hand during development and is just playing back with a typewriter animation. No AI model is being called. This was done intentionally to keep the demo free, fast, and hostable anywhere without a server.

**What is the `app/` folder?**

2026-06-18 update: `app/` is now the active local-first Next.js product. It
supports BYOK live AI providers, thesis memory, portfolio analysis, intake
grounding, offline evals, optional live provider scorecards, the safe
self-improvement loop, plus IC Agenda, Evidence Locker, Decision Ledger,
and IC Chair Triage flows.
Inside the same project folder (`D:\jp-invest\`), there is a second, completely separate product called `app/`. This is the real, production version being actively built. Unlike this demo, `app/` actually connects to an AI model (Claude by Anthropic), stores your analysis data permanently on your machine, and is designed for actual daily use — not just to demonstrate the concept to others.

**Why does this matter for the roadmap?**
Some features below were originally planned to be added to this demo. But since `app/` is now where the real product is being built, those features will be built there instead — not added here. This demo (`web/`) is considered feature-complete as a demo.

**What is already working here:**
- The financial calculators (DCF, BEP, IRR, LTV, Runway) — these are real math, not fake
- The Bull vs Bear debate panel — this is a simulation (pre-written text, typewriter animation)
- The 3-lens advisory views (Operator, Risk, Predator) — pre-written text per asset
- The decision log — you can type and save a decision; it stores in your browser locally

**What will NOT be built here — going into `app/` instead:**
- Real AI analysis — where an actual AI model reads your numbers and generates the debate live
- A way to test whether the AI is giving consistent, accurate answers over time
- A way to import real financial data from a file or an external data source
