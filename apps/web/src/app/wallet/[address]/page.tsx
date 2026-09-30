"use client";

import { useEffect, useState, use, useRef } from "react";
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
  Tag,
  Edit2,
} from "lucide-react";
import {
  getWalletOverview,
  getWalletPerformance,
  getWalletFunding,
  triggerWalletSync,
  getSyncStatus,
  refreshWalletPrices,
  updateWallet,
  WalletOverview,
  PerformanceResponse,
  InitialFundingResponse,
  SyncStatus,
} from "@/lib/api";
import { formatNumber, formatPercent, formatDuration, shortenAddress } from "@/lib/utils";
import { ClassificationBadge } from "@/components/ClassificationBadge";
import { HoldingDistributionChart } from "@/components/HoldingDistributionChart";
import { CumulativePnLChart } from "@/components/CumulativePnLChart";
import { TradeHistoryTable } from "@/components/TradeHistoryTable";
import { TokenPerformanceTable } from "@/components/TokenPerformanceTable";
import { ActivityTimeline } from "@/components/ActivityTimeline";

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
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [timeframe, setTimeframe] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"trades" | "timeline" | "tokens">("trades");
  const [chartTab, setChartTab] = useState<"pnl" | "holding">("pnl");
  const [mounted, setMounted] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState("");
  const [savingLabel, setSavingLabel] = useState(false);
  const syncInitiatedRef = useRef(false);

  const handleSaveWalletLabel = async () => {
    try {
      setSavingLabel(true);
      await updateWallet(address, { label: labelValue.trim() || undefined });
      setEditingLabel(false);
      const updated = await getWalletOverview(address);
      setOverview(updated);
    } catch (err: any) {
      alert("Failed to save wallet label: " + (err.message || err));
    } finally {
      setSavingLabel(false);
    }
  };

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
          getWalletPerformance(address, timeframe !== "all" ? timeframe : undefined).catch(() => null),
          getWalletFunding(address).catch(() => null),
        ]);
        setPerformance(perf);
        setFunding(fund);
      } catch (err: any) {
        if (err.message === "NOT_FOUND") {
          if (syncInitiatedRef.current) return;
          syncInitiatedRef.current = true;
          setSyncing(true);
          try {
            await triggerWalletSync(address);
            pollSyncProgress();
          } catch (syncErr: any) {
            setSyncing(false);
            setError(syncErr.message || "Failed to trigger sync");
          }
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

  const handleRefreshPrices = async () => {
    try {
      setRefreshingPrices(true);
      await refreshWalletPrices(address);
      await loadWalletData();
    } catch (err: any) {
      alert("Failed to refresh live token prices");
    } finally {
      setRefreshingPrices(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    loadWalletData();
  }, [address, timeframe]);

  const metrics = overview?.metrics;
  const classification = overview?.classification;
  const coverage = overview?.coverage;

  if (!mounted || (loading && !overview && !error)) {
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

  // Error screen when wallet cannot be loaded/found
  if (error && !overview) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 space-y-6 font-sans">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Watchlist</span>
        </Link>

        <div className="glass-panel p-8 border border-rose-500/30 bg-rose-950/20 rounded-2xl text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">
              Gagal Memuat Wallet
            </h2>
            <p className="text-xs text-rose-300 font-mono break-all max-w-lg mx-auto">
              {error}
            </p>
          </div>

          <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            Pastikan alamat yang dimasukkan adalah alamat publik Solana yang valid (Base58, 32–44 karakter).
          </p>

          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium transition-colors shadow-lg shadow-emerald-950/30"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              <span>{syncing ? "Sedang Sinkronisasi..." : "Coba Sinkronkan Lagi"}</span>
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Halaman Utama</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Initial Sync in Progress Screen
  if (syncing && !overview) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 space-y-6 font-sans">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Watchlist</span>
        </Link>

        <div className="glass-panel p-8 border border-cyan-500/30 bg-slate-950/80 rounded-2xl text-center space-y-5 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">
              Sinkronisasi On-Chain Sedang Berjalan...
            </h2>
            <p className="text-xs text-zinc-400 font-mono">
              Alamat: <span className="text-cyan-300">{shortenAddress(address, 8)}</span>
            </p>
          </div>

          {syncStatus && (
            <div className="max-w-md mx-auto space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                <span>Status: {syncStatus.status}</span>
                <span className="text-cyan-400 font-semibold">{syncStatus.progress_percentage.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(5, syncStatus.progress_percentage)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-1">
                <span>Transaksi: {syncStatus.total_transactions}</span>
                <span>Trades Direkonstruksi: {syncStatus.reconstructed_trades}</span>
              </div>
            </div>
          )}

          <p className="text-[11px] text-zinc-500 max-w-md mx-auto">
            Sistem sedang mengambil riwayat transaksi dari Helius RPC dan merekonstruksi trade swaps secara bertahap. Halaman ini akan otomatis memuat metrik begitu selesai.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 font-sans">
      {/* Back button & top bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Tracker</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshPrices}
            disabled={refreshingPrices || syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-300 hover:text-white transition-colors disabled:opacity-50"
            title="Fetch real-time prices for open positions via DexScreener"
          >
            <Coins className={`w-3.5 h-3.5 text-zinc-400 ${refreshingPrices ? "animate-spin" : ""}`} />
            <span>{refreshingPrices ? "Updating Prices..." : "Live Price Oracle"}</span>
          </button>

          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Syncing..." : "Sync On-Chain"}</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncing && syncStatus && (
        <div className="glass-panel p-4 border border-zinc-700/80 bg-zinc-900/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-200 font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Synchronizing Solana Historical Transactions... ({syncStatus.status})
            </span>
            <span className="text-zinc-300 font-mono font-semibold">{syncStatus.progress_percentage.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-zinc-200 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(5, syncStatus.progress_percentage)}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-0.5">
            <span>Transactions: {syncStatus.total_transactions}</span>
            <span>Parsed: {syncStatus.parsed_transactions}</span>
            <span>Trades Reconstructed: {syncStatus.reconstructed_trades}</span>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Header Profile Card */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-semibold font-mono text-white tracking-tight break-all">
                {address}
              </h1>
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Copy Address"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <a
                href={`https://solscan.io/account/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                title="View on Solscan"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Wallet Name / Label */}
            <div className="flex items-center gap-2 py-0.5">
              {editingLabel ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={labelValue}
                    onChange={(e) => setLabelValue(e.target.value)}
                    placeholder="Tag / Name"
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-zinc-500 w-52 font-sans"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveWalletLabel();
                      if (e.key === "Escape") setEditingLabel(false);
                    }}
                  />
                  <button
                    onClick={handleSaveWalletLabel}
                    disabled={savingLabel}
                    className="px-2.5 py-1 rounded bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-medium"
                  >
                    {savingLabel ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setEditingLabel(false)}
                    className="text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {overview?.label ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700/60 text-xs font-medium">
                      <Tag className="w-3 h-3 text-zinc-400" />
                      {overview.label}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-500 italic">No label</span>
                  )}
                  <button
                    onClick={() => {
                      setLabelValue(overview?.label || "");
                      setEditingLabel(true);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors"
                  >
                    <Edit2 className="w-3 h-3 text-zinc-400" />
                    <span>{overview?.label ? "Edit" : "+ Add Label"}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
              <div>
                First Seen:{" "}
                <span className="text-zinc-200 font-mono">
                  {overview?.first_seen_at
                    ? new Date(overview.first_seen_at).toLocaleDateString()
                    : "-"}
                </span>
              </div>
              <div>
                Last Active:{" "}
                <span className="text-zinc-200 font-mono">
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
          <div className="pt-2.5 border-t border-zinc-800/80 flex flex-wrap items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-zinc-400" />
              <span>Data Coverage:</span>
              <span className="text-zinc-200 font-mono font-medium">{coverage.coverage_percentage}%</span>
              <span className="text-[11px] text-zinc-500 font-mono">
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

      {/* Performance Overview Header & Timeframe Switch */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <Activity className="w-4 h-4 text-zinc-400" />
          <span>Performance Overview</span>
        </h3>

        {/* Timeframe Toggle: All Time | 30D | 7D */}
        <div className="flex items-center gap-0.5 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800">
          {[
            { id: "all", label: "All-Time" },
            { id: "30d", label: "30D" },
            { id: "7d", label: "7D" },
          ].map((tf) => (
            <button
              key={tf.id}
              onClick={() => setTimeframe(tf.id)}
              className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-colors ${
                timeframe === tf.id
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Performance Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Realized PnL */}
        <div className="glass-panel p-4 space-y-1">
          <span className="text-zinc-500 text-[11px] uppercase tracking-wider block font-medium">
            Realized PnL {timeframe !== "all" && <span className="text-zinc-400 font-mono">({timeframe})</span>}
          </span>
          <div
            className={`text-lg sm:text-xl font-semibold font-mono tabular-nums ${
              (performance?.pnl_summary.realized_pnl ?? metrics?.realized_pnl ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {(performance?.pnl_summary.realized_pnl ?? metrics?.realized_pnl ?? 0) >= 0 ? "+" : ""}
            {(performance?.pnl_summary.realized_pnl ?? metrics?.realized_pnl ?? 0).toFixed(2)} SOL
          </div>
        </div>

        {/* Unrealized PnL */}
        <div className="glass-panel p-4 space-y-1">
          <span className="text-zinc-500 text-[11px] uppercase tracking-wider block font-medium">
            Unrealized PnL
          </span>
          <div className="text-lg sm:text-xl font-semibold font-mono tabular-nums text-zinc-300">
            {(performance?.pnl_summary.unrealized_pnl ?? metrics?.unrealized_pnl ?? 0).toFixed(2)} SOL
          </div>
        </div>

        {/* Total PnL */}
        <div className="glass-panel p-4 space-y-1">
          <span className="text-zinc-500 text-[11px] uppercase tracking-wider block font-medium">
            Total PnL {timeframe !== "all" && <span className="text-zinc-400 font-mono">({timeframe})</span>}
          </span>
          <div
            className={`text-lg sm:text-xl font-semibold font-mono tabular-nums ${
              (performance?.pnl_summary.total_pnl ?? metrics?.total_pnl ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {(performance?.pnl_summary.total_pnl ?? metrics?.total_pnl ?? 0) >= 0 ? "+" : ""}
            {(performance?.pnl_summary.total_pnl ?? metrics?.total_pnl ?? 0).toFixed(2)} SOL
          </div>
        </div>

        {/* Win Rate */}
        <div className="glass-panel p-4 space-y-1">
          <span className="text-zinc-500 text-[11px] uppercase tracking-wider block font-medium">
            Win Rate {timeframe !== "all" && <span className="text-zinc-400 font-mono">({timeframe})</span>}
          </span>
          <div className="text-lg sm:text-xl font-semibold font-mono tabular-nums text-white">
            {(performance?.pnl_summary.win_rate ?? metrics?.win_rate ?? 0).toFixed(1)}%
          </div>
          <span className="text-[10px] text-zinc-500 font-mono block">
            {timeframe === "all" ? `${metrics?.winning_trades || 0}W / ${metrics?.losing_trades || 0}L` : "Windowed"}
          </span>
        </div>

        {/* ROI */}
        <div className="glass-panel p-4 space-y-1">
          <span className="text-zinc-500 text-[11px] uppercase tracking-wider block font-medium">
            ROI
          </span>
          <div
            className={`text-lg sm:text-xl font-semibold font-mono tabular-nums ${
              (performance?.pnl_summary.roi ?? metrics?.roi ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {formatPercent(performance?.pnl_summary.roi ?? metrics?.roi)}
          </div>
        </div>

        {/* Total Trades */}
        <div className="glass-panel p-4 space-y-1">
          <span className="text-zinc-500 text-[11px] uppercase tracking-wider block font-medium">
            Total Trades
          </span>
          <div className="text-lg sm:text-xl font-semibold font-mono tabular-nums text-zinc-200">
            {metrics?.trade_count || 0}
          </div>
        </div>
      </div>

      {/* Behavior Stats & Holding Time Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Trading Behavior Stats */}
        <div className="glass-panel p-5 space-y-3">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span>Trading Behavior</span>
          </h2>

          <div className="divide-y divide-zinc-800/80 text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-zinc-400">Median Hold Duration:</span>
              <span className="text-white font-medium font-mono">
                {formatDuration(metrics?.median_hold_seconds)}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-zinc-400">Average Hold Duration:</span>
              <span className="text-zinc-300 font-mono">
                {formatDuration(metrics?.avg_hold_seconds)}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-zinc-400">Average Position PnL:</span>
              <span className="text-zinc-200 font-mono font-medium">
                {metrics?.avg_trade_pnl ? `${metrics.avg_trade_pnl.toFixed(2)} SOL` : "-"}
              </span>
            </div>
            {funding && funding.initial_balance_sol && (
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-zinc-400">Initial Funding:</span>
                <span className="text-zinc-200 font-mono font-medium">
                  {funding.initial_balance_sol.toFixed(2)} SOL
                </span>
              </div>
            )}
            {funding && funding.first_funding_source && (
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-zinc-400">Funding Source:</span>
                <span
                  className="text-zinc-300 font-mono text-xs truncate max-w-[140px] hover:text-white cursor-pointer"
                  title={funding.first_funding_source}
                  onClick={() => {
                    if (funding.first_funding_source) {
                      navigator.clipboard.writeText(funding.first_funding_source);
                    }
                  }}
                >
                  {shortenAddress(funding.first_funding_source)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right 2 cols: Dual Chart Container (Cumulative PnL & Holding Distribution) */}
        <div className="lg:col-span-2 glass-panel p-5 space-y-3">
          <div className="flex items-center justify-between">
            {/* Chart Mode Toggle */}
            <div className="flex items-center gap-0.5 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800">
              <button
                onClick={() => setChartTab("pnl")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  chartTab === "pnl"
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Cumulative PnL Curve</span>
              </button>
              <button
                onClick={() => setChartTab("holding")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  chartTab === "holding"
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Holding Distribution</span>
              </button>
            </div>

            <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline-block">
              {chartTab === "pnl"
                ? `Equity Curve (${performance?.pnl_timeline?.length || 0} points)`
                : `Style: ${classification?.trading_style || "Unknown"}`}
            </span>
          </div>

          {chartTab === "pnl" ? (
            <CumulativePnLChart data={performance?.pnl_timeline || []} />
          ) : (
            <HoldingDistributionChart
              data={performance?.holding_time_distribution || []}
            />
          )}
        </div>
      </div>

      {/* Tabs: Trade History vs Activity Timeline vs Token Breakdown */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center gap-1 bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-800/80 w-fit">
          <button
            onClick={() => setActiveTab("trades")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "trades"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Reconstructed Trades ({metrics?.trade_count || 0})
          </button>
          <button
            onClick={() => setActiveTab("timeline")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "timeline"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Activity Timeline
          </button>
          <button
            onClick={() => setActiveTab("tokens")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "tokens"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Token Breakdown
          </button>
        </div>

        {activeTab === "trades" ? (
          <TradeHistoryTable address={address} />
        ) : activeTab === "timeline" ? (
          <ActivityTimeline address={address} />
        ) : (
          <TokenPerformanceTable address={address} />
        )}
      </div>
    </div>
  );
}
