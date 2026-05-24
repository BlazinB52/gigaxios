import type { Metadata } from "next";
import { Inter } from "next/font/google";
import BottomNav from "@/app/components/BottomNav";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GigAxios",
  description: "Know what you actually make",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#020814]">
        <header className="fixed left-0 right-0 top-0 z-50 border-b border-slate-800 bg-[#020814]/95 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
            <div>
              <img
                src="/GigAxios-logo.png"
                alt="GigAxios"
                className="h-12 w-auto brightness-125 contrast-125"
              />

              <p className="mt-1 text-sm text-slate-400">
                Know what you actually make
              </p>
            </div>

            <button className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 text-xl">
              🔔
            </button>
          </div>
        </header>

        <div className="min-h-screen pb-24 pt-24">{children}</div>

        <BottomNav />
      </body>
    </html>
  );
}