import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from workers.parser.transfer_parser import parse_transaction_transfers, SOL_MINT
from workers.parser.swap_detector import detect_swap_and_reconstruct_trade
from workers.position_engine.position_builder import build_positions_from_trades
from workers.pnl_engine.pnl_calculator import calculate_wallet_metrics_and_classification


def test_swap_detection():
    # Mock Solana transaction: Wallet swaps 1 SOL for 1000 TEST_TOKEN
    wallet = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
    token_mint = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    now = datetime.utcnow()

    raw_tx = {
        "blockTime": int(now.timestamp()),
        "meta": {
            "err": None,
            "fee": 5000,
            "preBalances": [2000000000, 0],
            "postBalances": [999995000, 1000000000],  # Sent 1 SOL (-1,000,005,000 + 5000 fee = -1 SOL)
            "preTokenBalances": [],
            "postTokenBalances": [
                {
                    "owner": wallet,
                    "mint": token_mint,
                    "uiTokenAmount": {"uiAmountString": "1000.0"},
                }
            ],
        },
        "transaction": {
            "message": {
                "accountKeys": [
                    {"pubkey": wallet},
                    {"pubkey": "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"},  # Raydium V4
                ]
            }
        },
    }

    transfers = parse_transaction_transfers(raw_tx, wallet)
    assert len(transfers) == 2, f"Expected 2 transfers, got {len(transfers)}"

    trade, status, reason = detect_swap_and_reconstruct_trade(transfers, raw_tx)
    assert status == "TRADE", f"Expected status TRADE, got {status} ({reason})"
    assert trade is not None
    assert trade["side"] == "BUY"
    assert trade["token_address"] == token_mint
    assert trade["token_amount"] == Decimal("1000.0")
    assert trade["quote_amount"] == Decimal("1.0")
    assert trade["price"] == Decimal("0.001")
    assert "Raydium V4" in trade["dex"]
    print("[OK] Swap detection & trade reconstruction passed.")


def test_position_and_pnl_math():
    wallet_id = uuid.uuid4()
    token_id = uuid.uuid4()
    t0 = datetime(2026, 9, 1, 10, 0, 0)
    t1 = t0 + timedelta(hours=2)
    t2 = t0 + timedelta(hours=4)
    t3 = t0 + timedelta(hours=6)

    trades = [
        # Buy 100 @ $1 -> Cost = $100
        {
            "token_id": token_id,
            "side": "BUY",
            "token_amount": Decimal("100"),
            "quote_amount": Decimal("100"),
            "price": Decimal("1"),
            "timestamp": t0,
        },
        # Buy 300 @ $2 -> Cost = $600. Total Qty = 400, Total Cost = $700, Avg = $1.75
        {
            "token_id": token_id,
            "side": "BUY",
            "token_amount": Decimal("300"),
            "quote_amount": Decimal("600"),
            "price": Decimal("2"),
            "timestamp": t1,
        },
        # Sell 100 @ $3 -> Sold Cost = $175, Realized PnL = $300 - $175 = +$125. Remaining Qty = 300, Cost = $525
        {
            "token_id": token_id,
            "side": "SELL",
            "token_amount": Decimal("100"),
            "quote_amount": Decimal("300"),
            "price": Decimal("3"),
            "timestamp": t2,
        },
        # Sell 300 @ $4 -> Sold Cost = $525, Realized PnL = $1200 - $525 = +$675. Closed. Total Realized = $800
        {
            "token_id": token_id,
            "side": "SELL",
            "token_amount": Decimal("300"),
            "quote_amount": Decimal("1200"),
            "price": Decimal("4"),
            "timestamp": t3,
        },
    ]

    positions = build_positions_from_trades(trades, wallet_id)
    assert len(positions) == 1, f"Expected 1 completed position lifecycle, got {len(positions)}"
    pos = positions[0]

    assert pos["status"] == "CLOSED"
    assert pos["quantity"] == Decimal("0")
    assert pos["total_cost_basis"] == Decimal("0")
    assert pos["avg_entry_price"] == Decimal("1.75")
    assert pos["realized_pnl"] == Decimal("800"), f"Expected 800 realized PnL, got {pos['realized_pnl']}"
    assert pos["opened_at"] == t0
    assert pos["closed_at"] == t3
    print("[OK] Position WACB and partial/complete exit math passed.")

    # Test Metrics & Classification
    metrics = calculate_wallet_metrics_and_classification(
        wallet_id=wallet_id,
        trades=trades,
        positions=positions,
        first_seen_at=t0,
        last_seen_at=t3,
    )

    assert metrics["trade_count"] == 4
    assert metrics["winning_trades"] == 1
    assert metrics["losing_trades"] == 0
    assert metrics["win_rate"] == Decimal("100.0")
    assert metrics["realized_pnl"] == Decimal("800")
    # Hold duration: 6 hours = 21600 seconds
    assert metrics["median_hold_seconds"] == 21600
    assert metrics["trading_style"] == "SWING_TRADER"  # 2h - 3d
    print("[OK] Wallet metrics and rule-based classification passed.")


if __name__ == "__main__":
    test_swap_detection()
    test_position_and_pnl_math()
    print("\nALL RUNNABLE ENGINE CHECKS PASSED SUCCESSFULLY!")
