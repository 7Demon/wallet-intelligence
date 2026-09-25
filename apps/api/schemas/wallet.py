from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SyncTriggerResponse(BaseModel):
    job_id: str
    wallet_address: str
    status: str
    message: str


class SyncStatusResponse(BaseModel):
    status: str
    progress_percentage: float
    total_transactions: int
    parsed_transactions: int
    reconstructed_trades: int
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class MetricsResponse(BaseModel):
    trade_count: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    realized_pnl: float
    unrealized_pnl: float
    total_pnl: float
    roi: float
    avg_trade_pnl: Optional[float] = None
    median_hold_seconds: Optional[int] = None
    avg_hold_seconds: Optional[int] = None


class ClassificationResponse(BaseModel):
    performance_tier: Optional[str] = None
    trading_style: Optional[str] = None
    capital_tier: Optional[str] = None
    activity_level: Optional[str] = None


class CoverageResponse(BaseModel):
    transactions_analyzed: int
    successfully_parsed: int
    unparsed: int
    coverage_percentage: float


class WalletOverviewResponse(BaseModel):
    address: str
    chain: str
    first_seen_at: Optional[datetime] = None
    last_active_at: Optional[datetime] = None
    metrics: Optional[MetricsResponse] = None
    classification: Optional[ClassificationResponse] = None
    coverage: Optional[CoverageResponse] = None


class TradeItem(BaseModel):
    id: str
    tx_hash: str
    timestamp: datetime
    side: str
    token_address: str
    token_symbol: Optional[str] = None
    token_amount: float
    quote_amount: float
    price: Optional[float] = None
    usd_value: Optional[float] = None
    dex: Optional[str] = None


class TradeListResponse(BaseModel):
    page: int
    limit: int
    total_records: int
    items: List[TradeItem]


class PositionItem(BaseModel):
    id: str
    token_address: str
    token_symbol: Optional[str] = None
    quantity: float
    avg_entry_price: Optional[float] = None
    total_cost_basis: float
    realized_pnl: float
    unrealized_pnl: float
    roi: Optional[float] = None
    opened_at: Optional[datetime] = None
    last_trade_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    status: str


class HoldingBucket(BaseModel):
    bucket: str
    count: int


class PerformanceResponse(BaseModel):
    holding_time_distribution: List[HoldingBucket]
    pnl_summary: Dict[str, Any]


class TokenPerformanceItem(BaseModel):
    token_address: str
    symbol: Optional[str] = None
    name: Optional[str] = None
    trade_count: int
    total_invested: float
    realized_pnl: float
    roi: float


class InitialFundingResponse(BaseModel):
    first_seen_at: Optional[datetime] = None
    initial_balance_sol: Optional[float] = None
    first_funding_source: Optional[str] = None
    initial_funding_tx: Optional[str] = None
