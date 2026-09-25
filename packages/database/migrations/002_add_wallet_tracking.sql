-- Add tracking and label support to wallets
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS is_tracked BOOLEAN DEFAULT TRUE;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_wallets_is_tracked ON wallets(is_tracked);
