from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

SOL_MINT = "So11111111111111111111111111111111111111112"
USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"

QUOTE_TOKENS = {SOL_MINT, USDC_MINT, USDT_MINT}

DEX_PROGRAM_IDS = {
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium V4",
    "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C": "Raydium CPMM",
    "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK": "Raydium CLMM",
    "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": "Orca Whirlpool",
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": "Jupiter v6",
    "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB": "Jupiter v4",
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": "Pump.fun",
}


def identify_dex(raw_tx: Dict[str, Any]) -> Optional[str]:
    """Identify which DEX was used based on program IDs in accountKeys or instructions."""
    tx_inner = raw_tx.get("transaction", {})
    message = tx_inner.get("message", {})
    account_keys = message.get("accountKeys", [])

    program_ids_found = set()
    for acc in account_keys:
        pubkey = acc if isinstance(acc, str) else acc.get("pubkey")
        if pubkey in DEX_PROGRAM_IDS:
            program_ids_found.add(DEX_PROGRAM_IDS[pubkey])

    if program_ids_found:
        return ", ".join(sorted(program_ids_found))
    return None


def detect_swap_and_reconstruct_trade(
    transfers: List[Dict[str, Any]], raw_tx: Dict[str, Any]
) -> Tuple[Optional[Dict[str, Any]], str, Optional[str]]:
    """
    Reconstruct trade from token/SOL transfers of a wallet.
    Returns: (trade_dict or None, status: 'TRADE' | 'TRANSFER' | 'UNKNOWN', reason or None)
    """
    if not transfers:
        return None, "TRANSFER", "No economic balance change detected"

    ins = [t for t in transfers if t["direction"] == "IN"]
    outs = [t for t in transfers if t["direction"] == "OUT"]

    # If only IN or only OUT, it's a deposit, withdrawal, or transfer, not a swap
    if not ins or not outs:
        return None, "TRANSFER", "One-way asset movement"

    dex_name = identify_dex(raw_tx)

    # 1. Simple Single Token Swap (1 IN, 1 OUT)
    if len(ins) == 1 and len(outs) == 1:
        in_t = ins[0]
        out_t = outs[0]

        # Case A: Quote OUT -> Base Token IN (BUY)
        if out_t["token_address"] in QUOTE_TOKENS and in_t["token_address"] not in QUOTE_TOKENS:
            token_amount = in_t["amount"]
            quote_amount = out_t["amount"]
            price = quote_amount / token_amount if token_amount > 0 else Decimal("0")
            return (
                {
                    "side": "BUY",
                    "token_address": in_t["token_address"],
                    "token_amount": token_amount,
                    "quote_amount": quote_amount,
                    "price": price,
                    "timestamp": in_t["timestamp"],
                    "dex": dex_name or "DEX",
                },
                "TRADE",
                None,
            )

        # Case B: Base Token OUT -> Quote IN (SELL)
        if in_t["token_address"] in QUOTE_TOKENS and out_t["token_address"] not in QUOTE_TOKENS:
            token_amount = out_t["amount"]
            quote_amount = in_t["amount"]
            price = quote_amount / token_amount if token_amount > 0 else Decimal("0")
            return (
                {
                    "side": "SELL",
                    "token_address": out_t["token_address"],
                    "token_amount": token_amount,
                    "quote_amount": quote_amount,
                    "price": price,
                    "timestamp": out_t["timestamp"],
                    "dex": dex_name or "DEX",
                },
                "TRADE",
                None,
            )

        # Wrap / Unwrap SOL (WSOL <-> SOL)
        if in_t["token_address"] in QUOTE_TOKENS and out_t["token_address"] in QUOTE_TOKENS:
            return None, "TRANSFER", "SOL wrapping/unwrapping or stable swap"

    # 2. Multi-hop Aggregator Swap (Jupiter / Raydium router)
    # Check if there is exactly 1 non-quote token
    non_quote_ins = [t for t in ins if t["token_address"] not in QUOTE_TOKENS]
    non_quote_outs = [t for t in outs if t["token_address"] not in QUOTE_TOKENS]

    if len(non_quote_ins) == 1 and len(non_quote_outs) == 0:
        # Multi-quote/hop BUY
        base_t = non_quote_ins[0]
        total_quote_spent = sum(t["amount"] for t in outs if t["token_address"] in QUOTE_TOKENS)
        price = total_quote_spent / base_t["amount"] if base_t["amount"] > 0 else Decimal("0")
        return (
            {
                "side": "BUY",
                "token_address": base_t["token_address"],
                "token_amount": base_t["amount"],
                "quote_amount": total_quote_spent,
                "price": price,
                "timestamp": base_t["timestamp"],
                "dex": dex_name or "Aggregator",
            },
            "TRADE",
            None,
        )

    if len(non_quote_outs) == 1 and len(non_quote_ins) == 0:
        # Multi-quote/hop SELL
        base_t = non_quote_outs[0]
        total_quote_received = sum(t["amount"] for t in ins if t["token_address"] in QUOTE_TOKENS)
        price = total_quote_received / base_t["amount"] if base_t["amount"] > 0 else Decimal("0")
        return (
            {
                "side": "SELL",
                "token_address": base_t["token_address"],
                "token_amount": base_t["amount"],
                "quote_amount": total_quote_received,
                "price": price,
                "timestamp": base_t["timestamp"],
                "dex": dex_name or "Aggregator",
            },
            "TRADE",
            None,
        )

    return None, "UNKNOWN", f"Ambiguous swap pattern: {len(ins)} IN, {len(outs)} OUT"
