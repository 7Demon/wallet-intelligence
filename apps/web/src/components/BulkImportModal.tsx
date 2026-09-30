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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-lg bg-[#111218] border border-zinc-800 p-6 space-y-5 rounded-xl shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Import &amp; Tag Wallets</h2>
              <p className="text-xs text-zinc-400">Track Solana wallets and organize them with custom labels</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleImport} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-zinc-300">
                Wallet Addresses (One per line):
              </label>
              <span className="text-[11px] text-zinc-400">
                Format: <code className="bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-zinc-300 font-mono text-[10px]">Address, Name</code>
              </span>
            </div>
            <textarea
              rows={5}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Example without name:\n7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU\n\nExample with custom name:\n4CcYMohSa8YKJfHn2UhyR2fVXyt8zoU6xAK63mZ3Lc7y, Whale Scalper\nDN7HENoqJw9V983rmzBkx836RS5MbVB6EgazVciPgnXV, Top Memecoin Trader`}
              className="w-full bg-zinc-900/90 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
              <span>Default Group / Label (Optional):</span>
              <span className="text-[11px] text-zinc-500">Applied if line has no custom name</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Smart Money, KOL Tracker, Whale Alpha"
              className="w-full bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
            />
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-zinc-500">Quick Presets:</span>
              {["Smart Money", "KOL / Callers", "Insider Whale", "Alpha Snipers"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLabel(preset)}
                  className="px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-[11px] text-zinc-300 border border-zinc-800 transition-colors"
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
              className="rounded bg-zinc-900 border-zinc-700 text-zinc-200 focus:ring-zinc-600"
            />
            <label htmlFor="autoSync" className="text-xs text-zinc-400 select-none">
              Automatically trigger on-chain history sync in background
            </label>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Import Succeeded</span>
              </div>
              <p className="text-[11px] text-zinc-300">
                Newly Added: <span className="text-emerald-400 font-mono font-medium">{result.imported_count}</span> · Already
                tracked: <span className="text-zinc-400 font-mono">{result.already_tracked_count}</span>
                {result.invalid_addresses.length > 0 && (
                  <> · Invalid skipped: <span className="text-rose-400 font-mono">{result.invalid_addresses.length}</span></>
                )}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs text-zinc-300 transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-medium shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <span>Save Wallets</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
