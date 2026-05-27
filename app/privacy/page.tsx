/* =========================================================
   PRIVACY POLICY PAGE
   ---------------------------------------------------------
   Public page — no auth required.
   Describes what GigAxios collects, how it is used, and
   the user's rights over their own data.
   ========================================================= */

import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — GigAxios",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#020814] px-4 py-10 text-white">
      <div className="mx-auto max-w-md space-y-6">

        {/* BACK LINK */}
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300"
        >
          ‹ Back to login
        </Link>

        {/* PAGE HEADER */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Last updated: May 2025
          </p>
        </div>

        {/* INTRO CARD */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm leading-relaxed text-slate-300">
            GigAxios is built on a simple principle: your data belongs to
            you. We collect only what is necessary to run the app, we never
            sell your information, and we never share it with third parties
            for advertising or marketing purposes.
          </p>
        </section>

        {/* WHAT WE COLLECT */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-bold text-white">What we collect</h2>
          <p className="mt-2 text-sm text-slate-400">
            We only collect information necessary to provide the service.
            This includes:
          </p>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-blue-400">•</span>
              <span>
                <span className="font-semibold text-white">Email address</span> —
                used only for secure, passwordless account access via magic link.
                We do not store passwords.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-blue-400">•</span>
              <span>
                <span className="font-semibold text-white">Shift data</span> —
                start/end times, mileage, platform, deliveries, and hours you
                log manually.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-blue-400">•</span>
              <span>
                <span className="font-semibold text-white">Pay records</span> —
                base pay, tips, bonuses, and adjustments you enter.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-blue-400">•</span>
              <span>
                <span className="font-semibold text-white">Fuel logs</span> —
                fill-up dates, gallons, price per gallon, and odometer readings.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-blue-400">•</span>
              <span>
                <span className="font-semibold text-white">Vehicle &amp; maintenance records</span> —
                vehicle details and service reminders you configure.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-blue-400">•</span>
              <span>
                <span className="font-semibold text-white">Calculated analytics</span> —
                derived metrics such as net profit, cost per mile, and MPG,
                computed from the data above.
              </span>
            </li>
          </ul>
        </section>

        {/* HOW WE USE IT */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-bold text-white">How we use your data</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-emerald-400">✓</span>
              <span>To display your earnings, mileage, and analytics inside the app</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-emerald-400">✓</span>
              <span>To send your magic-link login email when you sign in</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-emerald-400">✓</span>
              <span>To sync your records across devices via your account</span>
            </li>
          </ul>
        </section>

        {/* WHAT WE DON'T DO */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-bold text-white">What we do not do</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-red-400">✕</span>
              <span>We do not sell your data — ever, to anyone</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-red-400">✕</span>
              <span>We do not share your information with third parties for advertising or marketing</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-red-400">✕</span>
              <span>We do not store passwords — authentication is handled via secure magic links only</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-red-400">✕</span>
              <span>We do not collect data beyond what is necessary to provide the service</span>
            </li>
          </ul>
        </section>

        {/* DATA SECURITY */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-bold text-white">Security</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Your data is stored securely using Supabase, a trusted database
            platform with row-level security enforced so that only your
            authenticated account can access your records. Authentication is
            handled via PKCE magic links — no passwords are ever created or
            stored.
          </p>
        </section>

        {/* YOUR RIGHTS */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-bold text-white">Your rights</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            You are in control of your data at all times:
          </p>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-blue-400">•</span>
              <span>You can export a full backup of your records at any time from the Admin page</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-blue-400">•</span>
              <span>You can request complete deletion of your account and all associated data by contacting us</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-blue-400">•</span>
              <span>Your information is kept private and is never shared with third parties without your explicit consent</span>
            </li>
          </ul>
        </section>

        {/* CONTACT */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-bold text-white">Questions</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            If you have any questions about this privacy policy or how your
            data is handled, please reach out through the app.
          </p>
        </section>

        {/* FOOTER LINKS */}
        <div className="flex justify-center gap-4 pb-6 text-xs text-slate-600">
          <Link href="/login" className="hover:text-slate-400">Back to login</Link>
          <Link href="/terms" className="hover:text-slate-400">Terms of Use</Link>
        </div>

      </div>
    </main>
  );
}
