from datetime import datetime, timezone
from decimal import Decimal
import json
import os
import statistics
from typing import Any, Dict, List, Optional
import uuid


def load_classification_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    """Load configurable classification thresholds from JSON."""
    path = config_path or os.getenv(
        "CLASSIFICATION_CONFIG_PATH", "./config/classification_thresholds.json"
    )
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def calculate_wallet_metrics_and_classification(
    wallet_id: uuid.UUID,
    trades: List[Dict[str, Any]],
    positions: List[Dict[str, Any]],
    first_seen_at: Optional[datetime],
    last_seen_at: Optional[datetime],
    config_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Calculate comprehensive wallet performance metrics and rule-based classification badges.
    """
    config = load_classification_config(config_path)

    trade_count = len(trades)
    closed_positions = [p for p in positions if p["status"] == "CLOSED"]

    winning_trades = sum(1 for p in closed_positions if p["realized_pnl"] > Decimal("0"))
    losing_trades = sum(1 for p in closed_positions if p["realized_pnl"] < Decimal("0"))

    total_closed = len(closed_positions)
    win_rate = (
        Decimal(str(round((winning_trades / total_closed) * 100, 2)))
        if total_closed > 0
        else Decimal("0")
    )

    realized_pnl = sum((p["realized_pnl"] for p in positions), Decimal("0"))
    unrealized_pnl = sum((p.get("unrealized_pnl", Decimal("0")) for p in positions), Decimal("0"))
    total_pnl = realized_pnl + unrealized_pnl

    # ROI Calculation: Total Realized PnL / Total Cost Basis of trades
    total_invested = sum((Decimal(str(t["quote_amount"])) for t in trades if t["side"] == "BUY"), Decimal("0"))
    roi = (
        Decimal(str(round((realized_pnl / total_invested) * 100, 2)))
        if total_invested > 0
        else Decimal("0")
    )

    avg_trade_pnl = (
        Decimal(str(round(realized_pnl / total_closed, 2)))
        if total_closed > 0
        else Decimal("0")
    )

    # Holding times for closed positions
    hold_durations: List[int] = []
    for p in closed_positions:
        opened = p.get("opened_at")
        closed = p.get("closed_at")
        if opened and closed:
            duration = int((closed - opened).total_seconds())
            if duration >= 0:
                hold_durations.append(duration)

    avg_hold_seconds = int(statistics.mean(hold_durations)) if hold_durations else None
    median_hold_seconds = int(statistics.median(hold_durations)) if hold_durations else None

    # Average Position Size (Quote / USD)
    avg_position_usd = (
        total_invested / Decimal(str(max(1, sum(1 for t in trades if t['side'] == 'BUY'))))
    )

    # -------------------------------------------------------------
    # Rule-Based Classification
    # -------------------------------------------------------------

    # 1. Performance Tier
    perf_cfg = config.get("performance_tier", {})
    min_trades = perf_cfg.get("min_closed_trades", 5)

    if total_closed < min_trades:
        performance_tier = "INSUFFICIENT_DATA"
    else:
        roi_float = float(roi)
        wr_float = float(win_rate)
        if roi_float > 100.0 and wr_float >= 60.0:
            performance_tier = "HIGHLY_PROFITABLE"
        elif roi_float > 20.0 and wr_float >= 50.0:
            performance_tier = "PROFITABLE"
        elif -20.0 <= roi_float <= 20.0:
            performance_tier = "BREAK_EVEN"
        elif roi_float < -50.0:
            performance_tier = "HIGHLY_UNPROFITABLE"
        else:
            performance_tier = "UNPROFITABLE"

    # 2. Trading Style (Holding Period)
    if median_hold_seconds is not None:
        if median_hold_seconds < 300:  # < 5m
            trading_style = "SCALPER"
        elif median_hold_seconds <= 7200:  # 5m - 2h
            trading_style = "SHORT_TERM_TRADER"
        elif median_hold_seconds <= 259200:  # 2h - 3d
            trading_style = "SWING_TRADER"
        else:  # > 3d
            trading_style = "HOLDER"
    else:
        trading_style = "UNKNOWN"

    # 3. Capital Size Tier
    avg_pos_float = float(avg_position_usd)
    if avg_pos_float < 100.0:
        capital_tier = "MICRO"
    elif avg_pos_float <= 1000.0:
        capital_tier = "SMALL"
    elif avg_pos_float <= 10000.0:
        capital_tier = "MEDIUM"
    elif avg_pos_float <= 100000.0:
        capital_tier = "LARGE"
    else:
        capital_tier = "VERY_LARGE"

    # 4. Activity Level
    now = datetime.now(timezone.utc)
    if last_seen_at:
        last_seen_aware = last_seen_at if last_seen_at.tzinfo else last_seen_at.replace(tzinfo=timezone.utc)
        days_inactive = (now - last_seen_aware).days
    else:
        days_inactive = 0

    if days_inactive > 30 and trade_count > 0:
        activity_level = "INACTIVE"
    elif first_seen_at and last_seen_at:
        first_seen_aware = first_seen_at if first_seen_at.tzinfo else first_seen_at.replace(tzinfo=timezone.utc)
        last_seen_aware = last_seen_at if last_seen_at.tzinfo else last_seen_at.replace(tzinfo=timezone.utc)
        active_span_days = max(1, (last_seen_aware - first_seen_aware).days)
        trades_per_day = trade_count / active_span_days

        if trades_per_day < 1.0:
            activity_level = "OCCASIONAL"
        elif trades_per_day <= 10.0:
            activity_level = "ACTIVE"
        else:
            activity_level = "HIGH_FREQUENCY"
    else:
        activity_level = "ACTIVE" if trade_count > 0 else "INACTIVE"

    return {
        "wallet_id": wallet_id,
        "trade_count": trade_count,
        "winning_trades": winning_trades,
        "losing_trades": losing_trades,
        "win_rate": win_rate,
        "realized_pnl": realized_pnl,
        "unrealized_pnl": unrealized_pnl,
        "total_pnl": total_pnl,
        "roi": roi,
        "avg_trade_pnl": avg_trade_pnl,
        "avg_win": None,
        "avg_loss": None,
        "profit_factor": None,
        "avg_hold_seconds": avg_hold_seconds,
        "median_hold_seconds": median_hold_seconds,
        "max_drawdown": None,
        "performance_tier": performance_tier,
        "trading_style": trading_style,
        "capital_tier": capital_tier,
        "activity_level": activity_level,
        "classified_at": now,
    }
