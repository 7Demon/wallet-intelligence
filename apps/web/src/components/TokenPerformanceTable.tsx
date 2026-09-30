"use client";

import { useEffect, useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { getWalletTokens, TokenPerformanceItem } from "@/lib/api";
import { shortenAddress, formatPercent } from "@/lib/utils";

interface Props {
  address: string;
}

export function TokenPerformanceTable({ address }: Props) {
  const [tokens, setTokens] = useState<TokenPerformanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getWalletTokens(address);
        setTokens(data);
      } catch (err) {
        console.error("Failed to load tokens:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [address]);

  const handleCopy = (tokenAddr: string) => {
    navigator.clipboard.writeText(tokenAddr);
    setCopiedToken(tokenAddr);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (loading) {
    return <div className="py-8 text-center text-zinc-500 font-mono text-xs">Loading token breakdown...</div>;
  }

  if (tokens.length === 0) {
    return (
      <div className="py-8 text-center text-zinc-500 font-mono text-xs border border-dashed border-zinc-800/80 rounded-xl">
        No token trade records found for this wallet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-950/40">
      <table className="w-full text-left text-xs">
        <thead className="bg-zinc-900/60 text-zinc-400 border-b border-zinc-800/80 text-[11px] font-medium uppercase tracking-wider">
          <tr>
            <th className="py-3 px-4">Token &amp; Ticker</th>
            <th className="py-3 px-4 text-center">Trades</th>
            <th className="py-3 px-4 text-right">Total Invested</th>
            <th className="py-3 px-4 text-right">Realized PnL</th>
            <th className="py-3 px-4 text-right">ROI</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {tokens.map((tok) => {
            const isProfit = tok.realized_pnl >= 0;
            const isCopied = copiedToken === tok.token_address;

            return (
              <tr key={tok.token_address} className="hover:bg-zinc-800/25 transition-colors">
                <td className="py-3 px-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700/60 font-mono">
                      ${tok.symbol || "UNKNOWN"}
                    </span>
                    {tok.name && tok.name !== tok.symbol && (
                      <span className="text-[11px] text-zinc-400 truncate max-w-[140px]" title={tok.name}>
                        {tok.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                    <span className="font-mono text-zinc-500">{shortenAddress(tok.token_address)}</span>
                    <button
                      onClick={() => handleCopy(tok.token_address)}
                      className="p-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors"
                      title="Salin Token Address"
                    >
                      {isCopied ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    <a
                      href={`https://solscan.io/token/${tok.token_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors"
                      title="Lihat di Solscan"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </td>
                <td className="py-3 px-4 text-center text-zinc-300 font-mono tabular-nums">{tok.trade_count}</td>
                <td className="py-3 px-4 text-right text-zinc-300 font-mono tabular-nums font-medium">
                  {tok.total_invested.toFixed(4)} SOL
                </td>
                <td className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
                  {isProfit ? "+" : ""}
                  {tok.realized_pnl.toFixed(4)} SOL
                </td>
                <td className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
                  {formatPercent(tok.roi)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
