import asyncio
from datetime import datetime, timezone
from decimal import Decimal
import logging
import time
from typing import Dict, List, Optional
import httpx

logger = logging.getLogger("price_oracle")

# In-memory price cache: { mint: (price_decimal, expiry_timestamp) }
_PRICE_CACHE: Dict[str, tuple[Decimal, float]] = {}
CACHE_TTL_SECONDS = 60.0


async def fetch_token_prices(token_mints: List[str], timeout: float = 10.0) -> Dict[str, Decimal]:
    """
    Fetch current USD price for Solana tokens using DexScreener API.
    Supports batching up to 30 tokens per request.
    Caches prices for 60 seconds.
    """
    now = time.time()
    results: Dict[str, Decimal] = {}
    to_fetch: List[str] = []

    # Check cache first
    for mint in token_mints:
        clean_mint = mint.strip()
        if not clean_mint:
            continue
        cached = _PRICE_CACHE.get(clean_mint)
        if cached and cached[1] > now:
            results[clean_mint] = cached[0]
        else:
            to_fetch.append(clean_mint)

    if not to_fetch:
        return results

    # DexScreener supports up to 30 tokens comma-separated per request
    chunk_size = 30
    for i in range(0, len(to_fetch), chunk_size):
        chunk = to_fetch[i : i + chunk_size]
        query_str = ",".join(chunk)
        url = f"https://api.dexscreener.com/latest/dex/tokens/{query_str}"

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.get(url, headers={"Accept": "application/json"})
                if res.status_code == 200:
                    data = res.json()
                    pairs = data.get("pairs") or []
                    
                    # Group by base token mint, select pair with highest liquidity
                    best_pairs: Dict[str, dict] = {}
                    for pair in pairs:
                        base_addr = pair.get("baseToken", {}).get("address")
                        if not base_addr:
                            continue
                        liq = float(pair.get("liquidity", {}).get("usd") or 0)
                        if base_addr not in best_pairs or liq > best_pairs[base_addr]["liq"]:
                            best_pairs[base_addr] = {"price": pair.get("priceUsd"), "liq": liq}

                    for mint in chunk:
                        if mint in best_pairs and best_pairs[mint]["price"]:
                            try:
                                price_dec = Decimal(str(best_pairs[mint]["price"]))
                                results[mint] = price_dec
                                _PRICE_CACHE[mint] = (price_dec, now + CACHE_TTL_SECONDS)
                            except Exception:
                                results[mint] = Decimal("0")
                        else:
                            # Token not found or has 0 liquidity
                            results[mint] = Decimal("0")
                else:
                    logger.warning(f"DexScreener API returned HTTP {res.status_code} for chunk {chunk[:3]}...")
                    for mint in chunk:
                        results[mint] = results.get(mint, Decimal("0"))
        except Exception as exc:
            logger.warning(f"Failed to fetch prices from DexScreener: {exc}")
            for mint in chunk:
                results[mint] = results.get(mint, Decimal("0"))

    return results


async def get_single_token_price(token_mint: str) -> Decimal:
    """Convenience helper to fetch USD price for a single Solana token."""
    res = await fetch_token_prices([token_mint])
    return res.get(token_mint, Decimal("0"))
