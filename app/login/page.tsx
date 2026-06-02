"use client";

/* =========================================================
   LOGIN PAGE
   ---------------------------------------------------------
   Code-first email authentication using Supabase OTP.
   ========================================================= */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  /* =========================================================
     STATE VARIABLES
     ========================================================= */

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  /* =========================================================
     SEND CODE
     Sends a 6-digit code.
     ========================================================= */

  async function sendCode() {
    setMessage("");
    setIsSending(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
    });

    setIsSending(false);

    if (error) {
      setMessage("We could not send a code. Please check your email and try again.");
      return;
    }

    setStep("code");
    setCode("");
    setMessage("We sent a 6-digit code to your email.");
  }

  async function handleSendCode(event: { preventDefault(): void }) {
    event.preventDefault();
    await sendCode();
  }

  /* =========================================================
     VERIFY CODE
     Confirms the 6-digit code, then routes the user to the
     welcome page if they have not seen it, otherwise dashboard.
     ========================================================= */

  async function handleVerifyCode(event: { preventDefault(): void }) {
    event.preventDefault();
    setMessage("");
    setIsVerifying(true);

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });

    setIsVerifying(false);

    if (error) {
      setMessage("That code did not work. Please check it and try again.");
      return;
    }

    const seenWelcome = localStorage.getItem("gigaxios_welcome_seen") === "true";
    router.replace(seenWelcome ? "/dashboard" : "/welcome");
  }

  function handleChangeEmail() {
    setStep("email");
    setCode("");
    setMessage("");
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
          {step === "email"
            ? "Enter your email and we'll send you a 6-digit code."
            : "Enter the 6-digit code from your email."}
        </p>

        {step === "email" ? (
          <form onSubmit={handleSendCode} className="mt-6 space-y-4">

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
              disabled={isSending}
              className="w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {isSending ? "Sending code..." : "Send code"}
            </button>

          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="mt-6 space-y-4">

            <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
              We sent a 6-digit code to <span className="font-semibold text-white">{email}</span>.
            </div>

            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-center text-2xl font-bold tracking-[0.35em] text-white placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-500"
            />

            <button
              type="submit"
              disabled={isVerifying || code.length !== 6}
              className="w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {isVerifying ? "Checking code..." : "Log in"}
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={sendCode}
                disabled={isSending}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-300 disabled:opacity-60"
              >
                {isSending ? "Sending..." : "Send another code"}
              </button>

              <button
                type="button"
                onClick={handleChangeEmail}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-300"
              >
                Change email
              </button>
            </div>

            <p className="text-center text-xs text-slate-500">
              Didn't get it? Send another code.
            </p>

          </form>
        )}

        {/* STATUS MESSAGE - shows success or error after submit */}
        {message && (
          <p className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
            {message}
          </p>
        )}

        {/* PRIVACY STATEMENT */}
        <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
          Your data belongs to you. GigAxios uses your email only for
          secure account access - never for spam or data sales.
        </p>

        {/* LEGAL LINKS */}
        <div className="mt-3 flex justify-center gap-4 text-xs text-slate-600">
          <a href="/privacy" className="hover:text-slate-400">Privacy Policy</a>
          <a href="/terms" className="hover:text-slate-400">Terms of Use</a>
        </div>

        {/* COPYRIGHT */}
        <p className="mt-6 text-center text-[11px] text-slate-600">
          Copyright 2026 GigAxios. All rights reserved.
        </p>

      </section>
    </main>
  );
}
