const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface WalletOverview {
  address: string;
  chain: string;
  first_seen_at: string | null;
  last_active_at: string | null;
  metrics: {
    trade_count: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number;
    realized_pnl: number;
    unrealized_pnl: number;
    total_pnl: number;
    roi: number;
    avg_trade_pnl?: number;
    median_hold_seconds?: number;
    avg_hold_seconds?: number;
  } | null;
  classification: {
    performance_tier?: string;
    trading_style?: string;
    capital_tier?: string;
    activity_level?: string;
  } | null;
  coverage: {
    transactions_analyzed: number;
    successfully_parsed: number;
    unparsed: number;
    coverage_percentage: number;
  } | null;
}

export interface SyncStatus {
  status: "PENDING" | "SYNCING" | "PROCESSING" | "COMPLETED" | "FAILED";
  progress_percentage: number;
  total_transactions: number;
  parsed_transactions: number;
  reconstructed_trades: number;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface TradeItem {
  id: string;
  tx_hash: string;
  timestamp: string;
  side: "BUY" | "SELL";
  token_address: string;
  token_symbol?: string | null;
  token_amount: number;
  quote_amount: number;
  price?: number | null;
  usd_value?: number | null;
  dex?: string | null;
}

export interface TradeListResponse {
  page: number;
  limit: number;
  total_records: number;
  items: TradeItem[];
}

export interface PositionItem {
  id: string;
  token_address: string;
  token_symbol?: string | null;
  quantity: number;
  avg_entry_price?: number | null;
  total_cost_basis: number;
  realized_pnl: number;
  unrealized_pnl: number;
  roi?: number | null;
  opened_at?: string | null;
  last_trade_at?: string | null;
  closed_at?: string | null;
  status: "OPEN" | "CLOSED";
}

export interface HoldingBucket {
  bucket: string;
  count: number;
}

export interface PerformanceResponse {
  holding_time_distribution: HoldingBucket[];
  pnl_summary: {
    realized_pnl: number;
    unrealized_pnl: number;
    total_pnl: number;
    win_rate: number;
    roi: number;
  };
}

export interface TokenPerformanceItem {
  token_address: string;
  symbol?: string | null;
  name?: string | null;
  trade_count: number;
  total_invested: number;
  realized_pnl: number;
  roi: number;
}

export interface InitialFundingResponse {
  first_seen_at?: string | null;
  initial_balance_sol?: number | null;
  first_funding_source?: string | null;
  initial_funding_tx?: string | null;
}

// --- Multi-Wallet Tracker Interfaces ---
export interface TrackedWalletItem {
  id: string;
  address: string;
  label?: string | null;
  tags: string[];
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  is_tracked: boolean;
  sync_status: string;
  trade_count: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_pnl: number;
  roi: number;
  median_hold_seconds?: number | null;
  avg_position_usd?: number | null;
  performance_tier?: string | null;
  trading_style?: string | null;
  capital_tier?: string | null;
  activity_level?: string | null;
}

export interface TrackedWalletsListResponse {
  page: number;
  limit: number;
  total_records: number;
  items: TrackedWalletItem[];
}

export interface TrackerOverview {
  total_tracked_wallets: number;
  combined_realized_pnl: number;
  combined_unrealized_pnl: number;
  combined_total_pnl: number;
  average_win_rate: number;
  active_today_count: number;
  top_performer?: {
    address: string;
    label?: string | null;
    realized_pnl: number;
  } | null;
}

export interface TrackerFeedItem {
  id: string;
  wallet_address: string;
  wallet_label?: string | null;
  tx_hash: string;
  timestamp: string;
  side: "BUY" | "SELL";
  token_address: string;
  token_symbol?: string | null;
  token_amount: number;
  quote_amount: number;
  price?: number | null;
  dex?: string | null;
}

export interface BulkImportResponse {
  total_received: number;
  imported_count: number;
  already_tracked_count: number;
  invalid_addresses: string[];
  imported_addresses: string[];
}

// --- API Functions ---

export async function getWalletOverview(address: string): Promise<WalletOverview> {
  const res = await fetch(`${API_BASE}/api/wallet/${address}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(res.status === 404 ? "NOT_FOUND" : `Failed to fetch wallet: ${res.statusText}`);
  }
  return res.json();
}

export async function triggerWalletSync(address: string): Promise<{ job_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/wallet/${address}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to trigger sync");
  }
  return res.json();
}

export async function getSyncStatus(address: string): Promise<SyncStatus> {
  const res = await fetch(`${API_BASE}/api/wallet/${address}/sync-status`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch sync status");
  return res.json();
}

export async function getWalletTrades(
  address: string,
  params: { page?: number; limit?: number; side?: string; token?: string } = {}
): Promise<TradeListResponse> {
  const url = new URL(`${API_BASE}/api/wallet/${address}/trades`);
  if (params.page) url.searchParams.set("page", params.page.toString());
  if (params.limit) url.searchParams.set("limit", params.limit.toString());
  if (params.side) url.searchParams.set("side", params.side);
  if (params.token) url.searchParams.set("token", params.token);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch trades");
  return res.json();
}

export async function getWalletPositions(
  address: string,
  statusFilter?: "OPEN" | "CLOSED"
): Promise<PositionItem[]> {
  const url = new URL(`${API_BASE}/api/wallet/${address}/positions`);
  if (statusFilter) url.searchParams.set("status_filter", statusFilter);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch positions");
  return res.json();
}

export async function getWalletPerformance(
  address: string,
  timeframe?: string
): Promise<PerformanceResponse> {
  const url = new URL(`${API_BASE}/api/wallet/${address}/performance`);
  if (timeframe) url.searchParams.set("timeframe", timeframe);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch performance");
  return res.json();
}

export async function refreshWalletPrices(
  address: string
): Promise<{ updated_positions: number; unrealized_pnl: number }> {
  const res = await fetch(`${API_BASE}/api/wallet/${address}/refresh-prices`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to refresh token prices");
  return res.json();
}

export async function getWalletTokens(address: string): Promise<TokenPerformanceItem[]> {
  const res = await fetch(`${API_BASE}/api/wallet/${address}/tokens`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch tokens");
  return res.json();
}

export async function getWalletFunding(address: string): Promise<InitialFundingResponse> {
  const res = await fetch(`${API_BASE}/api/wallet/${address}/funding`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch funding");
  return res.json();
}

// --- Multi-Wallet Tracker Endpoints ---

export async function getTrackedWallets(params: {
  search?: string;
  tier?: string;
  category?: string;
  timeframe?: string;
  sort_by?: string;
  order?: string;
  page?: number;
  limit?: number;
} = {}): Promise<TrackedWalletsListResponse> {
  const url = new URL(`${API_BASE}/api/wallets`);
  if (params.search) url.searchParams.set("search", params.search);
  if (params.tier) url.searchParams.set("tier", params.tier);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.timeframe) url.searchParams.set("timeframe", params.timeframe);
  if (params.sort_by) url.searchParams.set("sort_by", params.sort_by);
  if (params.order) url.searchParams.set("order", params.order);
  if (params.page) url.searchParams.set("page", params.page.toString());
  if (params.limit) url.searchParams.set("limit", params.limit.toString());

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch tracked wallets");
  return res.json();
}

export async function bulkImportWallets(payload: {
  addresses: string[];
  default_label?: string;
  auto_sync?: boolean;
}): Promise<BulkImportResponse> {
  const res = await fetch(`${API_BASE}/api/wallets/bulk-import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to bulk import wallets");
  }
  return res.json();
}

export async function updateWallet(
  address: string,
  payload: { label?: string; is_tracked?: boolean; tags?: string[] }
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/wallets/${address}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update wallet");
}

export async function untrackWallet(address: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/wallets/${address}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to remove wallet from tracking");
}

export async function getTrackerOverview(timeframe?: string): Promise<TrackerOverview> {
  const url = new URL(`${API_BASE}/api/wallets/tracker/overview`);
  if (timeframe) url.searchParams.set("timeframe", timeframe);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch tracker overview");
  return res.json();
}

export async function getTrackerFeed(limit = 50): Promise<TrackerFeedItem[]> {
  const res = await fetch(`${API_BASE}/api/wallets/tracker/feed?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch tracker feed");
  return res.json();
}
