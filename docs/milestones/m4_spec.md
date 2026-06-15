# Milestone M4 Specification: Evidence Locker Primitives

## Summary

- Outcome: promote `thesis.evidenceCandidates` and attached `sources` into
  durable, first-class evidence records tied to thesis objects.
- User value: each thesis assumption, breaker, watch item, catalyst, valuation
  assumption, or open question can show what supports, challenges, or leaves it
  unresolved.
- Scope: Evidence Locker lives inside the analysis/thesis detail workflow.
- Non-goals:
  - do not build a global Evidence database or standalone Library surface
  - do not make AI-generated evidence summaries authoritative facts
  - do not require locked valuation figures before evidence can be captured

## Product And UX Contract

- Evidence Locker appears in the analysis thesis/detail workflow, including
  draft and scoping analyses that do not yet have locked valuation figures.
- Users can view, add, edit, classify, promote, and link evidence records.
- Users can promote existing `thesis.evidenceCandidates` into saved evidence
  items without creating duplicates.
- Users can attach or link files, URLs, notes, screenshots, PDFs, pitch decks,
  memos, and existing analysis `sources` to evidence items.
- Evidence items must expose:
  - title
  - type
  - relation: supporting, contradictory, neutral, or unresolved
  - reliability
  - source date or reporting/reference date
  - URL and/or note
  - linked source attachment refs
  - linked thesis refs
- Evidence linkage must be visible from the thesis-memory area so users can see
  which assumptions, breakers, watch items, valuation assumptions, catalysts, or
  open questions are backed or challenged.
- The locker should show active-context state: an evidence item linked to a
  currently attached `source` should read differently from detached evidence.
- Empty state: an analysis with no evidence should offer a direct way to add a
  note/URL item and should surface promotable evidence candidates when present.
- Error/invalid states: missing title, invalid URL, missing relation, and broken
  source refs should be handled without losing the draft edit.
- Responsive behavior: the locker must remain usable in the existing
  `AnalysisView` inspector on desktop and mobile, with compact evidence rows and
  editable detail state that does not overflow the panel.

## Engineering Contract

- Add a first-class `EvidenceItem[]` collection on `Analysis`; `Analysis` remains
  the owning object for M4.
- Reuse the existing evidence enums:
  - `EvidenceType`
  - `EvidenceRelation`
  - `EvidenceReliability`
- Define `EvidenceItem` with:
  - `id`
  - `title`
  - `type`
  - `relation`
  - `reliability`
  - `sourceDate`
  - `url?`
  - `note?`
  - `sourceRefIds: string[]`
  - `thesisRefs`
  - `createdAt`
  - `updatedAt`
- Define `thesisRefs` as structured refs to concrete thesis objects, covering:
  thesis summary, assumptions, thesis breakers, watch items, valuation
  assumptions, catalysts, and open questions.
- Normalize legacy `thesis.evidenceCandidates` into first-class evidence on
  read. Normalization must be idempotent.
- Deduplicate promoted or normalized evidence by URL first, then by exact title
  when no URL exists.
- Keep `sources` as AI context attachments. Do not repurpose or delete them.
  Evidence links to attachments through `sourceRefIds`.
- Add helpers for:
  - creating evidence from manual note/URL input
  - promoting an evidence candidate into an `EvidenceItem`
  - linking and unlinking `ContextSource` ids
  - normalizing legacy candidate data
  - formatting thesis-ref labels
  - grouping/filtering evidence by relation and type
- Preserve first-class evidence records in backup export/import.
- Ensure M6 decision snapshots preserve available evidence data after M4 lands.
- Follow the repo's normalize-on-read pattern and avoid a Dexie version bump
  unless implementation proves one is necessary.

## Implementation Slices

### Slice 1 - Evidence Domain And Normalization

- Add `EvidenceItem`, structured thesis refs, and evidence helper functions.
- Add `Analysis.evidence` defaults in normalization.
- Normalize legacy `thesis.evidenceCandidates` into first-class evidence on
  read with URL/title dedupe.
- Add unit tests for normalization, idempotence, dedupe, enum reuse, and helper
  behavior.

### Slice 2 - Creation, Promotion, And Linking Workflows

- Add manual note/URL evidence creation.
- Add promotion from evidence candidates to saved evidence records.
- Add link/unlink behavior for existing `sources` through `sourceRefIds`.
- Add persistence tests for source links and thesis refs.

### Slice 3 - Evidence Locker UI In `AnalysisView`

- Add the Evidence Locker section to the thesis/detail surface.
- Show evidence grouped or filterable by relation.
- Support editing relation, reliability, source date, URL/note, source links,
  and thesis refs.
- Show active-context state for source-linked evidence.
- Surface evidence linkage beside relevant thesis objects.

### Slice 4 - Backup, Snapshot, And Verification Closure

- Extend backup/export/import tests to preserve evidence and source refs.
- Update M6 snapshot builders so decision snapshots include first-class
  evidence where available.
- Run app quality gates and browser QA.
- Record closure evidence in roadmap/status docs after verification passes.

## Verification

- Unit tests:
  - legacy `thesis.evidenceCandidates` become first-class `evidence` records
  - normalization is idempotent
  - URL/title dedupe prevents duplicate promotion
  - manual note/URL evidence creation sets required defaults
  - linking and unlinking `ContextSource` ids preserves `sources`
  - thesis refs persist and format correctly
  - relation/type grouping helpers behave predictably
- Backup/export/import:
  - first-class evidence records round-trip
  - `sourceRefIds` round-trip
  - legacy analyses without evidence still normalize safely
- M6 snapshot regression:
  - decision snapshots preserve first-class evidence after M4
  - older snapshots without first-class evidence still read safely
- Browser QA:
  - attach a file and a URL to an analysis
  - create an evidence item from a link or note
  - promote an existing evidence candidate
  - add contradictory evidence against a thesis assumption
  - link and unlink an attached source
  - reload and confirm evidence, thesis refs, and active-context state persist
- Global gates:
  - `npm run lint`
  - `npm test`
  - `npm run build`

### Closure Evidence - 2026-06-15

- Implemented:
  - first-class `Analysis.evidence`
  - `EvidenceItem` and `ThesisRef` types
  - pure evidence helpers
  - legacy candidate promotion on read
  - URL/title dedupe
  - source link/unlink helpers that preserve `sources`
  - inline Evidence Locker UI in `AnalysisView`
  - backup/import preservation
  - M6 decision snapshot preservation
- Verification passed:
  - `npm test` (20 files / 165 tests)
  - `npm run lint` (0 errors; existing warnings only)
  - `npm run build`
- Browser QA status:
  - local dev server responded on `http://127.0.0.1:3000`
  - headless Edge/CDP launched and loaded the app
  - IndexedDB seeding/inspection worked in the CDP session
  - the fallback browser session did not hydrate/respond to UI state changes,
    so full M4 browser acceptance remains tooling-limited and should be rerun
    in a stable browser path
- Workspace hygiene:
  - `.tmp-*` added to `.gitignore`
  - `.tmp-edge-m3`, `.tmp-qa`, and the temporary `.tmp-edge-m4` browser-QA
    profile were removed after workspace path verification

## Assumptions And Deferrals

- M4 keeps evidence analysis-scoped; cross-analysis evidence search or a global
  Evidence table belongs to a later milestone.
- `sources` remain the existing AI context attachment channel.
- `thesis.evidenceCandidates` remain readable during migration, but `evidence`
  becomes canonical after M4.
- Evidence can exist before valuation figures are locked.
- Evidence records store user classification and linkage; autonomous evidence
  interpretation is deferred.
- M5 will consume first-class evidence for contradiction pressure and agenda
  signals after M4 closes.
