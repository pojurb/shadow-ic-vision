# Product Requirement Document (PRD) - Version 8 (Tri-Vertical & Advisory Board)

**Project Name:** Project Living Thesis (AI Family Office Assistant)  
**Author:** Johannes Purba  
**Date:** May 23, 2026  
**Status:** Final Draft / Ready for Implementation  

---

## 1. Executive Summary & Objective
Sistem berevolusi menjadi mesin *Family Office* komprehensif yang mengelola tiga vertikal aset (Saham Publik, Startup/VC, dan Sektor Riil). Sistem ini bertindak sebagai penasihat data kuantitatif, namun menyerahkan **keputusan akhir murni pada penilaian (judgement) manusia**. 

## 2. Tri-Vertical Ingestion Module
Sistem memiliki tiga jalur input mandiri:
1. `inputs/stocks/`: Data bursa, laporan keuangan 10-K/10-Q, dan sentimen makro.
2. `inputs/startups/`: Pitch deck, PRD startup, dan metrik Unit Economics VC.
3. `inputs/conventional_biz/`: Data mentah proyek fisik, asumsi CapEx/OpEx, dan proksi data (Scraping BPS, LPSE, Google Maps API).

## 3. Product Features & Functional Requirements
| Feature ID | Feature Name | Description | Priority |
| :--- | :--- | :--- | :--- |
| **FR-01** | Multi-Agent Red Teaming | Debat otonom Bull vs Bear di *split-screen panel*. | P0 |
| **FR-02** | Python Sandbox Validation | Eksekusi otomatis untuk menghitung unit economics, options pricing, atau skenario Break-Even Point. | P0 |
| **FR-03** | Cross-Asset Risk Manager | Membaca korelasi sistemik antar-vertikal aset (Saham, Startup, Sektor Riil) di `Portfolio_Master_State.md`. | P0 |
| **FR-04** | The Advisory Board Output | **[NEW]** Sistem dilarang memberikan satu kesimpulan kaku. AI wajib menyajikan 3 skenario lensa ahli untuk dievaluasi oleh *founder*. | P0 |

---

## 4. The Institutional Living Thesis Template

Setiap evaluasi aset wajib menggunakan struktur ini:

### 1. Executive Summary & Data Snapshot (BLUF)
Ringkasan fakta utama dari data fundamental, *order flow*, atau asumsi unit economics.

### 2. Quantitative & Microstructure Tracking
Validasi angka dari *Python Sandbox* (CapEx/OpEx, Margin, P/E Ratio, atau Runway).

### 3. Macro-Economic & Portfolio Correlation
Dampak kondisi ekonomi makro saat ini terhadap ide/aset tersebut.

### 4. The Red Team Debate Logs
Perdebatan objektif antara [BULL] dan [BEAR].

### 5. Market Competitor & Supply Landscape
Data kepadatan kompetitor, sentimen pasar, atau *barrier to entry*.

### 6. The Advisory Board Scenarios (Human Judgement Protocol)
**AI hanya menyajikan 3 kacamata berikut, manusia yang mengambil keputusan eksekusi:**
- **The Operator Lens (Moat & Efficiency):** Skenario penekanan CapEx (pendekatan *Asset-Light* / *System Integrator*). Apa SOP/Sistem yang bisa dipatenkan agar tidak mudah ditiru?
- **The Risk Manager Lens (Stress-Test & Survival):** Skenario krisis makro (gagal bayar, suku bunga tinggi). Kapan *cash flow* akan negatif dan bagaimana mitigasinya?
- **The Predator Lens (Fat Pitch & Opportunism):** Identifikasi kondisi "Fat Pitch" (peluang langka/diskon irasional). Kapan momen terbaik untuk mengayunkan modal secara agresif?

### 7. Orchestrator Confidence Score: XX%
