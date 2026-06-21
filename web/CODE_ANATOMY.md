# CODE ANATOMY - web/

> High-level map for the frozen legacy demo in `web/`.
> Active product work lives in `../app/`.
> Last updated: 2026-06-21

---

## What This Is

`web/` is the old standalone browser demo.

It is not the active product. It remains useful only as a compact demo of the
original valuation-cockpit concept:

- pick a preset asset
- move sliders
- recalculate deterministic metrics in the browser
- replay a simulated bull/bear debate
- save a lightweight decision log in browser storage

Everything current around Agenda, Explore, kickoff/fact-check/review,
Evidence Locker, IC thesis memory, stock provenance, manual/private assets, and
browser QA now lives in `../app/`.

---

## Architecture In One Sentence

`web/` is a static HTML/CSS/JavaScript demo where hardcoded preset data feeds
in-browser calculators and a simulated debate without any server, AI provider,
or persistent workspace model.

---

## File Map

| File | Role |
|---|---|
| `index.html` | HTML plus all demo JavaScript logic |
| `style.css` | All demo styles |
| `README.md` | Legacy project overview |

---

## Data Flow

```text
Hardcoded preset data
      |
      v
loadPreset()
      |
      +-> renderForm()
      +-> calculate()
      +-> runDebate()
      `-> renderLens()

User commits decision
      |
      v
commitDecision()
      |
      v
browser localStorage
```

Important limitations:

- no Next.js app shell
- no Dexie / IndexedDB repository
- no live AI calls
- no thesis memory or Evidence Locker
- no Explore flow or saved-review lifecycle

---

## What To Touch

| File | Touch when... |
|---|---|
| `index.html` | changing demo presets, calculators, debate playback, or decision-log behavior |
| `style.css` | changing the demo visuals only |

---

## Status

Keep this folder high-level and stable.

- `web/` should stay documented as a legacy demo
- feature truth for the real product belongs in `../app/`
- new architecture detail should be added to `app/CODE_ANATOMY.md`, not here
