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
        className="min-h-full bg-[#090a0f] text-zinc-100 flex flex-col font-sans selection:bg-zinc-800 selection:text-white"
        suppressHydrationWarning
      >
        {/* Clean Modern Navigation */}
        <header className="border-b border-[#1e2029] bg-[#090a0f]/90 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-md bg-zinc-100 text-zinc-950 flex items-center justify-center font-bold text-xs tracking-wider transition-opacity group-hover:opacity-90">
                WI
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-sm tracking-tight text-white">
                  Wallet Intelligence
                </span>
                <span className="text-xs text-zinc-500 hidden sm:inline">
                  Solana Analytics
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900/80 border border-zinc-800/80 text-[11px] text-zinc-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Solana Mainnet</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1">{children}</main>

        {/* Minimal Footer */}
        <footer className="border-t border-[#1e2029] bg-[#090a0f] py-6 text-xs text-zinc-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Wallet Intelligence &copy; 2026</span>
            <span className="text-zinc-600">On-chain trade reconstruction &amp; wallet profiling</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
