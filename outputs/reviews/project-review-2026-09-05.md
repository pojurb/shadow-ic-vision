**JP Invest — review produk, metode, implementasi, dan arah pengembangan**

Audit 5 September 2026, terhadap commit `0ab929500c586d97ef96cfb4e1c48ae990d9bc4f`. Dokumen ini adalah hasil review dan usulan, bukan perubahan keputusan produk, persetujuan milestone, atau pengganti ACTIVE_MILESTONE/SESSION_CHECKPOINT.

Tujuan pengguna: digunakan pribadi dalam 1–2 bulan; membuka kemungkinan penjualan dalam 6–9 bulan setelah produk pribadi selesai/stabil.

**Penilaian utama**

Fondasi proyek layak dilanjutkan. Kekuatan utamanya ada pada pemisahan sumber, pencatatan provenance, kontrol keputusan pengguna, dan fungsi domain yang bisa diuji. Hambatan terbesar adalah kesenjangan antara keberhasilan mengumpulkan kutipan dan keberhasilan membantu pengguna meninjau sebuah tesis. Beberapa masalah integritas juga perlu diperbaiki sebelum aplikasi menjadi tempat utama menyimpan riwayat analisis.

Untuk pemakaian pribadi: layak sebagai workbench riset yang diawasi, belum layak diandalkan sebagai pemantau tesis yang lengkap. Untuk dijual: belum siap; kebutuhan pengguna berbayar, isolasi identitas/data, instalasi, operasi, dan keberhasilan alur mingguan belum terbukti oleh audit ini.

Penilaian tidak menggunakan return investasi sebagai ukuran keberhasilan. Arah yang disarankan adalah menghasilkan review yang dapat ditelusuri: perubahan apa, asumsi mana yang dipengaruhi, bukti apa yang tersedia, apa yang belum diketahui, dan apa yang pengguna putuskan.

**Bukti dan batas audit**

- Dibaca: visi/strategi, peta kode, roadmap dan paket M013/M014, status terbaru, schema/migrasi, alur chat/konfirmasi, penelitian/snapshot/ekstraksi, coverage/verdict, portfolio/briefing, keputusan/export/import, batas provider, Private Knowledge, komponen/CSS, serta test yang relevan. Audit menyampel alur kritis; tidak mengklaim pemeriksaan setiap baris repository.
- `npm run verify:full`: context/status/typecheck/lint/build lulus; 450 unit/integration tests lulus, 3 dilewati; 7 browser tests lulus. Ringkasan: [verification-summary.json](../../test-results/verification-summary.json).
- Tujuh reproduksi tambahan berhasil mengonfirmasi perilaku bermasalah pada data sintetis. Test ini mengasersi perilaku saat ini, sehingga status lulus berarti masalah berhasil direproduksi, bukan sudah diperbaiki. Kode: [.tmp-review/audit.test.ts](../../.tmp-review/audit.test.ts). Perintah: `npm test -- --config .tmp-review/vitest.config.ts`.
- Browser diperiksa pada server lokal port 3200 dengan database `.tmp-e2e`: halaman awal, tesis terkonfirmasi, metadata evidence, keputusan, dan portfolio index. Screenshot desktop serta drawer 800px hasil E2E diperiksa. Tidak dilakukan audit penuh perangkat mobile, pembaca layar, atau usability dengan pengguna lain.
- Agregasi read-only atas 54 input source card mengonfirmasi 25 kartu generik dengan satu claim identik dan tanpa konsep. Angka historis kualitas relevansi dari risk register adalah hasil audit terdahulu, bukan pengukuran ulang relevansi corpus pada sesi ini.
- Tidak menjalankan research terhadap tesis investasi pengguna, tidak mengubah data investasi asli atau source card. Tidak menjalankan penetration test, audit seluruh dependensi/CVE, benchmark 100 perusahaan, atau evaluasi accuracy live lintas emiten.
- Riset web tambahan dipakai untuk memeriksa metodologi software/evaluasi. Itu bukan Evidence terverifikasi JP Invest dan tidak digunakan sebagai fakta investasi.

**Efek samping pengujian yang perlu diketahui**

Mode mock ternyata tidak menghentikan Tavily ketika `.env` berisi key. Selama dua run suite awal dan E2E, outbound log merekam 61 respons Tavily HTTP 200. Query aplikasi dibangun dari ticker dan nama perusahaan fixture; jumlah kredit/billing tidak diukur. Log Ollama pada jendela waktu yang sama berasal dari test dengan `fetchImpl` mock; itu tidak boleh dihitung sebagai bukti panggilan model live.

Konfigurasi diagnostik awal menggunakan merge yang menggabungkan include, sehingga suite utama ikut dijalankan lagi: 456 tests lulus = 450 baseline + 6 diagnostik. Konfigurasi kemudian dibatasi ke file diagnostik saja, key pencarian dibuat kosong, dan reproduksi ketujuh mengintersep fetch dengan key sintetis. Run terakhir: 7/7 diagnostik lulus tanpa panggilan pencarian eksternal. Artefak pengujian/log lokal bertambah. Perubahan generated `next-env.d.ts` dari dev server dikembalikan setelah inspeksi.

**Temuan, diurutkan menurut dampak**

| Prioritas | Temuan | Bukti dan konsekuensi | Perubahan yang disarankan |
|---|---|---|---|
| P0 — integritas data | Backup hanya menyalin file utama SQLite ketika aplikasi memakai WAL. | `db/client.ts:32–49`; reproduksi membuat transaksi committed di koneksi aktif, membuka koneksi kedua yang memicu backup, lalu membaca backup: transaksi tidak ada. Ini membuktikan risiko backup tidak lengkap, bukan klaim seluruh backup historis rusak. | Gunakan SQLite Online Backup API atau mekanisme snapshot konsisten; restore ke lokasi bersih dan verifikasi record serta sumber. |
| P0 — integritas penilaian | Export/import menghilangkan source adequacy dan assurance; referensi evidence dalam keputusan tidak dipetakan ke ID baru. | `lib/research/service.ts:1192–1412`, `lib/domain/contracts.ts:379`. Reproduksi: gate `suppressed` sebelum export menjadi `open` dan verdict `holding` setelah import; assurance `audited` menjadi `unknown`. ID keputusan menunjuk ID lama, sementara evidence baru memakai UUID baru. | Versikan paket, sertakan penilaian sumber/metadata, pertahankan atau petakan ID, dan uji kesetaraan makna panel sebelum/sesudah restore. Pisahkan thesis export dari backup lengkap sumber. |
| P0 — isolasi test dan biaya | Mode mock masih dapat memanggil discovery live. | `lib/research/discovery/factory.ts:17`, `lib/research/service.ts:1043`. Factory bergantung pada ketiadaan key, bukan mode. Bukti tambahan: hasil Tavily riil muncul pada database E2E dan log pengujian. | Mock factory eksplisit; guard mode di orchestrator; jangan menganggap key kosong sebagai kontrol; blok jaringan secara default dalam test dan gunakan log per-run terpisah. |
| P1 — inti manfaat produk | Exact match menguji keberadaan kutipan, bukan relevansi atau dukungan terhadap klaim. | `lib/research/extractors/candidate.ts:196`, `lib/knowledge/batch.ts:215`. Ranker berbasis token; teks biasanya menghasilkan `inconclusive`. Reproduksi source card: kutipan “not profitable” diterima untuk claim “profitable” karena substring valid. R-025 mendokumentasikan masalah relevansi pada corpus sebelumnya. | Pisahkan provenance, relevance, entailment, dan measurement. Model boleh mengusulkan hubungan, tetapi hasilnya tetap kandidat sampai lolos pemeriksaan yang sesuai. |
| P1 — kesan kepastian | Satu asumsi didukung dan lima hanya punya kutipan inconclusive dapat menghasilkan `holding`. | `coverage.ts:147–155` menghitung semua polarity untuk retrieval coverage; `verdict.ts:158` cukup mensyaratkan `supported > 0` saat gate terbuka. Reproduksi 1/6 didukung, coverage 100%, gate open. Pengecualian class C sudah benar, tetapi tidak menjangkau semua asumsi inconclusive yang belum diklasifikasikan C. | Pisahkan retrieval coverage dari evaluated/support coverage. Tentukan asumsi yang esensial bersama pengguna; gunakan status parsial yang eksplisit. Perubahan aturan positif perlu keputusan produk, bukan angka baru yang disisipkan diam-diam. |
| P1 — waktu dan revisi | Verdict memakai evidence historis tanpa aturan periode aktif/supersession. | `getResearchPanel` mengambil seluruh evidence; `verdict.ts:101–139` memilih kontradiksi terburuk. Reproduksi: evidence 2025 yang melanggar masih menentukan verdict setelah evidence September 2026 mendukung. | Simpan dan pilih periode berlaku, tanggal publikasi, waktu sistem mengetahui, revisi filing, dan versi kontrak. Bedakan current assessment, historical breach, dan unresolved conflict; jangan menghapus sejarah atau selalu mengambil yang terbaru tanpa aturan. |
| P1 — workflow | Outcome `Archive` tidak mengubah `theses.status`; `Update Thesis` juga hanya dicatat sebagai outcome. | `recordDecision` pada `service.ts:1165` hanya insert ke keputusan; route decision tidak menambahkan transisi. Refresh memilih tesis active. Reproduksi Archive meninggalkan status active. Tidak ada route edit tesis/measurement di inventaris route saat audit. | Browser action yang benar-benar mengarsipkan atau membuka editor revisi, dengan konfirmasi/diff dan riwayat. Tambahkan defer dengan tanggal review. |
| P1 — prioritas mingguan | Prioritas lebih peka terhadap jumlah snapshot daripada materialitas perubahan tesis. | Snapshot baru memicu alert (`snapshot-store.ts:71`); skor (`priorityQueue.ts:46`) menambah 50 per alert dan 30 untuk challenged. `getPortfolioBriefing` tidak memasukkan verdict ke kalkulasi skor; status owned/watchlist juga bukan input. | Prioritaskan breach/konflik material, gap penting, review jatuh tempo, lalu informasi tambahan. Deduplikasi berdasarkan perubahan substantif. Setiap item menjelaskan alasan prioritas. |
| P1 — Private Knowledge | Coverage nominal tinggi tetapi 25 source card berisi template generik; graph memberi provenance yang terlalu kasar. | Agregasi read-only: 54 kartu, 25 claim identik/konsep kosong. `graph.ts:111–140` menghubungkan semua concepts/mechanisms/definitions/indicators/limitations ke claim pertama. Memiliki claim ID valid tidak membuktikan relasi itu didukung claim tersebut. | Tandai coverage substantif terpisah; regenerasi atau downgrade kartu setelah review pengguna. Setiap item/relasi membawa claim dan locator yang tepat. Jangan perluas graph sebelum retrieval dan perbandingan sumber berguna. |
| P1 — exploration trust | “Source” pada kandidat eksplorasi berasal dari string model tanpa retrieval/verifikasi sumber di jalur itu. | `app/api/chat/route.ts:46`, `contracts.ts:264`, `ChatUI.tsx:227`. Field citation hanya non-empty string; ditampilkan langsung sebagai Source. | Beri label eksplorasi belum diverifikasi, atau sediakan provenance yang benar melalui pipeline. Tracking harus dilanjutkan ke draft tesis dan konfirmasi, bukan berhenti pada portfolio entry. |
| P1/P2 — kelengkapan riset | Dokumen yang sudah dikenal ticker dapat dilewati untuk asumsi lain yang belum memprosesnya. | `service.ts:621` memakai knownDocumentIds per market/ticker; `pipeline.ts:106` memilih dokumen yang belum dikenal. Mekanisme cache dokumen dan status pemrosesan asumsi belum terpisah. | Cache fetch/extraction per hash, tetapi catat evaluasi per assumption + contract version + extractor version. Dokumen sama boleh dipakai banyak asumsi tanpa fetch ulang. |
| P2 — observability | Kegagalan XBRL/secondary/discovery ditelan tanpa status lane yang memadai. | `runXbrlFactCall`, `runSecondaryResearchCall`, `runDiscoveryAndPromotion`; kegagalan lane tambahan tidak mengubah status job official. Pemisahan hasil lane baik, tetapi panel tidak cukup membedakan off, unavailable, empty, rejected, dan successful. | Simpan attempt/status per lane, jumlah kandidat, alasan penolakan, last success, biaya/latensi, serta next recovery action. |
| P2 — metadata Private Knowledge | Metadata OCR di knowledge_documents ditimpa metadata digest; merged cells XLSX belum ditangani sesuai spec. | `batch.ts:141–150` memakai kolom provider yang sama; `office/xlsx.ts:39` tidak melewati slave merged cells. Checkpoint terbaru mengukur duplikasi besar pada satu workbook. | Pisahkan provenance tiap tahap; gunakan master cell/locator yang konsisten. Tambahkan fixture bermakna untuk formula, merged/hidden cells, locator tabel, dan OCR hash mismatch. |
| P2 — commercial readiness | API aplikasi belum mengautentikasi/otorisasi pengguna per objek; runtime provider sengaja menolak production/hosted. | Misalnya `app/api/portfolio/route.ts`, route decision/export; `db/schema.ts` satu workspace; `lib/ai/provider-gate.ts:64`. Hanya endpoint cron memiliki bearer check yang terlihat. | Putuskan model distribusi dulu. Hosted/shared memerlukan identity, object authorization, isolation, quotas, retention, recovery, dan revisi provider policy yang dievaluasi. Jangan menganggap deploy sukses berarti siap dijual. |

**Apa yang sudah bagus dan perlu dipertahankan**

1. Thesis dan asumsi adalah pusat model produk. Ini memberi struktur yang lebih berguna untuk review berkala daripada sekadar riwayat chat.
2. SourceSnapshot immutable/content-addressed, metadata sumber, periode/tanggal, kelas evidence, dan pemisahan official/secondary/OCR/derived sudah merupakan aset teknis nyata.
3. Measurement contract mengenali ambiguity, definisi metrik, unit, dan perbedaan balance versus flow. Menolak perbandingan yang tidak masuk akal adalah keputusan yang tepat.
4. Coverage dan verdict berupa fungsi murni yang dipakai UI dan prompt. Model tidak bebas mengganti hasil aritmetika. Kelemahan aturan saat ini bisa diperbaiki tanpa membongkar seluruh produk.
5. User investment action terpisah dari assessment; browser menampilkan optional action dengan default None. Ini mendukung kendali pengguna, walau bukan bukti semua teks model selalu patuh.
6. SQLite/Drizzle, batas server-side, transaksi, lease owner, heartbeat, dan provider interface cukup sesuai untuk satu pengguna. Tidak ada temuan yang mengharuskan migrasi ke graph database atau microservices untuk tujuan 1–2 bulan.
7. Private Knowledge dipisahkan dari Evidence/SourceSnapshot. Pemisahan ini berguna dan jangan dilebur demi kemudahan retrieval.
8. Ada kebiasaan menyimpan keputusan desain dan mengoreksi hasil audit yang keliru. Test regresi dan pipeline verifikasi sudah cukup kuat sebagai fondasi; cakupannya perlu mengikuti risiko produk.

**Evaluasi pendekatan dari nol**

Pendekatan thesis-first dan evidence-first sesuai dengan masalah yang ingin diselesaikan. Bagian yang perlu diubah adalah pembagian tanggung jawab antara pengumpulan sumber, interpretasi, evaluasi metrik, dan keputusan pengguna.

Rangkaian yang disarankan:

`Pernyataan pengguna → jenis asumsi dan definisinya → sumber yang mungkin menjawab → kandidat bukti → provenance → relevance/entailment → evaluasi terukur atau penilaian kualitatif yang berlabel → review pengguna → riwayat versi.`

Ada empat jenis asumsi yang perlu mendapatkan jalur yang sesuai:

| Jenis | Jalur evaluasi | Batas penting |
|---|---|---|
| Angka yang diungkap langsung | Ambil nilai dengan entitas, segmen, satuan, periode, dan locator; bandingkan dengan kontrak. | Tag dengan satuan yang sama belum tentu mewakili metrik yang sama. |
| Angka turunan | Simpan rumus dan input terverifikasi yang periode/definisinya kompatibel. | Jangan membandingkan GrossProfit dalam USD langsung dengan margin persen. Helper kalkulasi yang ada perlu benar-benar terhubung ke alur live sebelum klaim kemampuan. |
| Kualitatif | Catat evidence mendukung/menantang, alasan, batas inferensi, dan review pengguna. | `not_measurable` sebaiknya tidak berarti pengguna kehilangan jalan untuk menilai asumsi tersebut. |
| Tidak ada sumber publik yang teridentifikasi | Catat alasan dan pilihan pengguna: pantau manual, pilih proxy dengan keterbatasan, revisi asumsi, atau defer. | Kegagalan pencarian tunggal tidak cukup untuk menetapkan class C; AI tidak memilih threshold spesifik sebagai jawaban final. |

Penambahan XBRL semata tidak menyelesaikan metrik segmen, KPI operasional, atau kontrak privat. SEC menyatakan API agregasi XBRL berfokus pada taxonomy standar dan fakta yang berlaku untuk entitas secara keseluruhan. Itu menjelaskan mengapa perlu dukungan dokumen/tabel dan capability matrix, bukan janji semua metrik bisa diambil dari satu endpoint. [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces).

Lapisan semantic relevance dapat memakai retrieval hybrid, reranking, dan pemeriksaan entailment sebagai kandidat metode. Nilai metode itu dengan dataset berlabel milik proyek, termasuk kutipan benar tetapi salah segmen, salah periode, negasi, dan kutipan relevan yang tidak cukup menjawab. Evaluasi ALCE memisahkan kualitas jawaban dan kualitas citation; itu mendukung keputusan untuk tidak menjadikan substring match satu-satunya ukuran. Tidak ada klaim bahwa memasang satu model otomatis menutup gap ini. [ALCE](https://arxiv.org/abs/2305.14627).

**Review UX dan kelengkapan fitur**

Desktop tiga kolom memberi pemisahan chat/research yang jelas dan verdict terlihat lebih dahulu. Namun panel 380px menampung seluruh evidence, discovery, dan decision history; chat mengambil sebagian besar ruang meski tugas utama adalah membandingkan sumber. Banyak badge menjelaskan implementasi, sehingga pengguna harus menerjemahkan sendiri perbedaan `succeeded`, `untested`, `pending`, dan `supports`.

Halaman awal masih menampilkan “M001 scaffolding”, database, dan provider mock yang hardcoded. Di browser, tesis yang telah dikonfirmasi ada di sidebar tetapi briefing/index masih kosong karena portfolio entry belum dibuat. Pesan “No active items require review” dapat dibaca sebagai aman padahal konteksnya belum ada holdings. Di draft, pengguna melihat statement tetapi tidak seluruh kontrak measurement yang menentukan evaluasi berikutnya. Label “Confirmation required” juga tetap terlihat pada kartu yang sudah dikonfirmasi.

Saran: jadikan halaman awal sebagai briefing pengguna, dengan tombol track/explore yang jelas. Jadikan tesis detail sebagai workspace utama berisi ringkasan, tabel asumsi, perubahan sejak review terakhir, evidence reader, dan history. Chat menjadi salah satu alat di workspace tersebut. Advanced metadata dan pemilihan model dapat ditempatkan dalam detail/settings. Sebelum konfirmasi, tampilkan metrik, definisi/segmen, unit, periode, threshold milik pengguna, dan sumber potensial secara dapat diedit.

Status kosong, gagal memuat, sumber mati, belum ada perubahan, belum ditinjau, dan ditunda perlu dibedakan. `app/portfolio/page.tsx` saat ini menelan kegagalan fetch lalu dapat menampilkan tabel kosong; ini berbeda makna dengan benar-benar tidak ada holdings. Label “Daily refresh / Next” dihitung dari cron string tanpa membuktikan scheduler terpasang; tampilkan planned schedule terpisah dari scheduler enabled dan last successful execution.

**Prioritas 1–2 bulan untuk penggunaan pribadi**

Urutan berikut adalah usulan kapasitas, bukan jaminan estimasi. Pilot dipersempit sementara ke sekitar 5–10 tesis pilihan pengguna agar kualitas end-to-end bisa dinilai; ini bukan perubahan permanen batas strategi 100 perusahaan.

| Periode | Hasil untuk pengguna | Kriteria selesai yang bisa diamati |
|---|---|---|
| Minggu 1–2 | Data dan hasil review tidak berubah diam-diam ketika dicadangkan, dipulihkan, atau diuji. | Backup saat WAL aktif dapat direstore; export/import mempertahankan adequacy, assurance, keterkaitan evidence, dan makna verdict; mock menghasilkan nol request eksternal dengan fake configured key. |
| Minggu 2–4 | Tesis punya asumsi yang dapat ditinjau, dan bukti yang relevan dapat dimasukkan secara dapat ditelusuri. | Editor kontrak + source capability check; jalur input/konfirmasi measurement dari dokumen; state relevan/insufficient/unknown jelas; satu dokumen dapat dievaluasi untuk beberapa asumsi. |
| Minggu 4–6 | Pengguna dapat menyelesaikan review sampai perubahan state nyata. | Archive berhenti dari active refresh; revisi tesis mempertahankan versi lama; defer punya tanggal; current evidence dan historical breach dibedakan; keputusan menyimpan sumber yang benar-benar dipakai. |
| Minggu 5–8 | Briefing mingguan menjawab apa yang berubah dan mengapa perlu perhatian. | Queue berbasis perubahan material, bukan jumlah dokumen; ringkasan bersitasi dengan coverage/gap; empat review mingguan dicatat, termasuk miss, false alarm, koreksi, dan effort. |

Perbaikan yang kecil dan independen boleh dikerjakan berdekatan. Pembenahan definisi support/relevance membutuhkan pilihan metodologi dan acceptance criteria sebelum implementasi. Jangan memakai satu threshold coverage baru sebagai pengganti keputusan itu.

**Arah fitur dan prioritas**

| Fitur | Arah pengembangan | Prioritas |
|---|---|---|
| Thesis builder | Statement → assumption map → measurement/source feasibility → browser confirmation. | Sekarang |
| Evidence review | Document reader, locator, relevance rationale, structured measurement proposal, accept/reject/correct dengan provenance. | Sekarang |
| Weekly IC briefing | Perubahan sejak review, alasan prioritas, konflik/gap, next review task; semua klaim material bersumber. | Sekarang |
| Decision journal | Revisi dan timeline yang dapat direkonstruksi; bedakan kualitas proses dan hasil investasi. | Sekarang |
| Source health | Status per emiten/lane, last success, reasons, quota/budget caps, retry terarah. | Sekarang |
| Explore company/sector | Kandidat tidak diranking, evidence status jelas, business drivers/risks/gaps, transisi utuh menjadi tesis. | Setelah loop inti stabil; tetap diperlukan sebelum beta sesuai strategi |
| Private Knowledge | Cari passage → bandingkan framework/limitations → buat pertanyaan review yang dipilih pengguna. | Bounded repair sekarang, ekspansi setelah loop inti |
| Counterargument assistant | Usulkan argumen lawan dan pertanyaan yang membedakan kedua pandangan dengan bukti. | Setelah evaluasi relevance/entailment ada |
| Scenario worksheet | Rumus dan asumsi eksplisit; pengguna memilih parameter; sensitivity/what-if bukan rekomendasi aksi. | Setelah kebutuhan penggunaan nyata terbukti |
| Kolaborasi trusted circle | Komentar, review, hak akses, history siapa mengubah apa. | Setelah single-user paid pilot tervalidasi |
| Multi-asset, brokerage, autonomous IC, graph besar | Belum mendukung kebutuhan jangka pendek yang paling mendesak. | Tunda |

**Arah komersial 6–9 bulan setelah produk pribadi stabil**

Hipotesis produk yang paling dekat dengan implementasi dan kebutuhan saat ini: workspace pemantauan tesis bersitasi untuk investor mandiri yang rutin meninjau emiten pilihannya. Diferensiasi yang perlu diuji adalah kualitas perubahan yang disaring, transparansi gap, dan kualitas ingatan keputusan. Belum ada bukti dalam audit ini tentang willingness to pay, pricing optimal, atau product-market fit.

1. Setelah empat weekly cycles, undang 3–5 pengguna dengan pola kerja serupa. Amati apakah mereka dapat membuat tesis, memahami gap, dan menyelesaikan review tanpa developer memperbaiki data/config.
2. Jalankan paid pilot terbatas untuk menguji kebutuhan berulang dan willingness to pay. Catat biaya sumber/model, waktu support/onboarding, dan retensi penggunaan. Hindari janji cakupan emiten/akurasi yang belum diukur.
3. Pilih distribusi berdasarkan pilot: aplikasi lokal berbayar dengan pengelolaan data pribadi, atau hosted workspace. Lokal tetap membutuhkan installer, update, restore, pengelolaan key, dan support. Hosted menambah identitas, isolasi data, object-level authorization, queue worker, quotas, dan operasi server. SQLite bukan masalah yang otomatis harus dibuang; keputusan persistence mengikuti pola deployment dan concurrency yang dibuktikan.
4. Sebelum penjualan luas, verifikasi hak penggunaan/redistribusi sumber dan materi edukasi privat; evaluasi ulang provider handling/consent dan kebijakan produksi. Ini kebutuhan pemeriksaan kesiapan produk, bukan kesimpulan hukum atau lisensi dari audit ini.
5. Tambahkan kolaborasi dan cakupan lebih luas hanya bila loop inti menunjukkan penggunaan berulang dan kualitas yang stabil.

Untuk deployment bersama, otorisasi harus menguji akses pada setiap objek, bukan sekadar menambahkan layar login. OWASP secara khusus menempatkan broken object-level authorization sebagai risiko utama API. [OWASP API1:2023](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/).

**Metrik dan acceptance checks yang perlu menggantikan hitungan fitur**

- Evidence precision: berapa passage yang reviewer konfirmasi relevan dan menjawab klaim; ukur juga relevant-but-insufficient secara terpisah.
- Known-change recall: berapa perubahan material dalam benchmark periode yang benar-benar ditangkap, bukan sekadar berapa banyak dokumen ditemukan.
- Measurement fidelity: metrik, entitas/segmen, unit, periode, dan derivasi cocok dengan kontrak; threshold tetap milik pengguna.
- Review completion: review berakhir pada no change yang beralasan, investigation task, revision, archive, atau deferral yang tercatat.
- Reconstruction: pengguna dapat membuka keputusan lama dan melihat versi tesis, bukti, alternatif, serta informasi yang tersedia saat itu.
- Review usefulness/effort: dipakai mingguan dan dirasakan membantu, tanpa menjadikan cepat mengambil aksi atau sering bertransaksi sebagai tujuan.
- Operational recovery: mock tanpa jaringan; source lane failure terlihat; restore konsisten; quota/cost dapat dijelaskan.

Target angka untuk kualitas relevansi/recall perlu disepakati setelah baseline berlabel ada. Guardrail integritas seperti nol network call pada mock dan tidak kehilangan record dalam restore bukan perkiraan statistik.

**Perawatan arsitektur dan dokumentasi**

Pertahankan modular monolith. Pisahkan `service.ts` (1.578 baris) berdasarkan tanggung jawab yang sudah jelas: thesis lifecycle, research orchestration, assessment queries, decision records, dan transfer/restore. Hindari refactor besar yang tidak menghasilkan perubahan pengguna; ekstraksi modul dapat mengikuti perbaikan di atas.

Setiap lane eksternal sebaiknya menerima konfigurasi/mode eksplisit dan dependency injectable. Cache per dokumen dan evaluasi per kontrak dipisahkan. Background worker baru berguna ketika deployment memerlukannya; tidak perlu memperkenalkan infrastructure terdistribusi untuk satu pengguna.

Dokumen current-state perlu diringkas dan diselaraskan: ACTIVE_MILESTONE 1.025 baris masih menyebut assurance step 6 terbuka di bagian awal, sementara SESSION_CHECKPOINT 4.265 baris menjelaskan selesai. Pindahkan narasi historis ke arsip yang dirujuk, pertahankan ringkasan status singkat di dua file kanonis. Skill arsitektur personal masih menyebut Dexie dan plan files yang tidak ada; repository saat ini memakai Drizzle/SQLite. Ini risiko context drift bagi agent, bukan alasan mengubah teknologi aplikasi mengikuti skill yang usang.

Backup yang konsisten memiliki mekanisme resmi pada SQLite; sekadar menyalin `.sqlite` tidak cukup ketika state masih berada di WAL. [SQLite Online Backup API](https://sqlite.org/backup.html), [SQLite WAL](https://sqlite.org/wal.html).

**Keputusan berikut yang disarankan**

Susun satu paket perbaikan menuju personal-use readiness dengan tiga outcome: integritas data/test, review asumsi yang bermakna, dan weekly loop yang tuntas. Batasi perluasan Private Knowledge pada koreksi kualitas yang sudah terbukti bermasalah. Arah ini mempertahankan investasi teknis yang sudah baik sambil memusatkan pengerjaan pada manfaat yang dapat pengguna alami setiap minggu.

Audit lanjutan khusus terminal workflow tersedia di [`cli-workflow-review-2026-09-05.md`](cli-workflow-review-2026-09-05.md). Temuan utamanya: CLI saat ini cocok sebagai operator tooling, tetapi mode isolation, snapshot-path consistency, browser-to-CLI identifier handoff, dan definisi durable-state confirmation harus diperbaiki sebelum menjadi jalur utama atau fitur produk berbayar.
