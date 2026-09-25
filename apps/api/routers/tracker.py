from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from packages.database.connection import get_db
from packages.database.models import (
    Position,
    Token,
    Trade,
    Wallet,
    WalletMetric,
    WalletSyncJob,
)
from workers.fetcher.solana_client import validate_solana_address
from workers.sync_worker import sync_wallet_history

router = APIRouter(prefix="/api/wallets", tags=["Wallet Tracker"])


# --- Schemas ---
class BulkImportRequest(BaseModel):
    addresses: List[str]
    default_label: Optional[str] = None
    auto_sync: bool = True


class BulkImportResponse(BaseModel):
    total_received: int
    imported_count: int
    already_tracked_count: int
    invalid_addresses: List[str]
    imported_addresses: List[str]


class TrackedWalletItem(BaseModel):
    id: str
    address: str
    label: Optional[str] = None
    tags: List[str] = []
    first_seen_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    is_tracked: bool = True
    sync_status: str = "PENDING"
    # Metrics
    trade_count: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0.0
    realized_pnl: float = 0.0
    unrealized_pnl: float = 0.0
    total_pnl: float = 0.0
    roi: float = 0.0
    median_hold_seconds: Optional[int] = None
    avg_position_usd: Optional[float] = None
    # Badges
    performance_tier: Optional[str] = None
    trading_style: Optional[str] = None
    capital_tier: Optional[str] = None
    activity_level: Optional[str] = None


class TrackedWalletsListResponse(BaseModel):
    page: int
    limit: int
    total_records: int
    items: List[TrackedWalletItem]


class UpdateWalletRequest(BaseModel):
    label: Optional[str] = None
    is_tracked: Optional[bool] = None
    tags: Optional[List[str]] = None


class TrackerOverviewResponse(BaseModel):
    total_tracked_wallets: int
    combined_realized_pnl: float
    combined_unrealized_pnl: float
    combined_total_pnl: float
    average_win_rate: float
    active_today_count: int
    top_performer: Optional[Dict[str, Any]] = None


class TrackerFeedItem(BaseModel):
    id: str
    wallet_address: str
    wallet_label: Optional[str] = None
    tx_hash: str
    timestamp: datetime
    side: str
    token_address: str
    token_symbol: Optional[str] = None
    token_amount: float
    quote_amount: float
    price: Optional[float] = None
    dex: Optional[str] = None


# --- Endpoints ---


@router.post("/bulk-import", response_model=BulkImportResponse)
async def bulk_import_wallets(
    payload: BulkImportRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Import multiple Solana wallet addresses in bulk.
    Deduplicates, validates Base58 format, saves to database, and triggers background sync.
    """
    raw_addresses = payload.addresses
    invalid_addresses = []
    valid_addresses = []

    # Clean & validate
    seen = set()
    for addr in raw_addresses:
        cleaned = addr.strip()
        if not cleaned:
            continue
        if cleaned in seen:
            continue
        seen.add(cleaned)

        if validate_solana_address(cleaned):
            valid_addresses.append(cleaned)
        else:
            invalid_addresses.append(cleaned)

    imported_addresses = []
    already_tracked = 0

    for addr in valid_addresses:
        stmt = select(Wallet).where(Wallet.address == addr)
        res = await db.execute(stmt)
        existing = res.scalar_one_or_none()

        if existing:
            if not existing.is_tracked:
                existing.is_tracked = True
                if payload.default_label:
                    if not existing.label:
                        existing.label = payload.default_label
                    current_tags = list(existing.tags or [])
                    if payload.default_label not in current_tags:
                        current_tags.append(payload.default_label)
                        existing.tags = current_tags
                imported_addresses.append(addr)
            else:
                if payload.default_label and not existing.label:
                    existing.label = payload.default_label
                    current_tags = list(existing.tags or [])
                    if payload.default_label not in current_tags:
                        current_tags.append(payload.default_label)
                        existing.tags = current_tags
                already_tracked += 1
        else:
            tags = [payload.default_label] if payload.default_label else []
            new_wallet = Wallet(
                address=addr,
                chain="solana",
                label=payload.default_label,
                tags=tags,
                is_tracked=True,
            )
            db.add(new_wallet)
            imported_addresses.append(addr)

    await db.commit()

    # Trigger background sync if requested
    if payload.auto_sync:
        for addr in imported_addresses:
            background_tasks.add_task(sync_wallet_history, addr)

    return BulkImportResponse(
        total_received=len(raw_addresses),
        imported_count=len(imported_addresses),
        already_tracked_count=already_tracked,
        invalid_addresses=invalid_addresses,
        imported_addresses=imported_addresses,
    )


@router.get("", response_model=TrackedWalletsListResponse)
async def list_tracked_wallets(
    search: Optional[str] = None,
    tier: Optional[str] = None,
    category: Optional[str] = None,
    sort_by: str = Query("pnl", pattern="^(pnl|win_rate|trades|last_active|created_at|avg_position)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    List all tracked wallets in the watchlist with their latest PnL, Win Rate, and classification badges.
    Supports filtering by custom group search, performance tier, and trader category (whale, smart_money, dolphin, scalper).
    """
    query = (
        select(Wallet)
        .options(
            selectinload(Wallet.metrics),
            selectinload(Wallet.sync_jobs),
        )
        .outerjoin(WalletMetric, WalletMetric.wallet_id == Wallet.id)
        .where(Wallet.is_tracked == True)
    )

    if search:
        query = query.where(
            or_(
                Wallet.address.ilike(f"%{search}%"),
                Wallet.label.ilike(f"%{search}%"),
            )
        )

    if tier:
        query = query.where(
            WalletMetric.performance_tier == tier.upper()
        )

    if category:
        cat = category.lower()
        if cat == "whale":
            query = query.where(
                or_(
                    WalletMetric.capital_tier.in_(["WHALE", "VERY_LARGE", "LARGE", "MEGA_WHALE"]),
                    WalletMetric.avg_position_usd >= 10000.0,
                )
            )
        elif cat == "smart_money":
            query = query.where(
                WalletMetric.win_rate >= 60.0,
                WalletMetric.realized_pnl > 0,
            )
        elif cat == "dolphin":
            query = query.where(
                or_(
                    WalletMetric.capital_tier.in_(["DOLPHIN", "MEDIUM"]),
                    WalletMetric.avg_position_usd.between(1000.0, 10000.0),
                )
            )
        elif cat == "scalper":
            query = query.where(
                or_(
                    WalletMetric.trading_style.in_(["SCALPER", "SHORT_TERM_TRADER"]),
                    WalletMetric.median_hold_seconds < 300,
                )
            )
        elif cat == "shrimp":
            query = query.where(
                or_(
                    WalletMetric.capital_tier.in_(["SHRIMP", "MICRO", "SMALL"]),
                    WalletMetric.avg_position_usd < 1000.0,
                )
            )

    # Count total
    count_stmt = select(func.count()).select_from(query.subquery())
    total_records = (await db.execute(count_stmt)).scalar() or 0

    # Sorting
    if sort_by == "pnl":
        sort_col = func.coalesce(WalletMetric.realized_pnl, 0)
    elif sort_by == "win_rate":
        sort_col = func.coalesce(WalletMetric.win_rate, 0)
    elif sort_by == "trades":
        sort_col = func.coalesce(WalletMetric.trade_count, 0)
    elif sort_by == "avg_position":
        sort_col = func.coalesce(WalletMetric.avg_position_usd, 0)
    elif sort_by == "last_active":
        sort_col = func.coalesce(Wallet.last_seen_at, Wallet.created_at)
    else:
        sort_col = Wallet.created_at

    query = (
        query.order_by(desc(sort_col) if order == "desc" else sort_col)
        .offset((page - 1) * limit)
        .limit(limit)
    )

    res = await db.execute(query)
    wallets = res.scalars().all()

    items = []
    for w in wallets:
        m = w.metrics
        latest_job = w.sync_jobs[-1].status if w.sync_jobs else "PENDING"
        items.append(
            TrackedWalletItem(
                id=str(w.id),
                address=w.address,
                label=w.label,
                tags=w.tags or [],
                first_seen_at=w.first_seen_at,
                last_seen_at=w.last_seen_at,
                is_tracked=w.is_tracked,
                sync_status=latest_job,
                trade_count=m.trade_count if m else 0,
                winning_trades=m.winning_trades if m else 0,
                losing_trades=m.losing_trades if m else 0,
                win_rate=float(m.win_rate) if m and m.win_rate else 0.0,
                realized_pnl=float(m.realized_pnl) if m and m.realized_pnl else 0.0,
                unrealized_pnl=float(m.unrealized_pnl) if m and m.unrealized_pnl else 0.0,
                total_pnl=float(m.total_pnl) if m and m.total_pnl else 0.0,
                roi=float(m.roi) if m and m.roi else 0.0,
                median_hold_seconds=m.median_hold_seconds if m else None,
                avg_position_usd=float(m.avg_position_usd) if m and m.avg_position_usd is not None else None,
                performance_tier=m.performance_tier if m else None,
                trading_style=m.trading_style if m else None,
                capital_tier=m.capital_tier if m else None,
                activity_level=m.activity_level if m else None,
            )
        )

    return TrackedWalletsListResponse(
        page=page,
        limit=limit,
        total_records=total_records,
        items=items,
    )


@router.patch("/{address}", status_code=status.HTTP_200_OK)
async def update_wallet(
    address: str,
    payload: UpdateWalletRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update custom label, tags, or tracking status for a wallet."""
    stmt = select(Wallet).where(Wallet.address == address)
    res = await db.execute(stmt)
    wallet = res.scalar_one_or_none()

    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    if payload.label is not None:
        wallet.label = payload.label
    if payload.is_tracked is not None:
        wallet.is_tracked = payload.is_tracked
    if payload.tags is not None:
        wallet.tags = payload.tags

    await db.commit()
    return {"status": "ok", "message": "Wallet updated successfully"}


@router.delete("/{address}", status_code=status.HTTP_200_OK)
async def untrack_wallet(
    address: str,
    db: AsyncSession = Depends(get_db),
):
    """Remove wallet from active tracking watchlist."""
    stmt = select(Wallet).where(Wallet.address == address)
    res = await db.execute(stmt)
    wallet = res.scalar_one_or_none()

    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    wallet.is_tracked = False
    await db.commit()
    return {"status": "ok", "message": f"Wallet {address} removed from tracking."}


@router.get("/tracker/overview", response_model=TrackerOverviewResponse)
async def get_tracker_overview(
    db: AsyncSession = Depends(get_db),
):
    """Aggregated portfolio summary metrics across all tracked wallets."""
    # Count tracked wallets
    count_stmt = select(func.count(Wallet.id)).where(Wallet.is_tracked == True)
    total_tracked = (await db.execute(count_stmt)).scalar() or 0

    # Aggregated PnL & Win Rate
    agg_stmt = (
        select(
            func.sum(WalletMetric.realized_pnl),
            func.sum(WalletMetric.unrealized_pnl),
            func.sum(WalletMetric.total_pnl),
            func.avg(WalletMetric.win_rate),
        )
        .join(Wallet, Wallet.id == WalletMetric.wallet_id)
        .where(Wallet.is_tracked == True)
    )
    agg_res = (await db.execute(agg_stmt)).first()

    comb_realized = float(agg_res[0] or 0)
    comb_unrealized = float(agg_res[1] or 0)
    comb_total = float(agg_res[2] or 0)
    avg_win_rate = round(float(agg_res[3] or 0), 1)

    # Active in last 24h
    now = datetime.now(timezone.utc)
    since_24h = now - timedelta(hours=24)
    active_stmt = select(func.count(Wallet.id)).where(
        Wallet.is_tracked == True,
        Wallet.last_seen_at >= since_24h,
    )
    active_today = (await db.execute(active_stmt)).scalar() or 0

    # Top performer
    top_stmt = (
        select(Wallet.address, Wallet.label, WalletMetric.realized_pnl)
        .join(WalletMetric, WalletMetric.wallet_id == Wallet.id)
        .where(Wallet.is_tracked == True)
        .order_by(desc(WalletMetric.realized_pnl))
        .limit(1)
    )
    top_row = (await db.execute(top_stmt)).first()
    top_performer = None
    if top_row and top_row[2] is not None:
        top_performer = {
            "address": top_row[0],
            "label": top_row[1],
            "realized_pnl": float(top_row[2]),
        }

    return TrackerOverviewResponse(
        total_tracked_wallets=total_tracked,
        combined_realized_pnl=comb_realized,
        combined_unrealized_pnl=comb_unrealized,
        combined_total_pnl=comb_total,
        average_win_rate=avg_win_rate,
        active_today_count=active_today,
        top_performer=top_performer,
    )


@router.get("/tracker/feed", response_model=List[TrackerFeedItem])
async def get_tracker_trade_feed(
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Live unified activity stream: latest trades across ALL tracked wallets (like GMGN follow feed).
    """
    query = (
        select(Trade, Wallet.address, Wallet.label, Token)
        .join(Wallet, Wallet.id == Trade.wallet_id)
        .join(Token, Token.id == Trade.token_id)
        .where(Wallet.is_tracked == True)
        .order_by(desc(Trade.timestamp))
        .limit(limit)
    )
    res = await db.execute(query)
    rows = res.all()

    items = []
    for trade, wallet_address, wallet_label, token in rows:
        items.append(
            TrackerFeedItem(
                id=str(trade.id),
                wallet_address=wallet_address,
                wallet_label=wallet_label,
                tx_hash=trade.tx_hash,
                timestamp=trade.timestamp,
                side=trade.side,
                token_address=token.address,
                token_symbol=token.symbol,
                token_amount=float(trade.token_amount),
                quote_amount=float(trade.quote_amount),
                price=float(trade.price) if trade.price else None,
                dex=trade.dex,
            )
        )
    return items
