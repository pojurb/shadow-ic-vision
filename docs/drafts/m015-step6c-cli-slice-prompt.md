# Execution prompt — M015 step 6c: the CLI slice

Prepared 2026-09-05, after 6b closed AC-M015-07. Hand this to a fresh session
as its opening instruction. **This is the last chunk before M015 can close.**

---

## Standing rule for this project (2026-09-05)

**Plan first, wait for the user's go-ahead, then execute.** The motivation is
model/token efficiency, not doubt about correctness — a plan reviewed before
execution is the cheapest place to cut scope. Read-only investigation needed to
*build* a sound plan is fine without approval; keep it proportionate and say
what it cost. Derive the sequence yourself and present it — never hand back a
bare menu. State explicitly what you are **not** doing and where the cheap
exits are.

## Starting state

`origin/main` at `8739da3` (2026-09-05), working tree clean. Steps 1–5, 6a
(`30c36c0`) and 6b (`0b69574`) are done, committed and pushed. **AC-M015-07 is
fully met.** AC-M015-08 is the one criterion 6c closes.

6b was independently re-verified before this prompt was written, not taken on
its completing session's word — 485 passed / 3 skipped confirmed directly,
doctor `tierA`/`tierC` byte-identical to the post-step-5 baseline, Tavily count
unchanged at 3,155, live database untouched (`db.sqlite` mtime `2026-09-05
13:40`), and the three live-corpus figures behind its rejected alternatives
confirmed exactly (276 evidence rows, 108 distinct `document_hash`, 269
distinct `(document_hash, content)` pairs with one quote repeated 4×).

## Two environment gotchas that will otherwise cost you a session

**Do not run `npm test` in parallel with `lint`/`context:check`/`build`.** On
Windows this reliably produces a spurious **42-of-42 test-file failure** —
`TypeError: Cannot read properties of undefined (reading 'config')`, with
`Test Files 42 failed` and `Tests no tests`, failing at the transform/collect
stage (`import 0ms`). It is esbuild contention between two concurrent Node
toolchains on the same tree, not a regression. Run the suite on its own.

**`.tmp-review/` is not yours.** A concurrent session left a gitignored
`.tmp-review/` directory in the working tree. It is the sole source of `lint`'s
one remaining warning (`import/no-anonymous-default-export`). Do not attribute
it to your own work and do not delete it — the same reasoning that left
`stash@{0}` alone in step 2.

## Objective

Close **AC-M015-08**: `CLI_WORKFLOW.md` accurately describes what
`research:queue` runs, and the `thesis:stage` → `research:queue` handoff does
not require a value the first command never prints.

Plus the two CLI defects the packet names alongside it: non-atomic staging, and
`source-adequacy:record` writing durable state with no browser gate.

## Required reading, in order

1. `AGENTS.md` — the four constitution rules, **rule 3 especially**
2. `docs/CLI_WORKFLOW.md` — the document under repair
3. `docs/decisions/DEC-0017-cli-terminal-workflow-and-concurrency-model.md` —
   governs this surface
4. `ACTIVE_MILESTONE.md` and the top entry of `SESSION_CHECKPOINT.md`
5. `docs/milestones/M015-data-integrity-and-verified-output-recovery.md` — §4
   step 6, §5 AC-M015-08
6. `scripts/thesis-stage.ts`, `scripts/research-queue.ts`,
   `scripts/source-adequacy.ts`
7. `lib/research/service.ts` — `createThesisFromValidatedDraft`,
   `recordSourceAdequacy`

**Re-derive every line reference before relying on it.** Both prior prompts
found the earlier audit's line numbers had drifted; 6b's had drifted again by
the time it ran. Treat any number quoted below as a claim to check.

## The four items

### 1. The `thesis:stage` → `research:queue` handoff is broken

`thesis:stage` prints `{conversationId, url, clarificationNeeded, questions}`
and **no thesis id**; `research:queue` requires `--thesis-id` and accepts
nothing else. The documented workflow cannot be followed as written.

Sol's recommendation, recorded in the packet: **use the conversation URL as the
stable handle.** Evaluate it rather than adopting it blindly — the constraint
is that a thesis does not exist until the user confirms the draft in the
browser, so `thesis:stage` has no thesis id to print at the moment it runs.
That is the actual reason the handoff is broken, and any fix has to respect it
rather than paper over it by printing an id that does not exist yet.

### 2. Staging is not atomic

`thesis-stage.ts` performs two separate `.run()` calls with no
`db.transaction()`, while `importThesisData` in the same codebase does use one.
A crash between them leaves a conversation with no draft message. Fix to match
the existing transactional pattern.

### 3. `source-adequacy:record` has no browser gate — **user decision made**

It writes durable state straight from CLI flags and prints "will no longer be
requeued by the daily refresh" itself, with no browser confirmation. That
breaks Constitution rule 3.

**The user decided, 2026-09-05: keep the CLI write, but mark the row as not yet
confirmed.** The terminal flow stays fast; the row is explicitly unconfirmed
until the user confirms it in the browser. Do **not** re-open this decision —
implement it. What is still yours to work out, and to put in the plan before
executing:

- **Schema shape.** A nullable `confirmedAt` timestamp is the smaller change
  and encodes "when", which an enum does not. Weigh it against an explicit
  status enum; say which you chose and why. A migration is required either way,
  and migrations are committed and preceded by a database backup — which is now
  WAL-safe thanks to 6a.
- **Every reader must distinguish the two.** Find them all rather than assuming:
  `getLiveSourceAdequacy`, the research panel, the daily-refresh requeue
  decision, and `doctor` if it reports adequacy. An unconfirmed row must not
  silently behave like a confirmed one — that would reproduce rule 3's
  violation one layer down while looking fixed.
- **Default posture.** A row written before this column existed has never been
  through a browser gate. Decide what that means and defend it; the
  `assurance_level` precedent (`'unknown'`, never `'audited'` — fail toward
  *less* assurance, never more) is the closest analogue in this codebase.

**Interaction with 6b — do not miss this.** 6b just added `sourceAdequacy` to
`thesisExportSchema` with exactly five fields (`classification`, `reasoning`,
`contractFingerprint`, `assessedBy`, `assessedAt`). Adding a confirmation field
to the table **without adding it to the export schema** would silently drop it
on every round trip — reintroducing precisely the class of bug 6b existed to
fix, in the same table 6b just repaired. Extend the export/import path in the
same commit, keep the `.optional()` / `.default()` posture 6b used so pre-6c
exports still parse, and keep `version` at `z.literal(1)`.

### 4. `CLI_WORKFLOW.md` understates `research:queue`

The doc says `research:queue` runs "the deterministic CitationPipeline".
`processResearchJobs` actually runs five lanes — official, Class A issuer press
release, Class B news wire, XBRL, and Class C discovery→promotion. A user
reading the doc cannot predict that the command makes outbound calls on four
lanes they were not told about. Fix the description against the code, not
against this paragraph.

## Definition of done

1. The documented `thesis:stage` → `research:queue` sequence can be executed
   end to end using only values the commands actually print.
2. Staging is atomic — one transaction, proven by a test that fails on the
   current two-call shape.
3. `source-adequacy:record` writes a row that is explicitly **unconfirmed**,
   every reader distinguishes it from a confirmed row, and the confirmation
   field survives export → import.
4. `CLI_WORKFLOW.md` names all five lanes `research:queue` runs.
5. Each behavioural change proven **fail-first**: failing before, passing
   after. Show both runs.
6. There are currently **no CLI contract tests** — 41 test files and none
   spawns a script subprocess (the audit's finding; re-verify it). Items 1–3
   need at least one test that actually exercises the CLI surface, or the same
   gap that hid these defects stays open.

## Verification

- Focused tests, then `npm run typecheck`, `npm run lint`, then full
  `npm run verify:full`. **Run the suite alone.**
- `npm run doctor -- --json` before and after. **Do not read the overall exit
  code as the signal** — it exits 1 on the accepted XBRL Tier B failure.
  Compare `tierA` violations and `tierC.current`. Baseline 2026-09-05: 116
  paths checked / 0 violations, polarity 0/0/276, assurance 6 audited / 0
  unaudited / 270 unknown, `nonInconclusiveEvidenceCount` 0, decisions 1.
- `logs/outbound.log` before and after. The `api.tavily.com` count must not
  move — baseline **3,155**. Total line count grows on any full-suite run from
  pre-existing `tests/ollama-provider.test.ts` synthetic-fixture logging; that
  is expected and not a leak.
- Fingerprint the live database before and after. The migration is the one
  thing here that legitimately touches it — back up first (6a's
  `backupExistingDatabase` is now WAL-safe), and record before/after row counts
  for `source_adequacy_assessments` specifically.

## Hard constraints

- **Never run a CLI command that writes to the live database as a "test".**
  Use a temp SQLite file.
- The migration is the sole authorized live-DB change, and only after a
  verified backup.
- Do **not** create `docs/generated/doctor-baseline.json`.
- Do **not** add an XBRL exception, change `doctor` behaviour, or add `doctor`
  to `verify:full`.
- Do **not** touch M014.
- Do **not** re-open the rule-3 decision — it is made (item 3).
- Do **not** push without an explicit instruction.
- Before committing: `git diff --check`, `npm run context:check`,
  `npm run status:check`; confirm `next-env.d.ts`, `.claude/`, `.tmp-review/`,
  live DB files and generated test artifacts are not staged. `next-env.d.ts`
  regenerates a `.next/types` → `.next/dev/types` diff on every dev/build run —
  restore it with `git restore --worktree -- next-env.d.ts`.

## On completion — M015 can close

With 6c done, **all eight acceptance criteria are addressed** and M015 is
complete. Closing it is a governance act, so do not declare it closed
unilaterally: present the evidence per criterion and let the user sign off, the
same way M013 was signed off.

Two things must be carried forward rather than closed with the packet, because
neither is fixed and both outlive it:

- **Source *bytes* still have no automated backup.** 6a made the *database*
  backup WAL-safe. The 306 MB across `snapshots/` and `source-snapshots/` was
  copied once by hand in step 1 and nothing keeps it current. This is the
  finding §1 opened the packet with, and it is still true. It has no risk
  register row — `docs/RISK_REGISTER.md` was checked and covers neither backup
  nor source-byte preservation. Propose one; do not write it unilaterally.
- **The pipeline has still never produced a directional verdict.**
  `nonInconclusiveEvidenceCount` is 0 and step 5 recorded why: A1's blocker is
  a calendar, not a defect. The next real attempt should start from **A4**, the
  one assumption M013 classified (A), whose contract asks for a segment YoY
  differential TLKM's filings do publish. That is a new packet, not M015.

Also still open and untouched: `docs/generated/doctor-baseline.json` remains
ungenerated pending the XBRL Tier B decision, and
`IdxAdapter.REPORT_TERMS` admits only periodic financial reports, which becomes
load-bearing the day the NeutraDC transaction closes.
