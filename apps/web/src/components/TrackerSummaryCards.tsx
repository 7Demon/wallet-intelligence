import { TrackerOverview } from "@/lib/api";
import { formatPercent, shortenAddress } from "@/lib/utils";
import { Users, TrendingUp, Award, Activity, DollarSign } from "lucide-react";
import Link from "next/link";

interface Props {
  overview: TrackerOverview | null;
}

export function TrackerSummaryCards({ overview }: Props) {
  if (!overview) return null;

  const isRealizedProfit = overview.combined_realized_pnl >= 0;
  const isTotalProfit = overview.combined_total_pnl >= 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {/* 1. Total Tracked Wallets */}
      <div className="glass-panel p-4 space-y-1">
        <div className="flex items-center justify-between text-slate-500 text-[11px] font-mono uppercase tracking-wider">
          <span>Tracked Wallets</span>
          <Users className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div className="text-xl sm:text-2xl font-bold font-mono text-white">
          {overview.total_tracked_wallets}
        </div>
        <span className="text-[10px] text-emerald-400 font-mono block">
          {overview.active_today_count} active in 24h
        </span>
      </div>

      {/* 2. Combined Realized PnL */}
      <div className="glass-panel p-4 space-y-1">
        <div className="flex items-center justify-between text-slate-500 text-[11px] font-mono uppercase tracking-wider">
          <span>Combined Realized</span>
          <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
        </div>
        <div
          className={`text-xl sm:text-2xl font-bold font-mono ${
            isRealizedProfit ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {isRealizedProfit ? "+" : ""}
          {overview.combined_realized_pnl.toFixed(2)} SOL
        </div>
        <span className="text-[10px] text-slate-500 font-mono block">Across all closed trades</span>
      </div>

      {/* 3. Combined Total PnL */}
      <div className="glass-panel p-4 space-y-1">
        <div className="flex items-center justify-between text-slate-500 text-[11px] font-mono uppercase tracking-wider">
          <span>Combined Total PnL</span>
          <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div
          className={`text-xl sm:text-2xl font-bold font-mono ${
            isTotalProfit ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {isTotalProfit ? "+" : ""}
          {overview.combined_total_pnl.toFixed(2)} SOL
        </div>
        <span className="text-[10px] text-slate-500 font-mono block">Realized + Unrealized</span>
      </div>

      {/* 4. Average Win Rate */}
      <div className="glass-panel p-4 space-y-1">
        <div className="flex items-center justify-between text-slate-500 text-[11px] font-mono uppercase tracking-wider">
          <span>Avg Portfolio Win Rate</span>
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="text-xl sm:text-2xl font-bold font-mono text-white">
          {overview.average_win_rate ? overview.average_win_rate.toFixed(1) : "0.0"}%
        </div>
        <span className="text-[10px] text-slate-500 font-mono block">Tracked trader baseline</span>
      </div>

      {/* 5. Top Performer */}
      <div className="glass-panel p-4 space-y-1">
        <div className="flex items-center justify-between text-slate-500 text-[11px] font-mono uppercase tracking-wider">
          <span>Top Performer</span>
          <Award className="w-3.5 h-3.5 text-amber-400" />
        </div>
        {overview.top_performer ? (
          <div>
            <Link
              href={`/wallet/${overview.top_performer.address}`}
              className="text-sm font-bold font-mono text-cyan-400 hover:underline block truncate"
            >
              {overview.top_performer.label || shortenAddress(overview.top_performer.address)}
            </Link>
            <span className="text-[10px] text-emerald-400 font-mono font-bold">
              +{overview.top_performer.realized_pnl.toFixed(2)} SOL
            </span>
          </div>
        ) : (
          <div className="text-xs text-slate-500 font-mono pt-1">No trades recorded yet</div>
        )}
      </div>
    </div>
  );
}
