from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from apps.api.main import app

client = TestClient(app)


def test_healthz():
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    print("[OK] /healthz endpoint passed.")


def test_invalid_address_rejection():
    # Solana base58 invalid format
    response = client.post("/api/wallet/not_a_valid_solana_address_000/sync")
    assert response.status_code == 400
    print("[OK] Invalid Solana address rejected with 400 Bad Request.")


def test_valid_address_sync_trigger():
    valid_addr = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
    # Mock background worker so tests don't make real external network calls
    with patch("apps.api.routers.wallet.sync_wallet_history", new_callable=AsyncMock) as mock_sync:
        mock_sync.return_value = {"status": "COMPLETED"}
        response = client.post(f"/api/wallet/{valid_addr}/sync")
        assert response.status_code == 202
        data = response.json()
        assert data["wallet_address"] == valid_addr
        assert data["status"] == "PENDING"
    print("[OK] POST /api/wallet/{address}/sync accepted with 202.")


def test_wallet_not_found():
    unseen_addr = "9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
    response = client.get(f"/api/wallet/{unseen_addr}")
    assert response.status_code == 404
    print("[OK] GET /api/wallet/{address} returns 404 for unseen wallet.")


if __name__ == "__main__":
    test_healthz()
    test_invalid_address_rejection()
    test_valid_address_sync_trigger()
    test_wallet_not_found()
    print("\nALL API INTEGRATION TESTS PASSED SUCCESSFULLY!")
