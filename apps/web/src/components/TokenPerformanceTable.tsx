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
    return <div className="py-8 text-center text-slate-500 font-mono text-xs">Loading token breakdown...</div>;
  }

  if (tokens.length === 0) {
    return (
      <div className="py-8 text-center text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-lg">
        No token trade records found for this wallet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800/80 bg-slate-900/40">
      <table className="w-full text-left text-xs font-mono">
        <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
          <tr>
            <th className="py-3 px-4">Token &amp; Ticker</th>
            <th className="py-3 px-4 text-center">Trades</th>
            <th className="py-3 px-4 text-right">Total Invested</th>
            <th className="py-3 px-4 text-right">Realized PnL</th>
            <th className="py-3 px-4 text-right">ROI</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {tokens.map((tok) => {
            const isProfit = tok.realized_pnl >= 0;
            const isCopied = copiedToken === tok.token_address;

            return (
              <tr key={tok.token_address} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                      ${tok.symbol || "UNKNOWN"}
                    </span>
                    {tok.name && tok.name !== tok.symbol && (
                      <span className="text-[11px] text-slate-300 truncate max-w-[140px]" title={tok.name}>
                        {tok.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span className="font-mono text-slate-500">{shortenAddress(tok.token_address)}</span>
                    <button
                      onClick={() => handleCopy(tok.token_address)}
                      className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
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
                      className="p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-cyan-400 transition-colors"
                      title="Lihat di Solscan"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </td>
                <td className="py-3 px-4 text-center text-slate-300">{tok.trade_count}</td>
                <td className="py-3 px-4 text-right text-slate-300 font-medium">
                  {tok.total_invested.toFixed(4)} SOL
                </td>
                <td className={`py-3 px-4 text-right font-bold ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
                  {isProfit ? "+" : ""}
                  {tok.realized_pnl.toFixed(4)} SOL
                </td>
                <td className={`py-3 px-4 text-right font-bold ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
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
