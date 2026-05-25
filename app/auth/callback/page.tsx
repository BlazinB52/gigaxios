"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");

    if (!code) {
      router.push("/login");
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        console.error("Auth callback error:", error.message);
        router.push("/login");
      } else {
        router.push("/");
      }
    });
  }, [router]);

  return (
    <main className="min-h-screen bg-[#020814] text-white flex items-center justify-center">
      <p className="text-slate-400">Signing you in…</p>
    </main>
  );
}
