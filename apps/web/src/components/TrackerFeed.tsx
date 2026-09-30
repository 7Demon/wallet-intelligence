"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Radio, ArrowUpRight, ArrowDownRight, Copy, Check } from "lucide-react";
import { getTrackerFeed, TrackerFeedItem } from "@/lib/api";
import { shortenAddress } from "@/lib/utils";

export function TrackerFeed() {
  const [feed, setFeed] = useState<TrackerFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const handleCopyToken = (e: React.MouseEvent, tokAddr: string) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(tokAddr);
    setCopiedToken(tokAddr);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const loadFeed = async () => {
    try {
      const items = await getTrackerFeed(30);
      setFeed(items);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
    const interval = setInterval(loadFeed, 10000); // 10s refresh
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-slate-500 font-mono text-xs">Streaming tracked wallet signals...</div>;
  }

  if (error && feed.length === 0) {
    return (
      <div className="py-12 text-center text-amber-400 font-mono text-xs border border-dashed border-amber-500/30 rounded-lg bg-amber-500/5">
        Backend API offline (http://localhost:8000). Live signal stream paused.
      </div>
    );
  }

  if (feed.length === 0) {
    return (
      <div className="py-12 text-center text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-lg">
        No recent trade signals found across tracked wallets. Import wallets to start monitoring!
      </div>
    );
  }

  return (
    <div className="space-y-2 font-sans">
      <div className="flex items-center justify-between text-xs text-zinc-400 pb-2 border-b border-zinc-800">
        <span className="flex items-center gap-1.5 text-zinc-200 font-medium">
          <Radio className="w-3.5 h-3.5 text-zinc-400" /> Live Wallet Signals
        </span>
        <span className="text-[11px] text-zinc-500 font-mono">Auto-refresh: 10s</span>
      </div>

      <div className="divide-y divide-zinc-800/60 max-h-[600px] overflow-y-auto pr-1">
        {feed.map((item) => {
          const isBuy = item.side === "BUY";
          return (
            <div
              key={item.id}
              className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-zinc-800/30 px-2 rounded-lg transition-colors text-xs"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                    isBuy ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                  }`}
                >
                  {isBuy ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/wallet/${item.wallet_address}`}
                      className="font-medium text-white hover:underline transition-colors"
                    >
                      {item.wallet_label || shortenAddress(item.wallet_address)}
                    </Link>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase ${
                        isBuy ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      {item.side}
                    </span>
                    <span className="font-medium text-xs px-2 py-0.2 rounded bg-zinc-800 text-zinc-200 border border-zinc-700/60 font-mono">
                      ${item.token_symbol || "TOKEN"}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 flex items-center gap-2 pt-0.5">
                    <span className="font-mono text-zinc-500 text-[10px]">{shortenAddress(item.token_address)}</span>
                    <button
                      onClick={(e) => handleCopyToken(e, item.token_address)}
                      className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                      title="Copy Token Mint"
                    >
                      {copiedToken === item.token_address ? (
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-2.5 h-2.5" />
                      )}
                    </button>
                    <span className="text-zinc-600">·</span>
                    <span className="font-mono font-medium text-zinc-300">{item.quote_amount.toFixed(4)} SOL</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-500">{item.dex || "DEX"}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-right shrink-0">
                <span className="text-[11px] font-mono text-zinc-500">
                  {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <a
                  href={`https://solscan.io/tx/${item.tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-zinc-300 p-1"
                  title="View on Solscan"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

