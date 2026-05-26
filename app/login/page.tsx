"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin(event: { preventDefault(): void }) {
    event.preventDefault();
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Check your email for the login link.");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <section className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
        <h1 className="text-2xl font-bold">Log in to GigAxios</h1>

        <p className="mt-2 text-sm text-slate-400">
          Enter your email and we&apos;ll send you a secure login link.
        </p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white placeholder:text-slate-500"
          />

          <button
            type="submit"
            className="w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white"
          >
            Send login link
          </button>
        </form>

        {message && (
          <p className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}