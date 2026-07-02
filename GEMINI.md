@./AGENTS.md

# Gemini CLI Adapter

`AGENTS.md` is the canonical shared playbook. This file exists only so Gemini
CLI loads that playbook automatically.

- Read the relevant policy module under `.agents/` before acting.
- Keep Gemini-specific settings or loader notes here; do not duplicate shared
  lifecycle, quality, security, or release rules.
- After changing context files during an active Gemini CLI session, reload its
  project context before continuing.
