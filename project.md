# Wallet Intelligence — Tahap 1 MVP

> Fokus tahap pertama: **membangun Wallet Intelligence terlebih dahulu**.
>
> Jangan membangun token scanner, smart-money detection, wallet clustering, alerts, atau fitur kompleks lainnya sebelum fondasi wallet analytics akurat.

---

# 1. Tujuan Tahap 1

Target utama:

> Masukkan sebuah wallet address → sistem mengambil aktivitas wallet → merekonstruksi transaksi menjadi trade → menghitung posisi dan PnL → menghasilkan profil trader.

Output akhirnya adalah halaman:

```text
/wallet/{address}
```

yang dapat menjawab:

- Wallet ini aktif atau tidak?
- Berapa total trade?
- Berapa token yang pernah diperdagangkan?
- Berapa realized PnL?
- Berapa unrealized PnL?
- Berapa ROI?
- Berapa win rate?
- Berapa average/median holding time?
- Trade mana yang profitable?
- Token mana yang paling menghasilkan?
- Berapa besar average position?
- Bagaimana pola trading wallet?
- Kapan wallet pertama kali aktif?
- Dari mana wallet mendapatkan funding awal?

---

# 2. Scope Tahap 1

## WAJIB

```text
Wallet Address
      ↓
Blockchain Data
      ↓
Transaction Parser
      ↓
Trade Reconstruction
      ↓
Position Engine
      ↓
PnL Engine
      ↓
Wallet Metrics
      ↓
Wallet Dashboard
```

## BELUM DIBUAT

Untuk sementara jangan membuat:

- Smart Money Score
- Wallet clustering
- Bundle detection
- Fresh wallet detection
- Whale detection
- Token scanner
- Copy trading
- AI agent
- Multi-chain
- Social sentiment
- Telegram alert
- Advanced ML
- Graph database

Semua itu masuk fase berikutnya.

---

# 3. Blockchain

Untuk tahap pertama gunakan **satu blockchain saja**.

Rekomendasi:

## Solana-first

Alasan:

- Ekosistem meme coin besar.
- Aktivitas wallet tinggi.
- Banyak DEX.
- Banyak use case untuk wallet intelligence.
- Cocok untuk menguji konsep product.

Jangan langsung multi-chain.

---

# 4. Tech Stack

## Frontend

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
```

## Backend

```text
Python
FastAPI
```

## Data Processing

```text
Python
asyncio
Pydantic
SQLAlchemy
```

## Database

```text
PostgreSQL
```

## Development

```text
Docker
Docker Compose
Git
GitHub
```

## Chart

Gunakan salah satu:

```text
Recharts
```

atau library chart financial/time-series yang sesuai.

---

# 5. Arsitektur MVP

```text
                         SOLANA
                            │
                            ▼
                    ┌───────────────┐
                    │   RPC / API   │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Wallet Fetcher│
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ TX Parser     │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Trade Parser  │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  PostgreSQL   │
                    └───────┬───────┘
                            │
                 ┌──────────┼──────────┐
                 ▼          ▼          ▼
             Position      PnL       Metrics
              Engine      Engine      Engine
                 │          │          │
                 └──────────┼──────────┘
                            ▼
                       FastAPI
                            │
                            ▼
                        Next.js
                            │
                            ▼
                    Wallet Dashboard
```

---

# 6. Project Structure

Gunakan struktur sederhana:

```text
wallet-intelligence/
│
├── apps/
│   ├── web/
│   │   └── Next.js
│   │
│   └── api/
│       └── FastAPI
│
├── workers/
│   ├── indexer/
│   ├── parser/
│   ├── position-engine/
│   └── pnl-engine/
│
├── packages/
│   ├── database/
│   └── types/
│
├── migrations/
│
├── scripts/
│
├── docs/
│
├── docker-compose.yml
│
└── README.md
```

---

# 7. Database Design

Gunakan PostgreSQL sebagai source of truth.

## 7.1 wallets

```sql
CREATE TABLE wallets (
    id UUID PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    chain TEXT NOT NULL,
    first_seen_at TIMESTAMP,
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

Tujuan:

Menyimpan identitas wallet yang dianalisis.

---

# 8. Tokens

```sql
CREATE TABLE tokens (
    id UUID PRIMARY KEY,
    chain TEXT NOT NULL,
    address TEXT NOT NULL,
    symbol TEXT,
    name TEXT,
    decimals INTEGER,
    first_seen_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(chain, address)
);
```

Walaupun fokus sekarang wallet, token tetap harus disimpan karena wallet melakukan transaksi terhadap token.

---

# 9. Raw Transactions

Simpan data blockchain mentah secara terpisah.

```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    chain TEXT NOT NULL,
    tx_hash TEXT NOT NULL UNIQUE,
    wallet_address TEXT NOT NULL,
    block_number BIGINT,
    block_time TIMESTAMP,
    success BOOLEAN,
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Kenapa raw data perlu disimpan?

Karena parser kemungkinan akan berubah.

Misalnya hari ini:

```text
Parser v1
```

kemudian kita menemukan bug.

Kita bisa:

```text
Raw transaction
      ↓
Parser v2
      ↓
Recalculate trade
```

tanpa mengambil data blockchain ulang.

---

# 10. Transfers

```sql
CREATE TABLE transfers (
    id UUID PRIMARY KEY,
    tx_id UUID REFERENCES transactions(id),
    wallet_address TEXT NOT NULL,
    token_address TEXT NOT NULL,
    direction TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    usd_value NUMERIC,
    timestamp TIMESTAMP NOT NULL
);
```

Direction:

```text
IN
OUT
```

Transfer jangan langsung dianggap sebagai buy/sell.

---

# 11. Trades

Ini tabel paling penting.

```sql
CREATE TABLE trades (
    id UUID PRIMARY KEY,
    wallet_id UUID REFERENCES wallets(id),
    token_id UUID REFERENCES tokens(id),

    tx_hash TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,

    side TEXT NOT NULL,

    token_amount NUMERIC NOT NULL,
    quote_amount NUMERIC NOT NULL,

    price NUMERIC,
    usd_value NUMERIC,
    market_cap NUMERIC,

    dex TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);
```

Side:

```text
BUY
SELL
```

Contoh:

```text
Wallet A
BUY
TOKEN XYZ
100,000 tokens
$250
MC $400K
```

---

# 12. Position Table

```sql
CREATE TABLE positions (
    id UUID PRIMARY KEY,

    wallet_id UUID REFERENCES wallets(id),
    token_id UUID REFERENCES tokens(id),

    quantity NUMERIC NOT NULL,
    avg_entry_price NUMERIC,

    total_cost_basis NUMERIC,

    realized_pnl NUMERIC DEFAULT 0,
    unrealized_pnl NUMERIC DEFAULT 0,

    roi NUMERIC,

    opened_at TIMESTAMP,
    last_trade_at TIMESTAMP,
    closed_at TIMESTAMP,

    status TEXT NOT NULL
);
```

Status:

```text
OPEN
CLOSED
```

---

# 13. Wallet Metrics

```sql
CREATE TABLE wallet_metrics (
    wallet_id UUID PRIMARY KEY REFERENCES wallets(id),

    trade_count INTEGER DEFAULT 0,

    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,

    win_rate NUMERIC,

    realized_pnl NUMERIC DEFAULT 0,
    unrealized_pnl NUMERIC DEFAULT 0,

    total_pnl NUMERIC DEFAULT 0,

    roi NUMERIC,

    avg_trade_pnl NUMERIC,
    avg_win NUMERIC,
    avg_loss NUMERIC,

    profit_factor NUMERIC,

    avg_hold_seconds BIGINT,
    median_hold_seconds BIGINT,

    max_drawdown NUMERIC,

    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

# 14. Trade Reconstruction

Ini bagian teknis terpenting.

Jangan menganggap:

```text
Transaction = Trade
```

Karena satu transaction dapat memiliki banyak instruction dan token movement.

Contoh:

```text
Transaction
│
├── Wallet sends SOL
│
├── Router
│
├── Pool interaction
│
├── Token received
│
└── Fee
```

Parser harus menghasilkan:

```text
BUY
Token: XYZ
Amount: 100,000
Spent: 1.2 SOL
Price: ...
USD Value: ...
```

---

# 15. Trade Classification

Minimal klasifikasi:

```text
BUY
SELL
TRANSFER
UNKNOWN
```

Jangan memaksa semua transaksi menjadi BUY/SELL.

Jika parser tidak yakin:

```text
UNKNOWN
```

lebih baik daripada memasukkan data salah ke PnL engine.

---

# 16. Position Engine

Position engine mengubah:

```text
BUY
BUY
BUY
SELL
SELL
```

menjadi:

```text
Position
```

Contoh:

```text
BUY
100 TOKEN @ $1
Cost = $100

BUY
100 TOKEN @ $2
Cost = $200

Current:
200 TOKEN
Cost Basis = $300
Average Entry = $1.50
```

Kemudian:

```text
SELL
100 TOKEN @ $3
```

Position menjadi:

```text
Remaining:
100 TOKEN

Realized PnL:
+$150

Remaining Cost Basis:
$150
```

---

# 17. PnL Engine

Pisahkan:

## Realized PnL

Profit/loss dari posisi yang sudah dijual.

```text
Realized PnL
=
Exit Value
-
Cost Basis Sold
-
Fees
```

## Unrealized PnL

Profit/loss dari posisi yang masih dipegang.

```text
Unrealized PnL
=
Current Position Value
-
Remaining Cost Basis
```

## Total PnL

```text
Total PnL
=
Realized PnL
+
Unrealized PnL
```

Jika data fee tersedia:

```text
Net PnL
=
Gross PnL
-
Trading Fees
-
Network Fees
```

---

# 18. Average Entry

Gunakan weighted average.

Contoh:

```text
Buy 100 @ $1
Buy 300 @ $2
```

Total:

```text
Quantity = 400

Cost =
100 × $1
+
300 × $2

= $700
```

Average:

```text
$700 / 400
= $1.75
```

---

# 19. Win Rate

Definisikan secara eksplisit.

Untuk MVP:

```text
Win Rate =
Profitable Closed Trades
/
Total Closed Trades
× 100
```

Contoh:

```text
100 closed trades

65 profitable
35 losing

Win Rate = 65%
```

Jangan memasukkan posisi open ke win rate.

---

# 20. Holding Time

Untuk setiap completed position:

```text
Holding Time =
Closed At
-
Opened At
```

Simpan:

```text
average_hold_time
median_hold_time
min_hold_time
max_hold_time
```

Median lebih penting daripada average karena meme coin trading dapat memiliki outlier ekstrem.

---

# 21. Wallet Classification

Setelah `wallet_metrics` dihitung, wallet perlu diklasifikasikan ke beberapa kategori berdasarkan metrik miliknya sendiri.

> Penting: ini **BUKAN** Smart Money Score dan **BUKAN** wallet clustering.
>
> - Smart Money Score = skor composite/weighted, kemungkinan pakai model, masuk fase berikutnya.
> - Wallet Clustering = mengelompokkan wallet berdasarkan hubungan antar wallet (funding, bundling), masuk fase berikutnya.
> - Wallet Classification (bagian ini) = **rule-based tagging** dari metrik satu wallet itu sendiri. Sederhana, transparan, threshold eksplisit — cocok untuk tahap 1.

## 21.1 Dimensi Klasifikasi

### A. Performance Tier

Berdasarkan `realized_pnl` + `roi` + `win_rate` dari `wallet_metrics`.

```text
Highly Profitable   ROI > 100%      AND win_rate >= 60%
Profitable          ROI > 20%       AND win_rate >= 50%
Break-even          -20% <= ROI <= 20%
Unprofitable        ROI < -20%
Highly Unprofitable ROI < -50%
```

Minimal jumlah closed trades (misal >= 5) sebelum tier ini dihitung — di bawah itu tandai `INSUFFICIENT_DATA`, jangan memaksakan label.

### B. Trading Style (Holding Period)

Berdasarkan `median_hold_seconds`. Ambang sama dengan bucket di bagian Holding-Time Distribution (bagian 25), supaya konsisten:

```text
Scalper           median hold < 5m
Short-term Trader 5m – 2h
Swing Trader       2h – 3d
Holder             > 3d
```

### C. Capital Size Tier

Berdasarkan rata-rata besar posisi (`avg_position_size`, dari average `usd_value` per trade) atau total capital deployed wallet ini sendiri.

```text
Micro    < $100
Small    $100 – $1,000
Medium   $1,000 – $10,000
Large    $10,000 – $100,000
Very Large  > $100,000
```

Catatan: ini ukuran modal wallet ini sendiri, bukan "whale detection" (yang membandingkan terhadap wallet lain / token supply — tetap masuk fase berikutnya).

### D. Activity Level

Berdasarkan `trade_count` dan rentang waktu aktif (`last_seen_at - first_seen_at`), yaitu trade per hari aktif.

```text
Inactive        tidak ada trade > 30 hari terakhir
Occasional      < 1 trade/hari aktif
Active          1 – 10 trade/hari aktif
High-Frequency  > 10 trade/hari aktif
```

## 21.2 Output

Setiap wallet mendapat kombinasi label, contoh:

```text
Profitable · Swing Trader · Medium Size · Active
```

Ditampilkan sebagai badge di halaman `/wallet/{address}`.

## 21.3 Database

Tambahkan kolom pada `wallet_metrics` (bukan tabel terpisah dulu, karena ini derived 1:1 dari metrik yang sudah ada):

```sql
ALTER TABLE wallet_metrics
    ADD COLUMN performance_tier TEXT,
    ADD COLUMN trading_style TEXT,
    ADD COLUMN capital_tier TEXT,
    ADD COLUMN activity_level TEXT,
    ADD COLUMN classified_at TIMESTAMP;
```

## 21.4 Threshold sebagai Config

Jangan hardcode angka-angka di atas langsung di kode. Simpan sebagai config (JSON/YAML atau tabel `classification_thresholds`) supaya bisa disesuaikan tanpa redeploy — threshold ini akan sering direvisi begitu data wallet nyata mulai masuk.

## 21.5 API

```http
GET /api/wallet/{address}
```

Tambahkan field pada response:

```json
{
  "classification": {
    "performance_tier": "PROFITABLE",
    "trading_style": "SWING_TRADER",
    "capital_tier": "MEDIUM",
    "activity_level": "ACTIVE"
  }
}
```

## 21.6 Kapan Dihitung

Klasifikasi dihitung ulang setiap kali `wallet_metrics` di-update (setelah sync awal dan setelah setiap transaksi baru realtime), bukan on-demand saat halaman dibuka.

---

# 22. Wallet Dashboard

Halaman:

```text
/wallet/{address}
```

Struktur:

```text
┌─────────────────────────────────────────────┐
│ WALLET                                      │
│ 7xK...abc                                   │
│                                             │
│ First Seen     120 days ago                 │
│ Last Active    4 minutes ago                │
│                                             │
│ [Profitable] [Swing Trader] [Medium] [Active]│
└─────────────────────────────────────────────┘
```

Badge di atas diambil dari `wallet_classification` (lihat bagian 21).

---

# 23. Performance Overview

```text
┌──────────────┬──────────────┬──────────────┐
│ Realized PnL │ Unrealized   │ Total PnL    │
│              │ PnL          │              │
│ +$284K       │ +$37K        │ +$321K       │
└──────────────┴──────────────┴──────────────┘

┌──────────────┬──────────────┬──────────────┐
│ Win Rate     │ ROI          │ Trades       │
│ 68.4%        │ +184%        │ 487          │
└──────────────┴──────────────┴──────────────┘
```

---

# 24. Trading Behavior

Display:

```text
Median Hold:
4h 17m

Average Hold:
11h 32m

Average Position:
$1,842

Average Entry MC:
$420K

Average Exit MC:
$1.8M
```

---

# 25. Holding-Time Distribution

Visualisasi:

```text
< 1m        █████████
1-5m        ███████
5-30m       ███████████
30m-2h      █████
2h-12h      ███████
12h-3d      ████
3d+         ██
```

Tujuan:

Memahami apakah wallet:

- Scalper
- Short-term trader
- Swing trader
- Holder

Untuk tahap 1 cukup tampilkan data distribution. Classification otomatis dapat ditambahkan nanti.

---

# 26. Trade History

Tabel:

| Time | Token | Side | Amount | Value | MC | PnL | Hold |
|---|---|---|---:|---:|---:|---:|---:|
| 12:03 | XYZ | BUY | 100K | $250 | $400K | - | - |
| 15:40 | XYZ | SELL | 100K | $1.2K | $1.9M | +$950 | 3h |
| 17:20 | ABC | BUY | 50K | $500 | $800K | - | - |

Filter:

```text
All
BUY
SELL
Profitable
Loss
Token
Date
```

---

# 27. Token Performance

Walaupun belum membuat Token Explorer, halaman wallet harus memiliki token performance.

Contoh:

| Token | Trades | Invested | Realized PnL | ROI | Hold |
|---|---:|---:|---:|---:|---:|
| XYZ | 7 | $4K | +$21K | +525% | 6h |
| ABC | 4 | $2K | -$500 | -25% | 2h |
| DEF | 2 | $1K | +$800 | +80% | 3d |

---

# 28. Wallet Activity Timeline

Buat timeline:

```text
Today
│
├── 09:20 BUY XYZ $4,200
├── 09:44 BUY ABC $1,200
├── 10:03 SELL XYZ $8,400
│
Yesterday
│
├── BUY DEF
├── SELL DEF
│
3 days ago
│
└── First trade XYZ
```

Ini akan sangat membantu debugging dan UX.

---

# 29. Wallet Funding

Tahap pertama cukup sederhana.

Tampilkan:

```text
Initial Funding

First Seen:
2026-08-12

Initial Balance:
12.4 SOL

First Funding Source:
Wallet X

Initial Funding:
12.4 SOL
```

Jangan dulu melakukan wallet clustering.

Tujuannya hanya mengumpulkan data untuk tahap berikutnya.

---

# 30. API Design

FastAPI.

## Wallet

```http
GET /api/wallet/{address}
```

Response:

```json
{
  "address": "...",
  "first_seen_at": "...",
  "last_active_at": "...",
  "trade_count": 487,
  "realized_pnl": 284000,
  "unrealized_pnl": 37000,
  "total_pnl": 321000,
  "roi": 184,
  "win_rate": 68.4,
  "median_hold_seconds": 15420
}
```

---

## Wallet Trades

```http
GET /api/wallet/{address}/trades
```

Query:

```text
?page=1
&limit=50
&side=BUY
&token=...
&from=...
&to=...
```

---

## Wallet Positions

```http
GET /api/wallet/{address}/positions
```

---

## Wallet Performance

```http
GET /api/wallet/{address}/performance
```

---

# 31. Indexing Strategy

Jangan langsung index seluruh blockchain.

MVP:

```text
User memasukkan wallet
        ↓
Check database
        ↓
Jika belum ada:
Fetch historical transactions
        ↓
Parse
        ↓
Save
        ↓
Calculate metrics
        ↓
Show dashboard
```

Setelah itu:

```text
Wallet tracked
        ↓
Realtime listener
        ↓
New transaction
        ↓
Parse
        ↓
Update position
        ↓
Update metrics
```

---

# 32. Initial Wallet Sync

Ketika user memasukkan wallet:

```text
POST /api/wallet/{address}/sync
```

Backend:

```text
1. Validate address
2. Check wallet
3. Fetch transactions
4. Store raw transactions
5. Parse transfers
6. Detect swaps
7. Create trades
8. Rebuild positions
9. Calculate PnL
10. Calculate wallet metrics
11. Mark sync complete
```

---

# 33. Sync Status

Frontend perlu mengetahui progress.

```text
Wallet Sync

Fetching transactions...
██████████░░░░░ 67%

Transactions found:
18,240

Trades reconstructed:
2,841

Positions:
384

Calculating PnL...
```

Status:

```text
PENDING
SYNCING
PROCESSING
COMPLETED
FAILED
```

---

# 34. Idempotency

Indexer harus aman jika transaksi diproses dua kali.

Gunakan:

```text
tx_hash UNIQUE
```

dan untuk trade:

```text
tx_hash
+
wallet
+
token
+
side
```

Jangan sampai:

```text
1 blockchain transaction
```

menjadi:

```text
2 identical trades
```

karena worker restart.

---

# 35. Error Handling

Setiap transaksi dapat memiliki status:

```text
PARSED
UNPARSED
FAILED
UNKNOWN
```

Simpan error:

```text
parser_errors
```

Contoh:

```text
TX:
abc123

Status:
UNPARSED

Reason:
Unknown DEX instruction
```

Jangan membuang transaksi yang tidak dikenal.

---

# 36. Data Quality

Ini sangat penting.

Dashboard sebaiknya menunjukkan:

```text
Data Coverage

Transactions analyzed:
18,240

Successfully parsed:
17,921

Unparsed:
319

Coverage:
98.25%
```

Jika parser belum mendukung suatu DEX, user harus tahu.

---

# 37. Testing

Minimal test:

## Parser

```text
Transaction
→ expected BUY
```

```text
Transaction
→ expected SELL
```

## Position

```text
BUY
BUY
SELL
SELL
→ correct position
```

## PnL

```text
BUY $100
SELL $200
→ +$100
```

## Partial Sell

```text
BUY 100
SELL 50
→ 50 remaining
```

## Multiple Entry

```text
BUY 100 @ $1
BUY 100 @ $2
SELL 100 @ $3
→ correct realized PnL
```

---

# 38. Docker Development

Minimal:

```yaml
services:

  postgres:
    image: postgres:16

  api:
    build: ./apps/api

  worker:
    build: ./workers

  web:
    build: ./apps/web
```

Untuk MVP belum perlu:

- Kafka
- Kubernetes
- ClickHouse
- Graph database
- Distributed queue

---

# 39. Development Environment

Local:

```text
Laptop
│
├── Docker
│
├── PostgreSQL
├── FastAPI
├── Python Worker
└── Next.js
```

Target biaya:

```text
$0
```

selama RPC/API yang digunakan masih berada pada free tier dan workload masih kecil.

---

# 40. Definition of Done

Tahap 1 dianggap selesai jika:

### Wallet

- [ ] User dapat memasukkan wallet address.
- [ ] Sistem memvalidasi address.
- [ ] Sistem dapat mengambil historical transactions.
- [ ] Transactions tersimpan.
- [ ] Transfers dapat direkonstruksi.
- [ ] Swap dapat dideteksi.
- [ ] BUY/SELL dapat direkonstruksi.
- [ ] Trade tersimpan.

### Position

- [ ] Position dapat dibuat.
- [ ] Multiple entries bekerja.
- [ ] Partial exits bekerja.
- [ ] Position close bekerja.
- [ ] Holding time benar.

### PnL

- [ ] Realized PnL benar.
- [ ] Unrealized PnL benar.
- [ ] Total PnL benar.
- [ ] ROI benar.
- [ ] Win rate benar.
- [ ] Average/median hold time benar.

### Classification

- [ ] Performance tier dihitung dari ROI/win rate.
- [ ] Trading style dihitung dari median holding time.
- [ ] Capital tier dihitung dari average position size.
- [ ] Activity level dihitung dari trade frequency.
- [ ] Threshold disimpan sebagai config, bukan hardcode.
- [ ] Badge klasifikasi tampil di dashboard.

### Dashboard

- [ ] Wallet overview.
- [ ] Performance metrics.
- [ ] Classification badge.
- [ ] PnL chart.
- [ ] Holding-time distribution.
- [ ] Trade history.
- [ ] Token performance.
- [ ] Activity timeline.
- [ ] Sync status.

---

# 41. Urutan Implementasi yang Tepat

Jangan mengerjakan frontend terlebih dahulu.

Urutan:

```text
1. Setup repository
        ↓
2. Setup PostgreSQL
        ↓
3. Setup blockchain RPC
        ↓
4. Wallet transaction fetcher
        ↓
5. Raw transaction storage
        ↓
6. Transaction parser
        ↓
7. Transfer reconstruction
        ↓
8. Swap detection
        ↓
9. Trade reconstruction
        ↓
10. Position engine
        ↓
11. PnL engine
        ↓
12. Wallet metrics
        ↓
13. FastAPI
        ↓
14. Next.js dashboard
        ↓
15. Charts
        ↓
16. Testing
        ↓
17. Realtime wallet sync
```

---

# 42. Tahap Setelah Wallet MVP

Setelah tahap ini benar-benar stabil:

```text
WALLET MVP
    ↓
Smart Money
    ↓
Whale Detection
    ↓
Wallet Relationship
    ↓
Bundle / Cluster
    ↓
Fresh Wallet
    ↓
Token Intelligence
    ↓
Realtime Alerts
```

Jangan melompat ke tahap berikutnya sebelum **trade reconstruction + position + PnL** benar.

---

# 43. Prinsip Utama

Tahap pertama bukan tentang membuat dashboard yang terlihat keren.

Tahap pertama adalah membuat:

> **“Wallet → transaksi → trade → position → PnL”**

seakurat mungkin.

Jika fondasi ini benar, seluruh fitur lanjutan dapat dibangun di atasnya.

Jika fondasi ini salah, maka:

```text
Wrong Trade
    ↓
Wrong Position
    ↓
Wrong PnL
    ↓
Wrong Win Rate
    ↓
Wrong Smart Money Score
    ↓
Wrong Cluster
    ↓
Wrong Alert
```

Karena itu, **Wallet Intelligence MVP harus diperlakukan sebagai data/analytics engine terlebih dahulu, dan dashboard sebagai layer terakhir.**