# JP Invest CLI Workflow Review

Audit 5 September 2026 terhadap `docs/CLI_WORKFLOW.md`, `DEC-0017`, script CLI, jalur service/database yang dipanggil, konfigurasi, test, dan kontrak produk/security terkait. Ini adalah review dan rekomendasi, bukan perubahan decision record atau otorisasi implementasi.

## Verdict

**Ready with caveats sebagai tooling internal untuk developer/operator yang memahami database dan batas sumber. Not ready sebagai workflow pengguna personal yang menjadi jalur utama; not ready sebagai bagian produk berbayar.**

Pemisahan dasarnya masuk akal: terminal membantu eksplorasi dan menjalankan pekerjaan, browser memperlihatkan evidence padat dan meminta keputusan pengguna. Lease-owner, WAL, shared thesis creation, serta larangan agent memberi aksi investasi adalah fondasi yang patut dipertahankan.

Namun, workflow yang tertulis belum benar-benar end-to-end. Setelah browser mengonfirmasi draft, pengguna tidak diberi `thesis-id` yang dibutuhkan semua command berikutnya. Runbook juga menyederhanakan `research:queue` sebagai CitationPipeline deterministik, padahal satu command memicu official retrieval, tiga secondary lanes, XBRL, Tavily discovery/promotion, dan berbagai durable writes. Gate durable state tidak konsisten antara konstitusi, DEC, runbook, dan implementasi.

## Alur aktual

```text
terminal agent conversation
  └─ outside jp-invest; provider/data handling belongs to terminal-agent client

thesis:stage --draft JSON
  ├─ validates draft
  ├─ INSERT conversation          ← durable state, no browser confirmation
  ├─ INSERT assistant message     ← separate transaction boundary
  └─ prints conversation URL      ← no thesis-id yet

browser: Confirm & Research
  ├─ INSERT thesis, assumptions, measurements, jobs
  ├─ returns thesisId to browser code
  └─ browser does not surface/copy thesisId

research:queue --thesis-id ???
  ├─ secondary issuer
  ├─ secondary news
  ├─ issuer info memo
  ├─ SEC XBRL when available
  ├─ Tavily search + allowlisted promotion
  └─ official CitationPipeline

research:panel --thesis-id ???
  └─ outputs verdict, coverage, evidence, discovery, decision history

browser: record decision
```

`Confirm & Research` currently queues jobs but does not itself call `/api/research/run`; `Workspace` only opens the polling panel. Therefore the separate queue step is meaningful. The broken part is identifier discovery and user guidance after confirmation.

## Findings

### P0 — mock/offline contract is false for discovery

`createDiscoveryProvider()` constructs Tavily solely from the presence of `SEARCH_DISCOVERY_API_KEY`; `runDiscoveryAndPromotion()` calls it regardless of `sourceMode`. A `research:queue` in mock mode can therefore use real network and quota when the user's `.env` contains a key. The project-wide audit observed 61 HTTP 200 Tavily responses during tests before the call was isolated; a later synthetic test intercepted `fetch` and reproduced one call in mock mode.

This directly conflicts with the codebase invariant that mock research and tests make no live calls, and with `.agents/SECURITY.md`'s mode-parity requirement.

Required change: make the discovery factory and orchestration take explicit mode. In mock/test, construct a deterministic no-network provider even when a real key exists. Add a hard test with a fake configured key and a network trap that must remain at zero calls.

### P0 — CLI and web can write snapshots to different roots

`research:queue` and `research:retry` override the service's snapshot directory with:

```text
<DB directory>/snapshots
```

The web/default service and `research:promote-discoveries` use `getSnapshotDirectory()`, which honors `SOURCE_SNAPSHOT_DIR` and otherwise uses:

```text
<DB directory>/source-snapshots
```

The runbook says browser and CLI operate on the same data, but these paths drift. A configured external snapshot directory is silently ignored by queue/retry. This can split source bytes across locations and makes backup/restore/diagnosis harder.

Required change: every caller uses the same config resolver. Do not reconstruct storage paths in individual scripts. Add an integration test using a non-default `SOURCE_SNAPSHOT_DIR` and assert all CLI-produced paths remain below it.

### P0 — commitment gate has no single definition

The root constitution says: “Before any action that creates durable state, the user confirms in the browser.” The runbook then says `thesis:stage` does not create a thesis, but it does create a durable conversation and message. This may be acceptable as a disposable staged draft, but the written rule currently says any durable state, not “tracked investment state.”

The newer `source-adequacy:record` command is more consequential: it accepts classification and reasoning as flags, persists a user-owned judgment, changes the coverage result, and can stop daily requeue. It has no browser confirmation and is absent from `CLI_WORKFLOW.md`. This conflicts with both the broad constitution wording and DEC-0017's rationale about agent-supplied durable state.

Other commands also persist evidence, snapshots, candidates, job status, and cleanup changes. The intended boundary is evidently narrower than the constitution's current literal wording.

Required product decision: define state categories explicitly.

| State | Proposed authority |
|---|---|
| Ephemeral exploration | Terminal only; no JP Invest persistence |
| Staged draft | CLI may persist as `staged`, visibly disposable, with expiry/delete path |
| Derived operational state: jobs, snapshots, candidates | CLI may write through deterministic services; full audit trail |
| User-owned semantic state: thesis, contract, source adequacy, correction, decision/action | Browser confirmation using a concrete review screen |
| Maintenance deletion/repair | Dry-run artifact, explicit apply, consistent backup, retained audit |

The exact classification requires user approval. Until then, `source-adequacy:record` is not product-ready.

### P1 — the handoff from browser confirmation to CLI is broken

`thesis:stage` prints `conversationId` and URL because no thesis exists yet. Browser confirmation returns `thesisId`, but `ChatUI` only uses `title`; the ID is not shown or copied. Every research command requires `--thesis-id`. The runbook provides no list, resolve, or post-confirm command.

Required change: choose one stable user-facing handle. The cleanest options are:

1. accept `--conversation-id` or the full conversation URL in queue/panel/retry and resolve the thesis internally; or
2. add `jp thesis resolve <conversation-url>` and print/copy the thesis ID after browser confirmation.

For a personal product, accepting URL/ticker and resolving ambiguity interactively is more usable than UUID-only commands. Ticker alone cannot be the unique key because thesis history and multiple theses per issuer may exist.

### P1 — `research:queue` documentation misstates what executes and what it guarantees

The runbook says the command runs the deterministic `CitationPipeline` and that this is the only producer of verified evidence. The service actually calls secondary sources, XBRL, discovery/promotion, then the official pipeline. Soft failures in the first lanes do not own `research_jobs.status`, so `succeeded` primarily describes the official lane rather than the entire research sweep.

Required change: document the lanes and their independent states. Output a run envelope containing mode, enabled lanes, network destinations/categories, attempted/succeeded/degraded/skipped counts, cost/quota where available, and snapshot root. Do not let one `succeeded` badge imply every lane worked.

### P1 — terminal-agent data disclosure is procedural, not enforced

Theses and decisions are Confidential under `.agents/SECURITY.md`. `research:panel --json` emits full assumption/evidence/decision data. When a cloud-backed coding agent invokes or reads this command, that output can leave the local machine through the agent client. JP Invest's provider gate and outbound log do not see or control this transmission.

DEC-0017 recognizes the issue but resolves it as a choice the user made outside JP Invest. That can work for the repository owner's personal setup only when they understand the boundary. It is insufficient for a product promise that says provider and handling boundary are disclosed before data is sent.

Evidence quotes are also untrusted document content. The in-app recommendation path scans embedded instructions before passing evidence to the model; a generic terminal agent reading `--json` receives raw evidence. An instruction in a filing cannot alter JP Invest code directly, but it can influence the orchestrating agent.

Required change for personal use: show a preflight disclosure and offer `--redacted`/`--summary` output that omits decision rationale and unnecessary raw metadata. Agent instructions must label the output as untrusted source data. For sale: either ship a controlled local CLI client or formally support named agent providers with explicit consent, data-class rules, and auditability. Do not make “bring any terminal agent” a silent requirement.

### P1 — staged draft writes are not atomic and have no lifecycle

`thesis:stage` inserts conversation and message in two separate writes. If the second fails, an orphan conversation remains. Staged drafts have no explicit status, expiry, list, resume, or delete flow. The title convention `Staged:` is the only practical marker.

Required change: one database transaction, explicit staged state, idempotency key, and lifecycle commands/UI. Re-running the same request should return the existing staged draft or create a clearly separate revision, not silently accumulate indistinguishable records.

### P1 — source-adequacy CLI can change product conclusions without review context

The command asks for an internal assumption UUID plus A/B/C and reasoning. It does not show the current contract, prior classification, corpus searched, or the coverage/verdict diff before applying. A mistyped `C` can stop scheduled research and suppress coverage. It also permits `not_measurable`/legacy shapes except the explicitly blocked `ambiguous` case.

Required change: stage a proposed assessment, display current contract and exact downstream effect, then confirm in browser. The agent may propose methodology and evidence coverage; the user chooses the classification. Preserve assessment history rather than one-row overwrite if this becomes a user-facing feature.

### P1 — scheduled refresh contradicts the accepted V1 strategy

`PRODUCT_STRATEGY.md` says scheduled/autonomous background monitoring is deferred. The runbook calls `research:refresh` the scheduled-refresh path, `.env.example` exposes a daily schedule, the panel says “Daily refresh,” and a Windows task installer is shipped. Later implementation decisions may intentionally have moved ahead, but the governing strategy was not reconciled.

Required change: decide whether scheduled monitoring is now in scope and update the governing product record, or label it experimental operator functionality outside the first release. The UI should distinguish configured schedule metadata from a scheduler actually installed and last verified.

### P1 — maintenance commands overstate their backup safety

Cleanup scripts are dry-run by default, which is good. Their comments rely on `getDatabase()` writing a full database backup before migrations. The main audit separately reproduced that copying only the SQLite main file while WAL is active can omit committed rows. A backup taken merely because a process opened the DB is also not the same as a verified pre-mutation restore point.

Required change: repair backup consistency first; then make maintenance `--apply` create and verify an operation-specific backup, record its path, and fail closed if it cannot be restored/read.

### P2 — the interface lacks normal CLI product basics

There is no top-level command, `--help`, versioned output contract, `list`, `doctor`, or config/mode preflight. Parsers silently ignore unknown flags. URLs assume port 3000. IDs are raw UUIDs. Commands mix JSON and prose conventions. `--json` is available only on panel, and npm adds its own banner around script output.

Required change: provide one executable namespace, for example:

```text
jp doctor
jp thesis stage --file draft.json
jp thesis list
jp research run --conversation <url-or-id> --dry-run
jp research show --conversation <url-or-id> --format summary|json
jp research retry --job <id>
jp maintenance cleanup-evidence --dry-run
```

Every mutating command should support a preflight view. Machine output needs `schemaVersion`, command/run ID, mode, DB path fingerprint (not necessarily the sensitive absolute path), timestamps, and consistent exit codes.

### P2 — test coverage proves services, not the CLI contract

The repo has strong service-level tests for lease ownership and confirmation. No repository-owned tests were found that spawn the CLI scripts and assert their stdout/stderr, exit codes, environment isolation, URL/ID handoff, configured snapshot directory, or end-to-end stage → browser confirm → queue → panel behavior.

Required verification:

- subprocess tests for every command with isolated DB and environment;
- zero-network test for all mock commands with realistic keys present;
- stage transaction/idempotency test;
- configured snapshot root test;
- browser test that stages a draft, confirms it, then exposes a usable CLI handle;
- concurrent browser/CLI claim test through real process boundaries, in addition to the existing service race test;
- scheduler test through the actual registered task if scheduled monitoring remains supported.

## What is already strong

- The terminal agent is an orchestrator rather than an evidence provider. That separation is conceptually correct.
- Thesis creation uses the same domain insert path as the browser/import flow.
- Confirmation is enforced server-side; a disabled button is not treated as the security boundary.
- Lease owner and heartbeat protect final job status from a reclaimed worker.
- `research:panel` leads with deterministic verdict and labels retrieval coverage honestly.
- Retry limits itself to degraded/failed jobs and scopes a requested job to the thesis.
- Cleanup commands are dry-run by default and retain raw source snapshots.
- Source discovery stores URLs rather than trusting search snippets as evidence.
- Commands load the same `.env` mechanism and generally return nonzero exit status on failure.

These pieces make the CLI worth repairing rather than replacing.

## Recommended direction

For the next 1–2 months, treat the CLI as an **operator console for the owner**, not as the main product experience. Its purpose should be to make deterministic operations inspectable and repeatable:

1. `doctor`: state exactly which database, snapshot root, source mode, discovery mode, provider boundary, and scheduler status will be used.
2. `stage`: accept a file or stdin, validate it, write an atomic staged object, then open/print a browser review URL.
3. `run`: accept the same conversation URL as the handoff, print preflight lanes/network destinations, then run with a run ID.
4. `show`: present the same assessment as the browser, with summary/redacted JSON options.
5. user-owned semantic changes stay in browser review flows.

For a sellable version, the customer should not need a coding agent, npm, raw JSON, environment variables, or UUIDs. The reusable asset is the local CLI/service contract, not the current shell syntax. Package it behind a desktop/local service or a supported hosted control plane after the deployment model is chosen.

## Proposed acceptance contract for a CLI hardening milestone

**Outcome:** From one terminal command, the user stages a draft, reviews it in the browser, then runs and reads research using the same stable handle. The command states its mode and external lanes before work begins. No mock invocation reaches the network. User-owned semantic state changes only after a browser review.

In scope:

- one command namespace and help;
- URL/conversation-based handoff;
- unified snapshot configuration;
- deterministic mock provider composition;
- atomic staged draft lifecycle;
- doctor/preflight and versioned JSON;
- explicit lane status;
- source-adequacy browser review;
- subprocess and browser contract tests.

Deferred:

- decision recording from CLI;
- generic third-party agent integration;
- hosted/multi-user CLI authentication;
- autonomous monitoring unless product strategy is amended.

Pass/fail checks:

1. With live-looking keys present and `RESEARCH_SOURCE_MODE=mock`, every command produces zero external network attempts.
2. `SOURCE_SNAPSHOT_DIR` is honored by browser, queue, retry, refresh, and promotion.
3. Stage → browser confirm → run → show completes without copying a thesis UUID from the database.
4. A failed stage cannot leave half-created state; repeated idempotent stage input is defined and tested.
5. Preflight names enabled lanes and whether each is local, official network, secondary network, discovery provider, or model provider.
6. Source adequacy cannot change until the browser shows the contract, reasoning, and expected operational effect and the user confirms.
7. Summary output leads with verdict/coverage and treats evidence text as untrusted; redacted output excludes decision rationale by default.
8. Every command has stable exit codes and versioned JSON suitable for automation.
9. A real two-process concurrency test proves browser and CLI cannot overwrite a later lease owner.
10. Cleanup apply refuses to proceed without a consistent, readable operation-specific backup.

## Priority recommendation

Do not build `decisions:record` next. First repair mode isolation, storage-path consistency, identifier handoff, and the definition of browser-confirmed state. Then make `doctor → stage → browser confirm → run → show` one coherent vertical slice. That gives the personal workflow immediate value and becomes a credible foundation for packaging later.
