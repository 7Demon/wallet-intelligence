# Wallet Intelligence — Solana On-Chain Trader Analytics & Engine

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_14+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js_15-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Solana](https://img.shields.io/badge/Network-Solana_Mainnet-14F195?logo=solana&logoColor=black)](https://solana.com/)
[![Coverage](https://img.shields.io/badge/Coverage-98%25+-brightgreen)](#)

> **Wallet Intelligence** adalah mesin analitik on-chain presisi tinggi yang merekonstruksi data riwayat transaksi mentah Solana menjadi metrik kinerja trader (*PnL, Win Rate, ROI, Holding Duration*) secara transparan melalui standar akuntansi **Weighted Average Cost Basis (WACB)**.

Dokumentasi interaktif visual dengan simulator WACB dan explorer skema database tersedia di file lokal:
👉 [`wallet_intelligence_interactive_documentation.html`](file:///D:/PROJECTS/analyzer/wallet_intelligence_interactive_documentation.html)

---

## 📑 Daftar Isi

- [Fitur Utama & Metrik Inti](#-fitur-utama--metrik-inti)
- [4 Pilar Desain Sistem](#-4-pilar-desain-sistem)
- [Arsitektur Sistem & Data Pipeline](#-arsitektur-sistem--data-pipeline)
  - [Topologi 3-Layer](#topologi-3-layer)
  - [5 Tahap Pipeline Asinkron](#5-tahap-pipeline-asinkron)
- [Model Akuntansi WACB (Weighted Average Cost Basis)](#-model-akuntansi-wacb)
- [Skema Basis Data (PostgreSQL)](#-skema-basis-data-postgresql)
- [Matriks Klasifikasi Profil Trader (4 Dimensi)](#-matriks-klasifikasi-profil-trader)
- [Spesifikasi REST API](#-spesifikasi-rest-api)
- [Panduan Instalasi & Menjalankan](#-panduan-instalasi--menjalankan)
- [Panduan Developer (Change Map)](#-panduan-developer-change-map)
- [Pengujian](#-pengujian)

---

## ⚡ Fitur Utama & Metrik Inti

| Metrik / Fitur | Spesifikasi | Keterangan |
| :--- | :--- | :--- |
| **Ingestion Throughput** | 25 Tx / Batch | Batch JSON-RPC paralel dengan *exponential backoff* terhadap rate-limit (HTTP 429). |
| **Model Akuntansi** | WACB Standard | Akuntansi harga pokok rata-rata tertimbang, mendukung *partial exit* & akumulasi DCA. |
| **Holding Time Metric** | Median Holding Duration | Menghitung durasi simpan posisi berbasis median untuk mengeliminasi bias outlier ekstrem. |
| **Auditability & Arsip** | Raw JSONB di PostgreSQL | Data transaksi mentah disimpan permanen; re-parse riwayat transaksi tanpa membebani kuota RPC. |
| **Kompensasi Biaya Gas** | Fee-Payer Neutralization | Otomatis menetralkan gas fee pada `preBalances` vs `postBalances` agar kalkulasi nilai perdagangan murni. |
| **Multi-DEX Detection** | Raydium, Orca, Jupiter, Pump.fun | Rekonstruksi arah swap (BUY vs SELL) otomatis berdasarkan arah pergerakan token vs quote asset. |

---

## 🏛️ 4 Pilar Desain Sistem

1. **Engine First, Dashboard Last**  
   Prioritas utama terletak pada integritas data, rekonsiliasi saldo, dan auditabilitas kalkulasi PnL di atas sekadar visualisasi dashboard.
2. **Kebenaran di Atas Asumsi**  
   Transaksi *multi-hop* atau DEX tak dikenal ditandai sebagai `UNKNOWN` dan dicatat ke tabel `parser_errors` untuk diinspeksi secara deterministik, tanpa asumsi tebakan liar.
3. **100% Reproducibility**  
   Seluruh payload mentah dari node Solana RPC diarsipkan dalam kolom `transactions.raw_data` (JSONB). Saat parser diperbarui, riwayat dapat diproses ulang 100% offline.
4. **Lean Zero-Cost Architecture**  
   Arsitektur ramping tanpa dependensi broker berat (tanpa Kafka, tanpa ClickHouse). Berjalan efisien menggunakan **FastAPI**, **PostgreSQL (asyncpg)**, dan **Next.js**.

---

## 🏗️ Arsitektur Sistem & Data Pipeline

### Topologi 3-Layer

```
[ Next.js 15 Web UI (:3000) ]  <--->  [ FastAPI REST API (:8000) ]
                                              │ (BackgroundTasks)
                                              ▼
                             [ Asynchronous Worker Engine ]
                                 ├── A. Solana RPC Ingestion (Batch 25 tx)
                                 ├── B. Transfer Parser (Net Delta + Fee Comp)
                                 ├── C. DEX Swap Detector (BUY / SELL)
                                 ├── D. WACB Position Engine (Cost Basis)
                                 └── E. PnL Engine & Classifier (4 Badges)
                                              │
                       ┌──────────────────────┴──────────────────────┐
                       ▼                                             ▼
          [ PostgreSQL 14+ (asyncpg) ]                   [ External Ecosystem ]
          • wallets       • trades                       • Solana RPC (Helius/QuickNode)
          • transactions  • positions                    • Price Oracles (Jupiter V2 / DEX)
          • transfers     • wallet_metrics
                          • parser_errors
```

### 5 Tahap Pipeline Asinkron

1. **Tahap 01: RPC Batch Ingestion** (`workers/fetcher/solana_client.py`)  
   Mengambil signature via `getSignaturesForAddress`, lalu memanggil `getParsedTransactions` secara batch (hingga 25 instruksi). Dilengkapi retry logic dengan *exponential backoff* jika terkena limit rate 429.
2. **Tahap 02: Balance Diff & Fee Compensation** (`workers/parser/transfer_parser.py`)  
   Membandingkan `preBalances` vs `postBalances` untuk SOL native dan token SPL. Bila wallet bertindak sebagai *fee payer* (`accountKeys[0]`), gas fee ditambahkan kembali untuk mengisolasi mutasi perdagangan murni:
   $$\text{net\_sol} = \frac{\text{post\_balance} - \text{pre\_balance}}{10^9} + \frac{\text{tx\_fee}}{10^9}$$
3. **Tahap 03: Swap Detector & Trade Reconstruction** (`workers/parser/swap_detector.py`)  
   Mengenali Program ID DEX utama (Raydium V4/CPMM/CLMM, Orca Whirlpool, Jupiter Aggregator, Pump.fun). Mengklasifikasikan arah perdagangan:
   - Quote OUT + Token IN $\rightarrow$ **BUY**
   - Token OUT + Quote IN $\rightarrow$ **SELL**
   - Perpindahan sepihak $\rightarrow$ **TRANSFER**
4. **Tahap 04: WACB Ledger & Position Engine** (`workers/position_engine/position_builder.py`)  
   Mengakumulasikan modal masuk ke dalam harga beli rata-rata (*Weighted Average Entry*). Saat terjadi *partial exit*, modal pokok dilepas secara proporsional dan sisa posisi diperbarui. Saldo $\le 0.0000001$ otomatis ditandai `CLOSED`.
5. **Tahap 05: PnL Engine & Profiling Matrix** (`workers/pnl_engine/pnl_calculator.py`)  
   Mengambil harga pasar live melalui Jupiter Price V2 API (fallback ke DexScreener). Menghitung Win Rate posisi tertutup, median holding time, dan menyematkan 4 lencana profil trader ke `wallet_metrics`.

---

## 🧮 Model Akuntansi WACB

Weighted Average Cost Basis (WACB) memastikan kalkulasi keuntungan/kerugian terealisasi (*Realized PnL*) akurat saat seorang trader melakukan akumulasi bertahap (DCA) dan penjualan parsial.

### 1. Akumulasi Pembelian (BUY)
Saat membeli tambahan token:
$$\text{Avg Entry Baru} = \frac{\text{Cost Basis Lama} + (\text{Qty Beli} \times \text{Harga Beli})}{\text{Qty Lama} + \text{Qty Beli}}$$
$$\text{Cost Basis Total} = \text{Cost Basis Lama} + (\text{Qty Beli} \times \text{Harga Beli})$$

### 2. Penjualan Parsial (SELL)
Saat menjual sebagian token:
$$\text{Cost Basis Dilepas} = \text{Qty Jual} \times \text{Avg Entry Saat Ini}$$
$$\text{Realized PnL} = (\text{Qty Jual} \times \text{Harga Eksekusi Jual}) - \text{Cost Basis Dilepas}$$
$$\text{Realized ROI (\%)} = \left(\frac{\text{Realized PnL}}{\text{Cost Basis Dilepas}}\right) \times 100$$
$$\text{Sisa Cost Basis} = \text{Cost Basis Sebelum Jual} - \text{Cost Basis Dilepas}$$

### 3. Valuasi Posisi Terbuka (Unrealized PnL)
$$\text{Nilai Pasar Saat Ini} = \text{Sisa Qty} \times \text{Harga Oracle Live}$$
$$\text{Unrealized PnL} = \text{Nilai Pasar Saat Ini} - \text{Sisa Cost Basis}$$
$$\text{Total PnL} = \text{Realized PnL} + \text{Unrealized PnL}$$

### 4. Ambang Debu (Dust Threshold)
Jika sisa saldo kuantitas token jatuh di bawah $10^{-7}$ ($\le 0.0000001$), posisi ditutup (`status = CLOSED`), sisa saldo di-nolkan, dan sisa modal dilepas sebagai penutup posisi.

---

## 🗄️ Skema Basis Data (PostgreSQL)

Arsitektur database terdiri dari 7 tabel relasional teroptimasi:

```mermaid
erDiagram
    WALLETS ||--o{ TRANSACTIONS : "has many"
    WALLETS ||--o{ TRADES : "executes"
    WALLETS ||--o{ POSITIONS : "holds"
    WALLETS ||--|| WALLET_METRICS : "summarized by"
    TRANSACTIONS ||--o{ TRANSFERS : "contains"
    TRANSACTIONS ||--o{ TRADES : "reconstructed as"
    TRANSACTIONS ||--o{ PARSER_ERRORS : "may produce"

    WALLETS {
        uuid id PK
        text address UK
        text chain
        text label
        boolean is_tracked
        text_array tags
        timestamp last_seen_at
    }

    TRANSACTIONS {
        uuid id PK
        text tx_hash UK
        text wallet_address FK
        timestamp block_time
        boolean success
        jsonb raw_data
    }

    TRANSFERS {
        uuid id PK
        uuid tx_id FK
        text wallet_address
        text token_address
        text direction
        numeric amount
    }

    TRADES {
        uuid id PK
        uuid wallet_id FK
        uuid token_id FK
        text side
        numeric token_amount
        numeric quote_amount
        text dex
    }

    POSITIONS {
        uuid id PK
        uuid wallet_id FK
        numeric quantity
        numeric avg_entry_price
        numeric total_cost_basis
        numeric realized_pnl
        text status
    }

    WALLET_METRICS {
        uuid wallet_id PK, FK
        numeric win_rate
        numeric realized_pnl
        bigint median_hold_seconds
        text performance_tier
        text trading_style
        text capital_tier
        text activity_level
    }

    PARSER_ERRORS {
        uuid id PK
        text tx_hash
        text error_type
        text raw_payload
        timestamp created_at
    }
```

### Rincian Tabel

1. **`wallets`**: Identitas utama wallet Solana (Base58), label kustom, tag kategori, dan flag `is_tracked`.
2. **`transactions`**: Gudang arsip transaksi mentah (`raw_data` JSONB) untuk menjamin auditabilitas dan *re-parsing* tanpa RPC.
3. **`transfers`**: Mutasi saldo bersih per aset dalam suatu transaksi dengan netralisasi gas fee.
4. **`trades`**: Peristiwa swap BUY/SELL DEX yang telah divalidasi, nominal token dasar, kuotasi SOL/USDC, dan DEX sumber.
5. **`positions`**: Rekam jejak posisi per aset berbasis WACB (`OPEN` atau `CLOSED`), average entry, dan total basis biaya modal.
6. **`wallet_metrics`**: Agregat analitik terindeks, memuat total Realized PnL, Win Rate, Median Holding Duration, serta 4 lencana profil.
7. **`parser_errors`**: Audit log untuk anomali transaksi atau transaksi `UNKNOWN` yang memerlukan perluasan parser.

---

## 🏷️ Matriks Klasifikasi Profil Trader

Klasifikasi profil trader bersifat deterministik dan dikonfigurasi melalui [`config/classification_thresholds.json`](file:///D:/PROJECTS/analyzer/config/classification_thresholds.json) yang terbagi menjadi 4 dimensi:

### 1. Performance Tier
- **`HIGHLY_PROFITABLE`**: $\text{ROI} \ge 100\%$ dan $\text{Win Rate} \ge 60\%$
- **`PROFITABLE`**: $\text{ROI} \ge 20\%$ dan $\text{Win Rate} \ge 50\%$
- **`BREAK_EVEN`**: $-20\% \le \text{ROI} \le 20\%$
- **`UNPROFITABLE`**: $\text{ROI} < -20\%$

### 2. Trading Style (Median Holding Time)
- **`SCALPER`**: $\text{Median Hold} \le 5\text{ menit}$
- **`SHORT_TERM_TRADER`**: $5\text{ menit} < \text{Median Hold} \le 2\text{ jam}$
- **`SWING_TRADER`**: $2\text{ jam} < \text{Median Hold} \le 3\text{ hari}$
- **`HOLDER`**: $\text{Median Hold} > 3\text{ hari}$

### 3. Capital Tier (Rata-rata Ukuran Posisi)
- **`MICRO`**: $<\$100$
- **`SMALL`**: $\$100 \le \text{Ukuran Posisi} < \$1{,}000$
- **`MEDIUM / LARGE`**: $\$1{,}000 \le \text{Ukuran Posisi} < \$100{,}000$
- **`VERY_LARGE (WHALE)`**: $\ge \$100{,}000$

### 4. Activity Level (Frekuensi Transaksi)
- **`INACTIVE`**: $0\text{ trade dalam 30 hari}$
- **`OCCASIONAL`**: $<1\text{ trade per hari}$
- **`ACTIVE`**: $1\text{ s/d }10\text{ trade per hari}$
- **`HIGH_FREQUENCY`**: $>10\text{ trade per hari}$ (indikasi Bot / Algo Scalper)

---

## 🔌 Spesifikasi REST API

Backend FastAPI berjalan pada port `:8000` dengan dokumentasi interaktif Swagger di `http://localhost:8000/docs`.

### 1. Trigger Sinkronisasi Wallet
Menjadwalkan job sinkronisasi asinkron untuk suatu address dompet.
```http
POST /api/wallet/{address}/sync
```
**Response (202 Accepted):**
```json
{
  "job_id": "b3f07a4a-18b2-4d5e-85a2-0941829e3a01",
  "status": "PENDING"
}
```

### 2. Ambil Ringkasan & Metrik Wallet
Mengambil profil lengkap, performa PnL, 4 badge klasifikasi, dan persentase coverage parsing.
```http
GET /api/wallet/{address}
```
**Response (200 OK):**
```json
{
  "address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "metrics": {
    "win_rate": 68.4,
    "realized_pnl": 12450.50,
    "unrealized_pnl": 340.20,
    "median_hold_seconds": 240
  },
  "classification": {
    "performance_tier": "HIGHLY_PROFITABLE",
    "trading_style": "SCALPER",
    "capital_tier": "MEDIUM",
    "activity_level": "ACTIVE"
  },
  "coverage": {
    "coverage_percentage": 98.2
  }
}
```

### 3. Bulk Import Watchlist
Mengimpor banyak wallet sekaligus dalam satu batch.
```http
POST /api/wallets/bulk-import
```
**Request Body:**
```json
{
  "addresses": [
    "8kPau1xR9wV1pYf...",
    "3kP2mZb8NqR..."
  ],
  "default_label": "Whale Alpha"
}
```
**Response (200 OK):**
```json
{
  "imported_count": 2,
  "invalid_addresses": []
}
```

### 4. Watchlist Activity Feed
Mengambil stream aktivitas transaksi terbaru (*reverse-chronological*) dari seluruh wallet yang dipantau (`is_tracked = true`).
```http
GET /api/wallets/tracker/feed?limit=50
```
**Response (200 OK):**
```json
[
  {
    "tx_hash": "3WqNx19fa...",
    "wallet_address": "8kPau1xR...",
    "side": "BUY",
    "token_symbol": "BONK",
    "quote_amount": 2.5,
    "dex": "Raydium CPMM",
    "timestamp": "2026-10-01T12:00:00Z"
  }
]
```

---

## 🚀 Panduan Instalasi & Menjalankan

### Prasyarat Sistem
- **Python 3.10+** (disarankan virtual environment `.venv`)
- **Node.js 18+** & **npm**
- **PostgreSQL 14+** (tersedia lokal, via Laragon, atau Docker)

### 1. Setup Environment
Salin file konfigurasi environment dan sesuaikan kredensial RPC & Database:
```bash
cp .env.example .env
```
Isi konfigurasi pada file `.env`:
```env
DATABASE_URL=postgresql+asyncpg://postgres:root@127.0.0.1:5432/wallet_intelligence
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
JUPITER_PRICE_API=https://api.jup.ag/price/v2
```

### 2. Instalasi Dependensi

**Backend (Python):**
```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

**Frontend (Next.js):**
```bash
cd apps/web
npm install
cd ../..
```

### 3. Menjalankan Sistem

#### Cara Cepat (Windows)
Jalankan file batch launcher otomatis:
```cmd
run_dev.bat
```
Skrip ini akan secara otomatis:
1. Memastikan layanan PostgreSQL (port 5432) telah berjalan.
2. Membuka worker backend FastAPI pada `http://localhost:8000`.
3. Membuka dashboard frontend Next.js pada `http://localhost:3000`.

#### Cara Manual

**Terminal 1 — FastAPI Backend:**
```bash
.venv\Scripts\python -m uvicorn apps.api.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 — Next.js Frontend:**
```bash
cd apps/web
npm run dev
```

---

## 🗺️ Panduan Developer (Change Map)

Bila Anda ingin memperluas atau memodifikasi fungsionalitas sistem, gunakan panduan referensi file berikut:

| Kebutuhan Pengembang | File Terkait | Aksi / Prosedur |
| :--- | :--- | :--- |
| **Menambah DEX Baru** | [`workers/parser/swap_detector.py`](file:///D:/PROJECTS/analyzer/workers/parser/swap_detector.py) | Daftarkan Program ID baru ke dalam kamus DEX program map. |
| **Menambah Token Quote (USDC/USDT)** | [`workers/parser/swap_detector.py`](file:///D:/PROJECTS/analyzer/workers/parser/swap_detector.py) | Daftarkan mint address token quote baru pada set token kuotasi. |
| **Mengubah Aturan Ambang Profil** | [`config/classification_thresholds.json`](file:///D:/PROJECTS/analyzer/config/classification_thresholds.json) | Modifikasi threshold ROI, durasi waktu holding, atau level volume. |
| **Menyesuaikan Logika Biaya & Saldo** | [`workers/parser/transfer_parser.py`](file:///D:/PROJECTS/analyzer/workers/parser/transfer_parser.py) | Edit normalisasi saldo token SPL atau kompensasi fee-payer. |
| **Modifikasi Model Akuntansi WACB** | [`workers/position_engine/position_builder.py`](file:///D:/PROJECTS/analyzer/workers/position_engine/position_builder.py) | Sesuaikan perhitungan average entry, debu saldo, atau realized PnL. |
| **Mengubah Skema Database ORM** | [`packages/database/models.py`](file:///D:/PROJECTS/analyzer/packages/database/) | Tambahkan atribut model SQLAlchemy dan jalankan migrasi Alembic. |

---

## 🧪 Pengujian

Jalankan suite pengujian unit dan integrasi dengan `pytest`:

```bash
# Menjalankan seluruh unit test
pytest

# Menjalankan pengujian kalkulator PnL & WACB secara spesifik
pytest tests/test_pnl_calculator.py -v
```

---

## 📄 Lisensi & Referensi

- **Dokumentasi Interaktif Sistem:** [`wallet_intelligence_interactive_documentation.html`](file:///D:/PROJECTS/analyzer/wallet_intelligence_interactive_documentation.html)
- **PRD & Rincian Desain Sistem:** [`prd.md`](file:///D:/PROJECTS/analyzer/prd.md) & [`project.md`](file:///D:/PROJECTS/analyzer/project.md)
