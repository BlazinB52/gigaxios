import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

/* =========================================================
   LANDING PAGE
   ---------------------------------------------------------
   app/(marketing)/page.tsx serves the public marketing
   landing page at /. gigaxios.com displays this marketing site.

   app/(marketing)/layout.tsx provides the marketing layout and
   fonts. Protected application routes live under app/(app)/,
   with the authenticated dashboard served at /dashboard.
   BottomNav exists only within app/(app)/layout.tsx.
   ========================================================= */

export default async function LandingPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components can read cookies for auth, but may not always
            // be able to write refreshed cookies during render.
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const benefits = [
    ["Real profit", "See earnings, fuel, mileage, tips, and expenses together."],
    ["Shift clarity", "Understand which days, apps, and routes are actually worth it."],
    ["Full access", "Use every tracker and insight during your trial."],
  ];

  const pricingPoints = [
    "14-day free trial",
    "No charge today",
    "$3.99/month for your first year",
    "Cancel anytime",
  ];

  return (
    <main className="min-h-screen bg-[#020814] text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(0,102,255,0.36),transparent_32%),radial-gradient(circle_at_15%_30%,rgba(14,165,233,0.18),transparent_26%),linear-gradient(135deg,#020814_0%,#031329_54%,#061a3a_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#020814] to-transparent" />

        <div className="relative mx-auto max-w-7xl px-5 py-6 sm:px-6 lg:px-8">
          <nav className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <Image src="/Full_Logo.png" alt="GigAxios" width={210} height={66} priority />
            </Link>

            <div className="hidden items-center gap-8 text-sm font-semibold text-slate-200 md:flex">
              <a href="#features" className="transition hover:text-white">Features</a>
              <a href="#pricing" className="transition hover:text-white">Pricing</a>
              <a href="#workers" className="transition hover:text-white">For Gig Workers</a>
              <Link href="/login" className="rounded-full bg-blue-500 px-5 py-3 text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400">
                Start free
              </Link>
            </div>
          </nav>

          <div className="grid items-center gap-12 pb-16 pt-14 md:grid-cols-[1.05fr_0.95fr] md:pb-24 md:pt-20">
            <div>
              <p className="inline-flex rounded-full border border-sky-300/30 bg-sky-400/10 px-4 py-2 text-sm font-bold text-sky-200">
                14-day free trial
              </p>

              <h1 className="mt-6 max-w-3xl text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
                Know what you actually make.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">
                GigAxios helps gig workers track earnings, mileage, fuel, tips, and expenses so every shift has a clear bottom line.
              </p>

              <div className="mt-8 grid gap-3 sm:max-w-2xl sm:grid-cols-2">
                {pricingPoints.map((point) => (
                  <div key={point} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold text-slate-100 shadow-lg shadow-black/10">
                    {point}
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link href="/login" className="rounded-2xl bg-blue-500 px-7 py-4 text-center text-base font-extrabold text-white shadow-xl shadow-blue-500/30 transition hover:bg-blue-400">
                  Start your free trial
                </Link>
                <a href="#pricing" className="rounded-2xl border border-white/20 px-7 py-4 text-center text-base font-bold text-slate-100 transition hover:border-sky-300 hover:text-white">
                  View pricing
                </a>
              </div>

              <p className="mt-5 text-sm font-semibold text-slate-300">
                14-day free trial. No charge today. Then $3.99/month for your first year.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-[360px] md:max-w-[430px]">
              <div className="absolute left-1/2 top-1/2 h-[78%] w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.32),transparent_68%)] blur-3xl" />
              <Image
                src="/landing_phone.png"
                alt="GigAxios app dashboard preview"
                width={430}
                height={860}
                priority
                className="relative z-10 h-auto w-full drop-shadow-[0_30px_80px_rgba(37,99,235,0.35)]"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="workers" className="bg-[#f8fbff] px-5 py-14 text-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 md:grid-cols-3">
            {benefits.map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
                <p className="text-lg font-extrabold text-slate-950">{title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </div>

          <div id="features" className="mt-16 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-sm font-extrabold uppercase text-blue-600">Built for gig work</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                Track the numbers that decide your real take-home pay.
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                "Shifts and deliveries",
                "Mileage and fuel",
                "Tips and expenses",
                "Weekly profit insights",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-800 shadow-lg shadow-slate-200/60">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-white px-5 py-16 text-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-sm font-extrabold uppercase text-blue-600">Simple Pricing</p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Start free. Lock in $3.99/month.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              14-day free trial. No charge today. Then $3.99/month for your first year.
            </p>
          </div>

          <div className="rounded-3xl border border-blue-100 bg-[#041227] p-6 text-white shadow-2xl shadow-blue-950/20 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold text-sky-200">Limited Time Offer</p>
                <p className="mt-3 text-sm font-bold text-slate-300">
                  Regular price <span className="line-through">$4.99/month</span>
                </p>
                <p className="mt-2 text-5xl font-extrabold">$3.99<span className="text-lg font-bold text-slate-300">/month</span></p>
              </div>
              <p className="rounded-full bg-blue-500/15 px-4 py-2 text-sm font-bold text-sky-100">
                Full access included
              </p>
            </div>

            <div className="mt-6 space-y-2 text-sm font-bold leading-6 text-slate-200">
              <p>Try GigAxios free first.</p>
              <p>Lock in the discounted rate when you subscribe.</p>
              <p>Cancel anytime.</p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {pricingPoints.map((point) => (
                <div key={point} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-4 text-sm font-bold">
                  {point}
                </div>
              ))}
            </div>

            <Link href="/login" className="mt-8 block rounded-2xl bg-blue-500 px-7 py-4 text-center font-extrabold text-white shadow-xl shadow-blue-500/30 transition hover:bg-blue-400">
              Start your free trial
            </Link>
          </div>
        </div>
      </section>

      <section id="how" className="bg-[#020814] px-5 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/[0.05] p-8 shadow-2xl shadow-black/30 sm:p-10">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-extrabold uppercase text-sky-200">Full access during trial</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl">
                Know what you make before you pay a dollar.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">
                Track every shift free first. After your trial, continue with the limited-time discounted rate of $3.99/month. Regular price is $4.99/month. Cancel anytime.
              </p>
            </div>

            <Link href="/login" className="rounded-2xl bg-blue-500 px-8 py-4 text-center font-extrabold text-white shadow-xl shadow-blue-500/30 transition hover:bg-blue-400">
              Get started
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-[#020814] px-5 pb-10 pt-4 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 border-t border-white/10 pt-10 md:grid-cols-4">
          <div>
            <Image src="/Full_Logo.png" alt="GigAxios" width={180} height={60} />
            <p className="mt-4 text-sm leading-6 text-slate-300">Know what you actually make.</p>
          </div>

          <div>
            <h4 className="font-bold">Quick Links</h4>
            <div className="mt-3 grid gap-2 text-sm text-slate-300">
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms of Service</Link>
            </div>
          </div>

          <div>
            <h4 className="font-bold">Support</h4>
            <div className="mt-3 grid gap-2 text-sm text-slate-300">
              <Link href="/contact">Contact Us</Link>
              <a href="mailto:help@gigaxios.com">help@gigaxios.com</a>
            </div>
          </div>

          <div>
            <h4 className="font-bold">Follow us</h4>
            <a href="https://facebook.com/gigaxios" target="_blank" rel="noopener noreferrer" className="mt-4 block text-sm text-slate-300">
              facebook.com/gigaxios
            </a>
          </div>
        </div>

        <p className="mt-10 text-center text-sm text-slate-400">Copyright 2026 GigAxios. All rights reserved.</p>
      </footer>
    </main>
  );
}
