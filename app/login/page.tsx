"use client";

/* =========================================================
   LOGIN PAGE
   ---------------------------------------------------------
   Magic-link authentication using Supabase OTP.
   On submit, Supabase emails a secure link that redirects
   to /auth/callback where the PKCE code is exchanged for
   a session cookie.
   ========================================================= */

import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

export default function LoginPage() {

  /* =========================================================
     STATE VARIABLES
     ========================================================= */

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  /* =========================================================
     HANDLE LOGIN
     Sends a magic link to the entered email address.
     emailRedirectTo must point to /auth/callback so the
     PKCE code exchange happens before the user lands on /.
     ========================================================= */

  async function handleLogin(event: { preventDefault(): void }) {
    event.preventDefault();
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Check your email for the login link.");
  }

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">

      {/* LOGIN CARD */}
      <section className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
        <h1 className="text-2xl font-bold">Log in to GigAxios</h1>

        <p className="mt-2 text-sm text-slate-400">
          Enter your email and we&apos;ll send you a secure login link.
        </p>

        {/* EMAIL FORM */}
        <form onSubmit={handleLogin} className="mt-6 space-y-4">

          {/* EMAIL INPUT */}
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white placeholder:text-slate-500"
          />

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            className="w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white"
          >
            Send login link
          </button>

        </form>

        {/* STATUS MESSAGE — shows success or error after submit */}
        {message && (
          <p className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
            {message}
          </p>
        )}

        {/* PRIVACY STATEMENT */}
        <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
          Your data belongs to you. GigAxios uses your email only for
          secure account access — never for spam or data sales.
        </p>

        {/* LEGAL LINKS */}
        <div className="mt-3 flex justify-center gap-4 text-xs text-slate-600">
          <a href="/privacy" className="hover:text-slate-400">Privacy Policy</a>
          <a href="/terms" className="hover:text-slate-400">Terms of Use</a>
        </div>

        {/* COPYRIGHT */}
        <p className="mt-6 text-center text-[11px] text-slate-600">
          © 2026 GigAxios. All rights reserved.
        </p>

      </section>
    </main>
  );
}
