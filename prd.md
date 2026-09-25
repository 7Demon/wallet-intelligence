# Product Requirements Document (PRD)

# Wallet Intelligence — Tahap 1 MVP (Solana-First)

---

## 1. Overview

**Wallet Intelligence MVP** adalah sistem data processing dan analytics engine berbasis blockchain Solana yang merekonstruksi data transaksi on-chain mentah menjadi data perdagangan (*trade*), posisi (*position*), dan performa (*PnL*), lalu menyajikannya dalam dashboard analitik terpadu pada route `/wallet/{address}`.

Tujuan utama produk ini adalah mengubah transaksi blockchain yang berisik (*noisy, multi-instruction, fragmented*) menjadi profil analitik trader yang akurat, transparan, dan dapat diandalkan.

### Prinsip Inti Produk
1. **Analytics Engine First, Dashboard Last**: Dashboard hanya merupakan layer visualisasi. Nilai sesungguhnya ada pada keakuratan *pipeline* rekonstruksi data: `Wallet → Transaksi → Trade → Position → PnL → Metrics`.
2. **Kebenaran Data di Atas Asumsi**: Jika parser tidak yakin terhadap suatu transaksi, klasifikasikan sebagai `UNKNOWN` dan catat ke `parser_errors`, jangan memaksakan label `BUY`/`SELL` yang dapat merusak integritas PnL.
3. **Reproducibility**: Data transaksi mentah (*raw JSONB*) disimpan permanen sehingga pembaruan logika parser (*Parser v2*) dapat dijalankan ulang (*re-parse*) tanpa perlu mengambil data ulang dari RPC node.
4. **Ponytail Senior Engineering**: Mengutamakan solusi sederhana, hemat resource, bebas dependensi kompleks (tanpa Kafka, ClickHouse, atau Kubernetes untuk MVP), dan menggunakan infrastruktur PostgreSQL + FastAPI + Next.js yang dapat berjalan lokal dengan biaya $0.

---

## 2. Problem & Goals

### 2.1 Problem Statement
- **Tingginya Kompleksitas Data Solana**: Satu transaksi Solana dapat memuat puluhan *inner instructions*, routing melalui DEX aggregator (Jupiter), token wrapping/unwrapping, dan transfer fee. Explorer biasa (seperti Solscan) hanya menampilkan transfer individual tanpa menghubungkannya menjadi sebuah *trade* logis.
- **Ketiadaan Metrik Performa Trader Real**: Trader dan analis tidak dapat mengetahui secara instan apakah suatu wallet menguntungkan (*profitable*), berapa *win rate*-nya, bagaimana *holding time*-nya, atau token apa yang menyumbang keuntungan/kerugian terbesar.
- **Distorsi Data Akibat Ekosistem Meme Coin**: Karakteristik trading Solana dipenuhi transaksi berkecepatan tinggi, holding time sangat singkat (menitan), dan outlier ekstrem yang membuat metrik rata-rata biasa (*mean*) menjadi bias tanpa adanya median.

### 2.2 Product Goals
1. **Automated Trade Reconstruction**: Mengambil riwayat transaksi wallet dari Solana RPC, membedah instruksi DEX, mendeteksi swap, dan merekonstruksi `BUY` serta `SELL` yang presisi.
2. **Accurate Position & PnL Engine**: Menghitung *weighted average entry*, merealisasikan PnL saat posisi ditutup sebagian/penuh, dan memisahkan *Realized PnL* dari *Unrealized PnL*.
3. **Comprehensive Trader Profiling**: Menghasilkan metrik kunci (Total PnL, ROI, Win Rate, Median/Average Holding Time, Average Position Size, Profit Factor).
4. **Transparent Rule-Based Classification**: Melabeli wallet secara otomatis berdasarkan metrik internalnya (Performance Tier, Trading Style, Capital Size, Activity Level).
5. **Interactive & Honest Dashboard**: Menampilkan performa, distribusi holding time, trade history berfilter, performa per token, timeline aktivitas, initial funding source, serta indikator *data coverage* yang transparan.

---

## 3. Users & Roles

| Role | Deskripsi | Hak Akses & Interaksi |
|---|---|---|
| **Public User / Analyst** | Trader kripto, riset independen, atau analis yang ingin memverifikasi performa suatu wallet address Solana. | - Memasukkan wallet address ke search input.<br>- Memicu proses initial sync jika wallet baru.<br>- Melihat dashboard `/wallet/{address}`.<br>- Menggunakan filter trade history dan tabel token.<br>- Memantau status sync & coverage. |
| **System Worker** | Background worker (asinkron Python) yang menjalankan ingestion, parsing, kalkulasi posisi, dan agregasi metrik. | - Membaca & menulis ke database PostgreSQL.<br>- Memanggil Solana RPC endpoint.<br>- Memperbarui status job sync secara bertahap. |
| **Admin / Developer** | Pengembang yang mengelola rule threshold, menginspeksi transaksi yang gagal diparse, dan menguji parser v2. | - Mengubah konfigurasi threshold klasifikasi.<br>- Mengakses log `parser_errors` dan metrik coverage sistem.<br>- Menjalankan script re-parse data transaksi mentah. |

---

## 4. Scope

### 4.1 In Scope (WAJIB - Tahap 1 MVP)
- **Single-chain**: Solana only (fokus ekosistem DEX Solana seperti Raydium, Orca, Jupiter).
- **Wallet Ingestion & Validation**: Validasi format public key Solana (Base58, 32-44 karakter).
- **Historical Transaction Fetcher**: Pengambilan riwayat transaksi wallet via RPC secara berurut (*reverse chronological/chronological*).
- **Raw Transaction Storage**: Penyimpanan payload transaksi mentah ke dalam format JSONB di PostgreSQL.
- **Transaction Parser & Swap Detector**: Ekstraksi transfer token/SOL dan identifikasi aksi swap DEX.
- **Trade Reconstruction**: Pemetaan swap menjadi data trade (`BUY`, `SELL`, `TRANSFER`, `UNKNOWN`).
- **Position Engine**: Pelacakan posisi per token menggunakan metode *Weighted Average Cost Basis* (WACB), mendukung akumulasi (*multiple entries*) dan penjualan bertahap (*partial exits*).
- **PnL Engine**: Perhitungan *Realized PnL*, *Unrealized PnL*, *Total PnL*, *ROI*, dan *Win Rate* (khusus closed trades).
- **Behavioral & Holding Metrics**: Perhitungan median & average holding time, serta distribusi waktu hold.
- **Rule-Based Wallet Classification**: Pelabelan otomatis 4 dimensi berdasarkan metrik wallet sendiri dengan threshold berbasis file konfigurasi.
- **Initial Funding Detection**: Mengidentifikasi transaksi pendanaan pertama, wallet pengirim, waktu, dan jumlah SOL awal.
- **Dashboard UI (`/wallet/{address}`)**: Tampilan responsive memuat Overview, Performance Cards, Behavior Stats, Holding Time Histogram, Trade History Table dengan filter, Token Performance Table, Activity Timeline, Initial Funding Card, dan Data Coverage Indicator.
- **Sync Status & Progress Tracking**: Status sinkronisasi real-time (`PENDING`, `SYNCING`, `PROCESSING`, `COMPLETED`, `FAILED`) dengan persentase progress.
- **Multi-Wallet Tracker (GMGN / Axiom Style)**:
  - **Bulk Import**: Mengimport banyak alamat wallet sekaligus via modal textarea dengan opsi auto-sync dan tag kustom.
  - **Watchlist Dashboard (`/`)**: Tabel pemantauan seluruh wallet yang disimpan di database, dilengkapi sorting (PnL, Win Rate, Last Active), inline label editing, status sync, dan aksi hapus/untrack.
  - **Aggregated Portfolio Overview**: Ringkasan metrik gabungan (Total Tracked Wallets, Combined Realized PnL, Combined Total PnL, Average Portfolio Win Rate, dan Top Performer).
  - **Live Multi-Wallet Trade Feed**: Stream transaksi terkini secara kronologis dari seluruh wallet yang sedang dipantau.

### 4.2 Out of Scope (Tahap 1 / Backlog Fase Lanjutan)
- Smart Money Composite Scoring (model tertimbang / machine learning).
- Wallet Clustering & Graph Database (Neo4j/Memgraph) untuk analisis relasi antar wallet.
- Bundle Detection & Sniping Detection.
- Fresh Wallet Detection & Whale Detection lintas supply token.
- Token Scanner / Token Explorer mandiri (hanya sebatas performa token pada wallet terkait).
- Copy Trading & Eksekusi Transaksi.
- AI Agent & Natural Language Chat Interface.
- Multi-chain support (Ethereum, Arbitrum, Base, BSC belum didukung di tahap 1).
- Social Sentiment & Twitter/X monitoring.
- Telegram / Discord Push Alerts.
- Infrastruktur terdistribusi berat (Kafka, RabbitMQ, Kubernetes, ClickHouse).

---

## 5. Functional Requirements

### 5.1 Ingestion & Data Fetching
- **FR-1.1**: Sistem harus memvalidasi format string alamat wallet Solana sebelum diproses. Jika invalid, kembalikan HTTP 400 Bad Request.
- **FR-1.2**: Sistem harus mengecek apakah wallet sudah tercatat di tabel `wallets`. Jika belum, sistem mendaftarkan wallet dan memicu background sync job.
- **FR-1.3**: Ingestion worker harus mengambil transaksi historis wallet dari RPC Solana menggunakan pagination (`before` signature) hingga mencapai batas transaksi atau genesis transaksi wallet.
- **FR-1.4**: Sistem harus menyimpan setiap transaksi yang berhasil diambil ke dalam tabel `transactions` dengan payload asli disimpan utuh pada kolom `raw_data` berformat JSONB.
- **FR-1.5**: Penyimpanan transaksi harus bersifat idempoten menggunakan `UNIQUE(tx_hash)`. Jika transaksi sudah ada, lakukan update atau skip tanpa duplikasi data.

### 5.2 Parsing & Trade Reconstruction
- **FR-2.1**: Parser harus membaca perubahan saldo token (*pre/post token balances*) dan saldo native SOL (*pre/post balances*) dari raw transaction.
- **FR-2.2**: Parser harus mengekstrak perpindahan aset ke dalam tabel `transfers` dengan mencatat arah (`IN` atau `OUT`), token address, jumlah, dan timestamp.
- **FR-2.3**: Swap Detector harus menganalisis transfer berpasangan dalam satu transaksi untuk mendeteksi penukaran (misal: SOL keluar dan Token SPL masuk = `BUY`; Token SPL keluar dan SOL/USDC masuk = `SELL`).
- **FR-2.4**: Jika transaksi memenuhi kriteria swap, sistem harus merekonstruksi satu atau lebih entri ke tabel `trades` dengan atribut: `side` (`BUY`/`SELL`), `token_amount`, `quote_amount`, `price`, `usd_value`, `market_cap` (bila tersedia), dan `dex`.
- **FR-2.5**: Jika transaksi bukan swap (misalnya transfer murni antar wallet atau reward airdrop tanpa quote exchange), klasifikasikan sebagai `TRANSFER`.
- **FR-2.6**: Jika instruksi transaksi tidak dapat dipahami oleh parser DEX yang didukung, sistem wajib menandai status transaksi sebagai `UNKNOWN` atau `UNPARSED` dan mencatat alasan kegagalan ke tabel `parser_errors`. Jangan membuang transaksi tersebut.

### 5.3 Position & PnL Engine
- **FR-3.1**: Sistem harus mengagregasi trade secara kronologis untuk membentuk entitas `positions` per pasangan `(wallet_id, token_id)`.
- **FR-3.2**: Sistem harus menggunakan metode **Weighted Average Cost Basis (WACB)** untuk menghitung `avg_entry_price` dan `total_cost_basis` ketika terjadi beberapa kali pembelian berturut-turut (*multiple entries*).
- **FR-3.3**: Ketika terjadi penjualan sebagian (*partial exit*), sistem harus merealisasikan PnL dari porsi yang terjual sesuai proporsi cost basis, serta mengurangi `quantity` dan `total_cost_basis` yang tersisa.
- **FR-3.4**: Ketika `quantity` mencapai 0, posisi harus ditandai dengan `status = 'CLOSED'` dan mencatat `closed_at`.
- **FR-3.5**: Realized PnL harus dihitung dengan rumus:
  $$\text{Realized PnL} = \text{Exit Value} - \text{Cost Basis Sold} - \text{Fees}$$
- **FR-3.6**: Unrealized PnL harus dihitung untuk posisi dengan `status = 'OPEN'` menggunakan harga terkini:
  $$\text{Unrealized PnL} = \text{Current Position Value} - \text{Remaining Cost Basis}$$
- **FR-3.7**: Total PnL harus dihitung sebagai:
  $$\text{Total PnL} = \text{Realized PnL} + \text{Unrealized PnL}$$
- **FR-3.8**: Win Rate harus dihitung secara eksklusif hanya dari closed trades/positions:
  $$\text{Win Rate} = \left(\frac{\text{Profitable Closed Positions}}{\text{Total Closed Positions}}\right) \times 100$$
  Posisi yang masih terbuka (`OPEN`) tidak boleh dimasukkan ke dalam perhitungan Win Rate.
- **FR-3.9**: Holding Time untuk setiap posisi yang telah ditutup harus dihitung sebagai selisih:
  $$\text{Holding Time} = \text{closed\_at} - \text{opened\_at}$$
  Sistem harus menghitung `average_hold_seconds` dan `median_hold_seconds` untuk setiap wallet.

### 5.4 Rule-Based Wallet Classification
- **FR-4.1**: Sistem harus mengklasifikasikan wallet ke dalam 4 dimensi menggunakan aturan threshold konfigurasi:
  1. **Performance Tier**:
     - `HIGHLY_PROFITABLE`: $\text{ROI} > 100\%$ DAN $\text{win\_rate} \ge 60\%$
     - `PROFITABLE`: $\text{ROI} > 20\%$ DAN $\text{win\_rate} \ge 50\%$
     - `BREAK_EVEN`: $-20\% \le \text{ROI} \le 20\%$
     - `UNPROFITABLE`: $\text{ROI} < -20\%$
     - `HIGHLY_UNPROFITABLE`: $\text{ROI} < -50\%$
     - *Guardrail*: Jika jumlah closed trades $< 5$, beri nilai `INSUFFICIENT_DATA`.
  2. **Trading Style**:
     - `SCALPER`: $\text{median\_hold} < 5\text{ menit}$
     - `SHORT_TERM_TRADER`: $5\text{ menit} \le \text{median\_hold} \le 2\text{ jam}$
     - `SWING_TRADER`: $2\text{ jam} < \text{median\_hold} \le 3\text{ hari}$
     - `HOLDER`: $\text{median\_hold} > 3\text{ hari}$
  3. **Capital Size Tier**:
     - `MICRO`: $\text{avg\_position\_size} < \$100$
     - `SMALL`: $\$100 \le \text{avg\_position\_size} \le \$1,000$
     - `MEDIUM`: $\$1,000 < \text{avg\_position\_size} \le \$10,000$
     - `LARGE`: $\$10,000 < \text{avg\_position\_size} \le \$100,000$
     - `VERY_LARGE`: $\text{avg\_position\_size} > \$100,000$
  4. **Activity Level**:
     - `INACTIVE`: Tidak ada trade dalam $> 30\text{ hari terakhir}$
     - `OCCASIONAL`: $< 1\text{ trade/hari aktif}$
     - `ACTIVE`: $1 - 10\text{ trade/hari aktif}$
     - `HIGH_FREQUENCY`: $> 10\text{ trade/hari aktif}$
- **FR-4.2**: Threshold klasifikasi harus disimpan dalam file konfigurasi (JSON/YAML) atau tabel konfigurasi terpisah, dan tidak boleh di-hardcode di dalam source code logic.
- **FR-4.3**: Klasifikasi dihitung dan diperbarui secara otomatis setiap kali metrik wallet dihitung ulang oleh worker, bukan dihitung on-demand saat API request dibaca.

### 5.5 Initial Funding Detection
- **FR-5.1**: Sistem harus mengidentifikasi transfer masuk pertama kali (`direction = 'IN'`) yang mendanai wallet dengan native SOL.
- **FR-5.2**: Sistem harus mengekstrak dan menyimpan tanggal pendanaan pertama (`first_seen_at`), saldo awal yang diterima, serta alamat wallet pengirim pertama (`first_funding_source`).

### 5.6 Data Quality & Coverage
- **FR-6.1**: Sistem harus melacak metrik kualitas data per wallet:
  - Jumlah total transaksi dianalisis.
  - Jumlah transaksi berhasil diparse.
  - Jumlah transaksi unparsed/unknown.
  - Persentase cakupan: $\text{Coverage \%} = (\text{Parsed} / \text{Total}) \times 100$.

### 5.7 User Interface & Visualization
- **FR-7.1**: Halaman `/wallet/{address}` harus menampilkan status sinkronisasi (`SYNCING`, `COMPLETED`, dll.) beserta visual progress bar saat sync berlangsung.
- **FR-7.2**: Header harus menampilkan alamat ringkas, umur wallet (*first seen*), aktivitas terakhir (*last active*), dan badge klasifikasi 4 dimensi.
- **FR-7.3**: Performance overview harus menampilkan kartu Realized PnL, Unrealized PnL, Total PnL, Win Rate, ROI, dan Total Trades.
- **FR-7.4**: Trading behavior section harus menyajikan metrik Median Hold, Average Hold, Average Position Size, Average Entry MC, dan Average Exit MC.
- **FR-7.5**: Visualisasi histogram/bar chart distribusi holding time dengan 7 bucket: `< 1m`, `1-5m`, `5-30m`, `30m-2h`, `2h-12h`, `12h-3d`, `> 3d`.
- **FR-7.6**: Tabel riwayat trade (*Trade History*) dengan pagination dan filtering berdasarkan: All, BUY, SELL, Profitable, Loss, Token, dan Date Range.
- **FR-7.7**: Tabel performa token (*Token Performance*) mengelompokkan trade per token dan menampilkan jumlah trade, modal diinvestasikan, realized PnL, ROI, dan rata-rata hold.
- **FR-7.8**: Activity timeline menampilkan kronologi aktivitas perdagangan wallet yang dikelompokkan berdasarkan hari (*Today*, *Yesterday*, *X days ago*).

---

## 6. Non-Functional Requirements

### 6.1 Accuracy & Precision
- Perhitungan kuantitas token dan nilai finansial (USD/SOL) **wajib menggunakan tipe data `NUMERIC` / Python `Decimal`**. Dilarang keras menggunakan floating point standar (`float`) untuk mencegah akumulasi *floating point precision errors*.
- Rekonstruksi trade harus menerapkan aturan idempotensi ketat pada kunci komposit `(tx_hash, wallet_id, token_id, side)`.

### 6.2 Performance & Latency
- Response time API untuk pembacaan dashboard `/api/wallet/{address}` harus berada di bawah **300 ms** (P95) karena seluruh data metrik sudah ter-precomputed di database.
- Database query pada tabel `trades` dan `positions` wajib memanfaatkan indeks komposit yang tepat agar pagination 50 item tetap instan pada wallet dengan $> 20.000$ transaksi.
- Proses background sync tidak boleh memblokir thread HTTP web server (arsitektur decoupled via async worker).

### 6.3 Reliability & Resilience
- Worker harus dilengkapi mekanisme *exponential backoff* dan *rate limiting handler* terhadap Solana RPC node untuk mencegah *HTTP 429 Too Many Requests*.
- Kegagalan parsing pada satu transaksi tidak boleh menggagalkan keseluruhan proses sync wallet. Transaksi bermasalah harus diisolasi ke `parser_errors`.

### 6.4 Maintainability
- Skema transaksi mentah (`raw_data JSONB`) wajib dipertahankan agar setiap pembaruan parser dapat diuji ulang menggunakan unit test berbasis payload historis nyata.
- Mengadopsi prinsip *Ponytail*: struktur kode monorepo ringkas, modul parser terisolasi, dan minimalisasi dependensi eksternal yang tidak diperlukan.

---

## 7. Use Cases & User Flows

### 7.1 UC-1: First-Time Wallet Search & Initial Sync
- **Actor**: Public User / Trader
- **Preconditions**: User membuka aplikasi web di browser.
- **Main Flow**:
  1. User memasukkan address Solana pada search bar di halaman utama (`/`).
  2. Frontend memvalidasi format Base58. Jika valid, navigasi ke `/wallet/{address}`.
  3. Frontend memanggil `GET /api/wallet/{address}`.
  4. Backend mengembalikan status 404 (wallet belum terdaftar).
  5. Frontend otomatis mengirim request `POST /api/wallet/{address}/sync`.
  6. Backend membuat record di `wallets` dan membuat job di `wallet_sync_jobs` dengan status `PENDING`.
  7. Background worker mengambil job, mengubah status menjadi `SYNCING`.
  8. Worker memanggil Solana RPC, mengambil historical transactions, dan menyimpannya ke `transactions`.
  9. Worker memparse transfer dan merekonstruksi trade (`PROCESSING`).
  10. Worker menghitung posisi, PnL, dan metrik wallet.
  11. Worker menandai job sebagai `COMPLETED`.
  12. Frontend melakukan polling ke `GET /api/wallet/{address}/sync-status` setiap 2 detik dan menampilkan progress bar.
  13. Setelah status `COMPLETED`, frontend memuat seluruh data dashboard secara penuh.
- **Alternative Flow (RPC Error)**:
  - Pada langkah 8, jika RPC limit tercapai setelah 5x retry, status job diubah menjadi `FAILED` dengan pesan error. Frontend menampilkan tombol *Retry Sync*.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Web as Next.js Web
    participant API as FastAPI Backend
    participant DB as PostgreSQL
    participant Worker as Python Worker
    participant RPC as Solana RPC

    User->>Web: Input Solana Address
    Web->>API: GET /api/wallet/{address}
    API->>DB: Query wallet
    DB-->>API: Not Found
    API-->>Web: 404 Not Found
    Web->>API: POST /api/wallet/{address}/sync
    API->>DB: Insert wallet & sync_job (PENDING)
    API-->>Web: 202 Accepted (job_id, status: PENDING)
    loop Polling Status (Every 2s)
        Web->>API: GET /api/wallet/{address}/sync-status
        API->>DB: Query job status & progress
        DB-->>API: Status (SYNCING / PROCESSING, %)
        API-->>Web: Progress JSON
        Web->>User: Update Progress Bar
    end
    Worker->>DB: Poll PENDING job
    Worker->>RPC: getSignaturesForAddress & getParsedTransaction
    RPC-->>Worker: Raw Transactions
    Worker->>DB: Bulk Insert `transactions` (raw_data)
    Worker->>Worker: Parse Transfers, Swaps & Trades
    Worker->>DB: Insert `transfers` & `trades`
    Worker->>Worker: Calculate Positions, PnL & Metrics
    Worker->>DB: Upsert `positions` & `wallet_metrics`
    Worker->>DB: Update job status = COMPLETED
    Web->>API: GET /api/wallet/{address}
    API->>DB: Query full metrics & classification
    DB-->>API: Wallet Data
    API-->>Web: 200 OK (Full Dashboard Data)
    Web->>User: Render Wallet Dashboard
```

### 7.2 UC-2: Inspecting Existing / Synced Wallet
- **Actor**: Public User / Trader
- **Preconditions**: Data wallet sudah pernah disinkronisasi sebelumnya.
- **Main Flow**:
  1. User membuka link `/wallet/{address}`.
  2. Frontend memanggil `GET /api/wallet/{address}`.
  3. Backend mengembalikan status wallet dan seluruh metrik yang telah di-precompute dari tabel `wallet_metrics`.
  4. Frontend langsung menampilkan Overview, Badge Klasifikasi, dan Performance Cards dalam waktu $< 300\text{ ms}$.
  5. Frontend memanggil endpoint data spesifik secara paralel:
     - `GET /api/wallet/{address}/trades?page=1&limit=50`
     - `GET /api/wallet/{address}/positions`
     - `GET /api/wallet/{address}/performance`
     - `GET /api/wallet/{address}/tokens`
     - `GET /api/wallet/{address}/funding`
  6. Seluruh widget dashboard terisi lengkap.

### 7.3 UC-3: Filtering Trade History & Token Breakdown
- **Actor**: Public User
- **Main Flow**:
  1. User memilih filter `Side = SELL` dan `Outcome = Profitable` pada tabel Trade History.
  2. Frontend mengirim query params: `GET /api/wallet/{address}/trades?side=SELL&profitable_only=true`.
  3. Backend mengeksekusi query terindeks dan mengembalikan list trade yang sesuai beserta metadata pagination.
  4. User mengklik salah satu baris token di tabel Token Performance.
  5. Tabel trade history otomatis terfilter untuk token tersebut.

---

## 8. System Architecture

Sistem dirancang dengan arsitektur monorepo modular yang memisahkan layer presentasi, layer API, worker asinkron, dan layer penyimpanan data.

```mermaid
graph TD
    subgraph External_Network [External Services]
        Solana_RPC["Solana RPC / Enhanced API<br/>(Helius / QuickNode / Public RPC)"]
    end

    subgraph Docker_Compose [Host / Docker Compose Environment]
        subgraph Web_Tier [Presentation Layer]
            Web["Next.js Web App<br/>(TypeScript, Tailwind CSS, shadcn/ui, Recharts)"]
        end

        subgraph API_Tier [API Service]
            FastAPI["FastAPI REST API<br/>(Python 3.11+, Pydantic, SQLAlchemy)"]
        end

        subgraph Worker_Tier [Background Data Processing]
            Fetcher["Wallet Fetcher Worker<br/>(Asyncio RPC Ingestion)"]
            Parser["TX & Trade Parser<br/>(DEX Swap & Transfer Engine)"]
            Engine["Position & PnL Engine<br/>(WACB, Metrics & Classification)"]
        end

        subgraph Data_Tier [Storage Layer]
            Postgres[("PostgreSQL 16<br/>- Wallets & Tokens<br/>- Raw Transactions JSONB<br/>- Trades & Positions<br/>- Metrics & Errors")]
        end
    end

    User(["User Browser"]) -->|HTTPS / UI| Web
    Web -->|HTTP / JSON| FastAPI
    FastAPI -->|SQL Queries| Postgres
    FastAPI -.->|Enqueue Sync Job| Postgres

    Fetcher -->|Pull Pending Jobs| Postgres
    Fetcher -->|RPC Calls| Solana_RPC
    Fetcher -->|Store Raw TX| Postgres

    Parser -->|Read Raw TX| Postgres
    Parser -->|Write Trades & Transfers| Postgres

    Engine -->|Read Trades| Postgres
    Engine -->|Write Positions, PnL & Metrics| Postgres
```

### 8.1 Repository Structure
Sesuai rancangan proyek pada `project.md`:
```text
wallet-intelligence/
├── apps/
│   ├── web/                    # Next.js 14+ App Router, Tailwind, shadcn/ui, Recharts
│   └── api/                    # FastAPI app, REST routers, schemas, dependencies
├── workers/
│   ├── fetcher/                # Solana RPC transaction ingestor
│   ├── parser/                 # Raw transaction to transfer & swap parser
│   ├── position_engine/        # Weighted average entry & position state builder
│   └── pnl_engine/             # Realized/Unrealized PnL, metrics & classification
├── packages/
│   ├── database/               # SQLAlchemy models, engine session, connection pool
│   └── types/                  # Shared domain types & schemas
├── migrations/                 # Alembic database migrations
├── scripts/                    # Maintenance & re-parsing scripts
├── docs/                       # Technical specs & documentation
├── docker-compose.yml          # Local container orchestration
└── README.md
```

---

## 9. Components & Data Flow

### 9.1 Data Processing Stages
Pipeline pemrosesan data berjalan dalam 8 tahap linier yang terisolasi:

```text
[1. Solana RPC]
       │ (JSON-RPC getSignaturesForAddress & getParsedTransaction)
       ▼
[2. Wallet Fetcher] ──> Validasi Base58, fetch batch transaksi, rate limiting backoff
       │
       ▼
[3. Raw TX Storage] ──> Simpan ke PostgreSQL `transactions` (tx_hash UNIQUE, raw_data JSONB)
       │
       ▼
[4. TX & Transfer Parser] ──> Ekstrak balances diff, SPL transfers, classify direction (IN/OUT)
       │
       ▼
[5. Swap Detector & Trade Reconstruction] ──> Match input/output aset DEX ──> `trades` (BUY/SELL)
       │                                     └── Ambigu? ──> Log ke `parser_errors` (UNKNOWN)
       ▼
[6. Position Engine] ──> Rekonstruksi kronologis per token, hitung WACB cost basis ──> `positions`
       │
       ▼
[7. PnL & Metrics Engine] ──> Hitung Realized PnL, Unrealized PnL, Win Rate, Holding Time ──> `wallet_metrics`
       │
       ▼
[8. Classification Engine] ──> Evaluasi rules terhadap `wallet_metrics` ──> Update badge klasifikasi
```

### 9.2 Modul Penjelasan

1. **Wallet Fetcher**:
   - Berfungsi menarik transaksi secara batch (misal 100 signature per RPC call).
   - Memastikan tidak ada signature yang terlewat dengan melakukan pagination mundur sampai `first_seen` tercapai.
   - Menggunakan format data RPC `jsonParsed` untuk memudahkan dekomposisi transaksi standar Solana SPL Token.
2. **Transaction Parser**:
   - Membandingkan `preTokenBalances` vs `postTokenBalances` serta `preBalances` vs `postBalances`.
   - Mengidentifikasi biaya transaksi (*gas fee*) yang dibayar oleh fee payer.
3. **Trade Parser (Swap Detector)**:
   - Mendeteksi interaksi dengan program ID DEX utama Solana (Raydium V4, Orca Whirlpool, Jupiter Aggregator).
   - Membedakan antara transfer non-ekonomi (transfer biasa antar wallet pribadi) dengan transaksi perdagangan (*swap*).
4. **Position Engine**:
   - Menjaga state akumulasi kuantitas token yang dimiliki wallet.
   - Mengakumulasi cost basis saat `BUY` dan melepas cost basis secara proporsional saat `SELL`.
5. **PnL & Metrics Engine**:
   - Menghitung statistik distribusi hold time: mean, median, minimum, maximum.
   - Mengagregasi metrik performa historis.

---

## 10. Database Design

Database relasional menggunakan **PostgreSQL 16**. Seluruh perhitungan finansial menggunakan kolom bertipe `NUMERIC`.

### 10.1 Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    wallets ||--o{ transactions : "has"
    wallets ||--o{ trades : "executes"
    wallets ||--o{ positions : "holds"
    wallets ||--|| wallet_metrics : "measured_by"
    wallets ||--o{ wallet_sync_jobs : "tracks"
    tokens ||--o{ trades : "traded_in"
    tokens ||--o{ positions : "held_as"
    transactions ||--o{ transfers : "contains"

    wallets {
        uuid id PK
        text address UK
        text chain
        timestamp first_seen_at
        timestamp last_seen_at
        timestamp created_at
        timestamp updated_at
    }

    tokens {
        uuid id PK
        text chain
        text address UK
        text symbol
        text name
        integer decimals
        timestamp first_seen_at
        timestamp created_at
    }

    transactions {
        uuid id PK
        text chain
        text tx_hash UK
        text wallet_address
        bigint block_number
        timestamp block_time
        boolean success
        jsonb raw_data
        timestamp created_at
    }

    transfers {
        uuid id PK
        uuid tx_id FK
        text wallet_address
        text token_address
        text direction
        numeric amount
        numeric usd_value
        timestamp timestamp
    }

    trades {
        uuid id PK
        uuid wallet_id FK
        uuid token_id FK
        text tx_hash
        timestamp timestamp
        text side
        numeric token_amount
        numeric quote_amount
        numeric price
        numeric usd_value
        numeric market_cap
        text dex
        timestamp created_at
    }

    positions {
        uuid id PK
        uuid wallet_id FK
        uuid token_id FK
        numeric quantity
        numeric avg_entry_price
        numeric total_cost_basis
        numeric realized_pnl
        numeric unrealized_pnl
        numeric roi
        timestamp opened_at
        timestamp last_trade_at
        timestamp closed_at
        text status
    }

    wallet_metrics {
        uuid wallet_id PK,FK
        integer trade_count
        integer winning_trades
        integer losing_trades
        numeric win_rate
        numeric realized_pnl
        numeric unrealized_pnl
        numeric total_pnl
        numeric roi
        numeric avg_trade_pnl
        numeric avg_win
        numeric avg_loss
        numeric profit_factor
        bigint avg_hold_seconds
        bigint median_hold_seconds
        numeric max_drawdown
        text performance_tier
        text trading_style
        text capital_tier
        text activity_level
        timestamp classified_at
        timestamp updated_at
    }

    wallet_sync_jobs {
        uuid id PK
        uuid wallet_id FK
        text status
        integer total_transactions
        integer parsed_transactions
        integer reconstructed_trades
        numeric progress_percentage
        text error_message
        timestamp started_at
        timestamp completed_at
        timestamp created_at
    }

    parser_errors {
        uuid id PK
        text tx_hash
        text wallet_address
        text status
        text reason
        jsonb context
        timestamp created_at
    }
```

### 10.2 Table Schemas & DDL

```sql
-- 1. Wallets
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address TEXT NOT NULL UNIQUE,
    chain TEXT NOT NULL DEFAULT 'solana',
    first_seen_at TIMESTAMP WITH TIME ZONE,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_wallets_address ON wallets(address);

-- 2. Tokens
CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain TEXT NOT NULL DEFAULT 'solana',
    address TEXT NOT NULL,
    symbol TEXT,
    name TEXT,
    decimals INTEGER DEFAULT 9,
    first_seen_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chain, address)
);
CREATE INDEX idx_tokens_address ON tokens(address);

-- 3. Raw Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain TEXT NOT NULL DEFAULT 'solana',
    tx_hash TEXT NOT NULL UNIQUE,
    wallet_address TEXT NOT NULL,
    block_number BIGINT,
    block_time TIMESTAMP WITH TIME ZONE,
    success BOOLEAN DEFAULT TRUE,
    raw_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_transactions_wallet_time ON transactions(wallet_address, block_time DESC);
CREATE INDEX idx_transactions_tx_hash ON transactions(tx_hash);

-- 4. Transfers
CREATE TABLE transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    token_address TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('IN', 'OUT')),
    amount NUMERIC(36, 18) NOT NULL,
    usd_value NUMERIC(20, 4),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_transfers_wallet_time ON transfers(wallet_address, timestamp DESC);

-- 5. Trades
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE RESTRICT,
    tx_hash TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
    token_amount NUMERIC(36, 18) NOT NULL,
    quote_amount NUMERIC(36, 18) NOT NULL,
    price NUMERIC(36, 18),
    usd_value NUMERIC(20, 4),
    market_cap NUMERIC(24, 2),
    dex TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_trade_event UNIQUE (tx_hash, wallet_id, token_id, side)
);
CREATE INDEX idx_trades_wallet_time ON trades(wallet_id, timestamp DESC);
CREATE INDEX idx_trades_wallet_token ON trades(wallet_id, token_id);

-- 6. Positions
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE RESTRICT,
    quantity NUMERIC(36, 18) NOT NULL DEFAULT 0,
    avg_entry_price NUMERIC(36, 18),
    total_cost_basis NUMERIC(20, 4) DEFAULT 0,
    realized_pnl NUMERIC(20, 4) DEFAULT 0,
    unrealized_pnl NUMERIC(20, 4) DEFAULT 0,
    roi NUMERIC(10, 4),
    opened_at TIMESTAMP WITH TIME ZONE,
    last_trade_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_positions_wallet_status ON positions(wallet_id, status);
CREATE INDEX idx_positions_wallet_token ON positions(wallet_id, token_id);

-- 7. Wallet Metrics
CREATE TABLE wallet_metrics (
    wallet_id UUID PRIMARY KEY REFERENCES wallets(id) ON DELETE CASCADE,
    trade_count INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    win_rate NUMERIC(6, 2) DEFAULT 0,
    realized_pnl NUMERIC(20, 4) DEFAULT 0,
    unrealized_pnl NUMERIC(20, 4) DEFAULT 0,
    total_pnl NUMERIC(20, 4) DEFAULT 0,
    roi NUMERIC(10, 4) DEFAULT 0,
    avg_trade_pnl NUMERIC(20, 4),
    avg_win NUMERIC(20, 4),
    avg_loss NUMERIC(20, 4),
    profit_factor NUMERIC(10, 4),
    avg_hold_seconds BIGINT,
    median_hold_seconds BIGINT,
    max_drawdown NUMERIC(8, 4),
    performance_tier TEXT,
    trading_style TEXT,
    capital_tier TEXT,
    activity_level TEXT,
    classified_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Wallet Sync Jobs
CREATE TABLE wallet_sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'SYNCING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    total_transactions INTEGER DEFAULT 0,
    parsed_transactions INTEGER DEFAULT 0,
    reconstructed_trades INTEGER DEFAULT 0,
    progress_percentage NUMERIC(5, 2) DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_sync_jobs_wallet_created ON wallet_sync_jobs(wallet_id, created_at DESC);

-- 9. Parser Errors
CREATE TABLE parser_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_hash TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PARSED', 'UNPARSED', 'FAILED', 'UNKNOWN')),
    reason TEXT,
    context JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_parser_errors_wallet ON parser_errors(wallet_address);
```

---

## 11. API / Interface Design

Base URL: `/api`  
Framework: FastAPI  
Data Format: `application/json`

### 11.1 Endpoints Summary

| Method | Endpoint | Deskripsi |
|---|---|---|
| `POST` | `/api/wallet/{address}/sync` | Memicu sinkronisasi data historis wallet |
| `GET` | `/api/wallet/{address}/sync-status` | Mengecek status dan progress sinkronisasi |
| `GET` | `/api/wallet/{address}` | Ringkasan wallet, metrik utama, dan klasifikasi |
| `GET` | `/api/wallet/{address}/trades` | Riwayat transaksi perdagangan (dengan pagination & filter) |
| `GET` | `/api/wallet/{address}/positions` | Daftar posisi wallet (OPEN dan CLOSED) |
| `GET` | `/api/wallet/{address}/performance` | Detail metrik performa dan distribusi holding time |
| `GET` | `/api/wallet/{address}/tokens` | Rekapitulasi performa per token |
| `GET` | `/api/wallet/{address}/funding` | Data pendanaan awal (*Initial Funding*) |

---

### 11.2 Endpoint Specifications

#### 1. Trigger Wallet Sync
- **Request**: `POST /api/wallet/{address}/sync`
- **Response `202 Accepted`**:
```json
{
  "job_id": "7f13dc8e-9c1e-4c74-9844-325d7b5f1280",
  "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "status": "PENDING",
  "message": "Wallet sync job initiated successfully."
}
```

#### 2. Get Sync Status
- **Request**: `GET /api/wallet/{address}/sync-status`
- **Response `200 OK`**:
```json
{
  "status": "PROCESSING",
  "progress_percentage": 67.5,
  "total_transactions": 18240,
  "parsed_transactions": 12312,
  "reconstructed_trades": 2841,
  "error_message": null,
  "started_at": "2026-09-25T03:00:12Z",
  "completed_at": null
}
```

#### 3. Get Wallet Overview
- **Request**: `GET /api/wallet/{address}`
- **Response `200 OK`**:
```json
{
  "address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "chain": "solana",
  "first_seen_at": "2026-05-28T09:12:00Z",
  "last_active_at": "2026-09-25T02:56:00Z",
  "metrics": {
    "trade_count": 487,
    "winning_trades": 333,
    "losing_trades": 154,
    "win_rate": 68.38,
    "realized_pnl": 284120.50,
    "unrealized_pnl": 37210.00,
    "total_pnl": 321330.50,
    "roi": 184.25,
    "avg_trade_pnl": 583.41,
    "avg_position_size": 1842.00,
    "avg_entry_mc": 420000.00,
    "avg_exit_mc": 1800000.00,
    "median_hold_seconds": 15420,
    "avg_hold_seconds": 41520
  },
  "classification": {
    "performance_tier": "PROFITABLE",
    "trading_style": "SWING_TRADER",
    "capital_tier": "MEDIUM",
    "activity_level": "ACTIVE"
  },
  "coverage": {
    "transactions_analyzed": 18240,
    "successfully_parsed": 17921,
    "unparsed": 319,
    "coverage_percentage": 98.25
  }
}
```

#### 4. Get Wallet Trades
- **Request**: `GET /api/wallet/{address}/trades?page=1&limit=50&side=SELL&token=XYZ&from=2026-09-01&to=2026-09-25`
- **Response `200 OK`**:
```json
{
  "page": 1,
  "limit": 50,
  "total_records": 142,
  "items": [
    {
      "id": "e2f4a132-9a3b-489e-b7d1-137bfa2b3c41",
      "tx_hash": "5Knm...31aB",
      "timestamp": "2026-09-25T01:40:00Z",
      "side": "SELL",
      "token": {
        "address": "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
        "symbol": "XYZ",
        "name": "XYZ Token"
      },
      "token_amount": 100000.0,
      "quote_amount": 8.0,
      "price": 0.012,
      "usd_value": 1200.00,
      "market_cap": 1900000.00,
      "dex": "Raydium",
      "realized_pnl": 950.00,
      "hold_duration_seconds": 10800
    }
  ]
}
```

#### 5. Get Wallet Performance & Holding Distribution
- **Request**: `GET /api/wallet/{address}/performance`
- **Response `200 OK`**:
```json
{
  "holding_time_distribution": [
    { "bucket": "< 1m", "count": 45 },
    { "bucket": "1-5m", "count": 68 },
    { "bucket": "5-30m", "count": 120 },
    { "bucket": "30m-2h", "count": 82 },
    { "bucket": "2h-12h", "count": 110 },
    { "bucket": "12h-3d", "count": 42 },
    { "bucket": "3d+", "count": 20 }
  ],
  "pnl_summary": {
    "realized_pnl": 284120.50,
    "unrealized_pnl": 37210.00,
    "total_pnl": 321330.50,
    "profit_factor": 2.45,
    "win_rate": 68.38
  }
}
```

#### 6. Get Initial Funding
- **Request**: `GET /api/wallet/{address}/funding`
- **Response `200 OK`**:
```json
{
  "first_seen_at": "2026-05-28T09:12:00Z",
  "initial_balance_sol": 12.4,
  "first_funding_source": "9wFF...8aBc",
  "initial_funding_tx": "3Xyz...99qP"
}
```

---

## 12. Authentication & Authorization

- **Public Analytics Tier (Tahap 1 MVP)**: Seluruh endpoint data bersifat *read-only* publik tanpa memerlukan user authentication (login/register). Siapapun dapat menganalisis wallet publik.
- **Sync Trigger Protection**: Endpoint `POST /api/wallet/{address}/sync` diproteksi menggunakan **Rate Limiting** (misal: maksimal 3 request per IP per menit) untuk mencegah spam trigger yang menghabiskan kuota RPC eksternal.
- **Internal Workers**: Komunikasi antara background worker dan database bersifat privat di dalam jaringan Docker internal menggunakan kredensial PostgreSQL yang aman.

---

## 13. Security

- **Strict Input Validation**: Validasi format alamat wallet Solana secara ketat di layer HTTP menggunakan validator Pydantic (`base58 regex: ^[1-9A-HJ-NP-za-km-z]{32,44}$`). Alamat yang tidak valid ditolak sebelum menyentuh database atau RPC.
- **No Private Keys Stored**: Aplikasi ini murni analitik data publik on-chain. Sistem tidak pernah meminta, menyimpan, atau memproses *private keys* atau *seed phrases*.
- **SQL Injection Prevention**: Menggunakan ORM (SQLAlchemy) dengan parameterized queries secara penuh; tidak ada raw string concatenation dalam query database.
- **Precision Security**: Menggunakan tipe data `NUMERIC` di database dan objek `Decimal` di Python guna mencegah kerentanan pembulatan nilai finansial atau eksploitasi selisih pecahan koin.
- **CORS Configuration**: Mengunci konfigurasi CORS backend hanya untuk domain frontend yang diizinkan (pada mode dev: `http://localhost:3000`).

---

## 14. Performance & Scalability

### 14.1 Database Optimization
- **Index Komposit**:
  - `transactions(wallet_address, block_time DESC)`: Mempercepat lookup pagination riwayat transaksi mentah.
  - `trades(wallet_id, timestamp DESC)`: Mempercepat rendering timeline dan filtering tabel trade.
  - `positions(wallet_id, status)`: Mempercepat pemisahan posisi open dan closed.
- **Precomputed Metrics**: Halaman dashboard tidak menjalankan agregasi berat (`SUM`, `AVG`, `MEDIAN`) saat di-request. Seluruh metrik diagregasi dan disimpan di tabel `wallet_metrics` setiap kali worker menyelesaikan siklus kalkulasi.

### 14.2 Network & RPC Efficiency
- **Batch RPC Calls**: Menggunakan `getMultipleAccounts` atau batch fetching signature untuk meminimalkan round-trip HTTP ke Solana RPC node.
- **Pagination Strategy**: Menggunakan keyset pagination (`before` transaction signature) alih-alih offset pagination yang lambat pada data transaksi berjumlah puluhan ribu.

---

## 15. Reliability & Error Handling

### 15.1 Idempotency & Replayability
- **Constraint-Based Deduplication**: Tabel `trades` memiliki constraint `UNIQUE(tx_hash, wallet_id, token_id, side)` dan `transactions` memiliki `UNIQUE(tx_hash)`. Jika worker mengalami crash dan melakukan re-run, transaksi tidak akan tercatat ganda.
- **Safe Re-parsing**: Karena `raw_data` disimpan di tabel `transactions`, jika ada bug pada logika parser DEX, pengembang dapat menjalankan script:
  $$\text{Raw Transactions} \longrightarrow \text{Parser v2} \longrightarrow \text{Recalculate Positions \& PnL}$$
  tanpa membebani kuota RPC blockchain.

### 15.2 Parser Failure Containment
- Transaksi dengan program instruksi yang belum didukung atau format instruksi tidak dikenal diberi label `UNKNOWN` / `UNPARSED` dan dicatat ke tabel `parser_errors`.
- Transaksi gagal tidak membatalkan pemrosesan transaksi lainnya; sistem tetap menghitung metrik dari transaksi yang berhasil diparse dan menampilkan persentase *Data Coverage* kepada pengguna secara jujur di dashboard.

---

## 16. Deployment & Operations

### 16.1 Local Development (Docker Compose)
Target biaya pengembangan adalah **$0** menggunakan free-tier RPC provider dan local docker stack:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: wallet_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
      POSTGRES_DB: wallet_intelligence
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: wallet_api
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:postgrespassword@postgres:5432/wallet_intelligence
      SOLANA_RPC_URL: ${SOLANA_RPC_URL}
    ports:
      - "8000:8000"
    depends_on:
      - postgres

  worker:
    build:
      context: .
      dockerfile: workers/Dockerfile
    container_name: wallet_worker
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:postgrespassword@postgres:5432/wallet_intelligence
      SOLANA_RPC_URL: ${SOLANA_RPC_URL}
    depends_on:
      - postgres

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    container_name: wallet_web
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    ports:
      - "3000:3000"
    depends_on:
      - api

volumes:
  postgres_data:
```

### 16.2 Environment Variables
```ini
# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com  # Atau endpoint Helius / QuickNode Free Tier

# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgrespassword@localhost:5432/wallet_intelligence

# Application Settings
LOG_LEVEL=INFO
CLASSIFICATION_CONFIG_PATH=./config/classification_thresholds.json
RATE_LIMIT_SYNC_PER_MINUTE=3
```

---

## 17. Constraints & Technical Decisions

| Keputusan Teknis | Pilihan | Alternatif yang Ditolak | Alasan / Rationale (Ponytail Principle) |
|---|---|---|---|
| **Blockchain Pertama** | Solana-First | Ethereum, EVM Multi-chain | Ekosistem meme coin dan volume swap per wallet di Solana sangat tinggi, menjadikannya lingkungan ideal untuk menguji trade reconstruction dan PnL engine. Menghindari premature multi-chain abstraction. |
| **Penyimpanan Transaksi Mentah** | PostgreSQL `JSONB` | S3 Object Store / MongoDB | Sederhana, zero external setup tambahan. PostgreSQL JSONB sudah sangat mumpuni untuk menyimpan ribuan payload JSON transaksi per wallet secara terindeks dan ACID-compliant. |
| **Metode Cost Basis** | Weighted Average Cost Basis (WACB) | First-In-First-Out (FIFO) / LIFO | WACB adalah standar paling intuitif untuk kalkulasi spot trading crypto di mana trader sering melakukan akumulasi bertahap (*DCA*). Perhitungan jauh lebih efisien dalam database dibandingkan melacak lot inventory individual FIFO. |
| **Metrik Holding Time** | Median Hold Time sebagai acuan utama | Average (Mean) Hold Time | Holding time trading meme coin memiliki distribusi sangat miring (*skewed*) dengan outlier berhari-hari. Nilai mean akan terdistorsi secara drastis, sedangkan median memberikan gambaran gaya trading yang sebenarnya. |
| **Klasifikasi Wallet** | Rule-Based Tagging (Configurable Threshold) | Machine Learning / Composite Scoring / Clustering | YAGNI (You Aren't Gonna Need It) di Tahap 1. Rule-based eksplisit, transparan, tidak membutuhkan training data, dan dapat diubah langsung melalui config file tanpa re-deploy code. |
| **Task Queue / Worker** | Simple Asyncio Database Job Queue | Kafka / Celery + Redis / RabbitMQ | Menghindari kompleksitas operasional infrastruktur. Tabel `wallet_sync_jobs` dengan status locking sudah lebih dari cukup untuk menangani antrean single-instance MVP. |

---

## 18. Edge Cases & Mitigations

1. **Airdrop & Spam Tokens**:
   - *Kasus*: Wallet menerima token gratis tanpa mengeluarkan SOL/USDC (transfer masuk murni).
   - *Penanganan*: Ditandai sebagai `TRANSFER` (IN), bukan `BUY`. Biaya perolehan (*cost basis*) dianggap $0. Ketika token tersebut dijual, seluruh nilai penjualan menjadi realized profit.
2. **Multi-Hop / DEX Aggregator Swaps (Jupiter)**:
   - *Kasus*: Satu transaksi swap Jupiter dapat melibatkan rute bertingkat (misal: SOL $\to$ USDC $\to$ MEME) dengan puluhan instruksi transfer perantara.
   - *Penanganan*: Swap detector membandingkan *net change* aset wallet pada level transaksi keseluruhan: token apa yang berkurang bersih dari wallet (`Spent`) dan token apa yang bertambah bersih (`Received`).
3. **Wrap & Unwrap Native SOL**:
   - *Kasus*: Konversi SOL ke WSOL (Wrapped SOL) atau sebaliknya.
   - *Penanganan*: Dideteksi sebagai utility transfer 1:1, tidak dicatat sebagai aktivitas trading `BUY`/`SELL`.
4. **Token Balance Dust (Sisa Desimal Sangat Kecil)**:
   - *Kasus*: Akibat pembulatan desimal, posisi menyisakan sisa token mikroskopis (misal: $0.000000001$ token bernilai $<\$0.0001$).
   - *Penanganan*: Tetapkan threshold penutupan posisi: jika nilai sisa posisi $<\$0.01$, posisi otomatis dianggap `CLOSED` untuk mencegah posisi menggantung tak terbatas.
5. **Transaksi Gagal di Blockchain**:
   - *Kasus*: Transaksi Solana berstatus `err != null` atau `success = false`.
   - *Penanganan*: Disimpan di tabel `transactions` untuk audit trail, tetapi diabaikan oleh Trade Parser sehingga tidak mempengaruhi PnL atau posisi.
6. **Data Minim untuk Klasifikasi**:
   - *Kasus*: Wallet hanya memiliki 1-2 trade yang ditutup.
   - *Penanganan*: Sistem memberikan badge `INSUFFICIENT_DATA` pada Performance Tier, bukan memaksakan label `PROFITABLE` atau `UNPROFITABLE`.

---

## 19. Acceptance Criteria (Definition of Done)

Tahap 1 MVP dianggap selesai dan siap rilis jika seluruh kriteria berikut terpenuhi:

### 19.1 Wallet & Ingestion
- [ ] User dapat menginput wallet address Solana dan divalidasi dengan benar.
- [ ] Sistem berhasil menarik transaksi historis dari Solana RPC dan menyimpannya ke tabel `transactions`.
- [ ] Payload JSONB mentah tersimpan utuh dan idempoten (`tx_hash UNIQUE`).
- [ ] Job status menampilkan progress yang akurat (`PENDING` $\to$ `SYNCING` $\to$ `PROCESSING` $\to$ `COMPLETED`).

### 19.2 Parsing & Trade Reconstruction
- [ ] Transfer SPL token dan native SOL berhasil diekstrak ke tabel `transfers`.
- [ ] Swap berhasil dideteksi dan direkonstruksi menjadi trade `BUY` dan `SELL`.
- [ ] Transaksi non-swap berhasil diklasifikasikan sebagai `TRANSFER` atau `UNKNOWN`.
- [ ] Transaksi yang gagal diparse tercatat rapi pada `parser_errors` tanpa menghentikan worker.

### 19.3 Position & PnL Engine
- [ ] Posisi berhasil dibangun dengan kalkulasi *Weighted Average Cost Basis* yang benar untuk multi-buy.
- [ ] Partial sell memperhitungkan pengurangan cost basis dan menghasilkan *Realized PnL* yang akurat.
- [ ] Full sell mengubah status posisi menjadi `CLOSED` dan menghitung holding time yang tepat.
- [ ] *Unrealized PnL* terhitung untuk posisi berstatus `OPEN`.
- [ ] *Win Rate* terhitung secara akurat dan **hanya melibatkan posisi yang sudah ditutup**.
- [ ] Metrik holding time menghasilkan nilai average dan median yang benar.

### 19.4 Classification & Rules
- [ ] Keempat dimensi klasifikasi (Performance, Style, Capital, Activity) terhitung otomatis saat sync selesai.
- [ ] Nilai threshold dapat dikonfigurasi melalui file config eksternal tanpa redeploy.
- [ ] Badge klasifikasi tampil di dashboard sesuai hasil kalkulasi metrik.

### 19.5 Dashboard & Visualization
- [ ] Halaman `/wallet/{address}` menampilkan Wallet Overview (alamat, first seen, last active, classification badges).
- [ ] Performance Overview menampilkan Realized PnL, Unrealized PnL, Total PnL, Win Rate, ROI, dan Total Trades.
- [ ] Trading behavior section menampilkan Median/Average Hold, Average Position Size, Entry/Exit MC.
- [ ] Chart distribusi holding time merender visualisasi batang pada 7 rentang waktu.
- [ ] Tabel Trade History memiliki pagination dan fungsi filter (All, BUY, SELL, Profitable, Loss, Token, Date).
- [ ] Tabel Token Performance menampilkan agregasi trade per token.
- [ ] Activity timeline menampilkan urutan kronologis trade per hari.
- [ ] Card Initial Funding menampilkan tanggal pertama, saldo awal, dan sumber pengirim pertama.
- [ ] Banner Data Coverage menampilkan persentase transaksi yang berhasil diparse.

### 19.6 Quality & Testing
- [ ] Unit test parser mencakup kasus swap Raydium, Orca, dan Jupiter.
- [ ] Unit test position engine memverifikasi skenario multi-entry, partial exit, dan complete exit.
- [ ] Unit test PnL memverifikasi keakuratan kalkulasi matematis tanpa floating point error.

---

## 20. TODO / Open Questions

| Item | Tipe | Deskripsi / Pertanyaan | Rencana Resolusi |
|---|---|---|---|
| **Price Oracle untuk Unrealized PnL** | TODO | Posisi terbuka membutuhkan harga token terkini untuk menghitung `unrealized_pnl`. API publik apa yang akan digunakan untuk fetching token price secara gratis dan reliable? | Direkomendasikan menggunakan Jupiter Price API v2 atau DexScreener API (free endpoint). |
| **Realtime Sync / Websocket** | TODO | Setelah initial sync selesai, bagaimana mekanisme mendengarkan transaksi baru secara realtime? | Tahap 1 dapat menggunakan polling periodik (misal setiap 60 detik) untuk wallet aktif, sebelum mengimplementasikan Solana WebSocket `logsSubscribe` atau Helius Webhook di Tahap 2. |
| **DEX Program IDs Scope** | OPEN QUESTION | Apakah parser tahap 1 cukup mendukung Raydium V4, Orca Whirlpool, dan Pump.fun bonding curves? | Ya, ketiga protokol ini mencakup $> 85\%$ volume meme trading di Solana saat ini. |
| **Historical Price Quote** | OPEN QUESTION | Untuk trade lama di mana quote token bukan SOL atau USDC, dari mana data konversi USD historis diambil? | Gunakan konversi nilai SOL pada timestamp block time yang bersangkutan jika quote token adalah SOL. |
