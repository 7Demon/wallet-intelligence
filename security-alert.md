# Security Audit Report — Wallet Intelligence

**Target**: `d:\PROJECTS\analyzer` (Solana Wallet Intelligence & Trader Analytics Engine)  
**Audit Standard**: `security-audit-skill` & Ponytail Senior Dev Review Principles  
**Date**: 2026-10-07  
**Review Status**: Completed  

---

## 1. Executive Summary

A comprehensive source-code security review was conducted on the **Wallet Intelligence** platform, covering the FastAPI backend (`apps/api`), worker synchronization pipeline (`workers/`), database layer (`packages/database`), configuration, and web frontend (`apps/web`).

The architecture implements several strong security foundations (PostgreSQL ORM parameterized queries preventing SQL injection, strict Base58 Solana address regex validation, and proper `.gitignore` prevention of secret leakage). However, critical vulnerabilities exist around **webhook administrative authorization, authentication bypass under default configuration, cross-origin resource sharing (CORS) misconfigurations, and unbounded request processing causing Denial of Service (DoS)**.

---

## 2. Findings Matrix

| ID | Title | Severity | Attack Class | Target File & Lines |
|---|---|---|---|---|
| **SEC-01** | Unauthenticated Helius Webhook Administration & Blind SSRF / Hijacking | **HIGH** | Broken Access Control / SSRF | [apps/api/routers/webhook.py:143-225](file:///d:/PROJECTS/analyzer/apps/api/routers/webhook.py#L143-L225) |
| **SEC-02** | Default-Open Webhook Verification & Non-Constant-Time Secret Check | **HIGH** | Authentication Bypass / Timing | [apps/api/routers/webhook.py:24-44](file:///d:/PROJECTS/analyzer/apps/api/routers/webhook.py#L24-L44) |
| **SEC-03** | Missing Authorization on Destructive Watchlist Operations | **MEDIUM** | Broken Access Control | [apps/api/routers/tracker.py:481-592](file:///d:/PROJECTS/analyzer/apps/api/routers/tracker.py#L481-L592) |
| **SEC-04** | Unbounded Bulk Import Input Causing Worker Queue & Connection Exhaustion | **MEDIUM** | Denial of Service (DoS) | [apps/api/routers/tracker.py:28-32](file:///d:/PROJECTS/analyzer/apps/api/routers/tracker.py#L28-L32), [132-231](file:///d:/PROJECTS/analyzer/apps/api/routers/tracker.py#L132-L231) |
| **SEC-05** | Overly Permissive CORS Regex with Hardcoded Foreign Public IP Range | **MEDIUM** | Security Misconfiguration | [apps/api/main.py:15-23](file:///d:/PROJECTS/analyzer/apps/api/main.py#L15-L23) |
| **SEC-06** | Unthrottled External DexScreener Oracle Invocations (Downstream DoS) | **LOW** | Resource Exhaustion | [apps/api/routers/wallet.py:322-379](file:///d:/PROJECTS/analyzer/apps/api/routers/wallet.py#L322-L379) |
| **SEC-07** | Default Network Exposure via Wildcard Interface Binding (`0.0.0.0`) | **LOW** | Deployment Hardening | [.env.example:17](file:///d:/PROJECTS/analyzer/.env.example#L17) |

---

## 3. Detailed Findings & Concrete Remediation

### [SEC-01] Unauthenticated Helius Webhook Administration & Blind SSRF / Hijacking
- **Severity**: **HIGH**
- **Boundary**: Untrusted Network Client $\rightarrow$ Third-Party Cloud Admin API (`api.helius.xyz`)
- **Location**: [apps/api/routers/webhook.py:143-225](file:///d:/PROJECTS/analyzer/apps/api/routers/webhook.py#L143-L225)

#### Analysis
The endpoints `POST /api/webhooks/helius/setup`, `GET /api/webhooks/helius/list`, and `GET /api/webhooks/helius/status` have zero authentication or authorization checks.
1. `POST /api/webhooks/helius/setup` accepts arbitrary `webhook_url` and `auth_header` strings and registers them directly with Helius using the server's private `HELIUS_API_KEY`:
   ```python
   # Line 178: apps/api/routers/webhook.py
   helius_url = f"https://api.helius.xyz/v0/webhooks?api-key={api_key}"
   async with httpx.AsyncClient(timeout=15.0) as client:
       resp = await client.post(helius_url, json=webhook_payload)
   ```
2. Any remote unauthenticated attacker can supply an attacker-controlled endpoint (e.g. `https://attacker.com/steal-events`) to hijack all real-time transaction events and tracked wallet activity pushed by Helius.
3. An attacker can also provide internal URLs or cloud metadata endpoints (`http://169.254.169.254`), making Helius contact arbitrary endpoints.
4. `GET /api/webhooks/helius/list` leaks all currently registered webhooks and authentication secrets configured on Helius.
5. `GET /api/webhooks/helius/status` enumerates all tracked Solana wallet addresses.

#### Remediation
Protect these management endpoints with an administrative token/API key check (or internal secret requirement), and validate the `webhook_url` format (must be a publicly routable HTTPS URL):

```diff
--- a/apps/api/routers/webhook.py
+++ b/apps/api/routers/webhook.py
@@ -1,6 +1,8 @@
+import secrets
 import os
+from urllib.parse import urlparse
 from typing import Any, Dict, List, Optional, Union
-from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request, status
+from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request, Security, status
+from fastapi.security import APIKeyHeader
 
+ADMIN_KEY_HEADER = APIKeyHeader(name="X-Admin-Secret", auto_error=False)
+
+def verify_admin_key(api_key: Optional[str] = Security(ADMIN_KEY_HEADER)):
+    admin_secret = os.getenv("APP_ADMIN_SECRET")
+    if not admin_secret or not api_key or not secrets.compare_digest(api_key, admin_secret):
+        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized administration request.")
```

---

### [SEC-02] Default-Open Webhook Verification & Non-Constant-Time Secret Check
- **Severity**: **HIGH**
- **Boundary**: Untrusted Network Client $\rightarrow$ Transaction Ingestion & Database Query Pipeline
- **Location**: [apps/api/routers/webhook.py:24-44](file:///d:/PROJECTS/analyzer/apps/api/routers/webhook.py#L24-L44)

#### Analysis
In `receive_helius_webhook`:
```python
# 1. Verify Secret Header if HELIUS_WEBHOOK_SECRET is configured
expected_secret = os.getenv("HELIUS_WEBHOOK_SECRET")
if expected_secret:
    if not authorization or authorization != expected_secret:
        raise HTTPException(...)
```
1. **Default Fail-Open**: If `HELIUS_WEBHOOK_SECRET` is unset in `.env` (which is omitted in `.env.example`), `expected_secret` evaluates to `None` or empty string. The condition `if expected_secret:` is skipped entirely. The endpoint accepts any unauthenticated POST request from the public internet.
2. **Forged Event Injection**: An attacker can send forged transaction events, forcing the system to execute database queries for accounts and schedule background sync tasks (`sync_wallet_history`) on arbitrary wallets.
3. **Timing Attack**: When configured, `authorization != expected_secret` uses standard string comparison, which leaks character matching latency.

#### Remediation
Enforce authentication strictly (fail-closed) and use constant-time comparison via `secrets.compare_digest`:

```diff
--- a/apps/api/routers/webhook.py
+++ b/apps/api/routers/webhook.py
@@ -36,8 +36,13 @@ async def receive_helius_webhook(
-    expected_secret = os.getenv("HELIUS_WEBHOOK_SECRET")
-    if expected_secret:
-        if not authorization or authorization != expected_secret:
-            raise HTTPException(
-                status_code=status.HTTP_401_UNAUTHORIZED,
-                detail="Invalid or missing webhook authorization secret.",
-            )
+    expected_secret = os.getenv("HELIUS_WEBHOOK_SECRET")
+    if not expected_secret:
+        raise HTTPException(
+            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
+            detail="Webhook secret not configured on server.",
+        )
+    if not authorization or not secrets.compare_digest(authorization, expected_secret):
+        raise HTTPException(
+            status_code=status.HTTP_401_UNAUTHORIZED,
+            detail="Invalid or missing webhook authorization secret.",
+        )
```

---

### [SEC-03] Missing Authorization on Destructive Watchlist Operations
- **Severity**: **MEDIUM**
- **Boundary**: Untrusted Client $\rightarrow$ Watchlist Database Records
- **Location**: [apps/api/routers/tracker.py:481-592](file:///d:/PROJECTS/analyzer/apps/api/routers/tracker.py#L481-L592)

#### Analysis
The tracker router exposes several state-altering and destructive endpoints:
- `POST /api/wallets/dormant/cleanup` — Immediately untracks all wallets that haven't traded in 30 days.
- `POST /api/wallets/bulk-untrack` — Untracks an array of arbitrary wallets.
- `PATCH /api/wallets/{address}` — Overwrites tags, custom labels, and tracking status.
- `DELETE /api/wallets/{address}` — Untracks the specified wallet.

None of these endpoints require authentication, sessions, or anti-CSRF protection. If the API is exposed on `0.0.0.0` or shared on a network, any user or script can untrack and tamper with the portfolio monitor database.

#### Remediation
If running in single-user or local mode, bind to `127.0.0.1` only. If exposed on a server or remote interface, guard mutating routes with an API key dependency or session check.

---

### [SEC-04] Unbounded Bulk Import Input Causing Worker Queue & Connection Exhaustion
- **Severity**: **MEDIUM**
- **Boundary**: HTTP Request Payload $\rightarrow$ Database Connection Pool & Async Worker Dispatcher
- **Location**: [apps/api/routers/tracker.py:28-32](file:///d:/PROJECTS/analyzer/apps/api/routers/tracker.py#L28-L32), [132-231](file:///d:/PROJECTS/analyzer/apps/api/routers/tracker.py#L132-L231)

#### Analysis
In `apps/api/routers/tracker.py`:
```python
class BulkImportRequest(BaseModel):
    addresses: List[str]
    default_label: Optional[str] = None
    auto_sync: bool = True
```
1. `addresses` has no maximum length constraint. An attacker can send an array with 10,000 or 100,000 items in a single request.
2. In `bulk_import_wallets`, each address is queried sequentially in a loop:
   ```python
   for addr, custom_label in parsed_entries:
       stmt = select(Wallet).where(Wallet.address == addr)
       res = await db.execute(stmt)  # O(N) database queries
   ```
3. When `auto_sync: True`, it schedules thousands of background tasks:
   ```python
   for addr in imported_addresses:
       background_tasks.add_task(sync_wallet_history, addr)
   ```
   Each sync worker makes multiple external JSON-RPC requests, parses transactions, and consumes database connections. This creates severe connection pool exhaustion and crashes or rate-limits the backend.

#### Remediation
Add a strict upper bound on input arrays and use batch query lookups instead of per-item SQL executions:

```diff
--- a/apps/api/routers/tracker.py
+++ b/apps/api/routers/tracker.py
@@ -28,5 +28,5 @@ router = APIRouter(prefix="/api/wallets", tags=["Wallet Tracker"])
 class BulkImportRequest(BaseModel):
-    addresses: List[str]
+    addresses: List[str] = Field(..., max_length=100, description="Max 100 addresses per batch")
     default_label: Optional[str] = None
     auto_sync: bool = True
```

---

### [SEC-05] Overly Permissive CORS Regex with Hardcoded Foreign Public IP Range
- **Severity**: **MEDIUM**
- **Boundary**: Browser Cross-Origin Security Model $\rightarrow$ Internal API
- **Location**: [apps/api/main.py:15-23](file:///d:/PROJECTS/analyzer/apps/api/main.py#L15-L23)

#### Analysis
In `apps/api/main.py`:
```python
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True if origins != ["*"] else False,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|123\.123\.\d+\.\d+)(:\d+)?$",
    allow_methods=["*"],
    allow_headers=["*"],
)
```
1. **Hardcoded Public IP Range**: `123.123.\d+\.\d+` is an arbitrary public IPv4 block (assigned to China Telecom). Web applications hosted on `http://123.123.x.x` can make authenticated cross-origin requests to this backend.
2. **Broad LAN Pattern**: `192.168.*.*` and `10.*.*.*` allows any machine on the local network to perform cross-origin actions against the user's running API instance.
3. Combining wildcard/regex patterns with `allow_credentials=True` violates security best practices and exposes API responses to cross-site origin snooping.

#### Remediation
Remove anomalous IP ranges from regex, and define exact trusted origins via environment variable `CORS_ORIGINS`:

```diff
--- a/apps/api/main.py
+++ b/apps/api/main.py
@@ -14,11 +14,10 @@ app = FastAPI(
 # CORS Middleware
-origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
+cors_origins_env = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
+origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
 app.add_middleware(
     CORSMiddleware,
-    allow_origins=origins if origins != ["*"] else ["*"],
-    allow_credentials=True if origins != ["*"] else False,
-    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|123\.123\.\d+\.\d+)(:\d+)?$",
-    allow_methods=["*"],
+    allow_origins=origins,
+    allow_credentials=True,
+    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
     allow_headers=["*"],
 )
```

---

### [SEC-06] Unthrottled External DexScreener Oracle Invocations (Downstream DoS)
- **Severity**: **LOW**
- **Boundary**: HTTP Client $\rightarrow$ Third-Party DexScreener API
- **Location**: [apps/api/routers/wallet.py:322-379](file:///d:/PROJECTS/analyzer/apps/api/routers/wallet.py#L322-L379)

#### Analysis
The endpoint `POST /api/wallet/{address}/refresh-prices` queries the database for all open positions and triggers external network calls to DexScreener via `fetch_token_metadata_and_prices(mints)`.
Because this endpoint has no cooldown or rate-limiting per client or wallet, rapid repeated calls will exceed DexScreener's rate limits (HTTP 429), triggering temporary IP bans that break pricing for all platform users.

#### Remediation
Enforce an in-memory or database timestamp check (e.g., minimum 30 or 60 seconds interval between refresh calls for the same wallet).

---

### [SEC-07] Default Network Exposure via Wildcard Interface Binding (`0.0.0.0`)
- **Severity**: **LOW**
- **Boundary**: Operating System Socket Binding
- **Location**: [.env.example:17](file:///d:/PROJECTS/analyzer/.env.example#L17)

#### Analysis
In `.env.example`, `HOST=0.0.0.0` is specified by default.
In development environments without container network isolation, binding to `0.0.0.0` exposes unauthenticated developer APIs to everyone on the local WiFi/LAN network.

#### Remediation
Set default host to `127.0.0.1` in `.env.example`:
```diff
--- a/.env.example
+++ b/.env.example
@@ -17,3 +17,3 @@ CLASSIFICATION_CONFIG_PATH=./config/classification_thresholds.json
 # API Settings
-HOST=0.0.0.0
+HOST=127.0.0.1
 PORT=8000
```

---

## 4. Verification & Validation Details

| Item | Validation Strategy | Result |
|---|---|---|
| Address Validation | Regular expression `^[1-9A-HJ-NP-za-km-z]{32,44}$` checked on all inputs | Validated safe against format-based injection. |
| SQL Injection | SQLAlchemy ORM & Core expressions parameterize all queries | Safe from SQL injection in application queries. |
| Secrets Leakage | Git status & `.gitignore` checks confirm `.env` is uncommitted | Safe from repository credential leak. |
| Timezone Handling | `datetime.utcnow()` vs aware UTC timestamps | Non-security logic warning (Python 3.12 deprecation). |
| Unit Engine Tests | Math engines (PnL, WACB, Swap Detector, Holding distribution) | All 9 non-DB tests pass cleanly. |

---

## 5. Prioritized Action Checklist (Ponytail Minimal-Diff Plan)

1. **[Immediate] Lock Webhook Secret (SEC-02)**: Change `if expected_secret:` to fail-closed (`if not expected_secret: raise 500`) and use `secrets.compare_digest`.
2. **[Immediate] Clean CORS Settings (SEC-05)**: Delete `123.123.\d+\.\d+` from `main.py` and rely on explicit origins.
3. **[Immediate] Cap Bulk Import (SEC-04)**: Add `Field(..., max_length=100)` to `BulkImportRequest.addresses`.
4. **[High] Secure Webhook Admin Endpoints (SEC-01)**: Add `verify_admin_key` dependency to `/api/webhooks/helius/setup` and `/api/webhooks/helius/list`.
5. **[Medium] Default to Localhost (SEC-07)**: Keep `HOST=127.0.0.1` in `.env.example`.
