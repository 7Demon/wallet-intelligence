"use client";

import { useState } from "react";
import { X, Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { bulkImportWallets, BulkImportResponse } from "@/lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkImportModal({ isOpen, onClose, onSuccess }: Props) {
  const [inputText, setInputText] = useState("");
  const [label, setLabel] = useState("");
  const [autoSync, setAutoSync] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkImportResponse | null>(null);

  if (!isOpen) return null;

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    // Parse lines: preserve custom names per line (e.g. "address, Custom Name" or "address | Custom Name")
    const rawList = inputText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (rawList.length === 0) {
      setError("Masukkan setidaknya satu alamat wallet Solana.");
      return;
    }

    try {
      setLoading(true);
      const res = await bulkImportWallets({
        addresses: rawList,
        default_label: label.trim() || undefined,
        auto_sync: autoSync,
      });
      setResult(res);
      setInputText("");
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to import wallets.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg glass-panel-glow bg-[#0f172a] border border-purple-500/30 p-6 space-y-5 rounded-xl shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono">Import &amp; Beri Nama Wallet</h2>
              <p className="text-xs text-slate-400">Track wallet Solana dan kelompokkan dengan nama/tag kustom</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleImport} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-mono text-slate-300">
                Alamat Wallet (Satu per baris):
              </label>
              <span className="text-[10px] text-cyan-400 font-mono">
                Bisa pakai format: <code className="bg-slate-800 px-1 rounded text-slate-200">Alamat, Nama</code>
              </span>
            </div>
            <textarea
              rows={5}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Contoh tanpa nama:\n7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU\n\nContoh dengan nama langsung:\n4CcYMohSa8YKJfHn2UhyR2fVXyt8zoU6xAK63mZ3Lc7y, Whale Scalper\nDN7HENoqJw9V983rmzBkx836RS5MbVB6EgazVciPgnXV, Top Memecoin Trader`}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500/60"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1 flex items-center justify-between">
              <span>Nama / Tag Grup Default (Opsional):</span>
              <span className="text-[10px] text-cyan-400">Diterapkan jika baris tidak punya nama</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Smart Money, KOL Tracker, Whale Alpha"
              className="w-full bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500/60"
            />
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] text-slate-500 font-mono">Preset Cepat:</span>
              {["Smart Money", "KOL / Callers", "Insider Whale", "Alpha Snipers"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLabel(preset)}
                  className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-purple-600/30 hover:border-purple-500/50 text-[10px] font-mono text-slate-300 border border-slate-700/60 transition-colors"
                >
                  +{preset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="autoSync"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="autoSync" className="text-xs font-mono text-slate-400 select-none">
              Automatically trigger on-chain history sync in background
            </label>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Import Succeeded!</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Newly Added: <span className="text-emerald-400 font-bold">{result.imported_count}</span> · Already
                tracked: <span className="text-slate-400">{result.already_tracked_count}</span>
                {result.invalid_addresses.length > 0 && (
                  <> · Invalid skipped: <span className="text-rose-400">{result.invalid_addresses.length}</span></>
                )}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-mono text-slate-300 transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-xs font-mono font-medium text-white shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <span>Save to Database</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
