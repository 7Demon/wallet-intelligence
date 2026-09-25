"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ChevronLeft, ChevronRight, Search } from "lucide-react";
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
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Side Tabs */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs font-mono">
          <button
            onClick={() => {
              setSideFilter("");
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              sideFilter === "" ? "bg-slate-800 text-white font-medium shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            ALL
          </button>
          <button
            onClick={() => {
              setSideFilter("BUY");
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              sideFilter === "BUY" ? "bg-emerald-500/20 text-emerald-400 font-medium" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            BUY
          </button>
          <button
            onClick={() => {
              setSideFilter("SELL");
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              sideFilter === "SELL" ? "bg-rose-500/20 text-rose-400 font-medium" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            SELL
          </button>
        </div>

        {/* Token Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter by token mint/symbol..."
            value={tokenSearch}
            onChange={(e) => {
              setTokenSearch(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900/80 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500/50 w-56"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800/80 bg-slate-900/40">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
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
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  Loading trades...
                </td>
              </tr>
            ) : trades.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  No reconstructed trades found for this filter.
                </td>
              </tr>
            ) : (
              trades.map((t) => (
                <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 text-slate-400">
                    {new Date(t.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                    <span className="block text-[10px] text-slate-500">
                      {new Date(t.timestamp).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.side === "BUY"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {t.side}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-200">
                      {t.token_symbol || shortenAddress(t.token_address)}
                    </span>
                    {t.token_symbol && (
                      <span className="block text-[10px] text-slate-500">
                        {shortenAddress(t.token_address)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-300 font-medium">
                    {t.token_amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-200 font-medium">
                    {t.quote_amount.toFixed(4)} SOL
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400">
                    {t.price ? t.price.toFixed(8) : "-"}
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-[11px]">{t.dex || "DEX"}</td>
                  <td className="py-3 px-4 text-center">
                    <a
                      href={`https://solscan.io/tx/${t.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:text-cyan-400 inline-flex items-center"
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
      <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
