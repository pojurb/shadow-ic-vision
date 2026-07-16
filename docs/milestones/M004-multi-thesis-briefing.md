# M004: Multi-Thesis Briefing

Status: `proposed`

Approval authority: user

---

## 1. User-Visible Outcome

The user can track, prioritize, and review up to 100 public company theses. The system:
- Surfaces a Top-10 Priority Queue based on the freshness of filing alerts, last-reviewed timestamps, and assumption changes.
- Provides a comprehensive, filterable Status Index of all watchlisted and active portfolio positions.
- Records and displays a timeline of past decision outcomes (e.g. Buy, Hold, Exit) along with the user's logged reasoning across review cycles.

---

## 2. Scope and Non-Goals

### In Scope
- **Top-10 Priority Queue:** Algorithm sorting assets by urgent update alerts, stale reviews, and challenged assumptions.
- **Filterable Status Index:** UI panel listing all assets sorted by market, ticker, or status.
- **Decision Timeline Logs:** DB persistence and frontend rendering of historical decision records.

### Out of Scope
- Trade execution, order placement, or brokerage account syncing.
- Portfolio value tracking, currency conversion, or cost basis calculation.
