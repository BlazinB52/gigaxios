/* =========================================================
   TERMS OF USE PAGE
   ---------------------------------------------------------
   Public page — no auth required.
   Outlines the terms under which GigAxios may be used.
   ========================================================= */

import Link from "next/link";

export const metadata = {
  title: "Terms of Use — GigAxios",
};

export default function TermsPage() {
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
            Terms of Use
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Last updated: May 2025
          </p>
        </div>

        {/* INTRO CARD */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm leading-relaxed text-slate-300">
            By using GigAxios, you agree to these terms. Please read them
            carefully. They are written plainly — no legalese.
          </p>
        </section>

        {/* ABOUT THE APP */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-bold text-white">About GigAxios</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            GigAxios is a personal financial and work tracking tool designed
            for gig economy workers. It helps you log shifts, track mileage,
            record fuel costs, manage vehicle maintenance, and understand
            your earnings over time.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            GigAxios is provided for informational and personal tracking
            purposes only. It is not a licensed financial advisor, tax
            advisor, or accounting service. Nothing in the app constitutes
            financial, legal, or tax advice.
          </p>
        </section>

        {/* USER RESPONSIBILITIES */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-bold text-white">Your responsibilities</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-blue-400">•</span>
              <span>
                <span className="font-semibold text-white">Accurate data.</span>{" "}
                You are solely responsible for the accuracy of the information
                you enter into GigAxios. The app calculates metrics based on
                what you provide — garbage in, garbage out.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-blue-400">•</span>
              <span>
                <span className="font-semibold text-white">Age requirement.</span>{" "}
                You must be at least 18 years old to use GigAxios.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-blue-400">•</span>
              <span>
                <span className="font-semibold text-white">Lawful use.</span>{" "}
                You agree to use GigAxios only for lawful personal tracking
                purposes and not to misuse, abuse, or attempt to compromise
                the service or other users&apos; data.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-blue-400">•</span>
              <span>
                <span className="font-semibold text-white">Account security.</span>{" "}
                You are responsible for keeping your email account secure.
                Anyone who can access your magic-link emails can access your
                GigAxios account.
              </span>
            </li>
          </ul>
        </section>

        {/* DISCLAIMER */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-bold text-white">Disclaimer</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            GigAxios is provided &quot;as is&quot; without warranties of any kind,
            express or implied. We do not guarantee that the app will be
            available at all times, error-free, or that the metrics it
            calculates will be suitable for tax filing, legal proceedings,
            or any other formal purpose.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Always consult a qualified tax professional or financial advisor
            for matters related to your income, deductions, or business
            finances.
          </p>
        </section>

        {/* ACCOUNT TERMINATION */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-bold text-white">Account termination</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            We reserve the right to suspend or terminate accounts that
            violate these terms, attempt to misuse the service, or engage
            in activity that could harm GigAxios or other users. You may
            also delete your account at any time by contacting us.
          </p>
        </section>

        {/* CHANGES TO TERMS */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-bold text-white">Changes to these terms</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            We may update these terms from time to time. Continued use of
            GigAxios after changes are posted constitutes acceptance of the
            updated terms. We will update the &quot;Last updated&quot; date at the
            top of this page when changes are made.
          </p>
        </section>

        {/* FOOTER LINKS */}
        <div className="flex justify-center gap-4 pb-6 text-xs text-slate-600">
          <Link href="/login" className="hover:text-slate-400">Back to login</Link>
          <Link href="/privacy" className="hover:text-slate-400">Privacy Policy</Link>
        </div>

      </div>
    </main>
  );
}
