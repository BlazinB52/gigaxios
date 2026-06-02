"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

type Device = "ios-safari" | "ios-chrome" | "android-chrome" | "android" | "desktop" | "unknown";

const getDevice = (): Device => {
  if (typeof window === "undefined") return "unknown";

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isChromeIOS = /CriOS/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  const isChromeAndroid = isAndroid && /Chrome/.test(ua);

  if (isIOS && isChromeIOS) return "ios-chrome";
  if (isIOS && isSafari) return "ios-safari";
  if (isIOS) return "ios-safari";
  if (isChromeAndroid) return "android-chrome";
  if (isAndroid) return "android";
  if (/Windows|Macintosh|Linux/.test(ua)) return "desktop";
  return "unknown";
};

export default function WelcomePage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [device, setDevice] = useState<Device>("unknown");

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const welcomeComplete = localStorage.getItem("gigaxios_welcome_complete") === "true";
      if (welcomeComplete) {
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
    <main className="min-h-screen bg-[#020814] px-5 py-6 pb-28 text-white">
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

        {(device === "ios-safari" || device === "unknown") && (
          <section className="rounded-3xl border border-blue-500/20 bg-slate-950/70 p-5 shadow-[0_0_35px_rgba(59,130,246,0.12)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-sm font-bold text-blue-200">
                iOS
              </div>
              <div>
                <h2 className="text-lg font-bold">iPhone Safari</h2>
                <p className="text-sm text-slate-400">Best for iPhone users</p>
              </div>
            </div>

            {device === "ios-safari" && (
              <p className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
                You are in the right place. On iPhone, Safari is the best
                browser for adding GigAxios to your Home Screen.
              </p>
            )}

            <ol className="space-y-3 text-sm leading-6 text-slate-300">
              <li><span className="font-semibold text-white">1.</span> Open GigAxios in Safari.</li>
              <li><span className="font-semibold text-white">2.</span> Tap the Share button.</li>
              <li>
                <span className="font-semibold text-white">3.</span> Tap{" "}
                <span className="font-semibold text-white">Add to Home Screen</span>.
              </li>
              <li><span className="font-semibold text-white">4.</span> Tap <span className="font-semibold text-white">Add</span>.</li>
            </ol>
          </section>
        )}

        {device === "ios-chrome" && (
          <section className="rounded-3xl border border-blue-500/20 bg-slate-950/70 p-5 shadow-[0_0_35px_rgba(59,130,246,0.12)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-sm font-bold text-blue-200">
                iOS
              </div>
              <div>
                <h2 className="text-lg font-bold">iPhone Chrome</h2>
                <p className="text-sm text-slate-400">Use Safari to install</p>
              </div>
            </div>

            <p className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
              iPhone home-screen install works best from Safari. Open
              gigaxios.com in Safari, then use Share and Add to Home Screen.
            </p>

            <ol className="space-y-3 text-sm leading-6 text-slate-300">
              <li><span className="font-semibold text-white">1.</span> Open gigaxios.com in Safari.</li>
              <li><span className="font-semibold text-white">2.</span> Tap the Share button.</li>
              <li>
                <span className="font-semibold text-white">3.</span> Tap{" "}
                <span className="font-semibold text-white">Add to Home Screen</span>.
              </li>
            </ol>
          </section>
        )}

        {(device === "android-chrome" || device === "android" || device === "unknown") && (
          <section className="rounded-3xl border border-blue-500/20 bg-slate-950/70 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-sm font-bold text-blue-200">
                A
              </div>
              <div>
                <h2 className="text-lg font-bold">Android Chrome</h2>
                <p className="text-sm text-slate-400">Fastest install option</p>
              </div>
            </div>

            <ol className="space-y-3 text-sm leading-6 text-slate-300">
              <li><span className="font-semibold text-white">1.</span> Open GigAxios in Chrome.</li>
              <li><span className="font-semibold text-white">2.</span> Tap the menu button.</li>
              <li>
                <span className="font-semibold text-white">3.</span> Tap{" "}
                <span className="font-semibold text-white">Install app</span> or{" "}
                <span className="font-semibold text-white">Add to Home Screen</span>.
              </li>
              <li><span className="font-semibold text-white">4.</span> Confirm the install.</li>
            </ol>
          </section>
        )}

        {(device === "desktop" || device === "unknown") && (
          <section className="rounded-3xl border border-blue-500/20 bg-slate-950/70 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-sm font-bold text-blue-200">
                PC
              </div>
              <div>
                <h2 className="text-lg font-bold">Desktop Browser</h2>
                <p className="text-sm text-slate-400">Windows, Mac, or Linux</p>
              </div>
            </div>

            <ol className="space-y-3 text-sm leading-6 text-slate-300">
              <li><span className="font-semibold text-white">1.</span> Open GigAxios in your browser.</li>
              <li><span className="font-semibold text-white">2.</span> Look for the install icon in the address bar or browser menu.</li>
              <li><span className="font-semibold text-white">3.</span> Click <span className="font-semibold text-white">Install</span>.</li>
              <li><span className="font-semibold text-white">4.</span> GigAxios will open like a desktop app.</li>
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
          onClick={() => {
            localStorage.setItem("gigaxios_welcome_complete", "true");
            router.push("/dashboard");
          }}
          className="flex min-h-[56px] items-center justify-center rounded-2xl bg-blue-500 px-6 py-4 text-center text-base font-bold text-white shadow-[0_0_25px_rgba(59,130,246,0.35)] transition active:scale-[0.98]"
        >
          Continue to GigAxios
        </button>
      </div>
    </main>
  );
}
