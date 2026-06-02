"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

const getDevice = () => {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Windows|Macintosh|Linux/.test(ua)) return "desktop";
  return "unknown";
};

export default function WelcomePage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [device, setDevice] = useState("unknown");

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const seen = user.user_metadata?.welcome_seen;
      if (seen) {
        router.replace("/dashboard");
        return;
      }

      setDevice(getDevice());
      setCheckingAuth(false);
    }

    checkUser();
  }, [router]);

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-[#020814] text-white flex items-center justify-center px-6">
        <p className="text-slate-400">Loading GigAxios...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020814] text-white px-5 py-6 pb-28">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <header className="flex flex-col items-center text-center">
          <div className="mb-5 flex justify-center">
            <Image
              src="/Full_Logo.png"
              alt="GigAxios"
              width={220}
              height={80}
              priority
              className="h-auto w-56"
            />
          </div>

          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-blue-400">
            Welcome to GigAxios
          </p>

          <h1 className="text-3xl font-bold leading-tight">
            Add GigAxios to your device
          </h1>

          <p className="mt-3 text-base leading-7 text-slate-400">
            Get quick access from your phone or computer. No app store needed.
          </p>
        </header>

        {(device === "ios" || device === "unknown") && (
          <section className="rounded-3xl border border-blue-500/20 bg-slate-950/70 p-5 shadow-[0_0_35px_rgba(59,130,246,0.12)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-2xl">
                📱
              </div>
              <div>
                <h2 className="text-lg font-bold">iPhone Safari</h2>
                <p className="text-sm text-slate-400">Best for iPhone users</p>
              </div>
            </div>

            {device === "ios" && (
              <p className="mb-4 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-sm text-blue-200">
                Make sure you are viewing this page in Safari before following
                these steps. The Add to Home Screen option is only available in
                Safari.
              </p>
            )}

            <ol className="space-y-3 text-sm leading-6 text-slate-300">
              <li>
                <span className="font-semibold text-white">1.</span> Open
                GigAxios in Safari.
              </li>
              <li>
                <span className="font-semibold text-white">2.</span> Tap the
                Share button.
              </li>
              <li>
                <span className="font-semibold text-white">3.</span> Tap{" "}
                <span className="font-semibold text-white">
                  Add to Home Screen
                </span>
                .
              </li>
              <li>
                <span className="font-semibold text-white">4.</span> Tap{" "}
                <span className="font-semibold text-white">Add</span>.
              </li>
            </ol>
          </section>
        )}

        {(device === "android" || device === "unknown") && (
          <section className="rounded-3xl border border-blue-500/20 bg-slate-950/70 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-2xl">
                🤖
              </div>
              <div>
                <h2 className="text-lg font-bold">Android Chrome</h2>
                <p className="text-sm text-slate-400">Fastest install option</p>
              </div>
            </div>

            <ol className="space-y-3 text-sm leading-6 text-slate-300">
              <li>
                <span className="font-semibold text-white">1.</span> Open
                GigAxios in Chrome.
              </li>
              <li>
                <span className="font-semibold text-white">2.</span> Tap the menu
                button.
              </li>
              <li>
                <span className="font-semibold text-white">3.</span> Tap{" "}
                <span className="font-semibold text-white">Install app</span> or{" "}
                <span className="font-semibold text-white">
                  Add to Home Screen
                </span>
                .
              </li>
              <li>
                <span className="font-semibold text-white">4.</span> Confirm the
                install.
              </li>
            </ol>
          </section>
        )}

        {(device === "desktop" || device === "unknown") && (
          <section className="rounded-3xl border border-blue-500/20 bg-slate-950/70 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-2xl">
                💻
              </div>
              <div>
                <h2 className="text-lg font-bold">Desktop Chrome</h2>
                <p className="text-sm text-slate-400">Windows or Mac</p>
              </div>
            </div>

            <ol className="space-y-3 text-sm leading-6 text-slate-300">
              <li>
                <span className="font-semibold text-white">1.</span> Open
                GigAxios in Chrome.
              </li>
              <li>
                <span className="font-semibold text-white">2.</span> Look for the
                install icon in the address bar.
              </li>
              <li>
                <span className="font-semibold text-white">3.</span> Click{" "}
                <span className="font-semibold text-white">Install</span>.
              </li>
              <li>
                <span className="font-semibold text-white">4.</span> GigAxios
                will open like a desktop app.
              </li>
            </ol>
          </section>
        )}

        <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/5 p-5 shadow-[0_0_30px_rgba(74,222,128,0.10)]">
          <p className="text-center text-sm leading-6 text-slate-300">
            Once installed, GigAxios opens from your home screen or desktop just
            like an app.
          </p>
        </div>

        <button
          onClick={async () => {
            await supabase.auth.updateUser({ data: { welcome_seen: true } });
            router.push("/dashboard");
          }}
          className="flex min-h-[56px] items-center justify-center rounded-2xl bg-blue-500 px-6 py-4 text-center text-base font-bold text-white shadow-[0_0_25px_rgba(59,130,246,0.35)] transition active:scale-[0.98]"
        >
          Continue to App
        </button>
      </div>
    </main>
  );
}
