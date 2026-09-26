from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from unittest.mock import AsyncMock, patch

from workers.fetcher.price_oracle import fetch_token_prices, _PRICE_CACHE


@pytest.mark.asyncio
async def test_price_oracle_caching_and_parsing():
    # Test batch token price parsing with mock
    mock_response = {
        "pairs": [
            {
                "baseToken": {"address": "TokenA111111111111111111111111111111111111"},
                "priceUsd": "1.25",
                "liquidity": {"usd": 50000},
            },
            {
                "baseToken": {"address": "TokenA111111111111111111111111111111111111"},
                "priceUsd": "1.20",
                "liquidity": {"usd": 1000},
            },
            {
                "baseToken": {"address": "TokenB222222222222222222222222222222222222"},
                "priceUsd": "0.005",
                "liquidity": {"usd": 200000},
            },
        ]
    }

    mock_client = AsyncMock()
    mock_client.get.return_value = AsyncMock(status_code=200, json=lambda: mock_response)
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None

    with patch("workers.fetcher.price_oracle.httpx.AsyncClient", return_value=mock_client):
        # Clear cache for testing
        _PRICE_CACHE.clear()
        tokens = [
            "TokenA111111111111111111111111111111111111",
            "TokenB222222222222222222222222222222222222",
        ]
        prices = await fetch_token_prices(tokens)

        # Higher liquidity pair should be chosen (1.25, not 1.20)
        assert prices["TokenA111111111111111111111111111111111111"] == Decimal("1.25")
        assert prices["TokenB222222222222222222222222222222222222"] == Decimal("0.005")

        # Second call should use cache without calling network
        mock_client.get.reset_mock()
        cached_prices = await fetch_token_prices(tokens)
        assert cached_prices["TokenA111111111111111111111111111111111111"] == Decimal("1.25")
        mock_client.get.assert_not_called()
