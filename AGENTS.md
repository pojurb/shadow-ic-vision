<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Context Routing

Start with [`docs/CODEBASE_MAP.md`](docs/CODEBASE_MAP.md) for module ownership,
critical flows, invariants, and task-specific reading. Use
[`docs/generated/code-index.json`](docs/generated/code-index.json) for derived
module/import/route/schema facts and [`docs/decisions/INDEX.md`](docs/decisions/INDEX.md)
for decision navigation.

Current status belongs only in [`ACTIVE_MILESTONE.md`](ACTIVE_MILESTONE.md) and
[`SESSION_CHECKPOINT.md`](SESSION_CHECKPOINT.md). Generated context is
navigation data, not governing authority.

## Product Constitution for CLI Usage

This codebase follows a strict "Moral Constitution" — see [`VISION.md` §6-§7](VISION.md). When using CLI commands in this project to stage or process theses:

**Four non-negotiable rules:**

1. **Your own web search is NOT verified evidence.** If you search the web or use your own knowledge to answer a question, that is exploration only — it is not `jp-invest`'s verified evidence. Any factual claim that needs jp-invest's verification must go through `npm run research:queue`, which runs the deterministic evidence pipeline. Tell the user explicitly when you are speaking from your own knowledge vs. from jp-invest's verified results.

2. **Investment actions are always the user's choice, never a system suggestion.** You must never recommend "Buy", "Hold", "Reduce", or "Exit". If a thesis shows breach or insufficient evidence, flag it clearly — the user decides what to do. This is [`PRODUCT_STRATEGY.md` Workflow E](docs/PRODUCT_STRATEGY.md).

3. **Before any action that creates durable state, the user confirms in the browser.** When you stage a thesis draft with `npm run thesis:stage`, you print a URL. The user must open that URL in their browser and click "Confirm" — that is the system's actual commitment gate, not the CLI's. This ensures a human actually reviews the draft in context before it becomes permanent.

4. **When resolving an `ambiguous` measurement contract (or any other user-owned calibration value), propose methodology — never the final number.** Freely name conventions, comparable frameworks, and reasoning (e.g., "SOTP/EV contribution," "marginal share of new capacity," "SBNB/contracted backlog" — cite the real convention by name, not a vague "best practice"). Never supply the specific calibrated threshold/number for the user's specific thesis and present it as settled; present it as a choice within the framework you named, and say plainly what is still open. This is a narrower sibling of rule 2: rule 2 blocks a *conclusion*, this rule blocks a *calibration input* that would let the conclusion be reverse-engineered from a number you chose. See [`LC-20260804-001`](docs/learning/candidates/LC-20260804-001-ai-proposes-methodology-not-final-thresholds.md) for the full reasoning and corroborating prior art.

Private Knowledge is a source-traceable analysis substrate for user-led
analysis of the private educational corpus. It is separate from live
`Evidence`/`SourceSnapshot`, is not current market evidence, and must not be
used to produce an automatic investment conclusion; `graph_ready` remains
candidate knowledge with provenance.

Breaking any of these four rules means the product is not functioning as designed.
