"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";
import { supabase } from "@/app/lib/supabaseClient";

export default function GaragePage() {
  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
      }
    }

    checkUser();
  }, [router]);

  return (
    <main className="min-h-screen bg-[#020814] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-24 pt-8">
        <h1 className="text-4xl font-bold tracking-tight">Garage</h1>

        <p className="mt-2 text-base text-slate-400">
          Your vehicle. Your business.
        </p>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-blue-950/20">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-3xl">
              🔧
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-bold">Service</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Track major maintenance and repairs you&apos;ve already completed.
              </p>
            </div>
          </div>

          <div className="mt-5 border-t border-slate-800 pt-5">
            <p className="text-sm text-slate-400">Last Major Service</p>
            <p className="mt-1 text-xl font-bold text-white">Brake Job</p>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-blue-400">$742.51</p>
                <p className="text-xs text-slate-400">Cost</p>
              </div>

              <div className="border-x border-slate-800">
                <p className="text-lg font-bold text-blue-400">124,220</p>
                <p className="text-xs text-slate-400">Miles</p>
              </div>

              <div>
                <p className="text-lg font-bold text-blue-400">3</p>
                <p className="text-xs text-slate-400">Recent</p>
              </div>
            </div>
          </div>

          <button className="mt-5 w-full rounded-2xl bg-blue-500 px-4 py-3 text-sm font-bold text-white">
            + Add Service
          </button>
        </section>

        <section className="mt-6 rounded-3xl border border-amber-900/60 bg-slate-950/80 p-5 shadow-lg shadow-amber-950/20">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-950/60 text-3xl">
              ⚠️
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-bold">Upcoming Maintenance</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Stay ahead of what&apos;s due so you can avoid problems.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4 border-t border-slate-800 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-white">Oil Change</p>
                <p className="text-sm text-slate-400">Due in 412 miles</p>
              </div>
              <p className="text-sm font-semibold text-amber-300">May 28</p>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">Tire Rotation</p>
                  <p className="text-sm text-slate-400">Due in 1,120 miles</p>
                </div>
                <p className="text-sm font-semibold text-amber-300">Jun 25</p>
              </div>
            </div>
          </div>

          <button className="mt-5 w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950">
            + Add Reminder
          </button>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}