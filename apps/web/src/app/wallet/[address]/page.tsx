"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  Clock,
  ShieldCheck,
  Coins,
  Percent,
  CheckCircle2,
  AlertCircle,
  Activity,
  Layers,
} from "lucide-react";
import {
  getWalletOverview,
  getWalletPerformance,
  getWalletFunding,
  triggerWalletSync,
  getSyncStatus,
  WalletOverview,
  PerformanceResponse,
  InitialFundingResponse,
  SyncStatus,
} from "@/lib/api";
import { formatNumber, formatPercent, formatDuration, shortenAddress } from "@/lib/utils";
import { ClassificationBadge } from "@/components/ClassificationBadge";
import { HoldingDistributionChart } from "@/components/HoldingDistributionChart";
import { TradeHistoryTable } from "@/components/TradeHistoryTable";
import { TokenPerformanceTable } from "@/components/TokenPerformanceTable";

export default function WalletDashboardPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const resolvedParams = use(params);
  const address = resolvedParams.address;

  const [overview, setOverview] = useState<WalletOverview | null>(null);
  const [performance, setPerformance] = useState<PerformanceResponse | null>(null);
  const [funding, setFunding] = useState<InitialFundingResponse | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"trades" | "tokens">("trades");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadWalletData = async () => {
    try {
      setLoading(true);
      setError(null);

      try {
        const ov = await getWalletOverview(address);
        setOverview(ov);

        const [perf, fund] = await Promise.all([
          getWalletPerformance(address).catch(() => null),
          getWalletFunding(address).catch(() => null),
        ]);
        setPerformance(perf);
        setFunding(fund);
      } catch (err: any) {
        if (err.message === "NOT_FOUND") {
          // Trigger initial sync automatically
          setSyncing(true);
          await triggerWalletSync(address);
          pollSyncProgress();
          return;
        }
        throw err;
      }

      // Check if background sync is still running
      try {
        const sync = await getSyncStatus(address);
        setSyncStatus(sync);
        if (sync.status === "SYNCING" || sync.status === "PROCESSING") {
          setSyncing(true);
          pollSyncProgress();
        }
      } catch {
        // No sync jobs yet
      }
    } catch (err: any) {
      setError(err.message || "Failed to load wallet data");
    } finally {
      setLoading(false);
    }
  };

  const pollSyncProgress = () => {
    const interval = setInterval(async () => {
      try {
        const sync = await getSyncStatus(address);
        setSyncStatus(sync);

        if (sync.status === "COMPLETED") {
          clearInterval(interval);
          setSyncing(false);
          // Reload all metrics
          const [ov, perf, fund] = await Promise.all([
            getWalletOverview(address),
            getWalletPerformance(address).catch(() => null),
            getWalletFunding(address).catch(() => null),
          ]);
          setOverview(ov);
          setPerformance(perf);
          setFunding(fund);
        } else if (sync.status === "FAILED") {
          clearInterval(interval);
          setSyncing(false);
          setError(sync.error_message || "Sync job failed");
        }
      } catch {
        clearInterval(interval);
        setSyncing(false);
      }
    }, 2000);
  };

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      await triggerWalletSync(address);
      pollSyncProgress();
    } catch (err: any) {
      setError(err.message || "Failed to trigger sync");
      setSyncing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    loadWalletData();
  }, [address]);

  const metrics = overview?.metrics;
  const classification = overview?.classification;
  const coverage = overview?.coverage;

  if (!mounted) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-pulse">
        <div className="h-10 w-32 bg-slate-900/60 rounded-lg" />
        <div className="h-32 bg-slate-900/60 rounded-xl border border-slate-800" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="h-24 bg-slate-900/60 rounded-xl border border-slate-800" />
          <div className="h-24 bg-slate-900/60 rounded-xl border border-slate-800" />
          <div className="h-24 bg-slate-900/60 rounded-xl border border-slate-800" />
          <div className="h-24 bg-slate-900/60 rounded-xl border border-slate-800" />
        </div>
        <div className="h-80 bg-slate-900/60 rounded-xl border border-slate-800" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Back button & top bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Search</span>
        </Link>

        <button
          onClick={handleManualSync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-purple-400" : ""}`} />
          <span>{syncing ? "Syncing..." : "Re-Sync On-Chain"}</span>
        </button>
      </div>

      {/* Sync Status Banner */}
      {syncing && syncStatus && (
        <div className="glass-panel p-4 border border-purple-500/40 bg-purple-950/20 space-y-2 animate-pulse">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-purple-300 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
              Synchronizing Solana Historical Transactions... ({syncStatus.status})
            </span>
            <span className="text-purple-400 font-bold">{syncStatus.progress_percentage.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-purple-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(5, syncStatus.progress_percentage)}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
            <span>Transactions: {syncStatus.total_transactions}</span>
            <span>Parsed: {syncStatus.parsed_transactions}</span>
            <span>Trades Reconstructed: {syncStatus.reconstructed_trades}</span>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header Profile Card */}
      <div className="glass-panel p-6 space-y-4 border border-slate-800/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight break-all">
                {address}
              </h1>
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="Copy Address"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <a
                href={`https://solscan.io/account/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-colors"
                title="View on Solscan"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
              <div>
                First Seen:{" "}
                <span className="text-slate-200 font-medium">
                  {overview?.first_seen_at
                    ? new Date(overview.first_seen_at).toLocaleDateString()
                    : "-"}
                </span>
              </div>
              <div>
                Last Active:{" "}
                <span className="text-slate-200 font-medium">
                  {overview?.last_active_at
                    ? new Date(overview.last_active_at).toLocaleDateString()
                    : "-"}
                </span>
              </div>
            </div>
          </div>

          {/* Classification Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <ClassificationBadge type="performance" value={classification?.performance_tier} />
            <ClassificationBadge type="style" value={classification?.trading_style} />
            <ClassificationBadge type="capital" value={classification?.capital_tier} />
            <ClassificationBadge type="activity" value={classification?.activity_level} />
          </div>
        </div>

        {/* Data Quality & Coverage Pill */}
        {coverage && (
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Data Coverage:</span>
              <span className="text-slate-200 font-semibold">{coverage.coverage_percentage}%</span>
              <span className="text-[11px] text-slate-500">
                ({coverage.successfully_parsed} parsed / {coverage.unparsed} unparsed of {coverage.transactions_analyzed} txs)
              </span>
            </div>
            {coverage.coverage_percentage >= 95 ? (
              <span className="text-emerald-400 text-[11px] flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> High Data Quality
              </span>
            ) : (
              <span className="text-amber-400 text-[11px]">Partial Coverage</span>
            )}
          </div>
        )}
      </div>

      {/* Performance Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Realized PnL */}
        <div className="glass-panel p-4 space-y-1">
          <span className="text-slate-500 text-[11px] font-mono uppercase tracking-wider block">
            Realized PnL
          </span>
          <div
            className={`text-lg sm:text-xl font-bold font-mono ${
              (metrics?.realized_pnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {(metrics?.realized_pnl || 0) >= 0 ? "+" : ""}
            {(metrics?.realized_pnl || 0).toFixed(2)} SOL
          </div>
        </div>

        {/* Unrealized PnL */}
        <div className="glass-panel p-4 space-y-1">
          <span className="text-slate-500 text-[11px] font-mono uppercase tracking-wider block">
            Unrealized PnL
          </span>
          <div className="text-lg sm:text-xl font-bold font-mono text-slate-300">
            {(metrics?.unrealized_pnl || 0).toFixed(2)} SOL
          </div>
        </div>

        {/* Total PnL */}
        <div className="glass-panel p-4 space-y-1">
          <span className="text-slate-500 text-[11px] font-mono uppercase tracking-wider block">
            Total PnL
          </span>
          <div
            className={`text-lg sm:text-xl font-bold font-mono ${
              (metrics?.total_pnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {(metrics?.total_pnl || 0) >= 0 ? "+" : ""}
            {(metrics?.total_pnl || 0).toFixed(2)} SOL
          </div>
        </div>

        {/* Win Rate */}
        <div className="glass-panel p-4 space-y-1">
          <span className="text-slate-500 text-[11px] font-mono uppercase tracking-wider block">
            Win Rate
          </span>
          <div className="text-lg sm:text-xl font-bold font-mono text-white">
            {metrics?.win_rate ? metrics.win_rate.toFixed(1) : "0.0"}%
          </div>
          <span className="text-[10px] text-slate-500 font-mono block">
            {metrics?.winning_trades || 0}W / {metrics?.losing_trades || 0}L
          </span>
        </div>

        {/* ROI */}
        <div className="glass-panel p-4 space-y-1">
          <span className="text-slate-500 text-[11px] font-mono uppercase tracking-wider block">
            ROI
          </span>
          <div
            className={`text-lg sm:text-xl font-bold font-mono ${
              (metrics?.roi || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {formatPercent(metrics?.roi)}
          </div>
        </div>

        {/* Total Trades */}
        <div className="glass-panel p-4 space-y-1">
          <span className="text-slate-500 text-[11px] font-mono uppercase tracking-wider block">
            Total Trades
          </span>
          <div className="text-lg sm:text-xl font-bold font-mono text-cyan-400">
            {metrics?.trade_count || 0}
          </div>
        </div>
      </div>

      {/* Behavior Stats & Holding Time Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Trading Behavior Stats */}
        <div className="glass-panel p-5 space-y-4">
          <h2 className="text-sm font-bold font-mono text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <span>Trading Behavior</span>
          </h2>

          <div className="divide-y divide-slate-800/80 text-xs font-mono">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-400">Median Hold Duration:</span>
              <span className="text-white font-bold">
                {formatDuration(metrics?.median_hold_seconds)}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-400">Average Hold Duration:</span>
              <span className="text-slate-300 font-medium">
                {formatDuration(metrics?.avg_hold_seconds)}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-400">Average Position Size:</span>
              <span className="text-slate-200 font-medium">
                {metrics?.avg_trade_pnl ? `${metrics.avg_trade_pnl.toFixed(2)} SOL` : "-"}
              </span>
            </div>
            {funding && funding.initial_balance_sol && (
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-400">Initial Funding:</span>
                <span className="text-cyan-400 font-bold">
                  {funding.initial_balance_sol.toFixed(2)} SOL
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right 2 cols: Holding Time Distribution Chart */}
        <div className="lg:col-span-2 glass-panel p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold font-mono text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Holding-Time Distribution</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-500">
              Style: {classification?.trading_style || "Unknown"}
            </span>
          </div>
          <HoldingDistributionChart
            data={performance?.holding_time_distribution || []}
          />
        </div>
      </div>

      {/* Tabs: Trade History vs Token Breakdown */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center gap-4 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab("trades")}
            className={`font-mono text-sm font-bold pb-1 transition-colors relative ${
              activeTab === "trades"
                ? "text-cyan-400 border-b-2 border-cyan-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Reconstructed Trades ({metrics?.trade_count || 0})
          </button>
          <button
            onClick={() => setActiveTab("tokens")}
            className={`font-mono text-sm font-bold pb-1 transition-colors relative ${
              activeTab === "tokens"
                ? "text-cyan-400 border-b-2 border-cyan-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Token Performance Breakdown
          </button>
        </div>

        {activeTab === "trades" ? (
          <TradeHistoryTable address={address} />
        ) : (
          <TokenPerformanceTable address={address} />
        )}
      </div>
    </div>
  );
}
