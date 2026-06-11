# Investment Brain V1 — Product Requirements Document

## Vision
Build a personal AI-native investment cognition system that:
- maintains persistent investment memory
- evolves investment theses over time
- ingests research and market information
- synthesizes structured knowledge
- reasons using an evolving worldview

The system is NOT:
- a traditional RAG application
- a chatbot with PDF uploads
- a trading bot

The system IS:
- a persistent investment cognition engine
- a thesis-aware research system
- a structured market worldview system

---

# Product Philosophy

Investment reasoning is not a retrieval problem.

It is a:
- synthesis problem
- memory problem
- probabilistic reasoning problem
- causality problem
- evolving worldview problem

Therefore:
- chunk-based RAG is intentionally avoided
- structured cognition state becomes the main primitive

---

# Core Goals

## 1. Persistent Investment Memory
The system remembers:
- investment theses
- assumptions
- supporting evidence
- contradictory evidence
- narrative evolution
- prior discussions
- confidence changes

## 2. Structured Knowledge
Convert:
- documents
- transcripts
- notes
- research
- market observations

Into:
- entities
- observations
- relationships
- thesis updates
- narrative shifts

## 3. Thesis Continuity
Track:
- what changed
- why it changed
- what assumptions became invalid
- what strengthened a thesis

## 4. Investment Reasoning
Reason using:
- structured state
- historical memory
- relationships
- macro context

Instead of:
- raw chunks
- semantic similarity retrieval

---

# V1 Scope

V1 focuses on:
1. Knowledge Ingestion
2. Structured Memory
3. Thesis-Aware Reasoning
4. Thesis Evolution Tracking

---

# Functional Requirements

## Knowledge Ingestion

Supported formats:
- PDF
- TXT
- Markdown
- Images
- Pasted text

Extraction outputs:
- entities
- observations
- implications
- risks
- catalysts
- thesis updates

CLI Example:

```bash
python ingest.py earnings.pdf
```

---

## Structured Knowledge Layer

Core objects:
- Entity
- Thesis
- Observation
- Relationship

No raw chunk memory.

---

## Thesis-Aware Reasoning Engine

Flow:
1. identify query topic
2. fetch related theses
3. fetch supporting evidence
4. fetch contradictory evidence
5. construct worldview snapshot
6. send structured context to reasoning model

Example query:

```text
Is the AI infrastructure cycle still early?
```

Example worldview snapshot:

```json
{
  "active_narratives": [],
  "supporting_observations": [],
  "contradictory_observations": [],
  "current_regime": {},
  "related_theses": []
}
```

---

## Thesis Evolution Engine

Flow:

```text
New Observation
↓
Identify Related Thesis
↓
Evaluate Impact
↓
Increase/Decrease Confidence
↓
Persist Thesis State Change
```

---

# Technical Architecture

## Stack

### Language
Python

### Database
PostgreSQL

### Validation
Pydantic

### ORM
SQLAlchemy / SQLModel

---

# LLM Allocation

## Qwen
Used for:
- extraction
- OCR
- parsing
- summarization
- document understanding

## Claude
Used for:
- synthesis
- deep reasoning
- contradiction analysis
- thesis evaluation

---

# System Architecture

```text
Documents / Research
↓
Ingestion Pipeline
↓
Structured Extraction
↓
PostgreSQL Knowledge Layer
↓
Context Construction Engine
↓
Reasoning LLM
↓
CLI Response
```

---

# Database Schema

## entities

```sql
id
entity_type
name
metadata_json
created_at
updated_at
```

## theses

```sql
id
title
hypothesis
assumptions_json
risks_json
confidence
status
created_at
updated_at
```

## observations

```sql
id
source
content
implication
timestamp
created_at
```

## relationships

```sql
id
from_entity_id
to_entity_id
relationship_type
strength
created_at
```

---

# CLI Experience

## Ingest

```bash
python ingest.py earnings.pdf
```

## Chat

```bash
python chat.py
```

Example:

```text
> what changed in the AI infrastructure narrative?
```

---

# Recommended Directory Structure

```text
/investment_brain

  /core
    entities.py
    thesis.py
    memory.py
    reasoning.py

  /ingestion
    pdf_parser.py
    extractor.py
    web_ingest.py

  /llm
    qwen_client.py
    claude_client.py

  /prompts
    extraction.txt
    synthesis.txt
    critique.txt

  /db
    models.py
    schema.sql

  /cli
    chat.py
    ingest.py

  main.py
```

---

# Development Milestones

## Milestone 1 — Core Ingestion
Deliverables:
- PostgreSQL setup
- schema creation
- document ingestion
- extraction pipeline
- structured storage

## Milestone 2 — Reasoning Engine
Deliverables:
- context builder
- worldview snapshot
- thesis retrieval
- CLI chat

## Milestone 3 — Thesis Evolution
Deliverables:
- confidence tracking
- contradiction handling
- thesis history
- change explanations

---

# Long-Term Direction

## V2
- graph database
- multi-agent reasoning
- automated workflows

## V3
- portfolio intelligence
- macro exposure analysis
- risk overlap analysis

## V4
- semi-autonomous research
- opportunity ranking
- narrative detection

---

# Key Insight

The differentiation is NOT:
- UI
- model choice
- vector retrieval
- agent count

The differentiation IS:
- persistent cognition
- thesis continuity
- evolving worldview
- structured investment memory
- probabilistic reasoning architecture
