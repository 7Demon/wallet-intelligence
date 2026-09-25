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
import { getTrackerOverview, TrackerOverview } from "@/lib/api";
import { TrackerSummaryCards } from "@/components/TrackerSummaryCards";
import { WatchlistTable } from "@/components/WatchlistTable";
import { TrackerFeed } from "@/components/TrackerFeed";
import { BulkImportModal } from "@/components/BulkImportModal";

export default function HomePage() {
  const router = useRouter();
  const [addressInput, setAddressInput] = useState("");
  const [searchError, setSearchError] = useState("");
  const [overview, setOverview] = useState<TrackerOverview | null>(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"watchlist" | "feed">("watchlist");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadOverview = async () => {
    try {
      const data = await getTrackerOverview();
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
  }, [refreshTrigger, mounted]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = addressInput.trim();
    if (!trimmed) {
      setSearchError("Please enter a Solana wallet address.");
      return;
    }
    if (trimmed.length < 32 || trimmed.length > 44) {
      setSearchError("Invalid Solana address format (must be 32-44 base58 characters).");
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-cyan-400" />
            <span>Wallet Tracker</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              GMGN / Axiom Style
            </span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Monitor multiple Solana trader wallets, track combined PnL, and stream real-time trade signals.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setRefreshTrigger((r) => r + 1)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Refresh tracker"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsImportOpen(true)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-xs font-mono font-medium text-white shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2 active:scale-95"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>+ Import Wallets</span>
          </button>
        </div>
      </div>

      {/* Backend Offline Alert */}
      {backendOffline && (
        <div className="glass-panel p-4 border border-amber-500/30 bg-amber-500/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200">
          <div className="flex items-start sm:items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="text-sm font-semibold text-amber-300">Backend API Offline (http://localhost:8000)</p>
              <p className="text-xs text-amber-200/80 font-mono mt-0.5">
                Pastikan backend FastAPI sudah dijalankan di terminal:{" "}
                <code className="bg-slate-900/80 border border-slate-700/60 px-1.5 py-0.5 rounded text-amber-300">
                  .venv\Scripts\python -m uvicorn apps.api.main:app --reload --port 8000
                </code>
              </p>
            </div>
          </div>
          <button
            onClick={() => setRefreshTrigger((r) => r + 1)}
            className="self-end sm:self-center px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-mono border border-amber-500/40 transition-colors shrink-0"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Quick Search Bar */}
      <div className="glass-panel p-3">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400 ml-2 shrink-0" />
          <input
            type="text"
            placeholder="Direct search: Enter any Solana wallet address to view full profile..."
            value={addressInput}
            onChange={(e) => {
              setAddressInput(e.target.value);
              if (searchError) setSearchError("");
            }}
            className="w-full bg-transparent px-2 py-1 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none"
          />
          <button
            type="submit"
            className="px-4 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium flex items-center gap-1 transition-colors shrink-0"
          >
            <span>Inspect</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
        {searchError && (
          <p className="text-[11px] text-rose-400 font-mono mt-1.5 ml-2">{searchError}</p>
        )}
      </div>

      {/* Aggregated Overview Cards */}
      <TrackerSummaryCards overview={overview} />

      {/* Tabs: Watchlist Table vs Live Activity Feed */}
      <div className="glass-panel p-6 space-y-4 border border-slate-800/80">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab("watchlist")}
              className={`font-mono text-sm font-bold pb-2 transition-colors relative flex items-center gap-2 ${
                activeTab === "watchlist"
                  ? "text-cyan-400 border-b-2 border-cyan-400 -mb-[13px]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Watchlist ({overview?.total_tracked_wallets || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab("feed")}
              className={`font-mono text-sm font-bold pb-2 transition-colors relative flex items-center gap-2 ${
                activeTab === "feed"
                  ? "text-cyan-400 border-b-2 border-cyan-400 -mb-[13px]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Radio className="w-4 h-4 text-purple-400" />
              <span>Live Signals Feed</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "watchlist" ? (
          <WatchlistTable
            refreshTrigger={refreshTrigger}
            onRefresh={() => setRefreshTrigger((r) => r + 1)}
          />
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
