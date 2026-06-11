# Investment Brain — Implementation Plans

**Synthesized from:** Project Living Thesis PRD, Investment Brain V1 PRD, ANALYST PRD v1.0  
**Date:** 2026-05-17

---

## Thesis File Structure (Shared Across Both Plans)

Format `.md` yang dihasilkan dan diperbarui oleh sistem. Sama di MVP maupun Full System — bedanya hanya siapa yang jadi source of truth (flat file vs DB).

```markdown
# Investment Thesis: [TICKER]

**Confidence:** 72% | **Status:** Active | **Last Updated:** 2026-05-17

## Hypothesis
Satu paragraf core thesis. Kenapa aset ini menarik, apa bet utamanya.

## Financial Snapshot
| Quarter | Revenue | Net Profit | EPS | YoY Growth |
|---|---|---|---|---|
| Q1 2026 | Rp X T | Rp X T | Rp X | +X% |
| Q4 2025 | Rp X T | Rp X T | Rp X | +X% |

## Key Entities
Perusahaan, sektor, kompetitor, regulator yang relevan.

## Supporting Evidence
- Observasi yang memperkuat tesis

## Contradictory Evidence
- Observasi yang menantang atau melemahkan tesis

## Assumptions
- Asumsi kunci yang harus benar agar tesis valid

## Bull Case
**Target:** Rp X.XXX | **Trigger:** ...

## Bear Case
**Downside:** Rp X.XXX | **Risk:** ...

## Narrative Evolution
| Date | Event | Impact | Confidence |
|---|---|---|---|
| 2026-05-17 | Initial thesis | Q1 beat estimates | 72% |

## Catalysts to Watch
- Event atau data yang akan membuktikan atau membantah tesis

## Open Questions
- Hal yang belum terjawab dan perlu di-monitor
```

---

# Plan A — MVP (Claude Code Native)

**Prinsip:** Flat files. Claude Code sebagai brain. Tidak butuh API key atau Python script.  
Source of truth adalah file `.md` — dibaca Claude sebagai state lama, ditulis ulang sebagai state baru.  
Web research = manual (user trigger search/paste, Claude process).

## Struktur Folder

```
investment_brain/
  CLAUDE.md         ← identity + aturan ketat untuk Claude (ini yang "menghidupkan" sistem)
  /inputs/          ← drop PDF atau paste teks di sini
  /thesis/          ← thesis files per ticker (source of truth)
  /notes/           ← call prep, sector notes, macro snapshots
  /skills/          ← referensi ke skills_and_prompts.md
```

## Yang Perlu Dibangun

**1. CLAUDE.md (project-level)**  
File ini adalah "identitas" Claude setiap kali dibuka di folder ini.  
Isinya: role, aturan ketat update thesis, skill index, dan cara baca folder structure.  
→ Detail di `skills_and_prompts.md`

**2. Folder structure**  
Cukup buat folder kosong: `inputs/`, `thesis/`, `notes/`

**3. Thesis template**  
Format standar di atas — Claude akan pakai ini setiap kali `initiate [TICKER]`

## Cara Pakai

```
"initiate TLKM"              → buat thesis/TLKM.md baru dari nol
"analyze earnings TLKM"      → update thesis setelah earnings
"challenge thesis TLKM"      → audit contradiction
"healthcheck TLKM"           → periodic pillar review
"prep call TLKM"             → buat call prep brief
"macro update"               → update worldview snapshot
"sector dive [SECTOR]"       → thematic research
```

Context diberikan dengan cara:
- `@thesis/TLKM.md` — attach thesis yang sudah ada
- `@inputs/TLKM_Q1.pdf` — attach PDF laporan
- Paste langsung teks artikel / berita / data ke terminal

---

# Plan B — Full System (Investment Brain V1 + ANALYST)

**Prinsip:** PostgreSQL sebagai source of truth. File `.md` adalah export. Dual LLM. Web UI di atas CLI.  
**Prasyarat: Plan A harus selesai dan divalidasi.**

## Dependency Graph

```
Phase 0 (Foundation)
├── Phase 1 (Pydantic Contracts) ──┐
│                                  ├── Phase 3 (Ingestion) ──┐
└── Phase 2 (LLM Clients) ─────────┘                         ├── Phase 5 (CLI) → Phase 6 (API) → Phase 7 (Web UI)
                                   └── Phase 4 (Thesis Engine)┘
```

## Phase 0 — Foundation
*Prerequisite semua. Tasks paralel.*

- [ ] Init project, virtualenv, `requirements.txt`
- [ ] `.env`: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `QWEN_API_KEY`
- [ ] `db/schema.sql` — 4 tabel: `entities`, `theses`, `observations`, `relationships`
- [ ] `db/models.py` — SQLModel models
- [ ] `db/connection.py` — engine + session factory

## Phase 1 — Pydantic Contracts
*Depends: Phase 0. Paralel dengan Phase 2.*

- [ ] `core/entities.py` — `Entity`, `EntityType` enum
- [ ] `core/thesis.py` — `Thesis`, `ThesisStatus`, `ConfidenceChange`
- [ ] `core/memory.py` — `Observation`, `Relationship`

## Phase 2 — LLM Clients
*Depends: Phase 0. Paralel dengan Phase 1.*

- [ ] `llm/claude_client.py` — reasoning, synthesis, contradiction analysis
- [ ] `llm/qwen_client.py` — extraction, OCR, document parsing
- [ ] `prompts/extraction.txt` — structured JSON dari dokumen
- [ ] `prompts/synthesis.txt` — worldview snapshot + thesis reasoning
- [ ] `prompts/thesis_update.txt` — evaluate impact + update confidence

## Phase 3 — Ingestion Pipeline
*Depends: Phase 1 + Phase 2.*

> PDF dikirim langsung ke Qwen (native multimodal). Tidak ada pre-processing layer.

- [ ] `ingestion/extractor.py` — PDF → Qwen → structured JSON
- [ ] `ingestion/writer.py` — validasi Pydantic → tulis ke PostgreSQL
- [ ] `cli/ingest.py` — `python ingest.py earnings.pdf [--ticker TLKM]`

## Phase 4 — Thesis Engine
*Depends: Phase 1 + Phase 2. Paralel dengan Phase 3.*

- [ ] `core/reasoning.py` — context builder → worldview snapshot JSON
- [ ] `core/memory.py` (extend) — observation → evaluate → update confidence
- [ ] `core/thesis.py` (extend) — history tracking per confidence change
- [ ] Thesis `.md` exporter — generate dari DB state (format identik dengan Plan A)

## Phase 5 — CLI Interface
*Depends: Phase 3 + Phase 4.*

- [ ] `cli/chat.py` — worldview-aware free-form query
- [ ] `cli/ingest.py` (extend) — auto-trigger thesis update setelah ingest
- [ ] `inv [TICKER]` alias

## Phase 6 — Web API
*Depends: Phase 5.*

- [ ] `POST /ingest`
- [ ] `GET /thesis/{ticker}` + `GET /thesis/{ticker}/history`
- [ ] `POST /chat` (streaming)
- [ ] CRUD `/watchlist` dan `/library`

## Phase 7 — ANALYST Web UI
*Depends: Phase 6.*

- [ ] Chat interface + 5 analysis modes
- [ ] Knowledge Library dengan context toggle
- [ ] Watchlist + ANALYZE trigger
- [ ] Analysis History (server-side)
- [ ] Proactive library suggestion

---

## Migration Path: A → B

Struktur thesis `.md` identik di kedua plan. Semua file yang dihasilkan Plan A langsung bisa di-import ke Plan B sebagai initial state — tidak perlu konversi.
