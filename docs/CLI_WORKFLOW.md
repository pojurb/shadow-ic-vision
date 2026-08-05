# CLI Workflow Runbook

How to actually drive jp-invest from a terminal, with the Web App as the
dashboard beside it. The architecture and its governance record are
[`DEC-0017`](decisions/DEC-0017-cli-terminal-workflow-and-concurrency-model.md);
this file is the operational how-to, not a decision record.

The rules a terminal agent must follow while doing any of this are in
[`AGENTS.md`](../AGENTS.md) ("Product Constitution for CLI Usage"). The two
that shape the workflow below: **the agent's own web search is never
jp-invest's verified evidence**, and **the agent never recommends Buy / Hold /
Reduce / Exit**.

## Prerequisites

- `.env` configured (see `.env.example`). `RESEARCH_SOURCE_MODE=live` for real
  sources; `mock` for fixtures.
- The dev server running for the browser half: `npm run dev` → `localhost:3000`.
- Both the browser and the CLI read the same SQLite file, concurrently and
  safely (WAL + `busy_timeout` + a per-claim lease owner). You do not need to
  stop one to use the other.

## The loop

### 1. Explore freely in the terminal

Ordinary conversation with your terminal agent. Nothing here touches
jp-invest. Anything the agent finds by its own browsing is **exploration
only** — it carries no verification status until it goes through the pipeline
below.

### 2. Stage a thesis draft

```bash
npm run thesis:stage -- --draft '{"ticker":"TLKM", ...}'
# or: cat draft.json | npm run thesis:stage
```

Prints a `localhost:3000/c/<id>` URL. **This does not create a thesis.** It
writes only a conversation + draft message. The thesis exists only after you
open that URL in the browser and click Confirm — that click is the system's
actual commitment gate, and the CLI cannot bypass it or pipe past it.

If the draft has an ambiguous measurement contract, the output's
`clarificationNeeded` / `questions` tell you what must be pinned down before
the browser will let you confirm. Those numbers are yours to choose — an agent
may propose a methodology or name a convention, never the final threshold.

### 3. Run the evidence pipeline

```bash
npm run research:queue -- --thesis-id <id>
```

Runs the deterministic `CitationPipeline` — fetch, verbatim `.includes()`
verification, polarity classification. This is the only thing that produces
jp-invest's verified evidence.

### 4. Read the results

```bash
npm run research:panel -- --thesis-id <id>          # readable summary
npm run research:panel -- --thesis-id <id> --full   # every evidence item, longer quotes
npm run research:panel -- --thesis-id <id> --json   # raw DTO, for piping
```

The summary leads with the **verdict** (deterministic arithmetic over
persisted evidence polarity — not model output, so no generated text can
soften it) and the **coverage ledger**, including assumptions with *no*
evidence. Absence of evidence is reported, not silently read as absence of
concern.

Evidence direction is marked in the margin: `✓` supports, `✗` contradicts,
`~` inconclusive.

### 5. Retry whatever did not complete

```bash
npm run research:retry -- --thesis-id <id>
npm run research:retry -- --thesis-id <id> --job-id <jobId>   # just one
```

Only `degraded` and `failed` jobs are eligible — a succeeded job cannot be
re-run over evidence that already verified. Requeues, then processes, then
prints the resulting per-job status.

Common `errorCode`s and what they mean:

| code | meaning |
| --- | --- |
| `issuer_source_unavailable` | The configured `ISSUER_SOURCE_URLS` page exposed no eligible PDF. Usually a config problem: the adapter scans only that one page for terminal `.pdf` links and never crawls deeper, so pointing it at an IR *landing* page instead of the *reports index* yields nothing. |
| `source_too_large` | The document exceeded first-slice multimodal processing. A retry may pick a different, smaller document. |
| `citation_not_found` | Documents were fetched but nothing passed verbatim verification. Not a failure of the gate — the gate working. |
| `crawl_limit_exceeded` | Source exceeded the crawl budget. |

An assumption can also finish `succeeded` with **zero** evidence
(`no_candidate_passed_gate` in the coverage ledger) — the job ran fine,
nothing cleared verification.

### 6. Record the decision — in the browser

Open `localhost:3000/c/<id>`. Record outcome, your reasoning, and any known
alternatives considered.

There is deliberately no `decisions:record` CLI script yet. When one is built
it must block on live interactive stdin for the action value rather than
accept it as a flag ([`DEC-0017`](decisions/DEC-0017-cli-terminal-workflow-and-concurrency-model.md)
Approved Scope item 6) — the recorded action must never be inferable as
agent-supplied.

## Other scripts

```bash
npm run research:refresh              # scheduled-refresh path (Task Scheduler)
npm run research:promote-discoveries  # re-evaluate discovered candidates after an allowlist change
npm run research:cleanup-evidence     # prune boilerplate evidence
npm run verify                        # context, status, types, lint, tests, build
```

## Troubleshooting

- **CLI shows data the browser doesn't (or vice versa):** the browser does not
  live-refresh yet. Reload the page.
- **Everything reads from the wrong database:** check `DB_PATH` in `.env`. All
  CLI scripts load `.env`.
- **A job sits in `running`:** leases expire after 60s and are swept back to
  `queued`; a long job heartbeats every 20s to keep its own lease. Re-run
  `research:queue`.
