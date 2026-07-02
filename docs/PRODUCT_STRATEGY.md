# Product Strategy

Status: `accepted`

Gate: `2 - Strategy Readiness`

Approval authority: user

This document translates the approved `VISION.md` into the first usable product
release. It defines product behavior and sequencing only. It does not approve an
architecture, technology stack, dependency, schema, API, or implementation.

## 1. Strategic Outcome

The first usable release helps one serious self-directed investor maintain a
disciplined, evidence-backed view of up to 100 public companies across Indonesia
and the United States.

The product must make it possible to:

- track the thesis and assumptions for a company already owned or watched
- explore a named company or sector theme without receiving a ranked investment
  recommendation
- distinguish official facts, secondary evidence, user-provided information,
  derived values, inference, and unavailable data
- review the most important thesis changes on demand
- receive a weekly briefing containing up to 10 prioritized review items plus a
  compact status index for every tracked company
- record thesis outcomes and optional user-originated investment actions without
  the system making or executing the decision

## 2. Initial Target Segment And Trigger

The initial user:

- personally researches and decides whether to own or watch individual public
  companies
- follows companies listed in Indonesia, the United States, or both
- has or wants a repeatable weekly review habit
- is willing to state what must remain true for each thesis
- needs plain-language guidance with deeper evidence available on demand

The recurring trigger is: "I need to know what changed, which assumptions need
attention, and what decision—if any—I should review this week."

The initial product is not designed for high-frequency traders, passive-only
investors, institutional research teams, or people seeking automated trade
recommendations.

## 3. V1 Release Contract

### Markets And Capacity

- Supported asset class: public equities only.
- Supported markets: Indonesia and the United States.
- Supported tracked universe: up to 100 companies.
- Each company may be tagged `Owned` or `Watchlist`.
- V1 does not collect quantity, cost basis, position value, target allocation,
  or brokerage-account data.

### First-Class Entry Paths

V1 has two equally valid entry paths:

1. `Track an existing thesis`
2. `Explore a company or sector`

Both must be present in the first usable release, but they may be delivered in
separate approved milestones.

### Operating Mode

- Evidence review and briefing generation are on demand in the first release.
- Scheduled or autonomous background monitoring is explicitly deferred.
- The first release is validated through four real weekly dogfood cycles before
  a private beta with 3–5 invited users.

## 4. Core Workflows

### Workflow A - Track An Existing Thesis

1. The user identifies an Indonesian or US company and marks it `Owned` or
   `Watchlist`.
2. The user provides a thesis in their own words, optionally including links,
   notes, or documents.
3. The product helps separate the thesis into a summary, assumptions, risks,
   disconfirming conditions, open questions, and evidence candidates.
4. The product discovers relevant official sources where available and shows
   provenance, period, freshness, and evidence classification.
5. The user confirms or corrects the drafted thesis and evidence before the
   company becomes actively tracked.
6. The saved company becomes eligible for on-demand review, the weekly
   briefing, and decision history.

Failure and recovery behavior:

- Unknown or ambiguous issuer: ask the user to choose the correct company and
  market; do not guess.
- Official source unavailable: preserve the thesis, label the evidence gap, and
  offer clearly classified secondary or user-provided evidence.
- Contradictory sources: show the disagreement and prevent the disputed claim
  from appearing as an uncontested fact.
- Incomplete thesis: allow a clearly labeled draft rather than inventing missing
  assumptions.

### Workflow B - Explore A Company Or Sector

1. The user enters either a named company or a sector theme.
2. A named-company exploration explains the business, relevant drivers, major
   risks, evidence gaps, and questions that would change the thesis.
3. A sector-theme exploration returns 3–5 unranked candidates with a cited
   inclusion rationale, key risks, and missing evidence for each.
4. The product does not identify a "best" company, predict returns, or originate
   Buy/Hold/Reduce/Exit actions.
5. Exploration remains temporary. No candidate enters the tracked universe
   until the user explicitly selects it, writes or confirms an initial thesis,
   and chooses `Owned` or `Watchlist`.
6. An explicitly saved candidate enters the same tracked-thesis workflow as an
   existing company.

Failure and recovery behavior:

- Theme too broad: ask the user to narrow the business, geography, value-chain
  layer, or decision criteria.
- Insufficient cited evidence: return the known limits and next research step,
  not fabricated candidates.
- Unsupported market or security: keep the exploration temporary and explain
  that active tracking is currently limited to Indonesian and US equities.

### Workflow C - Evidence And Assumption Review

1. The user requests a review for one or more tracked companies.
2. The product searches for source material tied to the company's recorded
   assumptions and open questions.
3. Every surfaced claim displays its evidence class, source, date or reporting
   period, freshness, and relationship to a tracked assumption.
4. The product separates changed facts, unchanged facts, inference, source
   disagreement, stale evidence, and unavailable evidence.
5. The user confirms corrections or updates before durable thesis state changes.

The product may challenge reasoning and present alternative views. It may not
turn model output into evidence or originate an investment action.

### Workflow D - Weekly IC Briefing

The briefing contains two layers:

1. **Priority review queue:** up to 10 companies requiring the most attention.
2. **Full status index:** a compact view of every tracked company, up to 100.

Priority may be influenced by:

- evidence tied to a potentially changed assumption
- an unresolved contradiction or material evidence gap
- overdue or explicitly requested review
- source staleness
- `Owned` rather than `Watchlist` status

The briefing must show why an item was prioritized. It must not prioritize by
predicted return, generate an investment ranking, or imply that every surfaced
item requires a trade.

The full status index must make it possible to distinguish at least:

- needs review
- evidence gap or conflict
- review deferred
- reviewed with no thesis change
- thesis updated
- archived or no longer tracked

### Workflow E - Review And Decision Record

After reviewing an item, the user records a thesis-state outcome:

- `No change`
- `Investigate further`
- `Update thesis`
- `Archive`

The user may additionally record an optional investment action:

- `Buy`
- `Hold`
- `Reduce`
- `Exit`

Investment actions are always entered by the user. The system must not
preselect, recommend, vote on, or execute them. Every record retains the user's
reasoning, relevant evidence, known alternatives, and timestamp so it can be
reviewed later without outcome bias.

## 5. Evidence And Source Policy

### Source Priority

Indonesia:

1. IDX disclosures and official exchange material
2. Issuer investor-relations pages, annual reports, financial statements, and
   official company announcements
3. Reputable secondary sources, clearly labeled
4. User-provided evidence, clearly labeled

United States:

1. SEC filings and official regulator material
2. Issuer investor-relations pages, annual reports, earnings releases, and
   official company announcements
3. Reputable secondary sources, clearly labeled
4. User-provided evidence, clearly labeled

### Evidence Rules

- Web search is a discovery mechanism, not evidence by itself.
- A material factual claim must include a source title, source location, date or
  reporting period, freshness, market, and evidence class.
- Secondary or user-provided evidence may be useful but may not be represented
  as verified official evidence.
- Derived values must expose their source inputs and remain labeled as derived.
- Model summaries and inferences must remain labeled and traceable to supporting
  evidence.
- Missing or conflicting evidence remains visible; the product does not fill the
  gap with an unsupported claim.
- The user confirms proposed durable facts and thesis changes before saving.

## 6. V1 Scope Boundaries

In scope:

- Indonesian and US public equities
- `Owned` and `Watchlist` status
- two first-class entry paths
- guided thesis structuring and evidence confirmation
- temporary, unranked sector exploration
- on-demand company and multi-company review
- top-10 briefing plus full tracked-company index
- thesis history and optional user-recorded investment actions
- correction, export, and deletion expectations inherited from `VISION.md`

Out of scope:

- trade execution or capital movement
- system-generated investment actions or recommendations
- ranked investment shortlists or return predictions
- quantity, cost basis, position sizing, allocation, or brokerage integration
- private assets, funds, crypto, real estate, or macro views as tracked assets
- shared workspaces or collaboration
- scheduled or autonomous background monitoring
- automatic persistence of exploration results
- architecture, implementation, or provider selection

## 7. First Usable Release Sequence

The release is delivered through separately approved vertical milestones:

1. **Existing Thesis Loop** - track a named company, confirm a structured thesis
   and cited evidence, complete an on-demand review, and record an outcome.
2. **Explore-To-Tracked Loop** - explore a named company or sector, receive an
   unranked cited shortlist where applicable, explicitly save one candidate, and
   enter the same thesis-review loop.
3. **Multi-Thesis Briefing** - support up to 100 tracked companies, generate the
   top-10 priority queue plus full status index, and preserve review history.
4. **Dogfood And Private Beta Readiness** - complete four real weekly cycles,
   resolve critical trust and workflow failures, then test with 3–5 invited
   users.

This sequence is strategic ordering only. Each milestone requires its own
decision-complete packet and approval before implementation.

## 8. Outcome Measures And Guardrails

Trust guardrails:

- no known unsupported claim is presented as fact
- all material factual briefing claims carry provenance, freshness, and evidence
  classification
- conflicting or missing evidence remains visible
- model output never becomes evidence merely because multiple models agree
- investment actions remain user-originated

Behavioral outcome measures:

- weekly review usefulness and comprehension of prioritization
- citation coverage and confirmed factual error rate
- user-confirmed relevance of priority items
- thesis-review completion or explicit deferral
- correction capture and auditability
- decision-record completeness
- review effort without pressure to trade or decide faster

Progression from dogfood to private beta requires:

- four consecutive weekly review cycles using real Indonesian and US theses
- successful use of both entry paths
- no unresolved critical trust, privacy, or data-integrity failure
- understandable top-10 prioritization and usable full-company status index
- recoverable behavior for missing, stale, secondary, and contradictory evidence
- explicit user acceptance of the dogfood workflow

## 9. Discovery Assumptions To Validate

- Users will state assumptions clearly enough to make monitoring useful.
- A top-10 queue reduces cognitive load across a universe of up to 100 companies.
- `Owned` and `Watchlist` provide enough context before position data exists.
- Users understand and value evidence classification and source freshness.
- Theme exploration can remain useful without rankings or trade recommendations.
- Official-source coverage across Indonesia and the US is sufficient for a
  trustworthy weekly review when gaps are disclosed.
- Users will record thesis outcomes and optional actions after reviewing
  evidence.

## 10. Gate 2 Approval

Approval of this strategy authorizes creation of the first milestone packet
only. It does not authorize code, architecture, dependencies, schemas, APIs, or
deployment.

Until explicit user approval is recorded in `docs/decisions/`, this strategy
remains `proposed`.
