import asyncio
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.api.schemas.wallet import (
    ClassificationResponse,
    CoverageResponse,
    HoldingBucket,
    InitialFundingResponse,
    MetricsResponse,
    PerformanceResponse,
    PositionItem,
    SyncStatusResponse,
    SyncTriggerResponse,
    TokenPerformanceItem,
    TradeItem,
    TradeListResponse,
    WalletOverviewResponse,
)
from packages.database.connection import get_db
from packages.database.models import (
    ParserError,
    Position,
    Token,
    Trade,
    Transaction,
    Transfer,
    Wallet,
    WalletMetric,
    WalletSyncJob,
)
from workers.fetcher.solana_client import validate_solana_address
from workers.parser.transfer_parser import SOL_MINT
from workers.sync_worker import sync_wallet_history

router = APIRouter(prefix="/api/wallet", tags=["Wallet Intelligence"])


@router.post(
    "/{address}/sync",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=SyncTriggerResponse,
)
async def trigger_wallet_sync(
    address: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Trigger on-chain historical transaction synchronization for a Solana wallet address."""
    if not validate_solana_address(address):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Solana base58 address: {address}",
        )

    # Check or create wallet record
    stmt = select(Wallet).where(Wallet.address == address)
    res = await db.execute(stmt)
    wallet = res.scalar_one_or_none()
    if not wallet:
        wallet = Wallet(address=address, chain="solana")
        db.add(wallet)
        await db.flush()

    # Enqueue background sync worker
    background_tasks.add_task(sync_wallet_history, address)

    return SyncTriggerResponse(
        job_id=str(uuid.uuid4()),
        wallet_address=address,
        status="PENDING",
        message="Wallet synchronization initiated in background.",
    )


@router.get("/{address}/sync-status", response_model=SyncStatusResponse)
async def get_wallet_sync_status(
    address: str,
    db: AsyncSession = Depends(get_db),
):
    """Check current synchronization status and progress percentage."""
    stmt = (
        select(WalletSyncJob)
        .join(Wallet, Wallet.id == WalletSyncJob.wallet_id)
        .where(Wallet.address == address)
        .order_by(desc(WalletSyncJob.created_at))
        .limit(1)
    )
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No sync jobs found for this wallet.",
        )

    return SyncStatusResponse(
        status=job.status,
        progress_percentage=float(job.progress_percentage or 0),
        total_transactions=job.total_transactions or 0,
        parsed_transactions=job.parsed_transactions or 0,
        reconstructed_trades=job.reconstructed_trades or 0,
        error_message=job.error_message,
        started_at=job.started_at,
        completed_at=job.completed_at,
    )


@router.get("/{address}", response_model=WalletOverviewResponse)
async def get_wallet_overview(
    address: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve full wallet profile, precalculated metrics, classification badges, and data coverage."""
    stmt = (
        select(Wallet)
        .options(selectinload(Wallet.metrics))
        .where(Wallet.address == address)
    )
    res = await db.execute(stmt)
    wallet = res.scalar_one_or_none()

    if not wallet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Wallet {address} has not been synced yet. POST to /api/wallet/{address}/sync to initiate.",
        )

    # Coverage metrics
    total_tx_stmt = select(func.count(Transaction.id)).where(Transaction.wallet_address == address)
    total_tx = (await db.execute(total_tx_stmt)).scalar() or 0

    err_tx_stmt = select(func.count(ParserError.id)).where(ParserError.wallet_address == address)
    unparsed_tx = (await db.execute(err_tx_stmt)).scalar() or 0

    parsed_tx = max(0, total_tx - unparsed_tx)
    coverage_pct = round((parsed_tx / total_tx * 100), 2) if total_tx > 0 else 100.0

    metrics_resp = None
    class_resp = None
    if wallet.metrics:
        m = wallet.metrics
        metrics_resp = MetricsResponse(
            trade_count=m.trade_count or 0,
            winning_trades=m.winning_trades or 0,
            losing_trades=m.losing_trades or 0,
            win_rate=float(m.win_rate or 0),
            realized_pnl=float(m.realized_pnl or 0),
            unrealized_pnl=float(m.unrealized_pnl or 0),
            total_pnl=float(m.total_pnl or 0),
            roi=float(m.roi or 0),
            avg_trade_pnl=float(m.avg_trade_pnl or 0) if m.avg_trade_pnl else None,
            median_hold_seconds=m.median_hold_seconds,
            avg_hold_seconds=m.avg_hold_seconds,
        )
        class_resp = ClassificationResponse(
            performance_tier=m.performance_tier,
            trading_style=m.trading_style,
            capital_tier=m.capital_tier,
            activity_level=m.activity_level,
        )

    return WalletOverviewResponse(
        address=wallet.address,
        chain=wallet.chain,
        first_seen_at=wallet.first_seen_at,
        last_active_at=wallet.last_seen_at,
        metrics=metrics_resp,
        classification=class_resp,
        coverage=CoverageResponse(
            transactions_analyzed=total_tx,
            successfully_parsed=parsed_tx,
            unparsed=unparsed_tx,
            coverage_percentage=coverage_pct,
        ),
    )


@router.get("/{address}/trades", response_model=TradeListResponse)
async def get_wallet_trades(
    address: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    side: Optional[str] = Query(None, pattern="^(BUY|SELL)$"),
    token: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve paginated trade history for a wallet with optional side and token filters."""
    # Find wallet
    w_res = await db.execute(select(Wallet.id).where(Wallet.address == address))
    wallet_id = w_res.scalar_one_or_none()
    if not wallet_id:
        raise HTTPException(status_code=404, detail="Wallet not found")

    query = select(Trade).options(selectinload(Trade.token)).where(Trade.wallet_id == wallet_id)

    if side:
        query = query.where(Trade.side == side)
    if token:
        query = query.join(Token).where(
            (Token.address == token) | (Token.symbol.ilike(f"%{token}%"))
        )

    count_stmt = select(func.count()).select_from(query.subquery())
    total_records = (await db.execute(count_stmt)).scalar() or 0

    query = query.order_by(desc(Trade.timestamp)).offset((page - 1) * limit).limit(limit)
    res = await db.execute(query)
    trades = res.scalars().all()

    items = [
        TradeItem(
            id=str(t.id),
            tx_hash=t.tx_hash,
            timestamp=t.timestamp,
            side=t.side,
            token_address=t.token.address if t.token else "",
            token_symbol=t.token.symbol if t.token else None,
            token_amount=float(t.token_amount),
            quote_amount=float(t.quote_amount),
            price=float(t.price) if t.price else None,
            usd_value=float(t.usd_value) if t.usd_value else None,
            dex=t.dex,
        )
        for t in trades
    ]

    return TradeListResponse(
        page=page,
        limit=limit,
        total_records=total_records,
        items=items,
    )


@router.get("/{address}/positions", response_model=List[PositionItem])
async def get_wallet_positions(
    address: str,
    status_filter: Optional[str] = Query(None, pattern="^(OPEN|CLOSED)$"),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve positions (OPEN and CLOSED) reconstructed for the wallet."""
    w_res = await db.execute(select(Wallet.id).where(Wallet.address == address))
    wallet_id = w_res.scalar_one_or_none()
    if not wallet_id:
        raise HTTPException(status_code=404, detail="Wallet not found")

    query = (
        select(Position)
        .options(selectinload(Position.token))
        .where(Position.wallet_id == wallet_id)
    )
    if status_filter:
        query = query.where(Position.status == status_filter)

    query = query.order_by(desc(Position.last_trade_at))
    res = await db.execute(query)
    positions = res.scalars().all()

    return [
        PositionItem(
            id=str(p.id),
            token_address=p.token.address if p.token else "",
            token_symbol=p.token.symbol if p.token else None,
            quantity=float(p.quantity),
            avg_entry_price=float(p.avg_entry_price) if p.avg_entry_price else None,
            total_cost_basis=float(p.total_cost_basis or 0),
            realized_pnl=float(p.realized_pnl or 0),
            unrealized_pnl=float(p.unrealized_pnl or 0),
            roi=float(p.roi) if p.roi else None,
            opened_at=p.opened_at,
            last_trade_at=p.last_trade_at,
            closed_at=p.closed_at,
            status=p.status,
        )
        for p in positions
    ]


@router.get("/{address}/performance", response_model=PerformanceResponse)
async def get_wallet_performance(
    address: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve holding time distribution histogram and PnL performance summary."""
    w_res = await db.execute(select(Wallet.id).where(Wallet.address == address))
    wallet_id = w_res.scalar_one_or_none()
    if not wallet_id:
        raise HTTPException(status_code=404, detail="Wallet not found")

    # Get closed positions to calculate holding distribution
    query = select(Position).where(
        Position.wallet_id == wallet_id, Position.status == "CLOSED"
    )
    res = await db.execute(query)
    closed_pos = res.scalars().all()

    buckets = {
        "< 1m": 0,
        "1-5m": 0,
        "5-30m": 0,
        "30m-2h": 0,
        "2h-12h": 0,
        "12h-3d": 0,
        "3d+": 0,
    }

    for p in closed_pos:
        if p.opened_at and p.closed_at:
            duration = int((p.closed_at - p.opened_at).total_seconds())
            if duration < 60:
                buckets["< 1m"] += 1
            elif duration <= 300:
                buckets["1-5m"] += 1
            elif duration <= 1800:
                buckets["5-30m"] += 1
            elif duration <= 7200:
                buckets["30m-2h"] += 1
            elif duration <= 43200:
                buckets["2h-12h"] += 1
            elif duration <= 259200:
                buckets["12h-3d"] += 1
            else:
                buckets["3d+"] += 1

    distribution = [HoldingBucket(bucket=k, count=v) for k, v in buckets.items()]

    m_res = await db.execute(select(WalletMetric).where(WalletMetric.wallet_id == wallet_id))
    m = m_res.scalar_one_or_none()

    pnl_summary = {
        "realized_pnl": float(m.realized_pnl or 0) if m else 0,
        "unrealized_pnl": float(m.unrealized_pnl or 0) if m else 0,
        "total_pnl": float(m.total_pnl or 0) if m else 0,
        "win_rate": float(m.win_rate or 0) if m else 0,
        "roi": float(m.roi or 0) if m else 0,
    }

    return PerformanceResponse(
        holding_time_distribution=distribution,
        pnl_summary=pnl_summary,
    )


@router.get("/{address}/tokens", response_model=List[TokenPerformanceItem])
async def get_wallet_tokens_breakdown(
    address: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve token-level trading breakdown and performance."""
    w_res = await db.execute(select(Wallet.id).where(Wallet.address == address))
    wallet_id = w_res.scalar_one_or_none()
    if not wallet_id:
        raise HTTPException(status_code=404, detail="Wallet not found")

    # Group positions by token
    query = (
        select(
            Token.address,
            Token.symbol,
            Token.name,
            func.count(Position.id).label("trade_count"),
            func.sum(Position.total_cost_basis).label("total_invested"),
            func.sum(Position.realized_pnl).label("realized_pnl"),
        )
        .join(Position, Position.token_id == Token.id)
        .where(Position.wallet_id == wallet_id)
        .group_by(Token.address, Token.symbol, Token.name)
    )
    res = await db.execute(query)
    rows = res.all()

    items = []
    for r in rows:
        invested = float(r.total_invested or 0)
        pnl = float(r.realized_pnl or 0)
        roi = round((pnl / invested * 100), 2) if invested > 0 else 0.0
        items.append(
            TokenPerformanceItem(
                token_address=r.address,
                symbol=r.symbol,
                name=r.name,
                trade_count=r.trade_count,
                total_invested=invested,
                realized_pnl=pnl,
                roi=roi,
            )
        )

    return items


@router.get("/{address}/funding", response_model=InitialFundingResponse)
async def get_initial_funding(
    address: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve initial funding source, timestamp, and starting SOL balance."""
    # Find the earliest native SOL transfer IN
    stmt = (
        select(Transfer, Transaction.tx_hash)
        .join(Transaction, Transaction.id == Transfer.tx_id)
        .where(
            Transfer.wallet_address == address,
            Transfer.token_address == SOL_MINT,
            Transfer.direction == "IN",
        )
        .order_by(Transfer.timestamp.asc())
        .limit(1)
    )
    res = await db.execute(stmt)
    row = res.first()

    if not row:
        return InitialFundingResponse()

    transfer, tx_hash = row
    return InitialFundingResponse(
        first_seen_at=transfer.timestamp,
        initial_balance_sol=float(transfer.amount),
        first_funding_source="Unknown (Genesis/Faucet)",
        initial_funding_tx=tx_hash,
    )
