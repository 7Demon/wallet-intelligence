import { TrackerOverview } from "@/lib/api";
import { formatPercent, shortenAddress } from "@/lib/utils";
import { Users, TrendingUp, Award, Activity, DollarSign } from "lucide-react";
import Link from "next/link";

interface Props {
  overview: TrackerOverview | null;
  timeframe?: string;
  onTimeframeChange?: (tf: string) => void;
}

export function TrackerSummaryCards({
  overview,
  timeframe = "all",
  onTimeframeChange,
}: Props) {
  if (!overview) return null;

  const isRealizedProfit = overview.combined_realized_pnl >= 0;
  const isTotalProfit = overview.combined_total_pnl >= 0;

  return (
    <div className="space-y-2">
      {onTimeframeChange && (
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-zinc-400 font-medium">Portfolio Overview</span>
          <div className="flex items-center gap-1 bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800/80">
            {[
              { id: "all", label: "All-Time" },
              { id: "30d", label: "30D" },
              { id: "7d", label: "7D" },
            ].map((tf) => (
              <button
                key={tf.id}
                onClick={() => onTimeframeChange(tf.id)}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-mono transition-all ${
                  timeframe === tf.id
                    ? "bg-zinc-100 text-zinc-950 font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. Total Tracked Wallets */}
        <div className="glass-panel p-4 space-y-1">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-mono uppercase tracking-wider">
            <span>Tracked Wallets</span>
            <Users className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-100 tabular-nums">
            {overview.total_tracked_wallets}
          </div>
          <span className="text-[10px] text-emerald-400 font-mono block">
            {overview.active_today_count} active in 24h
          </span>
        </div>

        {/* 2. Combined Realized PnL */}
        <div className="glass-panel p-4 space-y-1">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-mono uppercase tracking-wider">
            <span>Realized {timeframe !== "all" && `(${timeframe.toUpperCase()})`}</span>
            <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div
            className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
              isRealizedProfit ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {isRealizedProfit ? "+" : ""}
            {overview.combined_realized_pnl.toFixed(2)} SOL
          </div>
          <span className="text-[10px] text-zinc-500 font-mono block">
            {timeframe === "all" ? "Across all closed trades" : `Closed trades in ${timeframe}`}
          </span>
        </div>

        {/* 3. Combined Total PnL */}
        <div className="glass-panel p-4 space-y-1">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-mono uppercase tracking-wider">
            <span>Combined Total PnL</span>
            <DollarSign className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div
            className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
              isTotalProfit ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {isTotalProfit ? "+" : ""}
            {overview.combined_total_pnl.toFixed(2)} SOL
          </div>
          <span className="text-[10px] text-zinc-500 font-mono block">Realized + Unrealized</span>
        </div>

        {/* 4. Average Win Rate */}
        <div className="glass-panel p-4 space-y-1">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-mono uppercase tracking-wider">
            <span>Avg Portfolio Win Rate</span>
            <Activity className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-zinc-100 tabular-nums">
            {overview.average_win_rate ? overview.average_win_rate.toFixed(1) : "0.0"}%
          </div>
          <span className="text-[10px] text-zinc-500 font-mono block">Tracked trader baseline</span>
        </div>

        {/* 5. Top Performer */}
        <div className="glass-panel p-4 space-y-1">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-mono uppercase tracking-wider">
            <span>Top Performer</span>
            <Award className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          {overview.top_performer ? (
            <div>
              <Link
                href={`/wallet/${overview.top_performer.address}`}
                className="text-sm font-semibold font-mono text-zinc-200 hover:text-white hover:underline block truncate"
              >
                {overview.top_performer.label || shortenAddress(overview.top_performer.address)}
              </Link>
              <span className="text-[10px] text-emerald-400 font-mono font-medium">
                +{overview.top_performer.realized_pnl.toFixed(2)} SOL
              </span>
            </div>
          ) : (
            <div className="text-xs text-zinc-500 font-mono pt-1">No trades recorded yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
