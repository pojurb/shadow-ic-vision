Ini bukan sesi baru dari nol. Semua pekerjaan sudah ter-commit, working tree bersih, base commit terakhir `6fa90d7`. Orientasi dulu, jangan langsung koding.

## Baca dulu, dengan satu peringatan

1. `SESSION_CHECKPOINT.md` entri paling atas ("2026-08-06 — Class-C document classification, promotion cleanup, relevance-gate attempt..."). **PERINGATAN: entri ini BASI.** Ia hanya mencakup sampai `e8a99c3`, dan tidak memuat dua commit terakhir — `baff03c` (catatan R-025) dan `6fa90d7` (DEC-0018 + containment + briefing bridge). Untuk dua commit itu, baca `git show --stat baff03c 6fa90d7` dan bagian "Yang baru saja selesai" di bawah. Memperbarui checkpoint ini adalah pekerjaan kecil yang layak dikerjakan lebih dulu.
2. `docs/decisions/DEC-0018-verdict-positive-state-conditions.md` (`accepted`, baru) — syarat state positif verdict.
3. `docs/RISK_REGISTER.md`, cari **R-025** — ada paragraf naratif bertanggal 2026-08-06 dengan temuan terkuantifikasi soal relevansi evidence. Ini masalah terbuka terbesar di produk ini.
4. `AGENTS.md` — 4 rule "Product Constitution for CLI Usage", terutama rule 2 (jangan pernah menyarankan Buy/Hold/Reduce/Exit) dan rule 4 (usulkan metodologi, jangan tentukan angka kalibrasi milik user).
5. `VISION.md` §2, §3, §4, §7, §9 — dibutuhkan untuk memahami keputusan strategis di bawah.

## Reframing strategis dari sesi lalu — ini konteks terpenting

Produk ini **belum pernah menjalankan loop utamanya**. Terverifikasi langsung ke database: `portfolio_positions` = 0, `decisions` = 0, `user_confirmed_secondary` = 0. Sunday Evening Ritual (VISION §4), yang VISION §9 tetapkan sebagai ukuran sukses, belum pernah terjadi sekali pun — sementara belasan commit dihabiskan di lapis evidence di bawahnya.

Masalah teknis inti, dinyatakan sesederhana mungkin:

> Sistem bisa membuktikan sebuah kutipan berasal dari mana. Sistem tidak bisa menilai apakah kutipan itu membahas klaimnya.

Audit terhadap korpus TLKM nyata (72 kandidat) menemukan **88.9% jelas tidak relevan** terhadap asumsi yang ditempeli. Diverifikasi ulang secara independen dengan metode berbeda: dari 39 baris evidence secondary yang tersimpan, paling banyak 2-3 yang masuk akal.

Temuan struktural kedua: dari 6 asumsi TLKM, hanya 1 yang berbentuk angka laporan keuangan. Sisanya peristiwa/relasi (kepemilikan %, MW kapasitas, identitas investor) yang tidak punya tag XBRL di pasar mana pun. Dan `createXbrlFactSources()` mengembalikan `ID: undefined` di semua cabang, jadi untuk market ID `observedValue` selalu null → polarity selalu `inconclusive` → verdict tidak akan pernah bisa `breached`.

Pertanyaan produk yang belum dijawab user: **jp-invest mau jadi hakim (memvonis thesis) atau pencari (menyajikan bacaan relevan, user yang memvonis)?** VISION §3/§5/§7 condong ke "pencari dengan batas yang jujur".

## Yang baru saja selesai (`6fa90d7`)

Tiga hal, semuanya terverifikasi dengan disiplin fail-then-pass:

1. **DEC-0018** — state positif verdict (`holding`) sekarang wajib `coverage.supported > 0`. Sebelumnya cukup "tidak ada contradiction + gate terbuka", yang membuat TLKM berstatus HOLDING padahal 42/42 evidence-nya `inconclusive`. State positifnya **digerbangi, bukan dihapus** — opsi menghapus enum sempat diusulkan lalu ditolak pada review. Ini membuka jalur ke `insufficient_evidence` dengan gate TERBUKA dan `suppressionReasons` KOSONG, yang tadinya menghasilkan kalimat rusak `"INSUFFICIENT EVIDENCE — ."` — sudah diperbaiki.
2. **Containment tombol "Accept secondary evidence"** — ditahan di dua sisi (panel menampilkan alasan; `acceptSecondaryEvidence` menolak permintaan terlepas dari UI), karena passage di baliknya belum pernah dinilai relevansinya. Seam-nya bernama `secondaryEvidenceAcceptanceAvailable()` di `lib/domain/contracts.ts` — satu tempat untuk dibalik nanti.
3. **Briefing bridge** — `getPortfolioBriefing()` kini membawa verdict, `supported/total`, dan `relevanceUnassessedCount` (sengaja dipisah dari `supported` supaya tidak bisa disajikan sebagai korroborasi). Dirender di `TopTenQueue` dan `/portfolio`.

Verifikasi: 381 lulus / 3 skip, tsc, lint, `context:check`, `status:check` bersih. TLKM live sekarang membaca `INSUFFICIENT_EVIDENCE`.

## Dua caveat jujur dari sesi lalu

- **Briefing bridge belum pernah dilihat di browser.** Diuji lewat test integrasi dengan database sementara, bukan dengan mata di layar, karena portfolio nyata masih kosong. Kalau ada yang salah di rendering, belum ketahuan.
- **Satu test dibalik arah pernyataannya.** `"transitions a pending_confirmation assumption to user_confirmed_secondary"` menjadi `"withholds acceptance while relevance is unassessed"`. Sebuah jaminan lama sengaja dicabut, bukan diperbaiki — alasan dan cara memulihkannya ada di komentar test.

## LANGKAH BERIKUTNYA — eksperimen, bukan koding

Ini yang menghalangi semua keputusan lain. Jangan bangun apa pun di area relevance sebelum ini dijalankan.

```bash
npm run dev
```

1. User menambahkan **TLKM** lewat form di sidebar (`components/Sidebar.tsx`), pilih `Owned`/`Watchlist`, tautkan ke thesis TLKM. **Ini state portofolio durable — keputusan user, jangan dikerjakan agent.**
2. Buka `localhost:3000` dan `/portfolio`. TLKM harus tampil dengan badge "Not enough evidence" dan "0 of 6 assumptions supported · N passages not relevance-checked". **Ini pertama kalinya bridge dilihat di browser** — verifikasi rendering-nya benar.
3. Buka `/c/7bb5aefb-b4cb-49d8-a4a7-4d4e95adb62e` — pastikan tombol Accept sudah hilang, diganti keterangan.
4. User mencatat satu review/keputusan nyata (`decisions` masih 0, jadi ini sekaligus menguji `evidenceIds`/`alternatives` dengan data sungguhan).

Apa yang terlihat di langkah 2 dan 4 menentukan lingkup milestone relevance: apakah butuh relevance contract deterministik penuh, atau cukup label `uncertain` yang murah dan terlihat.

## Keputusan terbuka, belum dipilih

**Lingkup remedi R-025** — empat kandidat, tidak ada yang dipilih:

- (a) hygiene murah: perbaiki penamaan + tambah stop word Indonesia yang hilang (`sebagai`, `dengan`, `dalam`, `pada`, `oleh`, `serta`, `juga` — asimetri dengan daftar Inggris sudah dikonfirmasi)
- (b) deterministic relevance contract yang mengunci ke kelompok konsep dari measurement contract (entity/alias, metrik, jenis event) — measurement contract TLKM ternyata **kaya** dan layak dipakai, tapi pendekatan naif "semua token dari contract" GAGAL, harus entitas distingtif
- (c) pemisahan `PassageCandidate` vs `Evidence` (usulan reviewer "Sol", menyentuh skema + alur UI)
- (d) semantic assessor berbasis model — **tidak** diizinkan DEC-0016 (yang hanya mengatur polarity classifier setelah evidence ada, bukan relevance gate sebelum evidence dibuat), butuh DEC baru + milestone + live eval

Catatan: menaikkan floor token dari 1 ke 2 saja terbukti TIDAK memadai — masih menyisakan 37 kandidat tak relevan di korpus yang sama.

**Temuan terbuka lain, tercatat tapi belum dikerjakan:**

- `source_too_large` pada PDF issuer (5 job TLKM gagal di sini secara jujur)
- `knownDocumentIds` di-scope per ticker, bukan per asumsi — asumsi bersaudara saling menghalangi mengekstrak dari dokumen yang sama; perbaikannya butuh catatan per-(asumsi, dokumen) = migration + keputusan desain
- Promosi otomatis efektif hanya untuk asumsi pertama (`promotePendingForAssumption` menandai kandidat global `fetched`)
- Teks R-026 basi (masih menyebut promosi "tidak punya pengecekan bentuk URL")
- Roadmap `docs/drafts/cli-terminal-dashboard-draft-plan.md` §5 langkah 4/5/6, script `decisions:record`, dan keputusan Ollama §7.2

## Aturan kerja

- **Verifikasi klaim ke kode/database langsung, jangan percaya laporan begitu saja — termasuk laporan dari sesi sebelumnya dan dari reviewer.** Pola ini berulang kali menemukan kesalahan nyata: URL issuer yang salah dua kali, sukses palsu pada retry, salah label Class-C, dan sebuah klaim yang sempat dilaporkan ke user sebagai fakta lalu terbukti keliru.
- Untuk setiap perbaikan berbasis test: **buktikan test-nya gagal dulu sebelum perbaikan**, baru lulus sesudahnya.
- Jangan overbuild. Kerjakan yang diminta.
- User berkonsultasi dengan beberapa AI reviewer independen (dipanggil "Sol", "Terra", "Luna"). Kalau user menempelkan hasil review, **verifikasi klaimnya** — sitasi yang salah pernah terjadi (nama file DEC yang tidak ada).
- Keputusan kalibrasi (ambang, bobot, angka) milik user. Usulkan metodologi dan sebutkan trade-off-nya, jangan pilih angkanya.
- Jangan commit tanpa diminta.

## Perintah berguna

```bash
npm run research:panel -- --thesis-id 168cd37c-a6ce-473e-9b2a-943f253c0ef6
npm run research:panel -- --thesis-id 168cd37c-a6ce-473e-9b2a-943f253c0ef6 --full
npm run research:retry -- --thesis-id 168cd37c-a6ce-473e-9b2a-943f253c0ef6
npx vitest run && npx tsc --noEmit && npm run lint
npm run context:generate && npm run context:check && npm run status:check
```

Thesis nyata: TLKM `168cd37c-a6ce-473e-9b2a-943f253c0ef6`, conversation `7bb5aefb-b4cb-49d8-a4a7-4d4e95adb62e`. Ada juga ISAT (legacy, pre-M011). Database live: `d:/jp-invest-data/db.sqlite`. Runbook CLI: `docs/CLI_WORKFLOW.md`.
