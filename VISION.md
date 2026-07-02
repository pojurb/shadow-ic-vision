# VISION.md — Codex Protocol (v3)
## The Personal Investment Committee Engine

Status: `approved`

> "I want to invest like a great hedge fund manager, build a Family Office someday, and use that wealth to mentor people, do charity, and drive the world to a better future."
> — *The person this system is built for.*

---

## 1. The Target User

This system is built for the ambitious self-directed investor. Someone who:
- Wants to compound wealth steadily and intelligently over time, driven by a desire for financial freedom and legacy.
- Balances investing with a demanding career and personal life.
- Has a base level of investment knowledge but recognizes the need for better discipline.
- Dreams of eventually running a Family Office to manage money for relatives and trusted friends.
- Consumes frameworks and philosophies from legendary investors (Buffett, Dalio, etc.) but lacks the infrastructure to apply them consistently.

The initial product is specifically for someone who makes their own recurring
investment decisions, maintains or wants to maintain a portfolio or watchlist,
and is willing to record the assumptions behind a thesis. It is not initially
designed for high-frequency traders, passive investors who do not review
individual theses, or professional institutions with existing research teams.

## 2. The Core Problem

When this user wants to make an investment decision today, the process is fragmented:
1. Information is gathered from scattered, noisy sources (YouTube, Twitter, friends, influencers).
2. Decisions are made based on conviction that *feels* earned but is often built on optimism bias and unverified claims.
3. **The core failure:** There is no structured memory. Theses are not tracked. When conditions change, there is no system to prompt a re-evaluation of the original assumptions.

The result is inconsistent reasoning: assumptions go unreviewed, the rationale
behind prior decisions is lost, and the investor cannot reliably tell whether a
decision was well-founded or merely benefited from the outcome.

## 3. The Product Promise

**Codex Protocol is an AI-assisted Investment Committee that tracks your
theses, challenges your assumptions with cited evidence and explicit
uncertainty, and turns scattered conviction into disciplined decisions.**

## 4. The Core Experience: The Sunday Evening Ritual

The primary product experience happens on a quiet evening — before the week begins. The user is presented with an **IC Briefing**, prioritized by importance:

1. **Risk:** What has changed since last checked? Which assumptions are under pressure?
2. **Opportunity:** What new signals align with existing theses or open new doors?
3. **Insights:** What cited information has emerged this week, how fresh is it, and why is it relevant to a tracked assumption?
4. **Status:** Where do active theses stand, and what requires a decision?

## 5. Trust and Evidence

When the system warns the user that a thesis may be breaking, it must earn trust. Trust is built on:
1. **Supporting Evidence:** The filing, transcript, or data point that triggered the concern, with its source, date, freshness, and verification status.
2. **Alternative Views:** Presenting the strongest argument *for* the opposing position to ensure intellectual honesty.
3. **Known Limits:** Showing what the system could not verify, which relevant sources may be missing, and which statements are inference rather than fact.

## 6. The Moral Constitution (Trust Promises)

This system is bound by strict rules regarding user trust and data integrity:

1. **Never present unsupported information as fact:** Quantitative claims must identify their source and freshness. Derived values and model inferences must be labeled. If evidence is missing or contradictory, the system says so.
2. **Show uncertainty and coverage limits:** The system must distinguish verified facts, sourced claims, inferences, unresolved conflicts, stale information, and unavailable data.
3. **Ensure user sovereignty:** The user can correct, export, and delete their data, and controls its retention subject to clearly disclosed operational or legal limits.
4. **Never silently repurpose private data:** The product does not opt private user data into model training or product-improvement programs without explicit consent. Before data is sent to a provider, the product discloses the provider and applicable handling boundary.

## 7. Human Decision Authority And Product Boundaries

- The user makes every investment decision and remains accountable for it.
- The product does not execute trades or move capital.
- The product does not autonomously manage a portfolio.
- The product does not promise returns, predict prices, or claim complete market
  coverage.
- The product does not present every headline. It prioritizes information tied
  to user-defined theses and assumptions.
- The product does not treat model output as evidence. Claims must remain
  traceable to sources, calculations, or clearly labeled inference.
- Missing a relevant source, change, or risk is a possible product failure that
  must be visible and reviewable, not hidden behind confidence language.

## 8. Product Scope and Sequencing

To avoid over-engineering, the product vision is broken into three horizons. Solution hypotheses (like autonomous agents or graph databases) are subservient to achieving these outcomes.

### Horizon 1: The Initial Wedge (The Current Focus)
**A cited weekly thesis briefing that monitors user-defined assumptions, challenges conviction, and preserves decision history for one self-directed investor.**

This horizon is a product wedge, not one implementation milestone. It will be
delivered through multiple small vertical slices:

- capture one thesis and the assumptions that must remain true
- attach cited evidence with freshness and verification status
- review relevant changes on demand before scheduled monitoring is introduced
- generate a prioritized briefing from tracked assumptions
- record the user's review and decision without executing it

### Horizon 2: The Twelve-Month Product
**An intelligent tracking engine.**
- Focus: Expanded asset class support, deeper automated extraction from complex filings, and early collaborative features for a "Trusted Circle" (e.g., a spouse or partner).

### Horizon 3: The Long-Term Vision
**The Family Office Platform.**
- Focus: Multi-portfolio management, advanced team collaboration, and a shared intelligence layer for a small, informal family office.

## 9. Measurable Success (Product Metrics)

Success is not measured by portfolio returns (which are subject to market forces), but by the adoption of disciplined behavior. We measure:

1. **Weekly Review Usefulness:** Whether the user opens the briefing, understands why items were prioritized, and explicitly reviews, defers, or dismisses them—without rewarding trading activity.
2. **Citation Coverage:** The share of material factual claims that include a source, date, freshness indicator, and verification status.
3. **Confirmed Factual Error Rate:** How often a material claim is later corrected because it did not match its cited source or was presented with the wrong status.
4. **Signal Precision:** The share of surfaced changes the user confirms were relevant to a tracked assumption, monitored alongside known missed changes where a benchmark exists.
5. **Thesis-Review Completion:** How often a flagged or scheduled review ends with updated assumptions, an explicit deferral, or a documented decision.
6. **Correction Handling:** Whether user corrections are captured, reflected in future state, and auditable; fewer corrections are not automatically interpreted as greater trust.
7. **Decision-Record Completeness:** Whether the user can later reconstruct the evidence, assumptions, alternatives, and reasoning behind a decision.
8. **Review Effort:** Time and cognitive effort required to complete a documented review, treated as a usability measure rather than pressure to decide faster.
