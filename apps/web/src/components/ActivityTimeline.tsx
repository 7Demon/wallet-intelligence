"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Calendar,
  Layers,
  Filter,
  Clock,
} from "lucide-react";
import { getWalletTrades, TradeItem } from "@/lib/api";
import { shortenAddress } from "@/lib/utils";

interface Props {
  address: string;
}

interface GroupedTrades {
  label: string;
  items: TradeItem[];
}

export function ActivityTimeline({ address }: Props) {
  const [trades, setTrades] = useState<TradeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");

  useEffect(() => {
    let isMounted = true;
    const loadTrades = async () => {
      try {
        setLoading(true);
        // Load latest 100 trades for rich timeline view
        const res = await getWalletTrades(address, { page: 1, limit: 100 });
        if (isMounted) {
          setTrades(res.items);
        }
      } catch (err) {
        console.error("Failed to load timeline trades:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadTrades();
    return () => {
      isMounted = false;
    };
  }, [address]);

  const filteredTrades = trades.filter((t) => {
    if (filter === "BUY") return t.side === "BUY";
    if (filter === "SELL") return t.side === "SELL";
    return true;
  });

  // Group trades by relative day
  const groupTradesByDate = (items: TradeItem[]): GroupedTrades[] => {
    const groups: { [key: string]: TradeItem[] } = {};
    const order: string[] = [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    items.forEach((item) => {
      const itemDate = new Date(item.timestamp);
      const itemDay = new Date(
        itemDate.getFullYear(),
        itemDate.getMonth(),
        itemDate.getDate()
      );

      const diffTime = today.getTime() - itemDay.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      let label: string;
      if (diffDays === 0) {
        label = "Today";
      } else if (diffDays === 1) {
        label = "Yesterday";
      } else if (diffDays > 1 && diffDays < 7) {
        label = `${diffDays} days ago`;
      } else {
        label = itemDay.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }

      if (!groups[label]) {
        groups[label] = [];
        order.push(label);
      }
      groups[label].push(item);
    });

    return order.map((lbl) => ({ label: lbl, items: groups[lbl] }));
  };

  const grouped = groupTradesByDate(filteredTrades);

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-500 font-mono text-xs">
        <Clock className="w-5 h-5 animate-spin text-zinc-400" />
        <span>Loading wallet activity timeline...</span>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-500 font-mono text-xs border border-dashed border-zinc-800/80 rounded-xl text-center p-6">
        <Calendar className="w-8 h-8 text-zinc-600 mb-1" />
        <span>Belum ada aktivitas perdagangan terekam untuk wallet ini.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeline Filter Controls */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
          <Calendar className="w-4 h-4 text-zinc-400" />
          <span>Activity Timeline ({filteredTrades.length} trades)</span>
        </div>

        <div className="flex items-center gap-1 bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800/80">
          {(["ALL", "BUY", "SELL"] as const).map((side) => (
            <button
              key={side}
              onClick={() => setFilter(side)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all ${
                filter === side
                  ? side === "BUY"
                    ? "bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/25"
                    : side === "SELL"
                    ? "bg-rose-500/15 text-rose-400 font-semibold border border-rose-500/25"
                    : "bg-zinc-100 text-zinc-950 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {side}
            </button>
          ))}
        </div>
      </div>

      {/* Vertical Timeline Tree */}
      <div className="space-y-8 pl-2">
        {grouped.map((group) => (
          <div key={group.label} className="relative">
            {/* Date Group Badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-medium px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-zinc-400" />
                {group.label}
              </span>
              <span className="text-[11px] font-mono text-zinc-500">
                ({group.items.length} trade{group.items.length > 1 ? "s" : ""})
              </span>
            </div>

            {/* Tree Branch Items */}
            <div className="relative pl-6 space-y-3 border-l border-zinc-800/80 ml-3">
              {group.items.map((item, idx) => {
                const isBuy = item.side === "BUY";
                const dateObj = new Date(item.timestamp);
                const timeStr = dateObj.toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });

                return (
                  <div
                    key={item.id || item.tx_hash + idx}
                    className="relative group bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700/80 p-3 rounded-xl transition-all"
                  >
                    {/* Node Dot / Icon */}
                    <div
                      className={`absolute -left-[31px] top-3.5 w-5 h-5 rounded-full flex items-center justify-center border ${
                        isBuy
                          ? "bg-zinc-950 border-emerald-500/60 text-emerald-400"
                          : "bg-zinc-950 border-rose-500/60 text-rose-400"
                      }`}
                    >
                      {isBuy ? (
                        <ArrowDownLeft className="w-3 h-3" />
                      ) : (
                        <ArrowUpRight className="w-3 h-3" />
                      )}
                    </div>

                    {/* Trade Content Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="text-zinc-500 text-[11px] font-mono">{timeStr}</span>

                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isBuy
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {item.side}
                        </span>

                        <span className="text-zinc-200 font-semibold font-mono tracking-wide">
                          ${item.token_symbol || shortenAddress(item.token_address)}
                        </span>

                        {item.dex && (
                          <span className="bg-zinc-800 text-zinc-400 text-[9px] px-1.5 py-0.5 rounded uppercase font-mono">
                            {item.dex}
                          </span>
                        )}
                      </div>

                      {/* Amounts & External Link */}
                      <div className="flex items-center gap-3 font-mono">
                        <div className="text-right">
                          <span className="text-zinc-200 font-medium tabular-nums block">
                            {item.quote_amount ? `${Number(item.quote_amount).toFixed(3)} SOL` : "-"}
                          </span>
                          <span className="text-zinc-500 text-[10px] tabular-nums block">
                            {Number(item.token_amount).toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}{" "}
                            tokens
                          </span>
                        </div>

                        <a
                          href={`https://solscan.io/tx/${item.tx_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                          title="View on Solscan"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
