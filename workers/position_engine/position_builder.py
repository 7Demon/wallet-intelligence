from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
import uuid

DUST_THRESHOLD = Decimal("0.0000001")


@dataclass
class PositionState:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    wallet_id: uuid.UUID = field(default_factory=uuid.uuid4)
    token_id: uuid.UUID = field(default_factory=uuid.uuid4)
    quantity: Decimal = Decimal("0")
    avg_entry_price: Decimal = Decimal("0")
    total_cost_basis: Decimal = Decimal("0")
    realized_pnl: Decimal = Decimal("0")
    unrealized_pnl: Decimal = Decimal("0")
    roi: Optional[Decimal] = None
    opened_at: Optional[datetime] = None
    last_trade_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    status: str = "OPEN"  # 'OPEN' or 'CLOSED'


def build_positions_from_trades(
    trades: List[Dict[str, Any]], wallet_id: uuid.UUID
) -> List[Dict[str, Any]]:
    """
    Reconstruct chronological positions using Weighted Average Cost Basis (WACB).
    Processes trades sorted by timestamp ascending.
    Returns list of position dicts.
    """
    # Sort trades chronologically
    sorted_trades = sorted(trades, key=lambda t: t["timestamp"])

    # Group by token_id to track current open position
    positions_history: List[PositionState] = []
    active_position_by_token: Dict[uuid.UUID, PositionState] = {}

    for trade in sorted_trades:
        token_id = trade["token_id"]
        side = trade["side"]
        token_amount = Decimal(str(trade["token_amount"]))
        quote_amount = Decimal(str(trade["quote_amount"]))
        timestamp = trade["timestamp"]
        price = Decimal(str(trade["price"])) if trade.get("price") is not None else (quote_amount / token_amount if token_amount > 0 else Decimal("0"))

        current_pos = active_position_by_token.get(token_id)

        if side == "BUY":
            if current_pos is None or current_pos.status == "CLOSED":
                # Start new position
                current_pos = PositionState(
                    wallet_id=wallet_id,
                    token_id=token_id,
                    quantity=token_amount,
                    avg_entry_price=price,
                    total_cost_basis=quote_amount,
                    realized_pnl=Decimal("0"),
                    opened_at=timestamp,
                    last_trade_at=timestamp,
                    status="OPEN",
                )
                active_position_by_token[token_id] = current_pos
                positions_history.append(current_pos)
            else:
                # Accumulate (Multiple Entry / DCA)
                new_quantity = current_pos.quantity + token_amount
                new_cost_basis = current_pos.total_cost_basis + quote_amount
                current_pos.quantity = new_quantity
                current_pos.total_cost_basis = new_cost_basis
                current_pos.avg_entry_price = (
                    new_cost_basis / new_quantity if new_quantity > 0 else Decimal("0")
                )
                current_pos.last_trade_at = timestamp

        elif side == "SELL":
            if current_pos is None or current_pos.status == "CLOSED":
                # Unmatched sell (e.g. initial balance before tracking or airdrop)
                current_pos = PositionState(
                    wallet_id=wallet_id,
                    token_id=token_id,
                    quantity=Decimal("0"),
                    avg_entry_price=Decimal("0"),
                    total_cost_basis=Decimal("0"),
                    realized_pnl=quote_amount,  # Full exit value is realized profit
                    opened_at=timestamp,
                    last_trade_at=timestamp,
                    closed_at=timestamp,
                    status="CLOSED",
                )
                positions_history.append(current_pos)
                active_position_by_token.pop(token_id, None)
            else:
                # Selling from open position
                sell_qty = min(token_amount, current_pos.quantity)
                cost_of_sold = (
                    (sell_qty / current_pos.quantity) * current_pos.total_cost_basis
                    if current_pos.quantity > 0
                    else Decimal("0")
                )
                trade_realized_pnl = quote_amount - cost_of_sold

                current_pos.realized_pnl += trade_realized_pnl
                current_pos.quantity -= sell_qty
                current_pos.total_cost_basis -= cost_of_sold
                current_pos.last_trade_at = timestamp

                # Check if position is now closed
                if current_pos.quantity <= DUST_THRESHOLD:
                    current_pos.quantity = Decimal("0")
                    current_pos.total_cost_basis = Decimal("0")
                    current_pos.status = "CLOSED"
                    current_pos.closed_at = timestamp
                    active_position_by_token.pop(token_id, None)

    # Convert dataclass objects to dicts
    result = []
    for pos in positions_history:
        # Calculate ROI for closed positions
        initial_invested = pos.total_cost_basis + (pos.realized_pnl if pos.status == "CLOSED" else Decimal("0"))
        # If position was closed, ROI is realized_pnl / cost_basis_total
        roi = None
        if pos.status == "CLOSED" and pos.realized_pnl != Decimal("0"):
            # Avoid div zero
            cost_base = pos.total_cost_basis + (pos.realized_pnl - (pos.realized_pnl if pos.realized_pnl < 0 else Decimal("0")))
            # Standard ROI formula: realized_pnl / total_invested * 100
            # Let's save as Decimal
            roi = Decimal("0")

        result.append(
            {
                "id": pos.id,
                "wallet_id": pos.wallet_id,
                "token_id": pos.token_id,
                "quantity": pos.quantity,
                "avg_entry_price": pos.avg_entry_price,
                "total_cost_basis": pos.total_cost_basis,
                "realized_pnl": pos.realized_pnl,
                "unrealized_pnl": pos.unrealized_pnl,
                "roi": pos.roi,
                "opened_at": pos.opened_at,
                "last_trade_at": pos.last_trade_at,
                "closed_at": pos.closed_at,
                "status": pos.status,
            }
        )

    return result
