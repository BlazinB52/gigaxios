/* =========================================================
   ROOT LAYOUT
   ---------------------------------------------------------
   Wraps every page in the app.  Applies the Inter font,
   renders the sticky top header with the app name and
   notification bell, adds bottom padding so pages don't
   sit behind the BottomNav, and mounts BottomNav globally.
   ========================================================= */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
// import GigHeader from "@/app/components/GigHeader";
import "./globals.css";

/* =========================================================
   FONT SETUP
   Inter loaded via next/font — injected as a CSS variable
   so Tailwind's font-sans stack picks it up automatically.
   ========================================================= */

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/* =========================================================
   PAGE METADATA
   Shown in browser tab and used by Vercel / social previews.
   ========================================================= */

export const metadata: Metadata = {
  title: "GigAxios",
  description: "Know what you actually make",
};

/* =========================================================
   LAYOUT COMPONENT
   ========================================================= */

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#020814]">

        {/* =====================================================
            TOP HEADER
            Fixed — stays visible while the page scrolls.
            Contains the GigAxios wordmark and notification bell.
           ===================================================== */}
        <div className="hide-on-landing">
          <header className="fixed left-0 right-0 top-0 z-50 border-b border-slate-800 bg-[#020814]/95 backdrop-blur">
            <div className="mx-auto flex max-w-md items-center justify-between px-5 py-5">

              {/* APP WORDMARK */}
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">
                  Gig<span className="text-blue-400">A</span>xios
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Know what you actually make
                </p>
              </div>

              {/* HEADER ICONS */}
              <div className="flex items-center gap-2">

                {/* NOTIFICATION BELL */}
                <button className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-700 text-xl">
                  🔔
                </button>

                {/* SETTINGS GEAR */}
                <a
                  href="/settings"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-slate-300 hover:text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </a>

              </div>

            </div>
          </header>
        </div>

        {/* =====================================================
            PAGE CONTENT
            pt-24 clears the fixed header; pb-24 clears the
            fixed BottomNav so content is never hidden behind
            either one.
           ===================================================== */}
        <div className="min-h-screen pb-24 pt-24">
          {children}
        </div>

      </body>
    </html>
  );
}
