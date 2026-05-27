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
import BottomNav from "@/app/components/BottomNav";
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

            {/* NOTIFICATION BELL */}
            <button className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-700 text-xl">
              🔔
            </button>

          </div>
        </header>

        {/* =====================================================
            PAGE CONTENT
            pt-24 clears the fixed header; pb-24 clears the
            fixed BottomNav so content is never hidden behind
            either one.
           ===================================================== */}
        <div className="min-h-screen pb-24 pt-24">
          {children}
        </div>

        {/* =====================================================
            BOTTOM NAV
            Rendered here so every page gets it automatically.
           ===================================================== */}
        <div className="hide-on-landing">
          <BottomNav />
        </div>

      </body>
    </html>
  );
}
