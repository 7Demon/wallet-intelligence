"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  X,
  ExternalLink,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  RotateCw,
  Clock,
  Coins,
  ShieldCheck,
  Activity,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Layers,
  ChevronRight,
} from "lucide-react";
import {
  TrackedWalletItem,
  getWalletTokens,
  TokenPerformanceItem,
  triggerWalletSync,
} from "@/lib/api";
import { shortenAddress, formatPercent, formatDuration } from "@/lib/utils";
import { ClassificationBadge } from "@/components/ClassificationBadge";

interface Props {
  wallet: TrackedWalletItem | null;
  onClose: () => void;
  onSyncWallet?: (address: string) => void;
}

export function WalletOverviewSidePanel({
  wallet,
  onClose,
  onSyncWallet,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [topTokens, setTopTokens] = useState<TokenPerformanceItem[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!wallet) {
      setTopTokens([]);
      return;
    }

    let isMounted = true;
    async function loadTokens() {
      try {
        setLoadingTokens(true);
        if (wallet) {
          const data = await getWalletTokens(wallet.address);
          if (isMounted) {
            // Sort by realized_pnl or trade_count descending, take top 4
            const sorted = [...data].sort(
              (a, b) => Math.abs(b.realized_pnl) - Math.abs(a.realized_pnl)
            );
            setTopTokens(sorted.slice(0, 4));
          }
        }
      } catch (err) {
        console.error("Failed to load tokens for side panel:", err);
      } finally {
        if (isMounted) setLoadingTokens(false);
      }
    }

    loadTokens();
    return () => {
      isMounted = false;
    };
  }, [wallet?.address]);

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQuickSync = async () => {
    if (!wallet) return;
    try {
      setSyncing(true);
      if (onSyncWallet) {
        onSyncWallet(wallet.address);
      } else {
        await triggerWalletSync(wallet.address);
      }
    } catch (err) {
      console.error("Failed to sync wallet:", err);
    } finally {
      setTimeout(() => setSyncing(false), 1500);
    }
  };

  if (!wallet) {
    return (
      <div className="glass-panel p-6 border border-zinc-800/80 rounded-xl flex flex-col items-center justify-center text-center gap-3 text-zinc-500 text-xs min-h-[380px]">
        <Layers className="w-8 h-8 text-zinc-600 mb-1" />
        <p className="font-semibold text-zinc-300 text-sm">No Wallet Selected</p>
        <p className="text-zinc-500 max-w-[240px] leading-relaxed text-xs">
          Select any wallet row from the watchlist table to inspect its performance metrics and top traded tokens.
        </p>
      </div>
    );
  }

  const isProfit = wallet.realized_pnl >= 0;

  return (
    <div className="glass-panel border border-zinc-800/90 bg-[#111218] rounded-xl p-5 space-y-4 text-xs relative shadow-lg">
      {/* Header Bar */}
      <div className="flex items-start justify-between gap-3 border-b border-zinc-800/80 pb-3.5">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate max-w-[180px]">
              {wallet.label || "Untagged Wallet"}
            </span>

            {wallet.is_dormant ? (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5" />
                Inactive ({wallet.days_inactive ? `${wallet.days_inactive}d` : ">30d"})
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Active
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
            <span>{shortenAddress(wallet.address, 6)}</span>
            <button
              onClick={() => handleCopy(wallet.address)}
              className="text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Copy address"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            <a
              href={`https://solscan.io/account/${wallet.address}`}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-400 hover:text-zinc-200 transition-colors"
              title="View on Solscan"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Action Buttons */}
      <div className="flex items-center gap-2">
        <Link
          href={`/wallet/${wallet.address}`}
          className="flex-1 py-2 px-3 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors active:scale-98"
        >
          <span>View Full Profile</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>

        <button
          onClick={handleQuickSync}
          disabled={syncing}
          className="py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
          title="Synchronize latest transactions"
        >
          <RotateCw className={`w-3.5 h-3.5 text-zinc-400 ${syncing ? "animate-spin" : ""}`} />
          <span>Sync</span>
        </button>
      </div>

      {/* Key Financial Metrics (2 x 3 Grid) */}
      <div className="grid grid-cols-2 gap-2">
        {/* Realized PnL */}
        <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/80 space-y-0.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-medium">
            Realized PnL
          </span>
          <div
            className={`text-sm sm:text-base font-semibold font-mono tabular-nums ${
              isProfit ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {isProfit ? "+" : ""}
            {wallet.realized_pnl.toFixed(2)} SOL
          </div>
        </div>

        {/* Win Rate */}
        <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/80 space-y-0.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-medium">
            Win Rate
          </span>
          <div className="text-sm sm:text-base font-semibold font-mono tabular-nums text-white">
            {wallet.win_rate ? `${wallet.win_rate.toFixed(1)}%` : "0.0%"}
          </div>
          <span className="text-[10px] text-zinc-500 block">
            {wallet.winning_trades}W / {wallet.losing_trades}L
          </span>
        </div>

        {/* Total PnL */}
        <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/80 space-y-0.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-medium">
            Total PnL
          </span>
          <div
            className={`text-sm sm:text-base font-semibold font-mono tabular-nums ${
              wallet.total_pnl >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {wallet.total_pnl >= 0 ? "+" : ""}
            {wallet.total_pnl.toFixed(2)} SOL
          </div>
        </div>

        {/* ROI */}
        <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/80 space-y-0.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-medium">
            ROI
          </span>
          <div
            className={`text-sm sm:text-base font-semibold font-mono tabular-nums ${
              wallet.roi >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {formatPercent(wallet.roi)}
          </div>
        </div>

        {/* Unrealized PnL */}
        <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/80 space-y-0.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-medium">
            Unrealized PnL
          </span>
          <div className="text-sm sm:text-base font-semibold font-mono tabular-nums text-zinc-300">
            {wallet.unrealized_pnl ? `${wallet.unrealized_pnl.toFixed(2)} SOL` : "0.00 SOL"}
          </div>
        </div>

        {/* Total Trades */}
        <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/80 space-y-0.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-medium">
            Total Trades
          </span>
          <div className="text-sm sm:text-base font-semibold font-mono tabular-nums text-zinc-200">
            {wallet.trade_count}
          </div>
        </div>
      </div>

      {/* Behavioral Badges */}
      <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-medium">
          Trader Profile
        </span>
        <div className="flex flex-wrap gap-1.5">
          {wallet.performance_tier && (
            <ClassificationBadge
              type="performance"
              value={wallet.performance_tier}
            />
          )}
          {wallet.trading_style && (
            <ClassificationBadge
              type="style"
              value={wallet.trading_style}
            />
          )}
          {wallet.capital_tier && (
            <ClassificationBadge
              type="capital"
              value={wallet.capital_tier}
            />
          )}
          {wallet.activity_level && (
            <ClassificationBadge
              type="activity"
              value={wallet.activity_level}
            />
          )}
        </div>
      </div>

      {/* Trading Behavior Details */}
      <div className="bg-zinc-900/40 rounded-lg p-3 border border-zinc-800/80 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span>Median Hold:</span>
          </span>
          <span className="text-zinc-200 font-medium font-mono">
            {formatDuration(wallet.median_hold_seconds)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-zinc-500" />
            <span>Avg Position:</span>
          </span>
          <span className="text-zinc-200 font-medium font-mono">
            {wallet.avg_position_usd ? `$${wallet.avg_position_usd.toFixed(2)}` : "-"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-zinc-500" />
            <span>Last Active:</span>
          </span>
          <span className="text-zinc-300 font-mono text-[11px]">
            {wallet.last_seen_at
              ? new Date(wallet.last_seen_at).toLocaleDateString()
              : "-"}
          </span>
        </div>
      </div>

      {/* Top Traded Tokens Snippet */}
      <div className="space-y-2 pt-2 border-t border-zinc-800/80">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-medium">
            Top Traded Tokens
          </span>
          <Link
            href={`/wallet/${wallet.address}`}
            className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-0.5 transition-colors"
          >
            <span>All</span>
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {loadingTokens ? (
          <div className="py-3 text-center text-zinc-500 text-xs font-mono">
            Loading tokens...
          </div>
        ) : topTokens.length === 0 ? (
          <div className="py-2 text-center text-zinc-500 text-xs">
            No token data for this wallet yet.
          </div>
        ) : (
          <div className="space-y-1.5">
            {topTokens.map((tok) => {
              const pnlPos = tok.realized_pnl >= 0;
              return (
                <div
                  key={tok.token_address}
                  className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/50 border border-zinc-800/60 hover:border-zinc-700 text-xs transition-colors"
                >
                  <div className="flex items-center gap-1.5 truncate max-w-[130px]">
                    <span className="font-semibold text-white">
                      ${tok.symbol || shortenAddress(tok.token_address, 3)}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      ({tok.trade_count}x)
                    </span>
                  </div>

                  <span
                    className={`font-semibold font-mono tabular-nums ${
                      pnlPos ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {pnlPos ? "+" : ""}
                    {tok.realized_pnl.toFixed(2)} SOL
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

