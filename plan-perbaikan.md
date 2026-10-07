# Rencana Perbaikan — Wallet Intelligence
Tanggal: 2026-10-07
Scope: Perbaikan kerentanan keamanan prioritas tinggi pada API dan konfigurasi untuk skenario operasional single-user.

## Ringkasan
Berdasarkan hasil audit di `security-alert.md`, ditemukan 5 isu prioritas yang langsung berdampak pada keamanan endpoint publik, integritas webhook Helius, konsumsi kuota worker, dan network exposure. Mengingat sistem ini ditujukan untuk single-user dalam waktu dekat, perbaikan difokuskan pada pengamanan batas jaringan luar (webhook, CORS, host binding, dan input capping) tanpa menambah kompleksitas arsitektur atau multi-user auth yang belum dibutuhkan (prinsip Ponytail/YAGNI).

## Daftar Temuan

| ID | Deskripsi | Lokasi | Bukti | Severity | Estimasi |
|----|-----------|--------|-------|----------|----------|
| BUG-01 | Webhook verification bypass saat secret kosong (*fail-open*) dan perbandingan non-constant-time | `apps/api/routers/webhook.py:37-43` | `if expected_secret:` dan `authorization != expected_secret` | High | S |
| BUG-02 | Endpoint setup/list Helius webhook tidak terotentikasi dan menerima URL bebas (SSRF/Hijacking) | `apps/api/routers/webhook.py:143-225` | `helius_url = f"https://api.helius.xyz/v0/webhooks?api-key={api_key}"` tanpa auth check | High | S |
| BUG-03 | Konfigurasi CORS memiliki regex longgar dan hardcoded public IP range `123.123.*.*` | `apps/api/main.py:20` | `allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|123\.123\.\d+\.\d+)(:\d+)?$"` | Med | S |
| BUG-04 | Input array `addresses` pada bulk import tidak memiliki batas ukuran (*unbounded array DoS*) | `apps/api/routers/tracker.py:28-32` | `class BulkImportRequest(BaseModel): addresses: List[str]` tanpa `max_length` | Med | S |
| BUG-05 | Konfigurasi default network interface mengikat wildcard `0.0.0.0` pada local dev | `.env.example:17` | `HOST=0.0.0.0` | Low | S |

## Rencana Per-Item

### BUG-01 — Webhook Verification Fail-Closed & Constant-Time Check
- **Root cause**: Jika environment variable `HELIUS_WEBHOOK_SECRET` tidak diisi, pengecekan `if expected_secret:` dilewati sehingga endpoint menerima request apa pun dari internet. Selain itu, perbandingan string menggunakan `!=` bukan perbandingan konstan (*timing-safe*).
- **Langkah perbaikan**:
  1. Ubah logika verifikasi menjadi *fail-closed*: tolak request (HTTP 500/401) jika `HELIUS_WEBHOOK_SECRET` belum dikonfigurasi di server.
  2. Gunakan `secrets.compare_digest` dari Python stdlib untuk membandingkan header authorization dengan secret server.
- **File yang disentuh**: `apps/api/routers/webhook.py`
- **Cara verifikasi setelah fix**: Jalankan `pytest tests/test_webhook.py -k test_webhook_secret_auth`.
- **Risiko/dependency**: Webhook dari Helius akan ditolak jika user lupa menyetel `HELIUS_WEBHOOK_SECRET` di file `.env`.

### BUG-02 — Pengamanan Endpoint Setup & List Webhook Helius
- **Root cause**: Endpoint `/api/webhooks/helius/setup` dan `/api/webhooks/helius/list` memanggil Helius Management API menggunakan `HELIUS_API_KEY` internal tanpa validasi otentikasi pemanggil, memungkinkan pihak luar mengubah URL webhook tujuan event.
- **Langkah perbaikan**:
  1. Tambahkan dependency pengecekan API secret sederhana (misal header `X-Admin-Secret` atau mencocokkan `HELIUS_WEBHOOK_SECRET`) pada endpoint setup dan list.
  2. Validasi parameter `webhook_url` agar wajib berformat URL HTTPS yang valid sebelum diteruskan ke Helius.
- **File yang disentuh**: `apps/api/routers/webhook.py`
- **Cara verifikasi setelah fix**: Request ke `/api/webhooks/helius/setup` tanpa header secret harus mengembalikan HTTP 401/403.
- **Risiko/dependency**: Frontend/skrip internal yang memanggil setup webhook perlu menyertakan header secret.

### BUG-03 — Pengetatan Origin CORS Middleware
- **Root cause**: Terdapat blok IP publik luar `123.123.\d+\.\d+` dan subnet LAN di dalam `allow_origin_regex` yang aktif bersamaan dengan `allow_credentials=True`.
- **Langkah perbaikan**:
  1. Hapus regex longgar dan blok IP asing dari `apps/api/main.py`.
  2. Gunakan daftar eksplisit `allow_origins` yang diambil dari environment variable `CORS_ORIGINS` (default: `http://localhost:3000,http://127.0.0.1:3000`).
- **File yang disentuh**: `apps/api/main.py`
- **Cara verifikasi setelah fix**: Jalankan `curl -I -H "Origin: http://123.123.1.1" http://127.0.0.1:8000/healthz` dan pastikan header `Access-Control-Allow-Origin` tidak dikembalikan.
- **Risiko/dependency**: Tidak ada, frontend Next.js tetap berjalan normal di `http://localhost:3000`.

### BUG-04 — Pembatasan Maksimum Ukuran Batch Bulk Import
- **Root cause**: Pydantic schema `BulkImportRequest` tidak membatasi jumlah item pada list `addresses`, sehingga payload berukuran masif dapat mengeksekusi O(N) query database dan membanjiri antrean worker.
- **Langkah perbaikan**:
  1. Tambahkan batasan `Field(..., max_length=100)` pada field `addresses` di class `BulkImportRequest`.
- **File yang disentuh**: `apps/api/routers/tracker.py`
- **Cara verifikasi setelah fix**: Buat unit test yang mengirim request dengan 101 alamat dan pastikan response mengembalikan HTTP 422 Unprocessable Entity.
- **Risiko/dependency**: User tidak bisa mengimpor lebih dari 100 alamat dalam satu klik (cukup untuk skenario operasional single-user).

### BUG-05 — Default Host Binding Localhost
- **Root cause**: Default konfigurasi `HOST=0.0.0.0` pada template `.env.example` mengekspos port API ke seluruh antarmuka jaringan luar jika dijalankan tanpa reverse proxy.
- **Langkah perbaikan**:
  1. Ubah nilai default `HOST` di `.env.example` menjadi `127.0.0.1`.
- **File yang disentuh**: `.env.example`
- **Cara verifikasi setelah fix**: Periksa teks pada `.env.example` memastikan `HOST=127.0.0.1`.
- **Risiko/dependency**: Tidak ada risiko.

## Urutan Eksekusi
1. **BUG-01** — Mengunci verifikasi webhook ke *fail-closed* mencegah injeksi payload palsu dari internet.
2. **BUG-02** — Mengamankan endpoint setup Helius mencegah pembajakan webhook URL akun Helius.
3. **BUG-03** — Membersihkan CORS regex menghapus celah cross-origin dari IP luar.
4. **BUG-04** — Memberikan batas `max_length` pada bulk import mencegah resource exhaustion.
5. **BUG-05** — Mengubah default host ke `127.0.0.1` membatasi network exposure port lokal.

## Perlu Verifikasi Manual
1. **SEC-03 (Watchlist Mutations Authorization)**: Endpoint delete/untrack di `tracker.py` belum berotentikasi. Karena sistem single-user berjalan di localhost, ini dianggap aman untuk jangka pendek dan tidak memerlukan sistem multi-tenant session yang kompleks. Perlu diverifikasi ulang jika sistem nantinya di-host secara publik untuk banyak pengguna.
2. **SEC-06 (DexScreener Price Refresh Rate Limit)**: Endpoint refresh harga posisi open belum memiliki cooldown rate limit per-wallet. Untuk single-user risiko ini rendah, namun dapat dipasang throttling sederhana jika user sering melakukan spam refresh.
