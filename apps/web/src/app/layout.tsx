import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wallet Intelligence | Solana Trader Analytics",
  description:
    "On-chain trade reconstruction, real-time PnL, win rate, and automated trader profiling on Solana.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var clean = function() {
                    var els = document.querySelectorAll('*');
                    for (var i = 0; i < els.length; i++) {
                      var el = els[i];
                      if (el.hasAttribute('bis_skin_checked')) el.removeAttribute('bis_skin_checked');
                      if (el.hasAttribute('bis_register')) el.removeAttribute('bis_register');
                    }
                  };
                  clean();
                  if (typeof MutationObserver !== 'undefined') {
                    var observer = new MutationObserver(function(mutations) {
                      for (var i = 0; i < mutations.length; i++) {
                        var m = mutations[i];
                        if (m.type === 'attributes' && m.attributeName) {
                          if (m.attributeName.indexOf('bis_') === 0 || m.attributeName.indexOf('__processed') === 0) {
                            m.target.removeAttribute(m.attributeName);
                          }
                        }
                      }
                    });
                    observer.observe(document.documentElement, { attributes: true, subtree: true });
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className="min-h-full bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-purple-500/30 selection:text-purple-300"
        suppressHydrationWarning
      >
        {/* Sleek Top Navigation */}
        <header className="border-b border-slate-800/80 bg-[#090d16]/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform">
                WI
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Wallet Intelligence
                </span>
                <span className="text-[10px] text-cyan-400 font-mono tracking-wider uppercase -mt-0.5">
                  Phase 1 MVP · Solana
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Solana Mainnet</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1">{children}</main>

        {/* Minimal Footer */}
        <footer className="border-t border-slate-800/60 bg-[#090d16] py-6 text-center text-xs text-slate-500 font-mono">
          <div className="max-w-7xl mx-auto px-4">
            Wallet Intelligence Engine &copy; 2026 · Accuracy-first On-chain Trade Reconstruction
          </div>
        </footer>
      </body>
    </html>
  );
}
