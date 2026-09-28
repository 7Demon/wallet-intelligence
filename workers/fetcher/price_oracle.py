import asyncio
from datetime import datetime, timezone
from decimal import Decimal
import logging
import time
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger("price_oracle")

SOL_MINT = "So11111111111111111111111111111111111111112"
USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"

KNOWN_TOKENS: Dict[str, Dict[str, str]] = {
    SOL_MINT: {"symbol": "SOL", "name": "Solana"},
    USDC_MINT: {"symbol": "USDC", "name": "USD Coin"},
    USDT_MINT: {"symbol": "USDT", "name": "Tether USD"},
}

# In-memory price cache: { mint: (price_decimal, expiry_timestamp, symbol, name) }
_PRICE_CACHE: Dict[str, tuple[Decimal, float, Optional[str], Optional[str]]] = {}
CACHE_TTL_SECONDS = 60.0


async def fetch_token_metadata_and_prices(
    token_mints: List[str], timeout: float = 10.0
) -> Dict[str, Dict[str, Any]]:
    """
    Fetch current USD price, symbol, and name for Solana tokens using DexScreener API.
    Supports batching up to 30 tokens per request.
    Caches results for 60 seconds.
    """
    now = time.time()
    results: Dict[str, Dict[str, Any]] = {}
    to_fetch: List[str] = []

    # Check cache and known tokens first
    for mint in token_mints:
        clean_mint = mint.strip()
        if not clean_mint:
            continue
        cached = _PRICE_CACHE.get(clean_mint)
        if cached and cached[1] > now:
            results[clean_mint] = {
                "price": cached[0],
                "symbol": cached[2] or KNOWN_TOKENS.get(clean_mint, {}).get("symbol"),
                "name": cached[3] or KNOWN_TOKENS.get(clean_mint, {}).get("name"),
            }
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
                        base_token = pair.get("baseToken") or {}
                        base_addr = base_token.get("address")
                        if not base_addr:
                            continue
                        liq = float(pair.get("liquidity", {}).get("usd") or 0)
                        if base_addr not in best_pairs or liq > best_pairs[base_addr]["liq"]:
                            best_pairs[base_addr] = {
                                "price": pair.get("priceUsd"),
                                "liq": liq,
                                "symbol": base_token.get("symbol"),
                                "name": base_token.get("name"),
                            }

                    for mint in chunk:
                        known = KNOWN_TOKENS.get(mint, {})
                        if mint in best_pairs and best_pairs[mint]["price"]:
                            try:
                                price_dec = Decimal(str(best_pairs[mint]["price"]))
                                sym = best_pairs[mint].get("symbol") or known.get("symbol")
                                nm = best_pairs[mint].get("name") or known.get("name")
                                results[mint] = {
                                    "price": price_dec,
                                    "symbol": sym,
                                    "name": nm,
                                }
                                _PRICE_CACHE[mint] = (price_dec, now + CACHE_TTL_SECONDS, sym, nm)
                            except Exception:
                                results[mint] = {
                                    "price": Decimal("0"),
                                    "symbol": known.get("symbol"),
                                    "name": known.get("name"),
                                }
                        else:
                            # Token not found or has 0 liquidity
                            results[mint] = {
                                "price": Decimal("0"),
                                "symbol": known.get("symbol"),
                                "name": known.get("name"),
                            }
                else:
                    logger.warning(
                        f"DexScreener API returned HTTP {res.status_code} for chunk {chunk[:3]}..."
                    )
                    for mint in chunk:
                        known = KNOWN_TOKENS.get(mint, {})
                        results[mint] = results.get(
                            mint,
                            {
                                "price": Decimal("0"),
                                "symbol": known.get("symbol"),
                                "name": known.get("name"),
                            },
                        )
        except Exception as exc:
            logger.warning(f"Failed to fetch metadata from DexScreener: {exc}")
            for mint in chunk:
                known = KNOWN_TOKENS.get(mint, {})
                results[mint] = results.get(
                    mint,
                    {
                        "price": Decimal("0"),
                        "symbol": known.get("symbol"),
                        "name": known.get("name"),
                    },
                )

    return results


async def fetch_token_prices(token_mints: List[str], timeout: float = 10.0) -> Dict[str, Decimal]:
    """
    Fetch current USD price for Solana tokens using DexScreener API.
    Supports batching up to 30 tokens per request.
    Caches prices for 60 seconds.
    """
    meta_results = await fetch_token_metadata_and_prices(token_mints, timeout=timeout)
    return {mint: info["price"] for mint, info in meta_results.items()}


async def get_single_token_price(token_mint: str) -> Decimal:
    """Convenience helper to fetch USD price for a single Solana token."""
    res = await fetch_token_prices([token_mint])
    return res.get(token_mint, Decimal("0"))
