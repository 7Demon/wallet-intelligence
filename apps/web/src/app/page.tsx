"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Zap, TrendingUp, ShieldCheck, Activity, ArrowRight } from "lucide-react";

const SAMPLE_WALLETS = [
  {
    address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    label: "Active DEX Trader",
  },
  {
    address: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
    label: "Raydium Liquidity / Swapper",
  },
  {
    address: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
    label: "Pump.fun Contract / Deployer",
  },
];

export default function HomePage() {
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) {
      setError("Please enter a Solana wallet address.");
      return;
    }
    // Simple Base58 check (32-44 characters)
    if (trimmed.length < 32 || trimmed.length > 44) {
      setError("Invalid Solana address format (must be 32-44 base58 characters).");
      return;
    }
    setError("");
    router.push(`/wallet/${trimmed}`);
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-16 overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-cyan-600/15 to-purple-600/20 blur-[130px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-4xl w-full text-center space-y-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-purple-500/30 text-xs font-mono text-purple-300 shadow-sm backdrop-blur-md">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>Solana-First On-Chain Analytics Engine</span>
        </div>

        {/* Hero Title */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Analyze Any Solana <br />
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
              Trader Wallet &amp; PnL
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-400">
            Reconstruct noisy raw blockchain transactions into clean trades, accurate positions,
            weighted-average PnL, and automated trader profiles.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto w-full">
          <form
            onSubmit={handleSearch}
            className="relative flex items-center glass-panel-glow p-2 rounded-xl transition-all focus-within:ring-2 focus-within:ring-purple-500/50"
          >
            <Search className="w-5 h-5 text-slate-400 ml-3 shrink-0" />
            <input
              id="wallet-search-input"
              type="text"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (error) setError("");
              }}
              placeholder="Enter Solana wallet address (e.g., 7xKX...)"
              className="w-full bg-transparent px-3 py-2 text-sm sm:text-base text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
            />
            <button
              id="analyze-submit-button"
              type="submit"
              className="shrink-0 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-medium text-sm transition-all flex items-center gap-1.5 shadow-md shadow-purple-500/25 active:scale-95"
            >
              <span>Analyze</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
          {error && <p className="mt-2 text-xs text-rose-400 text-left font-mono">{error}</p>}
        </div>

        {/* Quick Presets */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-slate-500 font-mono">Try sample:</span>
          {SAMPLE_WALLETS.map((item) => (
            <button
              key={item.address}
              onClick={() => router.push(`/wallet/${item.address}`)}
              className="px-2.5 py-1 rounded-md bg-slate-900/60 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-cyan-400 font-mono transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-10 text-left">
          <div className="glass-panel p-5 space-y-2 border border-slate-800/80 hover:border-slate-700/80 transition-all">
            <div className="w-8 h-8 rounded-md bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-slate-200">Accurate Trade Reconstruction</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Splits noisy multi-instruction transactions into true BUY and SELL swaps across Raydium, Orca, and Jupiter.
            </p>
          </div>

          <div className="glass-panel p-5 space-y-2 border border-slate-800/80 hover:border-slate-700/80 transition-all">
            <div className="w-8 h-8 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-slate-200">Weighted Average Cost & PnL</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Computes realized and unrealized profit/loss using WACB with precise multi-entry and partial exit accounting.
            </p>
          </div>

          <div className="glass-panel p-5 space-y-2 border border-slate-800/80 hover:border-slate-700/80 transition-all">
            <div className="w-8 h-8 rounded-md bg-purple-500/10 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-slate-200">Rule-Based Profiling</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Transparent, configurable rule tagging across Performance Tier, Trading Style, Capital Size, and Activity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
