"use client";

import Image from "next/image";
import Link from "next/link";

/* =========================================================
   LANDING PAGE
   ---------------------------------------------------------
   Public marketing page at /landing — no auth required.
   Sections: Hero → Trust/Workers → Features → Beta CTA → Footer.
   All CTAs point to /login (sign-up page to be built later).
   Fonts (Syne + DM Sans) are loaded in app/landing/layout.tsx.
   ========================================================= */

export default function LandingPage() {

  /* -------------------------------------------------------
     FEATURES DATA
     Rendered as a 6-column card grid in the Features section.
     [emoji, title, description]
     ------------------------------------------------------- */
  const features = [
    ["⏱️", "Shifts", "Log your shifts and see exactly how much time you’re on the road."],
    ["⛽", "Fuel-ups", "Track fuel expenses and see your true cost per mile."],
    ["🚙", "Mileage", "Automatic or manual mileage tracking made easy."],
    ["🛍️", "Deliveries", "Keep tabs on deliveries and orders completed."],
    ["💵", "Tips", "Track tips so nothing you earn gets left behind."],
    ["📊", "Analytics", "Weekly insights that show your real net profit."],
  ];

  return (
    <main className="min-h-screen bg-white text-slate-950">

      {/* =======================================================
          HERO SECTION
          Dark gradient background. Contains: nav, headline,
          beta badge, CTA cards, and phone mockup (desktop only).
         ======================================================= */}
      <section className="relative overflow-hidden bg-[#020814] text-white">

        {/* BACKGROUND GRADIENTS */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(0,102,255,0.28),transparent_35%),linear-gradient(135deg,#020814_0%,#041227_70%,#061a3a_100%)]" />
        <div className="absolute bottom-0 right-0 h-72 w-[55%] rounded-tl-full bg-blue-700/30 blur-sm" />

        <div className="relative mx-auto max-w-7xl px-6 py-8">

          {/* NAV — Logo left, links + CTA right (desktop only) */}
          <nav className="flex items-center justify-between">
            <Link href="/landing" className="flex items-center">
              <Image src="/Full_Logo.png" alt="GigAxios" width={220} height={70} priority />
            </Link>

            <div className="hidden items-center gap-10 text-sm font-semibold md:flex">
              <a href="#features">Features</a>
              <a href="#how">How It Works</a>
              <a href="#workers">For Gig Workers</a>
              <a href="#faq">FAQ</a>
              <Link href="/login" className="rounded-lg bg-blue-600 px-5 py-3 text-white shadow-lg shadow-blue-600/30">
                Join the Beta
              </Link>
            </div>
          </nav>

          {/* HERO CONTENT — two-column on desktop */}
          <div className="grid items-center gap-12 pb-12 pt-20 md:grid-cols-2">

            {/* LEFT COLUMN — headline, sub-copy, beta badge, CTAs */}
            <div>

              {/* HEADLINE */}
              <h1 className="max-w-xl text-5xl font-extrabold leading-tight tracking-tight md:text-7xl">
                Know what you <span className="relative text-blue-500">actually</span> make.
              </h1>

              {/* SUB-HEADLINE */}
              <p className="mt-8 max-w-xl text-2xl leading-relaxed text-slate-200">
                GigAxios is a mobile-first tracker built for gig workers who want to see their real profit —
                not just gross pay.
              </p>

              {/* BETA BADGE */}
              <div className="mt-8 rounded-xl border border-blue-500 bg-blue-950/30 p-5">
                <div className="flex items-center gap-5">
                  <span className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold">BETA</span>
                  <div>
                    <p className="text-xl font-bold text-sky-300">GigAxios is now in beta!</p>
                    <p className="text-sm text-slate-200">
                      We’re actively building and improving based on your feedback.
                    </p>
                  </div>
                </div>
              </div>

              {/* CTA CARDS — Join Beta + Facebook */}
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <Link href="/login" className="rounded-xl bg-blue-600 p-5 shadow-xl shadow-blue-600/25">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">♡</span>
                    <div>
                      <p className="text-lg font-bold">Join the Beta</p>
                      <p className="text-sm text-blue-100">Create your free beta account</p>
                    </div>
                  </div>
                </Link>

                <a
                  href="https://facebook.com/gigaxios"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-slate-400/70 p-5"
                >
                  <div className="flex items-center gap-4">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-2xl text-slate-950">f</span>
                    <div>
                      <p className="text-lg font-bold">Follow us on Facebook</p>
                      <p className="text-sm text-slate-200">facebook.com/gigaxios</p>
                    </div>
                  </div>
                </a>
              </div>

              {/* PRIVACY TRUST LINE */}
              <p className="mt-8 text-slate-300">♧ Your data is private and secure. We never sell your information.</p>
            </div>

            {/* RIGHT COLUMN — App screenshot (desktop only) */}
            <div className="hidden justify-center md:flex">
              <Image
                src="/landing_phone.png"
                alt="GigAxios app screenshot"
                width={340}
                height={680}
                priority
                className="rounded-[3rem] shadow-2xl"
              />
            </div>

          </div>
        </div>
      </section>

      {/* =======================================================
          TRUST + FEATURES SECTION
          White background, rounded top overlaps dark hero.
          Sub-sections: trust cards → features grid → beta CTA.
         ======================================================= */}
      <section id="workers" className="-mt-1 rounded-t-xl bg-white px-6 py-10 shadow-2xl">

        {/* TRUST CARDS — 3-col grid: built for gig workers, privacy, simplicity */}
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {[
            ["🛡️", "Built for gig workers", "Drivers and shoppers using DoorDash, Shipt, Instacart, Uber Eats, GoPuff, and more."],
            ["🔒", "Privacy first", "Your data stays yours. We don’t share or sell your information."],
            ["⚡", "Simple. Fast. Clean.", "Track less. Earn more. Make smarter decisions with clear insights."],
          ].map(([icon, title, body]) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-white p-7 shadow-lg">
              <div className="flex gap-5">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-3xl text-blue-600">{icon}</span>
                <div>
                  <h3 className="font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FEATURES GRID — 6 feature cards from the features array */}
        <div id="features" className="mx-auto mt-14 max-w-7xl text-center">
          <h2 className="text-3xl font-extrabold">Track everything that impacts your bottom line</h2>
          <p className="mt-3 text-lg text-slate-700">
            Get a clear picture of your earnings and expenses in one simple app.
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
            {features.map(([icon, title, body]) => (
              <div key={title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
                <div className="text-5xl text-blue-600">{icon}</div>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">{body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* BETA CTA BLOCK — dark card with Join Beta + Facebook buttons */}
        <div id="how" className="mx-auto mt-12 max-w-7xl rounded-xl bg-[#041227] p-8 text-white">
          <div className="grid items-center gap-8 md:grid-cols-[280px_1fr]">

            {/* DECORATIVE GRAPHIC (desktop only) */}
            <div className="hidden md:block">
              <div className="h-36 rounded-2xl bg-blue-950/70 p-6">
                <div className="h-full rounded-xl bg-gradient-to-tr from-blue-800 to-blue-500" />
              </div>
            </div>

            {/* CTA COPY + BUTTONS */}
            <div>
              <h2 className="text-3xl font-extrabold">Join the beta and help shape the future of GigAxios.</h2>
              <p className="mt-4 max-w-2xl text-slate-200">
                We’re just getting started and your feedback will help us build the best tracker for gig workers.
              </p>
              <div className="mt-6 flex flex-col gap-4 sm:flex-row">
                <Link href="/login" className="rounded-xl bg-blue-600 px-8 py-4 font-bold">
                  Join the Beta
                </Link>
                <a href="https://facebook.com/gigaxios" target="_blank" rel="noopener noreferrer" className="rounded-xl border px-8 py-4 font-bold">
                  Follow us on Facebook
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =======================================================
          FOOTER
          Dark background. Four columns: logo, quick links,
          support, follow us. Copyright bar at the bottom.
         ======================================================= */}
      <footer className="bg-[#020814] px-6 py-10 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-4">

          {/* LOGO + TAGLINE */}
          <div>
            <Image src="/Full_Logo.png" alt="GigAxios" width={180} height={60} />
            <p className="mt-4 text-slate-300">A better way for gig workers to track, analyze, and grow.</p>
          </div>

          {/* QUICK LINKS */}
          <div>
            <h4 className="font-bold">Quick Links</h4>
            <div className="mt-3 grid gap-2 text-sm text-slate-300">
              <a href="#features">Features</a>
              <a href="#how">How It Works</a>
              <a href="#faq">FAQ</a>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms of Service</Link>
            </div>
          </div>

          {/* SUPPORT */}
          <div>
            <h4 className="font-bold">Support</h4>
            <div className="mt-3 grid gap-2 text-slate-300">
              <Link href="/contact">Contact Us</Link>
              <a href="mailto:help@gigaxios.com">help@gigaxios.com</a>
            </div>
          </div>

          {/* SOCIAL */}
          <div>
            <h4 className="font-bold">Follow us</h4>
            <a href="https://facebook.com/gigaxios" target="_blank" rel="noopener noreferrer" className="mt-5 flex items-center gap-3 text-slate-300">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-blue-700">f</span>
              facebook.com/gigaxios
            </a>
          </div>

        </div>

        {/* COPYRIGHT */}
        <p className="mt-10 text-center text-sm text-slate-400">© 2025 GigAxios. All rights reserved.</p>
      </footer>

    </main>
  );
}