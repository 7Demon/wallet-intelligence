import asyncio
import os
import re
from typing import Any, Dict, List, Optional
import httpx
from dotenv import load_dotenv

load_dotenv()

BASE58_PATTERN = re.compile(r"^[1-9A-HJ-NP-za-km-z]{32,44}$")


def validate_solana_address(address: str) -> bool:
    """Validate whether a string is a syntactically valid Solana base58 address."""
    return bool(BASE58_PATTERN.match(address.strip()))


class SolanaClient:
    """Solana JSON-RPC client optimized for fetching wallet transaction history."""

    def __init__(
        self,
        rpc_url: Optional[str] = None,
        max_retries: int = 5,
        base_delay: float = 0.5,
        timeout: float = 30.0,
    ):
        self.rpc_url = rpc_url or os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.timeout = timeout

    async def _post_rpc(self, payload: Any) -> Any:
        """Execute an RPC call with retry and exponential backoff for rate limits."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            delay = self.base_delay
            for attempt in range(self.max_retries):
                try:
                    response = await client.post(
                        self.rpc_url,
                        json=payload,
                        headers={"Content-Type": "application/json"},
                    )
                    if response.status_code == 429:  # Rate limited
                        await asyncio.sleep(delay)
                        delay *= 2
                        continue
                    response.raise_for_status()
                    data = response.json()
                    return data
                except (httpx.HTTPError, httpx.TimeoutException) as exc:
                    if attempt == self.max_retries - 1:
                        raise RuntimeError(f"Solana RPC request failed after {self.max_retries} attempts: {exc}")
                    await asyncio.sleep(delay)
                    delay *= 2

    async def get_signatures_for_address(
        self,
        address: str,
        limit: int = 100,
        before: Optional[str] = None,
        until: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch confirmed transaction signatures for a given wallet address."""
        if not validate_solana_address(address):
            raise ValueError(f"Invalid Solana address: {address}")

        config: Dict[str, Any] = {"limit": min(limit, 1000)}
        if before:
            config["before"] = before
        if until:
            config["until"] = until

        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getSignaturesForAddress",
            "params": [address, config],
        }

        res = await self._post_rpc(payload)
        if "error" in res:
            raise RuntimeError(f"RPC Error getSignaturesForAddress: {res['error']}")
        return res.get("result", [])

    async def get_parsed_transaction(self, signature: str) -> Optional[Dict[str, Any]]:
        """Fetch a single transaction in jsonParsed format."""
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getTransaction",
            "params": [
                signature,
                {
                    "encoding": "jsonParsed",
                    "maxSupportedTransactionVersion": 0,
                },
            ],
        }
        res = await self._post_rpc(payload)
        if "error" in res:
            raise RuntimeError(f"RPC Error getTransaction: {res['error']}")
        return res.get("result")

    async def get_parsed_transactions_batch(
        self, signatures: List[str]
    ) -> List[Optional[Dict[str, Any]]]:
        """Fetch multiple transactions in a single batch JSON-RPC request."""
        if not signatures:
            return []

        payload = [
            {
                "jsonrpc": "2.0",
                "id": i,
                "method": "getTransaction",
                "params": [
                    sig,
                    {
                        "encoding": "jsonParsed",
                        "maxSupportedTransactionVersion": 0,
                    },
                ],
            }
            for i, sig in enumerate(signatures)
        ]

        batch_res = await self._post_rpc(payload)
        if not isinstance(batch_res, list):
            raise RuntimeError("Expected batch response array from Solana RPC")

        # Sort responses by id to match signatures order
        results_by_id = {item.get("id"): item.get("result") for item in batch_res if isinstance(item, dict)}
        return [results_by_id.get(i) for i in range(len(signatures))]
