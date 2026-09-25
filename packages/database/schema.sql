-- =============================================================================
-- Wallet Intelligence — Database Schema (PostgreSQL 14+)
-- =============================================================================

-- 1. Wallets
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address TEXT NOT NULL UNIQUE,
    chain TEXT NOT NULL DEFAULT 'solana',
    label TEXT,
    is_tracked BOOLEAN DEFAULT TRUE,
    tags TEXT[] DEFAULT '{}',
    first_seen_at TIMESTAMP WITH TIME ZONE,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);
CREATE INDEX IF NOT EXISTS idx_wallets_is_tracked ON wallets(is_tracked);

-- 2. Tokens
CREATE TABLE IF NOT EXISTS tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain TEXT NOT NULL DEFAULT 'solana',
    address TEXT NOT NULL,
    symbol TEXT,
    name TEXT,
    decimals INTEGER DEFAULT 9,
    first_seen_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chain, address)
);
CREATE INDEX IF NOT EXISTS idx_tokens_address ON tokens(address);

-- 3. Raw Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain TEXT NOT NULL DEFAULT 'solana',
    tx_hash TEXT NOT NULL UNIQUE,
    wallet_address TEXT NOT NULL,
    block_number BIGINT,
    block_time TIMESTAMP WITH TIME ZONE,
    success BOOLEAN DEFAULT TRUE,
    raw_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_time ON transactions(wallet_address, block_time DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash);

-- 4. Transfers
CREATE TABLE IF NOT EXISTS transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    token_address TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('IN', 'OUT')),
    amount NUMERIC(36, 18) NOT NULL,
    usd_value NUMERIC(20, 4),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transfers_wallet_time ON transfers(wallet_address, timestamp DESC);

-- 5. Trades
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE RESTRICT,
    tx_hash TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
    token_amount NUMERIC(36, 18) NOT NULL,
    quote_amount NUMERIC(36, 18) NOT NULL,
    price NUMERIC(36, 18),
    usd_value NUMERIC(20, 4),
    market_cap NUMERIC(24, 2),
    dex TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_trade_event UNIQUE (tx_hash, wallet_id, token_id, side)
);
CREATE INDEX IF NOT EXISTS idx_trades_wallet_time ON trades(wallet_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_wallet_token ON trades(wallet_id, token_id);

-- 6. Positions
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE RESTRICT,
    quantity NUMERIC(36, 18) NOT NULL DEFAULT 0,
    avg_entry_price NUMERIC(36, 18),
    total_cost_basis NUMERIC(20, 4) DEFAULT 0,
    realized_pnl NUMERIC(20, 4) DEFAULT 0,
    unrealized_pnl NUMERIC(20, 4) DEFAULT 0,
    roi NUMERIC(10, 4),
    opened_at TIMESTAMP WITH TIME ZONE,
    last_trade_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_positions_wallet_status ON positions(wallet_id, status);
CREATE INDEX IF NOT EXISTS idx_positions_wallet_token ON positions(wallet_id, token_id);

-- 7. Wallet Metrics
CREATE TABLE IF NOT EXISTS wallet_metrics (
    wallet_id UUID PRIMARY KEY REFERENCES wallets(id) ON DELETE CASCADE,
    trade_count INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    win_rate NUMERIC(6, 2) DEFAULT 0,
    realized_pnl NUMERIC(20, 4) DEFAULT 0,
    unrealized_pnl NUMERIC(20, 4) DEFAULT 0,
    total_pnl NUMERIC(20, 4) DEFAULT 0,
    roi NUMERIC(10, 4) DEFAULT 0,
    avg_trade_pnl NUMERIC(20, 4),
    avg_win NUMERIC(20, 4),
    avg_loss NUMERIC(20, 4),
    profit_factor NUMERIC(10, 4),
    avg_hold_seconds BIGINT,
    median_hold_seconds BIGINT,
    max_drawdown NUMERIC(8, 4),
    performance_tier TEXT,
    trading_style TEXT,
    capital_tier TEXT,
    activity_level TEXT,
    classified_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Wallet Sync Jobs
CREATE TABLE IF NOT EXISTS wallet_sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'SYNCING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    total_transactions INTEGER DEFAULT 0,
    parsed_transactions INTEGER DEFAULT 0,
    reconstructed_trades INTEGER DEFAULT 0,
    progress_percentage NUMERIC(5, 2) DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_wallet_created ON wallet_sync_jobs(wallet_id, created_at DESC);

-- 9. Parser Errors
CREATE TABLE IF NOT EXISTS parser_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_hash TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PARSED', 'UNPARSED', 'FAILED', 'UNKNOWN')),
    reason TEXT,
    context JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_parser_errors_wallet ON parser_errors(wallet_address);
