import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    address = Column(Text, nullable=False, unique=True, index=True)
    chain = Column(Text, nullable=False, default="solana")
    label = Column(Text, nullable=True)
    is_tracked = Column(Boolean, default=True, index=True)
    tags = Column(ARRAY(Text), default=list)
    first_seen_at = Column(DateTime(timezone=True), nullable=True)
    last_seen_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    trades = relationship("Trade", back_populates="wallet", cascade="all, delete-orphan")
    positions = relationship("Position", back_populates="wallet", cascade="all, delete-orphan")
    metrics = relationship("WalletMetric", back_populates="wallet", uselist=False, cascade="all, delete-orphan")
    sync_jobs = relationship("WalletSyncJob", back_populates="wallet", cascade="all, delete-orphan")


class Token(Base):
    __tablename__ = "tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chain = Column(Text, nullable=False, default="solana")
    address = Column(Text, nullable=False, index=True)
    symbol = Column(Text, nullable=True)
    name = Column(Text, nullable=True)
    decimals = Column(Integer, default=9)
    first_seen_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("chain", "address", name="uq_token_chain_address"),
    )

    trades = relationship("Trade", back_populates="token")
    positions = relationship("Position", back_populates="token")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chain = Column(Text, nullable=False, default="solana")
    tx_hash = Column(Text, nullable=False, unique=True, index=True)
    wallet_address = Column(Text, nullable=False, index=True)
    block_number = Column(BigInteger, nullable=True)
    block_time = Column(DateTime(timezone=True), nullable=True)
    success = Column(Boolean, default=True)
    raw_data = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transfers = relationship("Transfer", back_populates="transaction", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_transactions_wallet_time", "wallet_address", block_time.desc()),
    )


class Transfer(Base):
    __tablename__ = "transfers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tx_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False)
    wallet_address = Column(Text, nullable=False, index=True)
    token_address = Column(Text, nullable=False)
    direction = Column(Text, nullable=False)  # 'IN' or 'OUT'
    amount = Column(Numeric(36, 18), nullable=False)
    usd_value = Column(Numeric(20, 4), nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False)

    transaction = relationship("Transaction", back_populates="transfers")

    __table_args__ = (
        Index("idx_transfers_wallet_time", "wallet_address", timestamp.desc()),
    )


class Trade(Base):
    __tablename__ = "trades"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wallet_id = Column(UUID(as_uuid=True), ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False)
    token_id = Column(UUID(as_uuid=True), ForeignKey("tokens.id", ondelete="RESTRICT"), nullable=False)
    tx_hash = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    side = Column(Text, nullable=False)  # 'BUY' or 'SELL'
    token_amount = Column(Numeric(36, 18), nullable=False)
    quote_amount = Column(Numeric(36, 18), nullable=False)
    price = Column(Numeric(36, 18), nullable=True)
    usd_value = Column(Numeric(20, 4), nullable=True)
    market_cap = Column(Numeric(24, 2), nullable=True)
    dex = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    wallet = relationship("Wallet", back_populates="trades")
    token = relationship("Token", back_populates="trades")

    __table_args__ = (
        UniqueConstraint("tx_hash", "wallet_id", "token_id", "side", name="uq_trade_event"),
        Index("idx_trades_wallet_time", "wallet_id", timestamp.desc()),
        Index("idx_trades_wallet_token", "wallet_id", "token_id"),
    )


class Position(Base):
    __tablename__ = "positions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wallet_id = Column(UUID(as_uuid=True), ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False)
    token_id = Column(UUID(as_uuid=True), ForeignKey("tokens.id", ondelete="RESTRICT"), nullable=False)
    quantity = Column(Numeric(36, 18), nullable=False, default=0)
    avg_entry_price = Column(Numeric(36, 18), nullable=True)
    total_cost_basis = Column(Numeric(20, 4), default=0)
    realized_pnl = Column(Numeric(20, 4), default=0)
    unrealized_pnl = Column(Numeric(20, 4), default=0)
    roi = Column(Numeric(10, 4), nullable=True)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    last_trade_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(Text, nullable=False, default="OPEN")  # 'OPEN' or 'CLOSED'
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    wallet = relationship("Wallet", back_populates="positions")
    token = relationship("Token", back_populates="positions")

    __table_args__ = (
        Index("idx_positions_wallet_status", "wallet_id", "status"),
        Index("idx_positions_wallet_token", "wallet_id", "token_id"),
    )


class WalletMetric(Base):
    __tablename__ = "wallet_metrics"

    wallet_id = Column(UUID(as_uuid=True), ForeignKey("wallets.id", ondelete="CASCADE"), primary_key=True)
    trade_count = Column(Integer, default=0)
    winning_trades = Column(Integer, default=0)
    losing_trades = Column(Integer, default=0)
    win_rate = Column(Numeric(6, 2), default=0)
    realized_pnl = Column(Numeric(20, 4), default=0)
    unrealized_pnl = Column(Numeric(20, 4), default=0)
    total_pnl = Column(Numeric(20, 4), default=0)
    roi = Column(Numeric(10, 4), default=0)
    avg_trade_pnl = Column(Numeric(20, 4), nullable=True)
    avg_win = Column(Numeric(20, 4), nullable=True)
    avg_loss = Column(Numeric(20, 4), nullable=True)
    profit_factor = Column(Numeric(10, 4), nullable=True)
    avg_hold_seconds = Column(BigInteger, nullable=True)
    median_hold_seconds = Column(BigInteger, nullable=True)
    max_drawdown = Column(Numeric(8, 4), nullable=True)
    performance_tier = Column(Text, nullable=True)
    trading_style = Column(Text, nullable=True)
    capital_tier = Column(Text, nullable=True)
    avg_position_usd = Column(Numeric(20, 4), nullable=True)
    activity_level = Column(Text, nullable=True)
    classified_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    wallet = relationship("Wallet", back_populates="metrics")


class WalletSyncJob(Base):
    __tablename__ = "wallet_sync_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wallet_id = Column(UUID(as_uuid=True), ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False)
    status = Column(Text, nullable=False, default="PENDING")  # 'PENDING', 'SYNCING', 'PROCESSING', 'COMPLETED', 'FAILED'
    total_transactions = Column(Integer, default=0)
    parsed_transactions = Column(Integer, default=0)
    reconstructed_trades = Column(Integer, default=0)
    progress_percentage = Column(Numeric(5, 2), default=0)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    wallet = relationship("Wallet", back_populates="sync_jobs")

    __table_args__ = (
        Index("idx_sync_jobs_wallet_created", "wallet_id", created_at.desc()),
    )


class ParserError(Base):
    __tablename__ = "parser_errors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tx_hash = Column(Text, nullable=False)
    wallet_address = Column(Text, nullable=False, index=True)
    status = Column(Text, nullable=False)  # 'PARSED', 'UNPARSED', 'FAILED', 'UNKNOWN'
    reason = Column(Text, nullable=True)
    context = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
