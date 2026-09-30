"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { PnLPoint } from "@/lib/api";

interface Props {
  data: PnLPoint[];
}

export function CumulativePnLChart({ data }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 font-mono text-xs">
        Loading PnL chart...
      </div>
    );
  }

  const hasData = data && data.length > 0;

  if (!hasData) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-2 text-zinc-500 font-mono text-xs border border-dashed border-zinc-800 rounded-xl p-6 text-center">
        <TrendingUp className="w-6 h-6 text-zinc-600 mb-1" />
        <span className="text-zinc-400 font-sans font-medium">No closed trade cycles recorded yet.</span>
        <span className="text-[11px] text-zinc-500 font-sans">
          The cumulative equity curve will appear automatically once closed positions are reconciled.
        </span>
      </div>
    );
  }

  // Pre-process data with formatted labels
  const formattedData = data.map((pt, idx) => {
    const d = new Date(pt.timestamp);
    const dateStr = d.toLocaleDateString("id-ID", {
      month: "short",
      day: "numeric",
    });
    const timeStr = d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      ...pt,
      index: idx + 1,
      displayDate: `${dateStr} ${timeStr}`,
      shortDate: dateStr,
    };
  });

  const latestPnL = data[data.length - 1]?.cumulative_pnl ?? 0;
  const isPositive = latestPnL >= 0;
  const strokeColor = isPositive ? "#10b981" : "#f43f5e";
  const gradientId = isPositive ? "pnlGradientPositive" : "pnlGradientNegative";

  return (
    <div className="space-y-3 font-sans">
      {/* Top Chart Stats */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">Total Realized PnL:</span>
          <span
            className={`font-semibold font-mono tabular-nums flex items-center gap-1 ${
              isPositive ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {isPositive ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            {latestPnL >= 0 ? "+" : ""}
            {latestPnL.toFixed(3)} SOL
          </span>
        </div>
        <span className="text-[11px] text-zinc-500 font-mono">
          {data.length} closed cycle{data.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={formattedData}
            margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
          >
            <defs>
              <linearGradient id="pnlGradientPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="pnlGradientNegative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="shortDate"
              stroke="#71717a"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#27272a" }}
              fontFamily="monospace"
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#71717a"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#27272a" }}
              fontFamily="monospace"
              tickFormatter={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`}
            />

            <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="3 3" />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const item = payload[0].payload;
                const pnl = item.pnl ?? 0;
                const cum = item.cumulative_pnl ?? 0;
                return (
                  <div className="bg-[#18181b] border border-zinc-800 rounded-lg p-2.5 shadow-xl font-sans text-xs space-y-1 z-50">
                    <div className="text-zinc-400 text-[10px] font-mono border-b border-zinc-800 pb-1">
                      {item.displayDate}
                    </div>
                    <div className="flex items-center justify-between gap-4 pt-0.5">
                      <span className="text-zinc-400">Token:</span>
                      <span className="text-zinc-100 font-semibold font-mono">
                        ${item.token_symbol || "TOKEN"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-400">Cycle PnL:</span>
                      <span
                        className={`font-semibold font-mono tabular-nums ${
                          pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {pnl >= 0 ? "+" : ""}
                        {pnl.toFixed(4)} SOL
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-zinc-800 pt-1">
                      <span className="text-zinc-300 font-medium">Cumulative:</span>
                      <span
                        className={`font-semibold font-mono tabular-nums ${
                          cum >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {cum >= 0 ? "+" : ""}
                        {cum.toFixed(4)} SOL
                      </span>
                    </div>
                  </div>
                );
              }}
            />

            <Area
              type="monotone"
              dataKey="cumulative_pnl"
              stroke={strokeColor}
              strokeWidth={1.5}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

