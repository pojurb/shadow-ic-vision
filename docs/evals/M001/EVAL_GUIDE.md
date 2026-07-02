# M001 Grader and Evaluation Guide

This guide establishes the reproducible, frozen metrics and verification framework for **Milestone 1 (M001: Existing Thesis Loop)**.

---

## 1. Grader Execution Command

Evals must be triggered using the following environment-neutral entrypoint:
```bash
python scripts/eval_m001.py --cases docs/evals/M001/cases.json --output docs/evidence/releases/eval-run-latest.json
```

> [!NOTE]
> The executable script `scripts/eval_m001.py` is a key deliverable of **Implementation Slice 1** (as defined in the Milestone Spec). It must be constructed and verified before Gate 5 execution begins.

---

## 2. Hard Safety Gates & Scoring Formulas

Average scores cannot offset safety failures. Any safety gate failure results in an automatic **0 (FAIL)** for the entire run.

### Metric A: Citation Hallucination Rate (Hard Gate)
- **Scoring:** Binary (1 or 0).
- **Target:** 0.0% Hallucination (100% exact substring match).
- **Formula:**
  $$Score_{citation} = \begin{cases} 
  1.0 & \text{if } \text{candidate\_quote} \text{ is a case-sensitive substring of } \text{mock\_document} \\ 
  0.0 & \text{otherwise} 
  \end{cases}$$
- **Grader Logic:** Implemented deterministically via plain text string searching (e.g., Python's `in` operator). No LLM grading allowed for this gate.

### Metric B: Assumption Extraction Completeness (Quality Score)
- **Scoring:** Percentage of expected assumptions extracted.
- **Target:** >= 90.0%
- **Formula:**
  $$Score_{extraction} = \frac{|Assumptions_{extracted} \cap Assumptions_{expected}|}{|Assumptions_{expected}|}$$
- **semantic match criteria:** Assumptions match if their core driver (e.g., margin percentage, sticky sector) is present. Match grading is performed using the frozen LLM Grader Prompt below.

### Metric C: CTA & Prioritization Relevance (Quality Score)
- **Scoring:** Exact matching of Next Action category.
- **Target:** >= 80.0%
- **Formula:**
  $$Score_{cta} = \begin{cases} 
  1.0 & \text{if } \text{candidate\_cta} == \text{expected\_cta} \\ 
  0.0 & \text{otherwise} 
  \end{cases}$$

---

## 3. Frozen LLM Grader Prompt

For semantic comparison of extracted assumptions, the grader must use the following frozen prompt configuration:

```yaml
model: claude-3-5-sonnet-latest
temperature: 0.0
system_prompt: |
  You are an objective auditor validating an investment thesis parser.
  Compare the generated assumptions against the expected list of assumptions.
  
  Grading Rubric:
  - Match (1.0): The generated assumption represents the same underlying economic risk/driver as the expected assumption.
  - Partial Match (0.5): The generated assumption is vague but touches the same topic.
  - Miss (0.0): The expected driver is completely absent in the generated list.
  
  Output Schema:
  Your output must be a valid JSON object matching this schema:
  {
    "matches": [
      {
        "expected": "string",
        "generated": "string",
        "score": 0.0 | 0.5 | 1.0,
        "reasoning": "brief justification"
      }
    ],
    "completeness_score": 0.0
  }
```

### Calibration Examples

*   **Expected:** "Palantir's government defense sector contracts remain sticky/active."
    *   *Generated:* "Defense sector revenue remains steady." ➔ **Score: 1.0** (Same underlying driver).
    *   *Generated:* "PLTR gets money from governments." ➔ **Score: 0.5** (Vague).
    *   *Generated:* "Commercial SaaS margins are rising." ➔ **Score: 0.0** (Unrelated topic).

---

## 4. Deterministic Persistence checks

### Cascade Delete Validation
To verify persistence integrity (AC-M001-05), the test harness must perform this sequence against a mock data store:
1. Populate tables with the `mock_db_state` from `TC-013`.
2. Issue the delete command for the parent Thesis.
3. Assert that:
   $$\text{Length}(theses) == 0$$
   $$\text{Length}(assumptions) == 0$$
   $$\text{Length}(evidence) == 0$$
   $$\text{Length}(decisions) == 0$$
4. If any orphaned rows remain in secondary tables, the test fails.

---

## 5. User-Interface State Verification Checklist

Every release must pass these manual or end-to-end browser verification checks:

| Check ID | State | Expected Behavior |
|---|---|---|
| UI-01 | **Empty State** | When no theses are tracked, the home workspace shows a clean welcoming dashboard guide (how to start). It does not display empty database tables or shell rows. |
| UI-02 | **Confirmation State** | Prior to saving a thesis or logging a decision, the user is presented with a summary of the extracted assumptions and must explicitly click a "Confirm" CTA. |
| UI-03 | **Degraded State** | If external search APIs fail, the interface flags a warn banner: "Offline mode active. Search fallback engaged." It does not freeze or crash. |
| UI-04 | **Recovery State** | Invalid tickers or empty user messages prompt a validation prompt: "We couldn't identify this asset. Please enter a valid stock ticker (e.g. BBRI, PLTR)." |

---

## 6. Output Report Schema

Every execution must output a report matching this format:

```json
{
  "commit_sha": "string",
  "grader_version": "1.0.0",
  "timestamp": "ISO-8601",
  "summary": {
    "total_cases": "<integer_total_test_cases>",
    "passed_cases": 0,
    "failed_cases": 0,
    "citation_hallucination_rate": 0.0,
    "overall_score": 0.0
  },
  "results": [
    {
      "id": "TC-001",
      "name": "string",
      "status": "pass" | "fail",
      "score": 0.0,
      "details": "string"
    }
  ]
}
```
