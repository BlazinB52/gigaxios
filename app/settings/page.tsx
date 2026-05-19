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
        <h1 className="text-3xl font-bold tracking-tight">Garage</h1>
        <p className="mt-2 text-sm text-slate-400">
          Vehicle costs, maintenance, payments, and service records will live here.
        </p>
      </div>

      <BottomNav />
    </main>
  );
}