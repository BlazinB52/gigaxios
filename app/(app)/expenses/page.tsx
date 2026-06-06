"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

export default function ExpensesPage() {
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setIsAllowed(true);
    }

    checkUser();
  }, [router]);

  if (!isAllowed) {
    return null;
  }

  return (
    <main className="min-h-screen bg-zinc-100 pb-20">
      <div className="mx-auto max-w-md p-4">
        <h1 className="text-2xl font-bold">Expenses</h1>
      </div>

    </main>
  );
}