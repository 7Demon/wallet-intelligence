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
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-slate-800">
        <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
          <Radio className="w-3.5 h-3.5 animate-pulse" /> Live Multi-Wallet Signals
        </span>
        <span className="text-[11px] text-slate-500">Auto-refreshing every 5s</span>
      </div>

      <div className="divide-y divide-slate-800/60 max-h-[600px] overflow-y-auto pr-1">
        {feed.map((item) => {
          const isBuy = item.side === "BUY";
          return (
            <div
              key={item.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-800/30 px-2 rounded-lg transition-colors font-mono text-xs"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    isBuy ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                  }`}
                >
                  {isBuy ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/wallet/${item.wallet_address}`}
                      className="font-bold text-slate-200 hover:text-cyan-400 transition-colors"
                    >
                      {item.wallet_label || shortenAddress(item.wallet_address)}
                    </Link>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                        isBuy ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                      }`}
                    >
                      {item.side}
                    </span>
                    <span className="font-bold text-xs px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                      ${item.token_symbol || "UNKNOWN"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                    <span className="font-mono text-slate-500 text-[10px]">{shortenAddress(item.token_address)}</span>
                    <button
                      onClick={(e) => handleCopyToken(e, item.token_address)}
                      className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                      title="Salin Alamat Token"
                    >
                      {copiedToken === item.token_address ? (
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-2.5 h-2.5" />
                      )}
                    </button>
                    <span>·</span>
                    <span className="font-semibold text-slate-300">{item.quote_amount.toFixed(4)} SOL</span>
                    <span>·</span>
                    <span>{item.dex || "DEX"}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-right shrink-0">
                <span className="text-[11px] text-slate-500">
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
                  className="text-slate-500 hover:text-cyan-400 p-1"
                  title="View on Solscan"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
