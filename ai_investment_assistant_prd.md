# Product Requirement Document (PRD)

**Project Name:** Project Living Thesis (AI Investment Assistant)  
**Author:** Johannes Purba  
**Date:** May 16, 2026  
**Status:** Draft / Ready for MVP Development  

---

## 1. Executive Summary & Objective

### 1.1 Background
Riset investasi saham/kripto konvensional membutuhkan waktu lama untuk menyinkronkan data baru (laporan keuangan, prospektus, riset makro) dengan tesis investasi yang sudah ada. Pendekatan berbasis RAG (Retrieval-Augmented Generation) terbukti tidak efektif untuk data finansial karena *chunking* merusak struktur tabel keuangan dan *vector search* mengabaikan konteks kuantitatif yang holistik.

### 1.2 Core Objective
Membangun sebuah sistem asisten AI berbasis CLI yang mampu melakukan **In-Context Learning** dan **State Management** secara kumulatif. AI akan membaca tesis investasi lama (state), mengekstrak informasi dari dokumen baru, dan memperbarui tesis tersebut menjadi satu *source of truth* berbentuk file Markdown terstruktur tanpa mengalami "amnesia".

### 1.3 Success Metrics (MVP)
* **Accuracy:** Angka krusial (EPS, Revenue, Net Profit) dari dokumen baru ter-update 100% akurat ke dalam file tesis.
* **Context Preservation:** Informasi penting dari tesis lama tidak hilang atau terhapus saat AI melakukan *overwrite*.
* **Speed:** Proses pembacaan hingga pembaruan file selesai dalam waktu < 30 detik via CLI.

---

## 2. Target User & Workflow

### 2.1 User Profile
Developer / Investor / Product Manager yang menggunakan IDE (VS Code, Zed, Obsidian) sebagai pusat kerja harian dan terbiasa dengan Terminal/CLI serta Git untuk *version control*.

### 2.2 Ideal Workflow
1.  User mengunduh PDF laporan keuangan baru ke folder `inputs/`.
2.  User menjalankan perintah via CLI: `inv [TICKER]`.
3.  Sistem memperbarui file `thesis/[TICKER].md`.
4.  User meninjau perubahan menggunakan *Markdown Preview* dan `git diff` di dalam IDE.

---

## 3. Product Features & Functional Requirements

Sistem dibagi menjadi 3 modul utama: **Ingestion**, **Brain Engine**, dan **State Persistence**.

### 3.1 Feature Matrix (MVP Scope)

| Feature ID | Feature Name | Description | Priority |
| :--- | :--- | :--- | :--- |
| **FR-01** | CLI Command Trigger | User bisa memicu proses update lewat command line dengan parameter Ticker (e.g., `python main.py TLKM`). | P0 (Must Have) |
| **FR-02** | State Reader | Sistem mengecek dan membaca isi file `.md` yang sudah ada di folder `thesis/`. Jika belum ada, sistem membuat file baru. | P0 (Must Have) |
| **FR-03** | PDF Multi-modal Ingestion | Sistem membaca dokumen PDF baru dari folder `inputs/` dan mengirimkannya secara utuh ke LLM (memanfaatkan native PDF capability LLM). | P0 (Must Have) |
| **FR-04** | Merging & Reasoning Prompt | LLM melakukan analisis komparatif antara tesis lama dan data baru berdasarkan instruksi finansial yang ketat. | P0 (Must Have) |
| **FR-05** | Atomic Overwrite | Sistem menimpa file `.md` target secara bersih dengan output Markdown murni dari LLM. | P0 (Must Have) |
| **FR-06** | Self-Correction Sandbox | Mengintegrasikan Python REPL agar LLM bisa memvalidasi perhitungan matematika sebelum menulis output. | P1 (Should Have) |

---

## 4. Architectural & Technical Specifications

```
                       [ inputs/TLKM_new.pdf ]
                                  │
                                  ▼
[ CLI: inv TLKM ] ──> [ Brain Engine (LLM API) ] ──> [ Overwrite ] ──> [ thesis/TLKM.md ]
                                  ▲
                                  │ (Read Old State)
                       [ thesis/TLKM.md ]
```

### 4.1 Tech Stack Constraints
* **Language:** Python 3.10+
* **LLM Service:** Gemini 1.5 Pro (karena memiliki 2M token *context window* dan kemampuan membaca PDF/multimodal secara *native*) atau Claude 3.5 Sonnet.
* **Storage:** Local File System (Flat files, no Database).
* **Format:** Markdown (`.md`) untuk *human-readable state* dan kompatibilitas IDE.

### 4.2 Core Prompt Template (The "Engine" Logic)
System Prompt yang ditanamkan pada Modul Brain Engine wajib mengikuti aturan berikut:
> "Lo adalah Senior Equity Research Analyst. Tugas lo adalah memperbarui berkas `Tesis Investasi` lama berdasarkan `Dokumen Baru` yang disediakan. 
> 
> **Aturan Ketat:**
> 1. JANGAN pernah menghapus historical data atau analogi kualitatif penting dari tesis lama kecuali data tersebut terbukti kontradiktif/salah berdasarkan dokumen baru.
> 2. Perbarui tabel keuangan di bagian atas dengan baris kuartal terbaru.
> 3. Jika ada revisi target harga atau asumsi risiko, highlight perubahan tersebut di section 'Bull/Bear Case'.
> 4. Output harus 100% Markdown bersih tanpa kata pengantar ('Berikut adalah hasilnya...'), langsung mulai dari `# Investment Thesis`."

---

## 5. Non-Functional Requirements (NFR)

* **Data Privacy:** Seluruh dokumen input dan file tesis disimpan secara lokal di perangkat user. Koneksi ke luar hanya terjadi via enkripsi API ke penyedia LLM.
* **Idempotency:** Menjalankan perintah `inv [TICKER]` dua kali dengan dokumen baru yang sama tidak boleh merusak struktur atau menduplikasi informasi di dalam file tesis.
* **Auditability:** Hasil modifikasi file harus bersih sehingga ketika dicek via `git diff`, user bisa melihat dengan jelas baris mana yang ditambah, diubah, atau dihapus oleh AI.

---

## 6. Future Scope (Phase 2)

* **Automated Web Research Agent:** Integrasi dengan Search API (Google/Tavily) untuk mencari berita sentimen pasar bertepatan saat rilis laporan keuangan.
* **Git Auto-Commit:** Menambahkan fungsi otomatisasi di mana sistem langsung melakukan `git commit -m "AI Update: [TICKER] - QX 2026"` setelah file berhasil diperbarui.
* **Interactive QA Mode:** Mode CLI sekunder (`inv chat TLKM`) untuk melakukan tanya jawab interaktif *hanya* berbasis file `.md` yang sudah matang tersebut, tanpa menyentuh dokumen mentah lagi.