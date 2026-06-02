"use client";

/* =========================================================
   LOGIN PAGE
   ---------------------------------------------------------
   Email code authentication using Supabase OTP.
   The user requests a code, enters it in the same browser,
   and Supabase verifies the token without a magic-link click.
   ========================================================= */

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  /* =========================================================
     STATE VARIABLES
     ========================================================= */

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);

  /* =========================================================
     HANDLE CODE REQUEST
     Sends a six-digit email verification code.
     ========================================================= */

  async function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSendingCode(true);
    setMessage("");
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    setSendingCode(false);

    if (error) {
      setErrorMessage("We could not send a verification code. Please check your email and try again.");
      return;
    }

    setCodeSent(true);
    setMessage("Check your email for the 6-digit code.");
  }

  /* =========================================================
     HANDLE CODE VERIFY
     Verifies the six-digit email code in the same browser.
     ========================================================= */

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifyingCode(true);
    setMessage("");
    setErrorMessage("");

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });

    setVerifyingCode(false);

    if (error) {
      setErrorMessage("That code did not work. Please check it and try again.");
      return;
    }

    const welcomeComplete = localStorage.getItem("gigaxios_welcome_complete") === "true";
    router.replace(welcomeComplete ? "/dashboard" : "/welcome");
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
          Enter your email and we&apos;ll send you a 6-digit verification code.
        </p>

        {/* EMAIL FORM */}
        <form onSubmit={handleSendCode} className="mt-6 space-y-4">

          {/* EMAIL INPUT */}
          <input
            type="email"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setCodeSent(false);
              setCode("");
              setMessage("");
              setErrorMessage("");
            }}
            placeholder="Email address"
            disabled={sendingCode || verifyingCode}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white placeholder:text-slate-500 disabled:opacity-60"
          />

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={sendingCode || verifyingCode}
            className="w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sendingCode ? "Sending code..." : codeSent ? "Send a new code" : "Send verification code"}
          </button>

        </form>

        {codeSent && (
          <form onSubmit={handleVerifyCode} className="mt-5 space-y-4 rounded-2xl border border-blue-500/20 bg-slate-950/70 p-4">
            <div>
              <p className="text-sm font-semibold text-white">Enter the code below to continue.</p>
              <p className="mt-1 text-sm text-slate-400">Check your email for the 6-digit code.</p>
            </div>

            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={6}
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                setErrorMessage("");
              }}
              placeholder="000000"
              disabled={sendingCode || verifyingCode}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-center text-xl font-bold tracking-[0.35em] text-white placeholder:text-slate-600 disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={verifyingCode || code.length !== 6}
              className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {verifyingCode ? "Verifying..." : "Continue"}
            </button>
          </form>
        )}

        {/* STATUS MESSAGE */}
        {message && (
          <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            {message}
          </p>
        )}

        {errorMessage && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
            {errorMessage}
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
