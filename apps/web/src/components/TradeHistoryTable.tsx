"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ChevronLeft, ChevronRight, Search, Copy, Check } from "lucide-react";
import { getWalletTrades, TradeItem } from "@/lib/api";
import { shortenAddress } from "@/lib/utils";

interface Props {
  address: string;
}

export function TradeHistoryTable({ address }: Props) {
  const [trades, setTrades] = useState<TradeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sideFilter, setSideFilter] = useState<string>("");
  const [tokenSearch, setTokenSearch] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const handleCopyToken = (tokAddr: string) => {
    navigator.clipboard.writeText(tokAddr);
    setCopiedToken(tokAddr);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const loadTrades = async () => {
    try {
      setLoading(true);
      const res = await getWalletTrades(address, {
        page,
        limit: 15,
        side: sideFilter || undefined,
        token: tokenSearch || undefined,
      });
      setTrades(res.items);
      setTotalPages(Math.max(1, Math.ceil(res.total_records / 15)));
    } catch (err) {
      console.error("Failed to load trades:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrades();
  }, [address, page, sideFilter, tokenSearch]);

  return (
    <div className="space-y-4 font-sans">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Side Tabs */}
        <div className="flex items-center gap-0.5 bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800 text-xs">
          <button
            onClick={() => {
              setSideFilter("");
              setPage(1);
            }}
            className={`px-3 py-1 rounded-md transition-colors ${
              sideFilter === "" ? "bg-zinc-800 text-white font-medium shadow-sm" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All
          </button>
          <button
            onClick={() => {
              setSideFilter("BUY");
              setPage(1);
            }}
            className={`px-3 py-1 rounded-md transition-colors ${
              sideFilter === "BUY" ? "bg-zinc-800 text-emerald-400 font-medium shadow-sm" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => {
              setSideFilter("SELL");
              setPage(1);
            }}
            className={`px-3 py-1 rounded-md transition-colors ${
              sideFilter === "SELL" ? "bg-zinc-800 text-rose-400 font-medium shadow-sm" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Sell
          </button>
        </div>

        {/* Token Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter by token mint / symbol..."
            value={tokenSearch}
            onChange={(e) => {
              setTokenSearch(e.target.value);
              setPage(1);
            }}
            className="bg-zinc-900/90 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 font-mono focus:outline-none focus:border-zinc-700 w-56"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-950/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900/70 text-zinc-400 border-b border-zinc-800 font-medium text-[11px] uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Time</th>
              <th className="py-3 px-4">Side</th>
              <th className="py-3 px-4">Token</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4 text-right">Quote Value</th>
              <th className="py-3 px-4 text-right">Price</th>
              <th className="py-3 px-4">DEX</th>
              <th className="py-3 px-4 text-center">TX</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-zinc-500 font-mono">
                  Loading trades...
                </td>
              </tr>
            ) : trades.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-zinc-500">
                  No reconstructed trades found for this filter.
                </td>
              </tr>
            ) : (
              trades.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3 px-4 text-zinc-400 font-mono">
                    {new Date(t.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                    <span className="block text-[10px] text-zinc-500">
                      {new Date(t.timestamp).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        t.side === "BUY"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {t.side}
                    </span>
                  </td>
                  <td className="py-3 px-4 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700/60 font-mono">
                        ${t.token_symbol || "TOKEN"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-zinc-500 pt-0.5 font-mono">
                      <span>{shortenAddress(t.token_address)}</span>
                      <button
                        onClick={() => handleCopyToken(t.token_address)}
                        className="p-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors"
                        title="Copy Token Address"
                      >
                        {copiedToken === t.token_address ? (
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-2.5 h-2.5" />
                        )}
                      </button>
                      <a
                        href={`https://solscan.io/token/${t.token_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                        title="View on Solscan"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-300 font-mono tabular-nums">
                    {t.token_amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-100 font-mono font-medium tabular-nums">
                    {t.quote_amount.toFixed(4)} SOL
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-400 font-mono tabular-nums">
                    {t.price ? t.price.toFixed(8) : "-"}
                  </td>
                  <td className="py-3 px-4 text-zinc-400 text-xs">{t.dex || "DEX"}</td>
                  <td className="py-3 px-4 text-center">
                    <a
                      href={`https://solscan.io/tx/${t.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-500 hover:text-zinc-300 inline-flex items-center"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between text-xs text-zinc-400 px-1 font-mono">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
