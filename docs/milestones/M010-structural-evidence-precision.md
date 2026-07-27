# M010: Structural Evidence Precision

Status: `complete`

Date drafted: 2026-07-27

Date accepted: 2026-07-27

Date completed: 2026-07-27

Approval authority: user

Depends on: [`M009`](M009-secondary-evidence-boilerplate-filtering.md) (whose
mitigation this milestone extends after R-025's own trigger fired),
[`M007`](M007-secondary-source-ingestion.md) and
[`M008`](M008-web-search-discovery.md) (the secondary and discovery paths it
touches). No new decision record is needed — this milestone changes no product
boundary, evidence class, trust tier, provider, or data classification; it
hardens extraction precision inside the scope
[`DEC-0015`](../decisions/DEC-0015-secondary-source-ingestion-boundaries.md)
already governs, exactly as M009 did.

Addresses:
- **R-025** (site-wide web boilerplate persisted as secondary evidence) —
  **returns to `Open`**, extended not closed. Its trigger fired on 2026-07-27,
  so M009's mitigation is recorded as necessary-but-insufficient rather than
  quietly amended. M010 adds the structural layer; semantic relevance remains
  unsolved and is stated plainly.
- **R-026** (a listing/index page fetched and mined as though it were an
  article) — `Mitigated`. New risk; the structural root cause M009 never named.

---

## Slice Outcomes (2026-07-27)

All four implementation slices plus governance close-out shipped and verified:
`typecheck`/`lint`/`build` clean; full suite **237 passed / 3 skipped**, up from
206 at M009's close (31 new cases across `tests/document-extraction.test.ts`,
`tests/source-adapters.test.ts`, and the new `tests/evidence-cleanup.test.ts`);
`npm run eval:m001:multimodal` and `npm run eval:m001:provider` (deterministic)
both show unchanged `additionalCaseCount: 23` with 0 hard-gate failures —
including the MM-021/022/023 gate that pushes `no_secondary_candidate_extracted`
on an empty result, so over-filtering the eval fixtures would have failed loudly
rather than silently; `context:generate`/`context:check` and `status:check`
pass; `test:e2e` 4/4 pass (M010 touches no UI code, so this is a confirmation).

- **AC-M010-01 (The real live failure is excluded):** met. The verbatim
  2026-07-27 category-filter widget is a regression fixture and now yields zero
  candidates. Confirmed against the retained snapshot too, not only the inline
  fixture: the newsroom page went from 1 bad candidate to 0 for the real
  tracked assumption.
- **AC-M010-02 (`canonicalText` unchanged):** met, and proven on real data
  rather than argued — byte-identical to a faithful re-implementation of the
  pre-M010 derivation on **all four** retained TLKM snapshots, plus every
  pre-existing fixture passing untouched.
- **AC-M010-03 (A listing page no longer wins the `[0]` slot):** met. The real
  retained snapshot goes from 29 refs (first 13 junk, `[0]` the discovery page
  itself) to exactly the 9 genuine `/news/...` articles, correctly dated,
  newest first.
- **AC-M010-04 (The already-persisted rows are gone):** met. 15 scanned, 15
  stale, 0 kept, 0 unresolvable; 7 assumptions reverted `pending_confirmation`
  → `untested`; all 4 `source_snapshots` rows and their `.bin` files retained.

**End-to-end proof on real data, not fixtures.** A live `npm run
research:refresh` after the fix fetched
`.../news/perkuat-peran-penggiat-budaya-...-3849` — a genuine article, the
newest release — instead of the listing page, and persisted 2 rows of real
press-release prose where the pre-M010 run had persisted 15 rows of nav chrome,
cookie-policy text, and category widgets.

**Honest note on what that run does and does not prove.** The article fetched is
about a culture festival, and one of the two quotes matched partly on division
names ("Enterprise Business Strategy", "Wholesale Service"). That is genuine
article prose rather than site chrome — which is exactly what M010 claims — but
it is not obviously material to a data-centre thesis. M010 fixes evidence
*shape*; it does not claim semantic relevance, and R-025 stays `Open` saying so.

**Design decision — the guard thresholds are calibrated on few real examples.**
The 400-character cap and the 8–14 word band for unpunctuated text come from
measured real data (largest genuine article block 298 chars; everything above
~310 on the IR pages was legal boilerplate, including a 908-char
intellectual-property clause M009's denylist does *not* catch because it reads
"dilindungi oleh hak cipta" rather than the denylisted "hak cipta dilindungi").
But the 14-word ceiling sits between exactly one genuine 10-word headline and
one 18-word nav run-on. Recorded as residual risk in R-025 rather than presented
as generally calibrated.

**Recorded follow-ups closed:** `docs/RISK_REGISTER.md` (R-025 → `Open` with the
fired-trigger history stated plainly; R-026 added), `ACTIVE_MILESTONE.md`,
`docs/milestones/ROADMAP.md`, `docs/CODEBASE_MAP.md`, `SESSION_CHECKPOINT.md`.

---

## 0. Why This Exists

M009 shipped on 2026-07-26 with three mechanisms against secondary-evidence
boilerplate: DOM-chrome stripping, a 16-phrase denylist, and a
ticker/bare-year qualifying-token rule. **All three filter on vocabulary.**

On 2026-07-27, a live run against the real TLKM newsroom page, scored against a
genuine tracked assumption ("Indonesian enterprise demand for data center
capacity remains strong through 2026"), produced this as evidence-grade output:

> "Category : All All Siaran Pers Enterprise Wholesale CSR Years Semua Tahun
> 2026 2025 2024 … 21 Juli 2026 Siaran Pers Perkuat Peran Penggiat Budaya …
> terhada…"

A category-filter widget plus listing teasers. It cleared every M009 mechanism
by matching the literal word **"Enterprise"** — a nav category label colliding
with the assumption's genuine word "enterprise" — so the ticker/bare-year rule
did not apply, and no denylisted phrase was present.

This is not a missing denylist entry. Three structural holes were confirmed:

1. **Document granularity.** The pipeline was fetching the *listing page* and
   mining it. See R-026.
2. **No sentence boundaries.** `extractHtml` joined block elements with a
   space, which `normalizeText` then collapsed, so a nav/filter widget reached
   `splitSentences` as one punctuation-free string that `Intl.Segmenter`
   returns as a single giant segment.
3. **Length helps, never hurts.** `rankSentenceCandidates` scores by
   Set-intersection token matching with no upper length bound and no length
   penalty, so a long run-on outscores a real one-sentence fact.

Vocabulary denylists cannot reach any of these. Continuing to add phrases would
have been a treadmill — which is the actual lesson, and why this milestone is
shaped around *shape* rather than around one more pattern.

---

## 1. User-Visible Outcome

Evidence shown against an assumption is a passage from a real article, not the
surrounding website. The Research drawer stops showing nav menus, cookie
notices, and category-filter widgets as secondary evidence, and the 15 such rows
already persisted are removed rather than left to age.

---

## 2. Scope and Non-Goals

### In Scope
- Block-boundary segmentation in `extractHtml`, exposed as `ExtractedPage.blocks`.
- Secondary-tier-only shape guards in `rankSentenceCandidates`.
- Listing/index-page rejection in `discoverIssuerPressReleases`.
- A re-deriving cleanup of already-persisted low-quality secondary evidence.

### Out of Scope
- **A readability dependency.** M009 §8 pre-authorized raising this at
  acceptance review if the hand-rolled approach proved too narrow. It was
  raised and declined by user decision: `@mozilla/readability` requires a full
  DOM (jsdom), a heavy addition to a module carrying only `cheerio` and
  `pdfjs-dist`. Revisit if the shape fix proves insufficient on a second site.
- **Semantic relevance.** Unchanged from M009, and R-025 stays `Open` for it.
- **Block structure for PDF and vision extraction.** pdfjs text items carry no
  reliable block structure (`hasEOL` is a line marker, not a block marker), so
  those paths deliberately emit no blocks.
- **A whole-document listing classifier for `promoteCandidate`.** Measured and
  deliberately not built — see R-026's residual risk.
- **Multi-document selection.** The pipeline still fetches `discovery.value[0]`
  only; M010 changes *which* document that is, not how many.

---

## 3. Workflows, States, and Recovery Behavior

### Workflow: secondary-source research call
Unchanged in shape. `discoverIssuerPressReleases` now returns only genuine
article refs, newest first, so `[0]` is a real release. If the new rules match
nothing the adapter returns `issuer_source_unavailable` and the job soft-fails
to *no evidence* — never to *wrong evidence*, and never touching
`research_jobs.status`, exactly as M007 established.

### Workflow: cleanup sweep
`npm run research:cleanup-evidence` is **dry-run by default**; `--apply` is
required to write, and the dry run prints the identical report, so what a
reviewer approves is what runs. Rows whose retained snapshot is missing are
reported `unresolvable` and never deleted. Idempotent: a second `--apply` run
is a no-op.

---

## 4. Data Inputs, Outputs, and Persistence

- `ExtractedPage` gains optional `blocks?: string[]`. **Optional deliberately**:
  `undefined` means "no block structure known" and every consumer falls back to
  `[text]`, i.e. pre-M010 behavior. A required field would let a construction
  site that forgot to populate it fail silently to zero candidates.
- No schema migration. The cleanup deletes `evidence` rows and updates
  `assumptions.status`; `source_snapshots` rows and the raw `.bin` files are
  never touched, so the chain of custody for *what was fetched* survives intact.
- `publishDate` on issuer press-release refs is now populated rather than
  always `null`.

---

## 5. Implementation Slices

- **Slice 1 — Block-boundary segmentation.** `lib/research/extractors/document.ts`.
  Append a `U+FFFC` sentinel after block elements instead of a space, derive
  `canonicalText` via `raw.split(SEP).join(' ')` (byte-identical to the previous
  `$('body').text()`, because the appended node *was* `' '`), and derive
  `blocks`. Includes a collision guard: a document already containing the
  sentinel falls back to the legacy path and emits no blocks. `U+FFFC` was
  chosen empirically — `U+0000` does not survive cheerio's `.append()` (parse5
  drops it) and `U+E000` is Private Use Area, which icon-font sites legitimately
  emit.
- **Slice 2 — Tier-gated consumption + shape guards.**
  `lib/research/extractors/candidate.ts`. `segmentationUnits` returns
  `[page.text]` for `'official'` — literally the pre-M010 expression — and
  `page.blocks ?? [page.text]` for `'secondary'`. Adds the 400-character cap and
  the 8–14 word band for unpunctuated text, both inside the existing
  `sourceTier === 'secondary'` branch. Covers **both** entry points by
  construction: `pipeline.ts` and `discovery-promotion.ts` both route through
  `extractDocument` → `extractSecondaryCandidates` and are untouched.
- **Slice 3 — Listing-page guard.** `lib/research/adapters/issuer-press.ts`.
  Five rejection rules, dedupe, month-name date parsing, and newest-first
  ordering. See R-026 for each rule and its rationale.
- **Slice 4 — Stale-row cleanup.** New `lib/research/evidence-cleanup.ts` and
  `scripts/cleanup-boilerplate-evidence.ts`, plus
  `deriveAssumptionStatusAfterEvidenceRemoval` beside its insert-shaped sibling
  in `lib/research/assumption-status.ts`.
- **Slice 5 — Governance close-out.** Risk register, roadmap, active milestone,
  codebase map, session checkpoint.

---

## 6. Security and Provider Constraints

No provider, model, routing, or data-classification change. No new outbound
call: Slice 3 changes which already-allowlisted URL is chosen, not whether a
domain may be fetched, so DEC-0015 §3.2's domain gate is untouched. The cleanup
runs entirely locally against the external SQLite database under ADR-0006.
`scanEmbeddedInstructions` still runs on every extraction path, unchanged.

---

## 7. Evals & Acceptance Criteria

### Acceptance Criteria
1. **AC-M010-01: The real live failure is excluded.** The verbatim 2026-07-27
   category-filter widget produces no secondary candidate, as a regression
   fixture and against the retained snapshot.
2. **AC-M010-02: `canonicalText` is unchanged.** Byte-identical on all four
   retained real snapshots and every existing fixture; every emitted quote
   still satisfies `verifyExactMatch`.
3. **AC-M010-03: A listing page no longer wins the `[0]` slot.** The retained
   newsroom snapshot yields only genuine article refs, newest first.
4. **AC-M010-04: The already-persisted low-quality rows are removed**, with
   assumption statuses reverted correspondingly and snapshots retained.

### Pass Thresholds
Same bar as prior milestones: 0 hard-gate failures, unchanged
`additionalCaseCount: 23`, full existing suite green.

### Deterministic Tests
Adversarial: the real category widget; a punctuation-free nav run-on containing
no denylisted phrase (**the fixture that would have caught this defect before it
shipped** — M009's nav test only passes because its fixture literally contains
"skip to content"); the `"Group Revenue 1Q 2026"` label fragment; a
sentinel-collision document; a substring-invariant test across both extractors;
the `blocks.join(' ') === text` identity. Anti-regression: M009's genuine-fact
case unmodified; a genuine secondary fact through `extractHtml` with full page
chrome; the official path untouched by every M010 guard; 399/401-character and
7/8/15-word boundary fixtures pinning both constants; and the real genuine
headline that must survive inside the word band. Discovery: one test per
rejection rule, with M007's existing press-release test passing **unmodified**.
Cleanup: deletion, retention of genuine rows, the official-tier hard filter,
non-pending interpretations, missing snapshots, dry-run inertness, idempotence,
and `user_confirmed_secondary` flagged rather than reverted.

---

## 8. Assumptions, Risks, and Explicit Deferrals

- **Assumption:** a repeated link is site chrome (Slice 3, rule 5). True on the
  measured page; a site listing one article twice would lose it.
- **Assumption:** the shape thresholds generalize. Calibrated on a handful of
  real examples from one site — see the Slice Outcomes design note and R-025.
- **Risk — over-filtering.** The word band is the riskiest constant; a genuine
  headline longer than 14 words with no terminal punctuation would be dropped.
  Guarded by the boundary fixtures, the preserved-real-headline test, and the
  MM-021/022/023 hard gate.
- **Risk — Slice 3 rule 1 false negatives.** An issuer whose anchor text is a
  bare headline, with the label in a sibling node, yields nothing. Soft-fails to
  no evidence. Only one issuer is configured today, so exposure is one site.
- **Deferral:** block structure for PDF/vision; a readability dependency; a
  whole-document listing classifier for `promoteCandidate`; multi-document
  selection; and semantic relevance.

## Options Considered

1. **Add the category-filter wording to `BOILERPLATE_PHRASES`.** Rejected: it
   is the treadmill this milestone exists to end. It would fix one site's one
   widget and leave the shape defect untouched for every other site.
2. **Adopt Mozilla Readability now.** Raised at review per M009 §8's explicit
   instruction, and declined by user decision — jsdom is a heavy dependency for
   a module holding only cheerio and pdfjs-dist, and the hand-rolled shape fix
   had not yet been shown insufficient. Reconsider on a second site's failure.
3. **Change how `canonicalText` is built (insert real sentence terminators).**
   Rejected: `canonicalText` is load-bearing for `verifyExactMatch` and
   `canonicalTextHash`, so changing it would make official-path equivalence an
   empirical claim. The separate `blocks` field keeps it a structural one.
4. **Apply segmentation to both tiers.** Rejected for the same reason: gating on
   `sourceTier` makes the official path reduce to literally the old expression.
   The cost — official HTML keeps the run-on shape — is recorded as a deferral
   rather than hidden.
5. **A path-depth rule for listing pages.** Rejected on measurement: the real
   articles are *shallower* than the listing page, so depth filtering would have
   deleted all nine.
6. **Soft-delete the stale evidence rows.** Rejected: `evidence` has no
   soft-delete column, and adding one means a migration plus every read path.
   Hard delete is safe here because the sweep re-derives rather than guesses,
   the raw snapshots are retained, the dry run is the default, and an explicit
   pre-cleanup database backup was taken.
