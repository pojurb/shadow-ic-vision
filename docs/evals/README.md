# Evaluation Artifacts

Store milestone-specific evaluation assets under `docs/evals/M###/`.

Each evaluation set must include:

- the acceptance criterion or risk covered by every case
- sanitized input fixtures and expected invariant behavior
- scoring rubric and hard-failure conditions
- pass thresholds defined before implementation
- normal, boundary, missing-data, adversarial, and provider-failure cases as
  applicable
- held-out cases not used in the builder repair loop
- model, prompt, rubric, and grader version metadata
- instructions for reproducing the evaluation

Golden Datasets measure specified behavior. They do not prove correctness and
do not replace deterministic tests, security review, or user-visible QA.
