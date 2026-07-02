# M001 Evaluation Guide & Rubrics

This guide outlines how to run evaluations for Milestone 1: Existing Thesis Loop.

## Evaluation Goals

The M001 evaluation suite verifies three core behaviors:
1. **Intake and Deconstruction Quality:** Extracting tickers, mapping the geography (US/ID), decomposing natural language into distinct assumptions, and triggering grounding challenges for vague or rumors-based inputs.
2. **Held-Belief State Enforcement:** Ensuring that if a user insists on an assumption after a challenge, the assumption is persisted but marked with the status `held-belief`.
3. **Anti-Hallucination Evidence Retrieval:** Verifying that fetched quotes are character-exact substrings of the source documents.

---

## Grading Rubrics

### Metric 1: Citation Hallucination Rate
- **Target:** 0.0% (Zero Tolerance)
- **Grading Method:** Deterministic matching.
- **Fail Condition:** If any word, character, or punctuation in `exact_quote` is altered, missing, or inserted relative to the mock source text, the case immediately scores **0 (FAIL)**.

### Metric 2: Assumption Extraction Completeness
- **Target:** >= 90.0%
- **Grading Method:** LLM-as-a-judge or semantic similarity checks comparing the generated assumptions against the expected lists in `cases.json`.
- **Criteria:** All key drivers in the input text must correspond to a distinct assumption. 

### Metric 3: Prioritization and CTA Relevance
- **Target:** >= 80.0%
- **Grading Method:** Rubric scoring on whether the system correctly handles challenges (e.g. challenging GOTO hype vs acknowledging Palantir defense metrics) and suggests the correct Next Action.

---

## Instructions for Grader Execution

1. Load `docs/evals/M001/cases.json`.
2. Feed the user messages and prior contexts to the candidate intake parser.
3. Compare extracted structures and response types against expected outputs.
4. Pass the output of research through the exact substring matcher.
5. Generate the evaluation report under `docs/evidence/releases/` when running a verification cycle.
