import asyncio
from datetime import datetime, timezone
from decimal import Decimal
import logging
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from packages.database.connection import async_session_factory
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
from workers.fetcher.price_oracle import fetch_token_prices, fetch_token_metadata_and_prices
from workers.fetcher.solana_client import SolanaClient, validate_solana_address
from workers.parser.swap_detector import detect_swap_and_reconstruct_trade
from workers.parser.transfer_parser import parse_transaction_transfers, SOL_MINT
from workers.pnl_engine.pnl_calculator import calculate_wallet_metrics_and_classification
from workers.position_engine.position_builder import build_positions_from_trades

logger = logging.getLogger("sync_worker")


async def sync_wallet_history(
    wallet_address: str,
    max_tx_limit: int = 100,
    solana_client: Optional[SolanaClient] = None,
) -> Dict[str, Any]:
    """
    End-to-end synchronization pipeline for a Solana wallet address.
    1. Validate address
    2. Upsert wallet & create sync job
    3. Fetch historical signatures & transactions
    4. Store raw transactions in JSONB
    5. Parse transfers, reconstruct trades, track errors
    6. Rebuild positions with WACB
    7. Compute PnL, holding time distribution & classification
    8. Mark job completed
    """
    if not validate_solana_address(wallet_address):
        raise ValueError(f"Invalid Solana wallet address: {wallet_address}")

    client = solana_client or SolanaClient()

    async with async_session_factory() as session:
        # 1. Get or create wallet
        stmt = select(Wallet).where(Wallet.address == wallet_address)
        res = await session.execute(stmt)
        wallet = res.scalar_one_or_none()

        if not wallet:
            wallet = Wallet(address=wallet_address, chain="solana")
            session.add(wallet)
            await session.flush()

        wallet_id = wallet.id

        # Check latest known transaction signature for incremental delta-sync
        latest_sig_stmt = (
            select(Transaction.tx_hash)
            .where(Transaction.wallet_address == wallet_address)
            .order_by(Transaction.block_time.desc().nullslast(), Transaction.id.desc())
            .limit(1)
        )
        latest_sig = (await session.execute(latest_sig_stmt)).scalar_one_or_none()

        # 2. Create sync job
        sync_job = WalletSyncJob(
            wallet_id=wallet_id,
            status="SYNCING",
            started_at=datetime.now(timezone.utc),
            progress_percentage=Decimal("10.0"),
        )
        session.add(sync_job)
        await session.commit()
        job_id = sync_job.id

    try:
        # 3. Fetch signatures (incremental with until=latest_sig)
        signatures_info = await client.get_signatures_for_address(
            wallet_address, limit=max_tx_limit, until=latest_sig
        )

        total_tx = len(signatures_info)
        logger.info(
            f"Fetched {total_tx} new signatures for wallet {wallet_address} (until={latest_sig})"
        )

        async with async_session_factory() as session:
            await session.execute(
                update(WalletSyncJob)
                .where(WalletSyncJob.id == job_id)
                .values(
                    total_transactions=total_tx,
                    status="SYNCING" if total_tx > 0 else "COMPLETED",
                    progress_percentage=Decimal("30.0") if total_tx > 0 else Decimal("100.0"),
                    completed_at=datetime.now(timezone.utc) if total_tx == 0 else None,
                )
            )
            await session.commit()

        if total_tx == 0:
            return {
                "status": "COMPLETED",
                "wallet_address": wallet_address,
                "total_transactions": 0,
                "parsed_transactions": 0,
                "reconstructed_trades": 0,
                "message": "Already up-to-date. No new transactions found.",
            }

        # 4. Fetch full parsed transactions in batches
        # Helius Free tier allows 10 RPS. Using batch_size=10 with 1.0s pause ensures strict 10 RPS compliance.
        signatures = [sig["signature"] for sig in signatures_info]
        batch_size = 10
        raw_txs: List[Dict[str, Any]] = []

        for i in range(0, len(signatures), batch_size):
            batch_sigs = signatures[i : i + batch_size]
            batch_results = await client.get_parsed_transactions_batch(batch_sigs)
            for sig, tx_data in zip(batch_sigs, batch_results):
                if tx_data:
                    raw_txs.append({"signature": sig, "data": tx_data})
            if i + batch_size < len(signatures):
                await asyncio.sleep(1.0)

        # 5. Store raw transactions and parse
        async with async_session_factory() as session:
            await session.execute(
                update(WalletSyncJob)
                .where(WalletSyncJob.id == job_id)
                .values(status="PROCESSING", progress_percentage=Decimal("60.0"))
            )
            await session.commit()

            parsed_count = 0
            all_reconstructed_trades: List[Dict[str, Any]] = []
            tokens_cache: Dict[str, uuid.UUID] = {}

            # Cache existing tokens
            tok_res = await session.execute(select(Token))
            for tok in tok_res.scalars():
                tokens_cache[tok.address] = tok.id

            first_block_time: Optional[datetime] = None
            last_block_time: Optional[datetime] = None

            for item in raw_txs:
                sig = item["signature"]
                data = item["data"]
                meta = data.get("meta") or {}
                block_time_raw = data.get("blockTime")
                block_time = (
                    datetime.fromtimestamp(block_time_raw, tz=timezone.utc)
                    if block_time_raw
                    else datetime.now(timezone.utc)
                )

                if first_block_time is None or block_time < first_block_time:
                    first_block_time = block_time
                if last_block_time is None or block_time > last_block_time:
                    last_block_time = block_time

                success = meta.get("err") is None

                # Upsert transaction
                tx_stmt = (
                    insert(Transaction)
                    .values(
                        tx_hash=sig,
                        chain="solana",
                        wallet_address=wallet_address,
                        block_time=block_time,
                        block_number=data.get("slot"),
                        success=success,
                        raw_data=data,
                    )
                    .on_conflict_do_update(
                        index_elements=["tx_hash"],
                        set_={"raw_data": data, "success": success},
                    )
                    .returning(Transaction.id)
                )
                tx_res = await session.execute(tx_stmt)
                tx_id = tx_res.scalar_one()

                if not success:
                    continue

                # Parse transfers
                transfers = parse_transaction_transfers(data, wallet_address)
                for t in transfers:
                    tr_stmt = insert(Transfer).values(
                        tx_id=tx_id,
                        wallet_address=wallet_address,
                        token_address=t["token_address"],
                        direction=t["direction"],
                        amount=t["amount"],
                        timestamp=t["timestamp"],
                    )
                    await session.execute(tr_stmt)

                # Reconstruct trade
                trade_dict, parse_status, reason = detect_swap_and_reconstruct_trade(
                    transfers, data
                )

                if parse_status == "TRADE" and trade_dict:
                    parsed_count += 1
                    tok_addr = trade_dict["token_address"]

                    # Ensure token exists
                    if tok_addr not in tokens_cache:
                        new_tok = Token(
                            chain="solana",
                            address=tok_addr,
                            decimals=9,
                        )
                        session.add(new_tok)
                        await session.flush()
                        tokens_cache[tok_addr] = new_tok.id

                    token_id = tokens_cache[tok_addr]

                    # Save Trade
                    trade_stmt = (
                        insert(Trade)
                        .values(
                            wallet_id=wallet_id,
                            token_id=token_id,
                            tx_hash=sig,
                            timestamp=trade_dict["timestamp"],
                            side=trade_dict["side"],
                            token_amount=trade_dict["token_amount"],
                            quote_amount=trade_dict["quote_amount"],
                            price=trade_dict["price"],
                            dex=trade_dict["dex"],
                        )
                        .on_conflict_do_nothing(
                            constraint="uq_trade_event"
                        )
                    )
                    await session.execute(trade_stmt)

                    all_reconstructed_trades.append(
                        {
                            "token_id": token_id,
                            "side": trade_dict["side"],
                            "token_amount": trade_dict["token_amount"],
                            "quote_amount": trade_dict["quote_amount"],
                            "price": trade_dict["price"],
                            "timestamp": trade_dict["timestamp"],
                        }
                    )
                elif parse_status == "UNKNOWN":
                    err_stmt = insert(ParserError).values(
                        tx_hash=sig,
                        wallet_address=wallet_address,
                        status="UNKNOWN",
                        reason=reason,
                    )
                    await session.execute(err_stmt)
                else:
                    parsed_count += 1

            # 6. Build positions
            # For complete portfolio accounting, fetch all historical trades for this wallet
            all_wallet_trades_res = await session.execute(
                select(Trade)
                .where(Trade.wallet_id == wallet_id)
                .order_by(Trade.timestamp.asc())
            )
            all_historical_trades = [
                {
                    "token_id": t.token_id,
                    "side": t.side,
                    "token_amount": t.token_amount,
                    "quote_amount": t.quote_amount,
                    "price": t.price,
                    "timestamp": t.timestamp,
                }
                for t in all_wallet_trades_res.scalars()
            ]

            positions = build_positions_from_trades(all_historical_trades, wallet_id)

            # 6a. Enrich tokens with metadata (symbol & name from DexScreener)
            traded_token_ids = list({t["token_id"] for t in all_historical_trades})
            if traded_token_ids:
                unnamed_tok_res = await session.execute(
                    select(Token).where(Token.id.in_(traded_token_ids), Token.symbol.is_(None))
                )
                unnamed_tokens = unnamed_tok_res.scalars().all()
                if unnamed_tokens:
                    unnamed_addrs = [tok.address for tok in unnamed_tokens]
                    try:
                        meta_dict = await fetch_token_metadata_and_prices(unnamed_addrs)
                        for tok in unnamed_tokens:
                            info = meta_dict.get(tok.address)
                            if info and info.get("symbol"):
                                tok.symbol = info["symbol"]
                                tok.name = info.get("name")
                        await session.flush()
                    except Exception as err:
                        logger.warning(f"Failed to fetch metadata for traded tokens: {err}")

            # 6b. Live Price Oracle for OPEN positions
            id_to_mint = {v: k for k, v in tokens_cache.items()}
            open_positions = [p for p in positions if p["status"] == "OPEN" and p["quantity"] > 0]
            if open_positions:
                open_mints = list({id_to_mint[p["token_id"]] for p in open_positions if p["token_id"] in id_to_mint})
                if open_mints:
                    try:
                        live_prices = await fetch_token_prices(open_mints)
                        for p in open_positions:
                            mint = id_to_mint.get(p["token_id"])
                            cur_price = live_prices.get(mint, Decimal("0"))
                            if cur_price > Decimal("0"):
                                market_val = p["quantity"] * cur_price
                                p["unrealized_pnl"] = market_val - p["total_cost_basis"]
                                if p["total_cost_basis"] > Decimal("0"):
                                    p["roi"] = (p["unrealized_pnl"] / p["total_cost_basis"]) * Decimal("100")
                    except Exception as err:
                        logger.warning(f"Failed to fetch live prices for open positions: {err}")

            # Clear old positions for this wallet and insert new
            await session.execute(delete(Position).where(Position.wallet_id == wallet_id))
            for p in positions:
                session.add(
                    Position(
                        wallet_id=wallet_id,
                        token_id=p["token_id"],
                        quantity=p["quantity"],
                        avg_entry_price=p["avg_entry_price"],
                        total_cost_basis=p["total_cost_basis"],
                        realized_pnl=p["realized_pnl"],
                        unrealized_pnl=p["unrealized_pnl"],
                        roi=p["roi"],
                        opened_at=p["opened_at"],
                        last_trade_at=p["last_trade_at"],
                        closed_at=p["closed_at"],
                        status=p["status"],
                    )
                )

            # Lifetime transaction bounds across all historical transactions in DB
            bounds_stmt = (
                select(func.min(Transaction.block_time), func.max(Transaction.block_time))
                .where(Transaction.wallet_address == wallet_address)
            )
            bounds_res = (await session.execute(bounds_stmt)).first()
            if bounds_res and bounds_res[0]:
                first_block_time = bounds_res[0]
            if bounds_res and bounds_res[1]:
                last_block_time = bounds_res[1]

            # 7. Calculate wallet metrics & classification
            metrics_dict = calculate_wallet_metrics_and_classification(
                wallet_id=wallet_id,
                trades=all_historical_trades,
                positions=positions,
                first_seen_at=first_block_time,
                last_seen_at=last_block_time,
            )

            metric_stmt = (
                insert(WalletMetric)
                .values(**metrics_dict)
                .on_conflict_do_update(
                    index_elements=["wallet_id"],
                    set_=metrics_dict,
                )
            )
            await session.execute(metric_stmt)

            # 8. Update wallet dates and job status
            await session.execute(
                update(Wallet)
                .where(Wallet.id == wallet_id)
                .values(
                    first_seen_at=first_block_time,
                    last_seen_at=last_block_time,
                    updated_at=datetime.now(timezone.utc),
                )
            )

            await session.execute(
                update(WalletSyncJob)
                .where(WalletSyncJob.id == job_id)
                .values(
                    status="COMPLETED",
                    parsed_transactions=parsed_count,
                    reconstructed_trades=len(all_reconstructed_trades),
                    progress_percentage=Decimal("100.0"),
                    completed_at=datetime.now(timezone.utc),
                )
            )
            await session.commit()

            return {
                "status": "COMPLETED",
                "wallet_address": wallet_address,
                "total_transactions": total_tx,
                "parsed_transactions": parsed_count,
                "reconstructed_trades": len(all_reconstructed_trades),
                "positions_count": len(positions),
                "metrics": {
                    "realized_pnl": float(metrics_dict["realized_pnl"]),
                    "win_rate": float(metrics_dict["win_rate"]),
                    "classification": {
                        "performance": metrics_dict["performance_tier"],
                        "style": metrics_dict["trading_style"],
                        "capital": metrics_dict["capital_tier"],
                        "activity": metrics_dict["activity_level"],
                    },
                },
            }

    except Exception as exc:
        logger.exception(f"Sync failed for wallet {wallet_address}: {exc}")
        async with async_session_factory() as session:
            await session.execute(
                update(WalletSyncJob)
                .where(WalletSyncJob.id == job_id)
                .values(
                    status="FAILED",
                    error_message=str(exc),
                    completed_at=datetime.now(timezone.utc),
                )
            )
            await session.commit()
        raise
