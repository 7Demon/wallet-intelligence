"use client";

import { useEffect, useState } from "react";
import { getWalletTokens, TokenPerformanceItem } from "@/lib/api";
import { shortenAddress, formatPercent } from "@/lib/utils";

interface Props {
  address: string;
}

export function TokenPerformanceTable({ address }: Props) {
  const [tokens, setTokens] = useState<TokenPerformanceItem[]>([]);
  const [loading, setLoading] = useState(true);

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
            <th className="py-3 px-4">Token</th>
            <th className="py-3 px-4 text-center">Trades</th>
            <th className="py-3 px-4 text-right">Total Invested</th>
            <th className="py-3 px-4 text-right">Realized PnL</th>
            <th className="py-3 px-4 text-right">ROI</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {tokens.map((tok) => {
            const isProfit = tok.realized_pnl >= 0;
            return (
              <tr key={tok.token_address} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-4">
                  <span className="font-bold text-slate-200">{tok.symbol || shortenAddress(tok.token_address)}</span>
                  <span className="block text-[10px] text-slate-500">{shortenAddress(tok.token_address)}</span>
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
