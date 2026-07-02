# Risk Register

Status: `active`

| ID | Risk | Category | Status | Current control |
|---|---|---|---|---|
| R-001 | Architecture or stack is chosen before product requirements | Product/engineering | Open | Vision-first and milestone gates in `AGENTS.md` |
| R-002 | Multiple model-specific playbooks drift apart | Delivery | Mitigated | Canonical `AGENTS.md` with thin importing adapters |
| R-003 | Confidential investment data is sent to an unapproved cloud model | Security/privacy | Open | Data classification and provider approval gate |
| R-004 | Golden Dataset optimization hides failures outside known cases | Model quality | Open | Held-out, adversarial, and independent review requirements |
| R-005 | Horizon 1 is implemented as one oversized milestone | Scope | Open | Versioned, vertical milestone readiness gate |
| R-006 | Product metrics reward trading activity, alert volume, or rushed decisions | Product safety | Mitigated | Vision measures review quality, signal precision, correction handling, and record completeness |

## Required Fields For New Risks

Every material risk must record an owner, likelihood, impact, mitigation,
trigger, residual risk, acceptance authority, and review date before the related
milestone is approved.
