"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

export default function UserGuidePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
      } else {
        setLoading(false);
      }
    });
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020814] text-white">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#020814] pb-24 pt-24 text-white">
      <div className="mx-auto max-w-3xl px-5 sm:px-6">

        {/* Header */}
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              User Guide
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Know What You Actually Make — Version 1.0
            </p>
          </div>
          <a
            href="/GigAxios_User_Guide_Professional.pdf"
            download
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500"
          >
            Download PDF
          </a>
        </div>

        {/* Search */}
        <div className="mb-8">
          <input
            type="search"
            placeholder="Search the guide..."
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            onChange={(e) => {
              const val = e.target.value.toLowerCase();
              document.querySelectorAll<HTMLElement>("[data-section]").forEach((el) => {
                el.style.display =
                  !val || el.textContent?.toLowerCase().includes(val) ? "" : "none";
              });
            }}
          />
        </div>

        {/* Table of Contents */}
        <nav className="mb-10 rounded-2xl border border-slate-700 bg-slate-900/50 p-6">
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-widest text-blue-400">
            Contents
          </h2>
          <ol className="space-y-2 text-sm text-slate-300">
            {[
              ["#welcome", "Welcome to GigAxios"],
              ["#getting-started", "Getting Started"],
              ["#starting-shift", "Starting a Shift"],
              ["#ending-shift", "Ending a Shift"],
              ["#fuel", "Logging Fuel Fill-Ups"],
              ["#dashboard", "Understanding the Home Dashboard"],
              ["#records", "Weekly Records"],
              ["#metrics", "Metrics"],
              ["#garage", "Garage"],
              ["#pay", "Pay & Adjustments"],
              ["#export", "Exporting Your Data"],
              ["#settings", "Account Settings"],
              ["#glossary", "Glossary"],
              ["#privacy", "Privacy & Data Ownership"],
              ["#troubleshooting", "Troubleshooting"],
              ["#coming-soon", "Coming Soon"],
            ].map(([href, label]) => (
              <li key={href}>
                <a href={href} className="transition hover:text-white">
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        <div className="space-y-10">

          <section id="welcome" data-section>
            <h2 className="mb-4 text-xl font-extrabold text-white">Welcome to GigAxios</h2>
            <p className="text-sm leading-7 text-slate-300">
              GigAxios is a mobile-first app designed specifically for gig workers who want a clearer picture of what they actually earn after expenses. Instead of focusing only on gross earnings, GigAxios helps you track shifts, fuel, vehicle costs, maintenance, and profitability so you can make informed business decisions.
            </p>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Whether you drive for GoPuff, DoorDash, Uber Eats, Amazon Flex, Shipt, Spark, Instacart, or another platform, GigAxios helps answer one important question: <span className="font-bold text-white">&ldquo;What am I really making?&rdquo;</span>
            </p>
          </section>

          <hr className="border-slate-800" />

          <section id="getting-started" data-section>
            <h2 className="mb-4 text-xl font-extrabold text-white">Getting Started</h2>
            <h3 className="mb-2 font-bold text-blue-400">Sign In Process</h3>
            <ul className="space-y-2 text-sm text-slate-300">
              {["Enter your email address.", "Check your inbox.", "Open the login link sent to your email.", "You will be signed in automatically."].map((item) => (
                <li key={item} className="flex gap-2"><span className="text-blue-400">→</span>{item}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              GigAxios does not require or store passwords. Secure email login links are used to simplify account access and improve security.
            </p>
            <h3 className="mb-2 mt-6 font-bold text-blue-400">Adding Your First Vehicle</h3>
            <p className="mb-3 text-sm text-slate-300">Navigate to <span className="font-bold text-white">Settings → Add Vehicle</span> and enter:</p>
            <ul className="space-y-1 text-sm text-slate-300">
              {["Year", "Make", "Model", "Trim (optional)", "VIN (optional)", "Current odometer"].map((item) => (
                <li key={item} className="flex gap-2"><span className="text-blue-400">→</span>{item}</li>
              ))}
            </ul>
          </section>

          <hr className="border-slate-800" />

          <section id="starting-shift" data-section>
            <h2 className="mb-4 text-xl font-extrabold text-white">Starting a Shift</h2>
            <p className="mb-3 text-sm text-slate-300">Navigate to <span className="font-bold text-white">Shifts</span>. Before beginning work:</p>
            <ul className="space-y-2 text-sm text-slate-300">
              {["Select your vehicle.", "Choose your platform.", "Enter today's date.", "Enter beginning mileage.", "Tap Start Shift."].map((item) => (
                <li key={item} className="flex gap-2"><span className="text-blue-400">→</span>{item}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-400">Supported platforms: GoPuff, DoorDash, Uber Eats, Amazon Flex, Shipt, Other.</p>
            <p className="mt-2 text-sm text-slate-400">Only one active shift can be open at a time.</p>
          </section>

          <hr className="border-slate-800" />

          <section id="ending-shift" data-section>
            <h2 className="mb-4 text-xl font-extrabold text-white">Ending a Shift</h2>
            <p className="mb-3 text-sm text-slate-300">When your workday is complete, open the active shift and enter:</p>
            <ul className="space-y-2 text-sm text-slate-300">
              {["Ending mileage", "Deliveries completed", "Hours worked", "Base Pay", "Tips", "Other Pay"].map((item) => (
                <li key={item} className="flex gap-2"><span className="text-blue-400">→</span>{item}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-400">Tap <span className="font-bold text-white">End Shift</span>. GigAxios automatically calculates total shift earnings.</p>
          </section>

          <hr className="border-slate-800" />

          <section id="fuel" data-section>
            <h2 className="mb-4 text-xl font-extrabold text-white">Logging Fuel Fill-Ups</h2>
            <p className="mb-3 text-sm text-slate-300">Navigate to <span className="font-bold text-white">Fuel</span>. Enter:</p>
            <ul className="space-y-2 text-sm text-slate-300">
              {["Vehicle", "Date", "Odometer", "Gallons Purchased", "Price Per Gallon", "Notes (optional)"].map((item) => (
                <li key={item} className="flex gap-2"><span className="text-blue-400">→</span>{item}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-400">Fuel data helps calculate fuel cost per mile, estimated operating costs, net profit, and vehicle efficiency metrics.</p>
          </section>

          <hr className="border-slate-800" />

          <section id="dashboard" data-section>
            <h2 className="mb-4 text-xl font-extrabold text-white">Understanding the Home Dashboard</h2>
            <p className="mb-4 text-sm text-slate-300">The Home Dashboard gives you a quick overview of your current week. Key metrics:</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Net Profit", "Estimated earnings after fuel costs."],
                ["Gross Earnings", "Total income before expenses."],
                ["Work Miles", "Miles driven during completed shifts."],
                ["Hourly Rate", "Estimated earnings per hour worked."],
                ["Earnings Per Delivery", "Average earnings for each completed delivery."],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                  <p className="font-bold text-white">{title}</p>
                  <p className="mt-1 text-xs text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          <hr className="border-slate-800" />

          <section id="records" data-section>
            <h2 className="mb-4 text-xl font-extrabold text-white">Weekly Records</h2>
            <p className="text-sm leading-7 text-slate-300">Navigate to <span className="font-bold text-white">Records</span>. Records provides a Monday-through-Sunday view of your activity. You can view weekly earnings, review individual shifts, see fuel entries for the week, and track pay adjustments including bonuses and delayed tips.</p>
          </section>

          <hr className="border-slate-800" />

          <section id="metrics" data-section>
            <h2 className="mb-4 text-xl font-extrabold text-white">Metrics</h2>
            <p className="mb-3 text-sm text-slate-300">Navigate to <span className="font-bold text-white">Metrics</span>. The Metrics section provides deeper analysis including:</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Earnings", ["Gross Earnings", "Net Profit", "Hourly Rate", "Per-Delivery Rate"]],
                ["Vehicle Usage", ["Work Miles", "Business Use %", "Average MPG"]],
                ["Cost Analysis", ["Fuel Cost", "Service Cost", "True Cost View"]],
              ].map(([title, items]) => (
                <div key={title as string} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                  <p className="mb-2 font-bold text-blue-400">{title}</p>
                  {(items as string[]).map((item) => (
                    <p key={item} className="text-xs text-slate-300">{item}</p>
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-400">You may filter reports by Year, Vehicle, or All Vehicles.</p>
          </section>

          <hr className="border-slate-800" />

          <section id="garage" data-section>
            <h2 className="mb-4 text-xl font-extrabold text-white">Garage</h2>
            <p className="text-sm leading-7 text-slate-300">Navigate to <span className="font-bold text-white">Garage</span>. The Garage section tracks your vehicle&apos;s service history and upcoming maintenance. Log service entries, set maintenance intervals, and receive reminders when service is due.</p>
          </section>

          <hr className="border-slate-800" />

          <section id="pay" data-section>
            <h2 className="mb-4 text-xl font-extrabold text-white">Pay & Adjustments</h2>
            <p className="text-sm leading-7 text-slate-300">Navigate to <span className="font-bold text-white">Records → Adjustments</span>. Pay Adjustments allow you to record bonuses, reimbursements, delayed tips, corrections, or guarantee payments. Each adjustment is assigned to a specific pay period week.</p>
          </section>

          <hr className="border-slate-800" />

          <section id="export" data-section>
            <h2 className="mb-4 text-xl font-extrabold text-white">Exporting Your Data</h2>
            <p className="mb-3 text-sm text-slate-300">Navigate to <span className="font-bold text-white">Settings → Export My Data</span>. Exports include:</p>
            <ul className="space-y-2 text-sm text-slate-300">
              {["Shifts", "Fuel Entries", "Service Entries", "Maintenance Reminders", "Pay Periods", "Pay Adjustments"].map((item) => (
                <li key={item} className="flex gap-2"><span className="text-blue-400">→</span>{item}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-400">Data is exported as CSV files inside a ZIP archive.</p>
          </section>

          <hr className="border-slate-800" />

          <section id="settings" data-section>
            <h2 className="mb-4 text-xl font-extrabold text-white">Account Settings</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Vehicles", ["Add Vehicle", "Edit Vehicle", "Archive Vehicle", "Set Primary Vehicle"]],
                ["Work Preferences", ["Default Platform"]],
                ["Notifications", ["Maintenance Reminders", "Future Notification Options"]],
                ["Account", ["View Email Address", "Export Data", "Sign Out"]],
              ].map(([title, items]) => (
                <div key={title as string} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                  <p className="mb-2 font-bold text-blue-400">{title}</p>
                  {(items as string[]).map((item) => (
                    <p key={item} className="text-xs text-slate-300">{item}</p>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <hr className="border-slate-800" />

          <section id="glossary" data-section>
            <h2 className="mb-4 text-xl font-extrabold text-white">Glossary</h2>
            <div className="space-y-3">
              {[
                ["Gross Earnings", "Total earnings before expenses."],
                ["Net Profit", "Estimated earnings after costs, especially fuel expenses."],
                ["Base Pay", "Standard compensation paid by the delivery platform."],
                ["Tips", "Customer gratuities."],
                ["Other Pay", "Additional earnings added to a shift."],
                ["Adjustments", "Bonuses, reimbursements, delayed tips, corrections, or guarantee payments."],
                ["Pay Period", "The weekly reporting period running Monday through Sunday."],
                ["Work Miles", "Miles driven while performing gig work."],
                ["Fuel Cost Per Mile", "Estimated fuel cost for each mile driven."],
                ["Business Use Percentage", "The percentage of total vehicle use related to business activity."],
                ["Service Interval", "How often a maintenance item should be completed."],
                ["Maintenance Reminder", "A notification indicating service is due or approaching."],
                ["Primary Vehicle", "The default vehicle used throughout GigAxios."],
                ["Archived Vehicle", "A vehicle removed from active use while preserving historical records."],
              ].map(([term, def]) => (
                <div key={term} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                  <p className="font-bold text-white">{term}</p>
                  <p className="mt-1 text-sm text-slate-400">{def}</p>
                </div>
              ))}
            </div>
          </section>

          <hr className="border-slate-800" />

          <section id="privacy" data-section>
            <h2 className="mb-4 text-xl font-extrabold text-white">Privacy & Data Ownership</h2>
            <p className="text-sm leading-7 text-slate-300">
              GigAxios is designed to help users manage their own business information. Your records remain associated with your account and can be exported at any time using the built-in export tools.
            </p>
          </section>

          <hr className="border-slate-800" />

          <section id="troubleshooting" data-section>
            <h2 className="mb-4 text-xl font-extrabold text-white">Troubleshooting</h2>
            <div className="space-y-4">
              {[
                ["I can't log in.", ["Verify the email address entered.", "Check spam and junk folders.", "Wait a few minutes for the login email to arrive.", "Request a new login link if needed."]],
                ["My dashboard numbers look incorrect.", ["Shifts are properly ended.", "Mileage is entered correctly.", "Fuel entries are current.", "Pay adjustments are assigned to the correct week."]],
                ["A maintenance reminder won't disappear.", ["Confirm the related service record has been entered and then dismiss the reminder from the Maintenance page."]],
              ].map(([question, answers]) => (
                <div key={question as string} className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
                  <p className="font-bold text-white">{question}</p>
                  <ul className="mt-3 space-y-1">
                    {(answers as string[]).map((a) => (
                      <li key={a} className="flex gap-2 text-sm text-slate-300">
                        <span className="text-blue-400">→</span>{a}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <hr className="border-slate-800" />

          <section id="coming-soon" data-section>
            <h2 className="mb-4 text-xl font-extrabold text-white">Coming Soon</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {["Advanced tax reporting", "Weekly summary notifications", "Low fuel alerts", "Overhead expense tracking", "Enhanced business insights", "Additional vehicle analytics"].map((item) => (
                <div key={item} className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-sm font-bold text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-16 border-t border-slate-800 pt-8 text-center">
          <p className="text-sm text-slate-500">GigAxios — Know What You Actually Make.</p>
          <a
            href="/GigAxios_User_Guide_Professional.pdf"
            download
            className="mt-4 inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
          >
            Download PDF Version
          </a>
        </div>

      </div>
    </main>
  );
}
