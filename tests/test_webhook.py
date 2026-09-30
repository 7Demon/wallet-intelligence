import pytest
import httpx
from unittest.mock import AsyncMock, patch
from apps.api.main import app


@pytest.mark.asyncio
async def test_webhook_status():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/webhooks/helius/status")
        assert response.status_code == 200
        data = response.json()
        assert "configured" in data
        assert "tracked_wallets_count" in data
        assert isinstance(data["tracked_addresses"], list)
    print("[OK] /api/webhooks/helius/status passed.")


@pytest.mark.asyncio
async def test_webhook_receive_unmatched():
    transport = httpx.ASGITransport(app=app)
    sample_payload = [
        {
            "signature": "5test_signature_random_111",
            "feePayer": "UntrackedAddress1111111111111111111111111111",
            "type": "SWAP",
            "nativeTransfers": [],
            "tokenTransfers": [],
        }
    ]
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/webhooks/helius", json=sample_payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert len(data["matched_wallets"]) == 0
    print("[OK] Webhook receive unmatched transaction passed.")


@pytest.mark.asyncio
async def test_webhook_receive_matched():
    transport = httpx.ASGITransport(app=app)
    tracked_addr = "DN7HENoqJw9V983rmzBkx836RS5MbVB6EgazVciPgnXV"

    sample_payload = [
        {
            "signature": "5test_signature_matched_999",
            "feePayer": tracked_addr,
            "type": "SWAP",
            "nativeTransfers": [
                {
                    "fromUserAccount": tracked_addr,
                    "toUserAccount": "So11111111111111111111111111111111111111112",
                    "amount": 1000000000,
                }
            ],
            "tokenTransfers": [],
        }
    ]

    with patch("apps.api.routers.webhook.sync_wallet_history", new_callable=AsyncMock) as mock_sync:
        mock_sync.return_value = {"status": "COMPLETED"}
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.post("/api/webhooks/helius", json=sample_payload)
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert tracked_addr in data["matched_wallets"]
            assert data["transactions_received"] == 1
    print("[OK] Webhook receive matched transaction and scheduled sync passed.")


@pytest.mark.asyncio
async def test_webhook_secret_auth():
    transport = httpx.ASGITransport(app=app)
    with patch.dict("os.environ", {"HELIUS_WEBHOOK_SECRET": "my_secret_token_123"}):
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
            # Without auth header -> 401
            resp401 = await ac.post("/api/webhooks/helius", json=[])
            assert resp401.status_code == 401

            # With wrong auth header -> 401
            resp_wrong = await ac.post(
                "/api/webhooks/helius",
                json=[],
                headers={"Authorization": "wrong_secret"},
            )
            assert resp_wrong.status_code == 401

            # With correct auth header -> 200
            resp200 = await ac.post(
                "/api/webhooks/helius",
                json=[],
                headers={"Authorization": "my_secret_token_123"},
            )
            assert resp200.status_code == 200
    print("[OK] Webhook secret authentication validation passed.")
