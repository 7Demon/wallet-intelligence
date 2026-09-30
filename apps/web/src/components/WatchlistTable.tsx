"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Edit2,
  ChevronRight,
  Search,
  Filter,
  ArrowUpDown,
  RotateCw,
  Tag,
  Folder,
  Download,
  AlertTriangle,
  CheckSquare,
  Square,
  Zap,
} from "lucide-react";
import {
  getTrackedWallets,
  untrackWallet,
  updateWallet,
  triggerWalletSync,
  bulkSyncWallets,
  bulkUntrackWallets,
  cleanupDormantWallets,
  TrackedWalletItem,
} from "@/lib/api";
import { shortenAddress, formatPercent } from "@/lib/utils";
import { ClassificationBadge } from "@/components/ClassificationBadge";

interface Props {
  refreshTrigger: number;
  onRefresh: () => void;
  selectedAddress?: string | null;
  onSelectWallet?: (wallet: TrackedWalletItem) => void;
}

export function WatchlistTable({
  refreshTrigger,
  onRefresh,
  selectedAddress,
  onSelectWallet,
}: Props) {
  const [wallets, setWallets] = useState<TrackedWalletItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState<"all" | "active" | "dormant">("all");
  const [timeframe, setTimeframe] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [sortBy, setSortBy] = useState("pnl");
  const [order, setOrder] = useState("desc");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Multi-selection state
  const [selectedWallets, setSelectedWallets] = useState<Set<string>>(new Set());
  const [bulkOperating, setBulkOperating] = useState(false);
  const [cleaningDormant, setCleaningDormant] = useState(false);

  // Inline edit state
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  // Extract all distinct groups/tags
  const availableTags = useMemo(() => {
    const tagMap = new Map<string, number>();
    wallets.forEach((w) => {
      const g = w.label?.trim() || "Untagged";
      tagMap.set(g, (tagMap.get(g) || 0) + 1);
    });
    return Array.from(tagMap.entries());
  }, [wallets]);

  // Dormant wallets memo
  const dormantWallets = useMemo(() => {
    return wallets.filter((w) => w.is_dormant);
  }, [wallets]);

  const displayedWallets = useMemo(() => {
    if (!selectedTag) return wallets;
    if (selectedTag === "Untagged") return wallets.filter((w) => !w.label?.trim());
    return wallets.filter((w) => w.label?.trim() === selectedTag || (w.tags && w.tags.includes(selectedTag)));
  }, [wallets, selectedTag]);

  const allDisplayedSelected = useMemo(() => {
    return displayedWallets.length > 0 && displayedWallets.every((w) => selectedWallets.has(w.address));
  }, [displayedWallets, selectedWallets]);

  const loadWallets = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await getTrackedWallets({
        search: search.trim() || undefined,
        tier: tierFilter || undefined,
        category: categoryFilter || undefined,
        activity_status: activityFilter !== "all" ? activityFilter : undefined,
        timeframe: timeframe !== "all" ? timeframe : undefined,
        sort_by: sortBy,
        order,
        page: 1,
        limit: 100,
      });
      setWallets(res.items);
      if (!selectedAddress && res.items.length > 0 && onSelectWallet) {
        onSelectWallet(res.items[0]);
      }
    } catch (err) {
      console.error("Failed to load tracked wallets:", err);
      setErrorMsg("Cannot connect to Backend API (http://localhost:8000). Please start the backend server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallets();
  }, [refreshTrigger, search, tierFilter, categoryFilter, activityFilter, timeframe, sortBy, order]);

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleUntrack = async (address: string) => {
    if (confirm(`Remove wallet ${shortenAddress(address)} from tracking?`)) {
      try {
        await untrackWallet(address);
        loadWallets();
        onRefresh();
      } catch (err) {
        alert("Failed to remove wallet.");
      }
    }
  };

  const handleSaveLabel = async (address: string) => {
    try {
      await updateWallet(address, { label: editLabel.trim() || undefined });
      setEditingAddress(null);
      loadWallets();
    } catch (err) {
      alert("Failed to update label.");
    }
  };

  const handleTriggerSync = async (address: string) => {
    try {
      await triggerWalletSync(address);
      loadWallets();
      onRefresh();
    } catch (err) {
      alert("Failed to trigger sync.");
    }
  };

  const handleToggleSelectAll = () => {
    if (allDisplayedSelected) {
      setSelectedWallets(new Set());
    } else {
      setSelectedWallets(new Set(displayedWallets.map((w) => w.address)));
    }
  };

  const handleToggleSelectWallet = (address: string) => {
    setSelectedWallets((prev) => {
      const next = new Set(prev);
      if (next.has(address)) {
        next.delete(address);
      } else {
        next.add(address);
      }
      return next;
    });
  };

  const handleBulkSync = async (addressesToSync: string[], targetName = "") => {
    if (addressesToSync.length === 0) return;
    if (!confirm(`Mulai sinkronisasi inkremental untuk ${addressesToSync.length} wallet ${targetName}?`)) return;
    try {
      setBulkOperating(true);
      await bulkSyncWallets(addressesToSync);
      setTimeout(() => {
        loadWallets();
        onRefresh();
        setBulkOperating(false);
        setSelectedWallets(new Set());
      }, 1500);
    } catch (err) {
      console.error("Bulk sync error:", err);
      alert("Gagal memulai bulk sync.");
      setBulkOperating(false);
    }
  };

  const handleBulkUntrackSelected = async () => {
    if (selectedWallets.size === 0) return;
    if (!confirm(`Hapus/untrack ${selectedWallets.size} wallet terpilih dari watchlist?`)) return;
    try {
      setBulkOperating(true);
      await bulkUntrackWallets(Array.from(selectedWallets));
      setSelectedWallets(new Set());
      loadWallets();
      onRefresh();
    } catch (err) {
      console.error("Bulk untrack error:", err);
      alert("Gagal menghapus wallet terpilih.");
    } finally {
      setBulkOperating(false);
    }
  };

  const handleCleanupDormant = async () => {
    if (dormantWallets.length === 0) return;
    if (
      !confirm(
        `Bersihkan ${dormantWallets.length} wallet dormant yang tidak aktif >30 hari? Wallet akan dihapus dari watchlist untuk menghemat kuota RPC.`
      )
    )
      return;
    try {
      setCleaningDormant(true);
      const res = await cleanupDormantWallets();
      alert(`Berhasil membersihkan ${res.untracked_count} wallet dormant.`);
      loadWallets();
      onRefresh();
    } catch (err) {
      console.error("Cleanup dormant error:", err);
      alert("Gagal membersihkan wallet dormant.");
    } finally {
      setCleaningDormant(false);
    }
  };

  const handleExportCSV = () => {
    if (displayedWallets.length === 0) {
      alert("Tidak ada data wallet untuk diekspor.");
      return;
    }
    const headers = [
      "Address",
      "Label/Group",
      "Performance Tier",
      "Trading Style",
      "Capital Tier",
      "Realized PnL ($)",
      "Win Rate (%)",
      "Avg Entry ($)",
      "Total Trades",
      "Last Active",
      "Dormant Status",
      "Sync Status",
    ];
    const rows = displayedWallets.map((w) => [
      w.address,
      w.label || "",
      w.performance_tier || "",
      w.trading_style || "",
      w.capital_tier || "",
      w.realized_pnl.toFixed(2),
      w.win_rate.toFixed(1),
      (w.avg_position_usd || 0).toFixed(2),
      w.trade_count,
      w.last_seen_at ? new Date(w.last_seen_at).toISOString() : "",
      w.is_dormant ? "Dormant (>30d)" : "Active",
      w.sync_status,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        headers.join(","),
        ...rows.map((r) =>
          r.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `solana_wallets_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3.5">
      {/* Group / Folder Quick Filter Pills & Timeframe Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-zinc-500 shrink-0 flex items-center gap-1 pr-1">
            <Folder className="w-3.5 h-3.5 text-zinc-400" /> Group:
          </span>
          <button
            onClick={() => setSelectedTag("")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
              selectedTag === ""
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700/80 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <span>All Wallets</span>
            <span className="text-[10px] text-zinc-500 font-mono">({wallets.length})</span>
          </button>

          {availableTags.map(([tag, count]) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag === selectedTag ? "" : tag)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                selectedTag === tag
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700/80 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              }`}
            >
              <span>{tag}</span>
              <span className="text-[10px] text-zinc-500 font-mono">({count})</span>
            </button>
          ))}
        </div>

        {/* Timeframe Toggle: All Time | 30D | 7D */}
        <div className="flex items-center gap-0.5 shrink-0 self-start sm:self-auto bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800">
          {[
            { id: "all", label: "All-Time" },
            { id: "30d", label: "30D" },
            { id: "7d", label: "7D" },
          ].map((tf) => (
            <button
              key={tf.id}
              onClick={() => setTimeframe(tf.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                timeframe === tf.id
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dormant Wallets Alert Banner */}
      {dormantWallets.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-300">
            <div className="p-1 rounded-md bg-amber-500/10 text-amber-400 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-amber-200">
                {dormantWallets.length} Inactive Wallets Detected (&gt;30 Days)
              </span>
              <p className="text-[11px] text-amber-400/80 mt-0.5">
                These wallets have had no on-chain activity for over 30 days. Untrack them to optimize RPC usage.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActivityFilter(activityFilter === "dormant" ? "all" : "dormant")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                activityFilter === "dormant"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800"
              }`}
            >
              {activityFilter === "dormant" ? "Show All" : "Filter Inactive"}
            </button>
            <button
              onClick={handleCleanupDormant}
              disabled={cleaningDormant}
              className="px-2.5 py-1 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{cleaningDormant ? "Cleaning..." : `Clean All (${dormantWallets.length})`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Filtering & Sorting Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by label or address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-zinc-900/90 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 w-52 font-mono"
            />
          </div>

          {/* Tier Filter */}
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="bg-zinc-900/90 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700"
          >
            <option value="">All Tiers</option>
            <option value="PROFITABLE">Profitable Only</option>
            <option value="HIGHLY_PROFITABLE">Highly Profitable</option>
            <option value="BREAK_EVEN">Break-Even</option>
            <option value="UNPROFITABLE">Unprofitable</option>
          </select>

          {/* Category / Position Size Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-zinc-900/90 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700"
          >
            <option value="">All Profiles</option>
            <option value="whale">Whale (&gt;$10k)</option>
            <option value="smart_money">Smart Money (WR 60%+)</option>
            <option value="dolphin">Dolphin ($1k - $10k)</option>
            <option value="scalper">Scalper (&lt;5m)</option>
            <option value="shrimp">Shrimp (&lt;$1k)</option>
          </select>

          {/* Activity / Dormant Filter */}
          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value as any)}
            className={`border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none transition-colors ${
              activityFilter === "dormant"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300 font-medium"
                : "bg-zinc-900/90 border-zinc-800 text-zinc-300"
            }`}
          >
            <option value="all">All Status</option>
            <option value="active">Active (&le;30 Days)</option>
            <option value="dormant">Inactive (&gt;30 Days)</option>
          </select>
        </div>

        {/* Sorting & Dynamic Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-zinc-900/90 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700"
            >
              <option value="pnl">Realized PnL</option>
              <option value="win_rate">Win Rate</option>
              <option value="avg_position">Avg Entry Size</option>
              <option value="trades">Trade Count</option>
              <option value="last_active">Last Active</option>
              <option value="created_at">Date Added</option>
            </select>

            <button
              onClick={() => setOrder((o) => (o === "desc" ? "asc" : "desc"))}
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title={`Order: ${order.toUpperCase()}`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-[1px] bg-zinc-800 mx-1 hidden sm:block" />

          {/* Dynamic Smart Action Controls */}
          {selectedWallets.size > 0 ? (
            <div className="flex items-center gap-1.5 bg-zinc-800/80 border border-zinc-700/80 rounded-lg p-1">
              <span className="text-[11px] font-medium text-zinc-300 px-2 shrink-0">
                {selectedWallets.size} selected
              </span>
              <button
                onClick={() => handleBulkSync(Array.from(selectedWallets), "selected")}
                disabled={bulkOperating}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-zinc-200 text-zinc-950 font-medium text-xs flex items-center gap-1 transition-colors disabled:opacity-50"
                title="Sync selected wallets"
              >
                <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span>Sync Selected</span>
              </button>
              <button
                onClick={handleBulkUntrackSelected}
                disabled={bulkOperating}
                className="px-2.5 py-1 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                title="Remove selected wallets from watchlist"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove</span>
              </button>
              <button
                onClick={() => setSelectedWallets(new Set())}
                className="text-zinc-400 hover:text-zinc-200 text-[11px] px-1.5"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkSync(displayedWallets.map((w) => w.address), selectedTag ? `group "${selectedTag}"` : "all wallets")}
                disabled={bulkOperating || displayedWallets.length === 0}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
                title="Synchronize wallets"
              >
                <RotateCw
                  className={`w-3.5 h-3.5 text-zinc-400 ${
                    bulkOperating ? "animate-spin" : ""
                  }`}
                />
                <span className="hidden sm:inline">Sync All ({displayedWallets.length})</span>
              </button>

              <button
                onClick={handleExportCSV}
                disabled={displayedWallets.length === 0}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
                title="Download CSV"
              >
                <Download className="w-3.5 h-3.5 text-zinc-400" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-950/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900/70 text-zinc-400 border-b border-zinc-800 font-medium text-[11px] uppercase tracking-wider">
            <tr>
              <th className="py-3 px-3 w-10 text-center">
                <button
                  onClick={handleToggleSelectAll}
                  className="text-zinc-400 hover:text-zinc-200 transition-colors p-0.5"
                  title={allDisplayedSelected ? "Deselect all" : "Select all"}
                >
                  {allDisplayedSelected ? (
                    <CheckSquare className="w-4 h-4 text-zinc-200" />
                  ) : (
                    <Square className="w-4 h-4 text-zinc-600" />
                  )}
                </button>
              </th>
              <th className="py-3 px-4">Wallet</th>
              <th className="py-3 px-4">Profile &amp; Position</th>
              <th className="py-3 px-4 text-right">
                Realized PnL {timeframe !== "all" && <span className="text-[10px] text-zinc-400 font-bold uppercase">({timeframe})</span>}
              </th>
              <th className="py-3 px-4 text-right">
                Win Rate {timeframe !== "all" && <span className="text-[10px] text-zinc-400 font-bold uppercase">({timeframe})</span>}
              </th>
              <th className="py-3 px-4 text-center">Trades</th>
              <th className="py-3 px-4 text-right">Last Active</th>
              <th className="py-3 px-4 text-center">Sync</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-sans">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-zinc-500 font-mono">
                  Loading tracked wallets...
                </td>
              </tr>
            ) : errorMsg && wallets.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-amber-400">
                    <p className="text-xs font-semibold">{errorMsg}</p>
                    <button
                      onClick={loadWallets}
                      className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 border border-zinc-700 transition-colors"
                    >
                      Retry Connection
                    </button>
                  </div>
                </td>
              </tr>
            ) : wallets.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-zinc-500">
                  No wallets tracked yet. Click &quot;Import Wallets&quot; above to add addresses.
                </td>
              </tr>
            ) : displayedWallets.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-zinc-400 text-xs">
                  No wallets match the current filter criteria.
                  <button
                    onClick={() => {
                      setSelectedTag("");
                      setActivityFilter("all");
                      setCategoryFilter("");
                      setTierFilter("");
                    }}
                    className="ml-2 text-zinc-200 underline hover:text-white font-medium"
                  >
                    Reset Filters
                  </button>
                </td>
              </tr>
            ) : (
              displayedWallets.map((w) => {
                const isProfit = w.realized_pnl >= 0;
                const isEditing = editingAddress === w.address;
                const isSelected = selectedWallets.has(w.address);
                const isOverviewActive = selectedAddress === w.address;

                return (
                  <tr
                    key={w.id}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest("button") || target.closest("a") || target.closest("input")) {
                        return;
                      }
                      if (onSelectWallet) onSelectWallet(w);
                    }}
                    className={`transition-colors cursor-pointer ${
                      isOverviewActive
                        ? "bg-zinc-800/70"
                        : isSelected
                        ? "bg-zinc-800/35"
                        : "hover:bg-zinc-900/50"
                    }`}
                  >
                    {/* Row Checkbox */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => handleToggleSelectWallet(w.address)}
                        className="text-zinc-400 hover:text-zinc-200 transition-colors p-0.5"
                        title={isSelected ? "Deselect" : "Select wallet"}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-zinc-200" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-600 hover:text-zinc-400" />
                        )}
                      </button>
                    </td>

                    {/* Label & Address */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-zinc-500 w-36 font-sans"
                            placeholder="Tag / Name"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveLabel(w.address);
                              if (e.key === "Escape") setEditingAddress(null);
                            }}
                          />
                          <button
                            onClick={() => handleSaveLabel(w.address)}
                            className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium hover:bg-emerald-500/30 text-[11px]"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingAddress(null)}
                            className="text-zinc-500 hover:text-zinc-300 text-[11px]"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 group">
                          {w.label ? (
                            <span
                              onClick={() => {
                                setEditingAddress(w.address);
                                setEditLabel(w.label || "");
                              }}
                              className="font-medium text-xs px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700/60 inline-flex items-center gap-1 cursor-pointer hover:border-zinc-500 transition-colors"
                              title="Edit label"
                            >
                              {w.label}
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingAddress(w.address);
                                setEditLabel("");
                              }}
                              className="text-zinc-500 hover:text-zinc-300 italic text-[11px] px-1.5 py-0.5 rounded border border-dashed border-zinc-700/60 hover:border-zinc-600 inline-flex items-center gap-1 transition-colors"
                              title="Add label"
                            >
                              <Edit2 className="w-2.5 h-2.5 text-zinc-500" />
                              <span>+ Add Label</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingAddress(w.address);
                              setEditLabel(w.label || "");
                            }}
                            className="text-zinc-500 hover:text-zinc-300 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Edit label"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 pt-0.5 font-mono">
                        <span>{shortenAddress(w.address)}</span>
                        <button
                          onClick={() => handleCopy(w.address)}
                          className="hover:text-zinc-200 transition-colors"
                          title="Copy address"
                        >
                          {copiedAddress === w.address ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        <a
                          href={`https://solscan.io/account/${w.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-zinc-200 transition-colors"
                          title="View on Solscan"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </td>

                    {/* Profile & Position */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        <div className="flex flex-wrap items-center gap-1">
                          {/* Smart Money Badge if WR >= 60% and Realized PnL > 0 */}
                          {w.win_rate >= 60 && w.realized_pnl > 0 && w.trade_count >= 3 && (
                            <ClassificationBadge type="capital" value="SMART_MONEY" />
                          )}
                          {/* Whale / Dolphin / Shrimp Capital Badge */}
                          <ClassificationBadge
                            type="capital"
                            value={
                              w.capital_tier ||
                              (w.avg_position_usd && w.avg_position_usd >= 10000
                                ? "WHALE"
                                : w.avg_position_usd && w.avg_position_usd >= 1000
                                ? "DOLPHIN"
                                : null)
                            }
                          />
                          {/* Trading Style (e.g. Scalper) */}
                          {w.trading_style === "SCALPER" && (
                            <ClassificationBadge type="style" value="SCALPER" />
                          )}
                          {/* Performance Tier */}
                          <ClassificationBadge type="performance" value={w.performance_tier} />
                        </div>
                        {/* Avg Position Size */}
                        {w.avg_position_usd ? (
                          <span className="text-[11px] text-zinc-400 font-mono">
                            Avg Entry: ${w.avg_position_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-600 font-mono">
                            Avg Entry: -
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Realized PnL */}
                    <td className={`py-3 px-4 text-right font-mono font-semibold tabular-nums ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
                      {isProfit ? "+" : ""}
                      {w.realized_pnl.toFixed(2)} SOL
                    </td>

                    {/* Win Rate */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-200">
                      {w.win_rate ? `${w.win_rate.toFixed(1)}%` : "0.0%"}
                      <span className="block text-[10px] text-zinc-500 font-sans">
                        {w.winning_trades}W / {w.losing_trades}L
                      </span>
                    </td>

                    {/* Trade Count */}
                    <td className="py-3 px-4 text-center font-mono tabular-nums text-zinc-300">
                      {w.trade_count}
                    </td>

                    {/* Last Active */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-zinc-300 font-mono text-[11px]">
                          {w.last_seen_at ? new Date(w.last_seen_at).toLocaleDateString() : "-"}
                        </span>
                        {w.is_dormant ? (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            title="No activity in >30 days"
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Inactive ({w.days_inactive ? `${w.days_inactive}d` : ">30d"})
                          </span>
                        ) : (
                          w.days_inactive !== undefined && w.days_inactive !== null && (
                            <span className="text-[10px] text-zinc-500">
                              {w.days_inactive === 0 ? "Today" : `${w.days_inactive}d ago`}
                            </span>
                          )
                        )}
                      </div>
                    </td>

                    {/* Sync Status */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-medium ${
                          w.sync_status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : w.sync_status === "SYNCING" || w.sync_status === "PROCESSING"
                            ? "bg-zinc-800 text-zinc-300 border border-zinc-700 animate-pulse"
                            : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                        }`}
                      >
                        {w.sync_status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTriggerSync(w.address);
                          }}
                          className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
                          title="Sync transactions"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUntrack(w.address);
                          }}
                          className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-zinc-700 transition-colors"
                          title="Untrack wallet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
