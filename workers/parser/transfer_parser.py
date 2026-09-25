from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

SOL_MINT = "So11111111111111111111111111111111111111112"
LAMPORTS_PER_SOL = Decimal("1000000000")


def parse_transaction_transfers(
    raw_tx: Dict[str, Any], wallet_address: str
) -> List[Dict[str, Any]]:
    """
    Extract token and native SOL transfers for a specific wallet address from a parsed Solana transaction.
    Returns a list of transfer dicts with:
    - token_address: str
    - direction: 'IN' | 'OUT'
    - amount: Decimal
    - timestamp: datetime
    """
    transfers: List[Dict[str, Any]] = []
    meta = raw_tx.get("meta")
    if not meta or meta.get("err") is not None:
        return []

    block_time = raw_tx.get("blockTime")
    timestamp = datetime.utcfromtimestamp(block_time) if block_time else datetime.utcnow()

    # 1. Native SOL Balance Movement
    tx_inner = raw_tx.get("transaction", {})
    message = tx_inner.get("message", {})
    account_keys = message.get("accountKeys", [])

    # Find wallet index in accountKeys
    wallet_idx = -1
    for idx, acc in enumerate(account_keys):
        pubkey = acc if isinstance(acc, str) else acc.get("pubkey")
        if pubkey == wallet_address:
            wallet_idx = idx
            break

    if wallet_idx != -1:
        pre_balances = meta.get("preBalances", [])
        post_balances = meta.get("postBalances", [])
        if len(pre_balances) > wallet_idx and len(post_balances) > wallet_idx:
            pre_bal = Decimal(str(pre_balances[wallet_idx]))
            post_bal = Decimal(str(post_balances[wallet_idx]))
            diff = post_bal - pre_bal

            # If wallet is the fee payer (index 0), account for the gas fee
            if wallet_idx == 0:
                fee = Decimal(str(meta.get("fee", 0)))
                # Actual economic transfer excluding network gas fee
                net_sol = diff + fee
            else:
                net_sol = diff

            if abs(net_sol) > Decimal("1000"):  # Ignore micro-dust (< 0.000001 SOL)
                sol_amount = abs(net_sol) / LAMPORTS_PER_SOL
                direction = "IN" if net_sol > 0 else "OUT"
                transfers.append(
                    {
                        "token_address": SOL_MINT,
                        "direction": direction,
                        "amount": sol_amount,
                        "timestamp": timestamp,
                    }
                )

    # 2. SPL Token Balance Movements
    pre_tokens = meta.get("preTokenBalances", [])
    post_tokens = meta.get("postTokenBalances", [])

    def get_token_map(balances: List[Dict[str, Any]]) -> Dict[str, Decimal]:
        token_map: Dict[str, Decimal] = {}
        for b in balances:
            owner = b.get("owner")
            if owner == wallet_address:
                mint = b.get("mint")
                ui_amount_str = b.get("uiTokenAmount", {}).get("uiAmountString")
                if mint and ui_amount_str is not None:
                    token_map[mint] = Decimal(ui_amount_str)
        return token_map

    pre_map = get_token_map(pre_tokens)
    post_map = get_token_map(post_tokens)

    all_mints = set(pre_map.keys()).union(set(post_map.keys()))
    for mint in all_mints:
        pre_amt = pre_map.get(mint, Decimal("0"))
        post_amt = post_map.get(mint, Decimal("0"))
        diff = post_amt - pre_amt

        if diff != Decimal("0"):
            transfers.append(
                {
                    "token_address": mint,
                    "direction": "IN" if diff > 0 else "OUT",
                    "amount": abs(diff),
                    "timestamp": timestamp,
                }
            )

    return transfers
