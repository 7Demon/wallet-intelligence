"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Upload,
  RefreshCw,
  TrendingUp,
  Activity,
  Layers,
  ArrowRight,
  Radio,
  AlertTriangle,
} from "lucide-react";
import { getTrackerOverview, TrackerOverview, TrackedWalletItem } from "@/lib/api";
import { WatchlistTable } from "@/components/WatchlistTable";
import { WalletOverviewSidePanel } from "@/components/WalletOverviewSidePanel";
import { TrackerFeed } from "@/components/TrackerFeed";
import { BulkImportModal } from "@/components/BulkImportModal";

export default function HomePage() {
  const router = useRouter();
  const [addressInput, setAddressInput] = useState("");
  const [searchError, setSearchError] = useState("");
  const [overview, setOverview] = useState<TrackerOverview | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<TrackedWalletItem | null>(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"watchlist" | "feed">("watchlist");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [timeframe, setTimeframe] = useState<string>("all");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadOverview = async () => {
    try {
      const data = await getTrackerOverview(timeframe !== "all" ? timeframe : undefined);
      setOverview(data);
      setBackendOffline(false);
    } catch (err) {
      console.error("Failed to load tracker overview:", err);
      setBackendOffline(true);
    }
  };

  useEffect(() => {
    if (mounted) {
      loadOverview();
    }
  }, [refreshTrigger, mounted, timeframe]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = addressInput.trim();
    if (!trimmed) {
      setSearchError("Please enter a Solana wallet address.");
      return;
    }
    const BASE58_REGEX = /^[1-9A-HJ-NP-za-km-z]{32,44}$/;
    if (!BASE58_REGEX.test(trimmed)) {
      setSearchError("Format alamat Solana tidak valid (harus 32-44 karakter Base58).");
      return;
    }
    setSearchError("");
    router.push(`/wallet/${trimmed}`);
  };

  if (!mounted) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-pulse font-mono text-xs">
        <div className="h-14 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center px-4 text-slate-500">
          Loading Wallet Intelligence Tracker...
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="h-24 bg-slate-900/60 rounded-xl border border-slate-800" />
          <div className="h-24 bg-slate-900/60 rounded-xl border border-slate-800" />
          <div className="h-24 bg-slate-900/60 rounded-xl border border-slate-800" />
          <div className="h-24 bg-slate-900/60 rounded-xl border border-slate-800" />
        </div>
        <div className="h-80 bg-slate-900/60 rounded-xl border border-slate-800" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            Wallet Tracker
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Monitor multiple Solana trader wallets, track combined PnL, and stream trade signals.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRefreshTrigger((r) => r + 1)}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-colors"
            title="Refresh tracker"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsImportOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs shadow-sm transition-colors flex items-center gap-1.5 active:scale-98"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Wallets</span>
          </button>
        </div>
      </div>

      {/* Backend Offline Alert */}
      {backendOffline && (
        <div className="glass-panel p-4 border border-amber-500/20 bg-amber-500/5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200">
          <div className="flex items-start sm:items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="text-xs font-semibold text-amber-300">Backend API Offline (http://localhost:8000)</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Pastikan backend FastAPI sudah dijalankan:{" "}
                <code className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 font-mono text-[11px]">
                  .venv\Scripts\python -m uvicorn apps.api.main:app --reload --port 8000
                </code>
              </p>
            </div>
          </div>
          <button
            onClick={() => setRefreshTrigger((r) => r + 1)}
            className="self-end sm:self-center px-3 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs border border-zinc-800 transition-colors shrink-0"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Quick Search Bar */}
      <div className="glass-panel p-2 sm:p-2.5">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <Search className="w-4 h-4 text-zinc-500 ml-2 shrink-0" />
          <input
            type="text"
            placeholder="Search or inspect any Solana wallet address..."
            value={addressInput}
            onChange={(e) => {
              setAddressInput(e.target.value);
              if (searchError) setSearchError("");
            }}
            className="w-full bg-transparent px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 font-mono focus:outline-none"
          />
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
          >
            <span>Inspect</span>
            <ArrowRight className="w-3 h-3 text-zinc-400" />
          </button>
        </form>
        {searchError && (
          <p className="text-[11px] text-rose-400 mt-1.5 ml-2 font-mono">{searchError}</p>
        )}
      </div>

      {/* Tabs: Watchlist Table vs Live Activity Feed */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-1 bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-800/80">
            <button
              onClick={() => setActiveTab("watchlist")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "watchlist"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
              <span>Watchlist</span>
              {overview?.total_tracked_wallets !== undefined && (
                <span className="text-[10px] text-zinc-400 bg-zinc-700/50 px-1.5 py-0.2 rounded-full font-mono">
                  {overview.total_tracked_wallets}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("feed")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "feed"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-zinc-400" />
              <span>Live Signals</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "watchlist" ? (
          <div className="flex flex-col xl:flex-row gap-6 items-start">
            {/* Left: Watchlist Table */}
            <div className="flex-1 min-w-0 w-full">
              <WatchlistTable
                refreshTrigger={refreshTrigger}
                onRefresh={() => setRefreshTrigger((r) => r + 1)}
                selectedAddress={selectedWallet?.address}
                onSelectWallet={setSelectedWallet}
              />
            </div>

            {/* Right: Wallet Overview Side Panel */}
            {selectedWallet && (
              <div className="w-full xl:w-[400px] shrink-0 xl:sticky xl:top-20">
                <WalletOverviewSidePanel
                  wallet={selectedWallet}
                  onClose={() => setSelectedWallet(null)}
                  onSyncWallet={() => setRefreshTrigger((r) => r + 1)}
                />
              </div>
            )}
          </div>
        ) : (
          <TrackerFeed />
        )}
      </div>

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => {
          setRefreshTrigger((r) => r + 1);
        }}
      />
    </div>
  );
}
