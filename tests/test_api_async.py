from unittest.mock import AsyncMock, patch
import pytest
import httpx
from apps.api.main import app


@pytest.mark.asyncio
async def test_healthz():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/healthz")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
    print("[OK] /healthz endpoint passed.")


@pytest.mark.asyncio
async def test_invalid_address():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/wallet/invalid_address_123/sync")
        assert response.status_code == 400
    print("[OK] Invalid address rejected with 400.")


@pytest.mark.asyncio
async def test_sync_trigger():
    valid_addr = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
    transport = httpx.ASGITransport(app=app)
    with patch("apps.api.routers.wallet.sync_wallet_history", new_callable=AsyncMock) as mock_sync:
        mock_sync.return_value = {"status": "COMPLETED"}
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.post(f"/api/wallet/{valid_addr}/sync")
            assert response.status_code == 202
            data = response.json()
            assert data["wallet_address"] == valid_addr
            assert data["status"] == "PENDING"
    print("[OK] Sync trigger endpoint passed.")


@pytest.mark.asyncio
async def test_wallet_not_found():
    unseen_addr = "9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get(f"/api/wallet/{unseen_addr}")
        assert response.status_code == 404
    print("[OK] 404 Not Found for unseen wallet passed.")


@pytest.mark.asyncio
async def test_bulk_import_and_list():
    transport = httpx.ASGITransport(app=app)
    sample_addresses = [
        "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
        "invalid_addr_test_xxx",
    ]
    with patch("apps.api.routers.tracker.sync_wallet_history", new_callable=AsyncMock) as mock_sync:
        mock_sync.return_value = {"status": "COMPLETED"}
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Bulk import
            res = await ac.post(
                "/api/wallets/bulk-import",
                json={
                    "addresses": sample_addresses,
                    "default_label": "Test Alpha",
                    "auto_sync": False,
                },
            )
            assert res.status_code == 200
            data = res.json()
            assert data["imported_count"] + data["already_tracked_count"] == 2
            assert len(data["invalid_addresses"]) == 1

            # 2. List tracked wallets
            list_res = await ac.get("/api/wallets")
            assert list_res.status_code == 200
            list_data = list_res.json()
            assert list_data["total_records"] >= 2

            # 3. Overview
            ov_res = await ac.get("/api/wallets/tracker/overview")
            assert ov_res.status_code == 200
            assert ov_res.json()["total_tracked_wallets"] >= 2
    print("[OK] Bulk import, list, and tracker overview endpoints passed.")
