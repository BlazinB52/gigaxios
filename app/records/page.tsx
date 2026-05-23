"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Inter } from "next/font/google";
import { supabase } from "@/app/lib/supabaseClient";
import { loadShiftsFromSupabase } from "@/app/lib/storage";
import { loadFuelEntriesFromSupabase, FuelEntry } from "@/app/lib/fuelStorage";
import { SavedShift, PayPeriod, PayAdjustment } from "@/app/lib/types";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Helpers
function getWeekBounds(offsetWeeks: number): { weekStart: string; weekEnd: string } {
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset + offsetWeeks * 7);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  return { weekStart: fmt(monday), weekEnd: fmt(sunday) };
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(val: number) {
  return val.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type DaySummary = {
  date: string;
  label: string;
  deliveries: number;
  hours: number;
  mileage: number;
  grossPay: number;
  hasData: boolean;
};

export default function RecordsPage() {
  const router = useRouter();

  const [weekOffset, setWeekOffset] = useState(0);
  const [shifts, setShifts] = useState<SavedShift[]>([]);
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);
  const [payPeriod, setPayPeriod] = useState<PayPeriod | null>(null);
  const [adjustments, setAdjustments] = useState<PayAdjustment[]>([]);
  const [loading, setLoading] = useState(true);

  const { weekStart, weekEnd } = getWeekBounds(weekOffset);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const [allShifts, allFuel, periodRes, adjRes] = await Promise.all([
        loadShiftsFromSupabase(user.id),
        loadFuelEntriesFromSupabase(user.id),
        supabase
          .from("pay_periods")
          .select("*")
          .eq("user_id", user.id)
          .eq("week_start", weekStart)
          .maybeSingle(),
        supabase
          .from("pay_adjustments")
          .select("*")
          .eq("user_id", user.id)
          .eq("week_start", weekStart),
      ]);

      setShifts(allShifts);
      setFuelEntries(allFuel);

      if (periodRes.data) {
        const p = periodRes.data;

        setPayPeriod({
          id: p.id,
          userId: p.user_id,
          platform: p.platform,
          weekStart: p.week_start,
          weekEnd: p.week_end,
          basePay: Number(p.base_pay || 0),
          tips: Number(p.tips || 0),
          adjustments: Number(p.adjustments || 0),
          bonuses: Number(p.bonuses || 0),
          reimbursements: Number(p.reimbursements || 0),
          grossPay: Number(p.gross_pay || 0),
          notes: p.notes,
        });
      } else {
        setPayPeriod(null);
      }

      if (adjRes.data) {
        setAdjustments(
          adjRes.data.map((a) => ({
            id: a.id,
            userId: a.user_id,
            platform: a.platform,
            weekStart: a.week_start,
            weekEnd: a.week_end,
            adjustmentType: a.adjustment_type,
            amount: Number(a.amount),
            notes: a.notes,
            createdAt: a.created_at,
          }))
        );
      } else {
        setAdjustments([]);
      }

      setLoading(false);
    }

    load();
  }, [weekOffset, router, weekStart]);

  const weekShifts = shifts.filter((s) => s.date >= weekStart && s.date <= weekEnd);
  const weekFuel = fuelEntries.filter((f) => f.date >= weekStart && f.date <= weekEnd);

  const totalDeliveries = weekShifts.reduce(
    (sum, s) => sum + Number(s.deliveries || 0),
    0
  );

  const totalHours = weekShifts.reduce(
    (sum, s) => sum + Number(s.hoursWorked || 0),
    0
  );

  const totalMileage = weekShifts.reduce(
    (sum, s) =>
      sum + (Number(s.endingMileage || 0) - Number(s.beginningMileage || 0)),
    0
  );

  const totalFuelCost = weekFuel.reduce(
    (sum, f) => sum + Number(f.totalCost || 0),
    0
  );

  const shiftGross = weekShifts.reduce(
    (sum, s) => sum + Number(s.grossPay || 0),
    0
  );

  const shiftBasePay = weekShifts.reduce(
    (sum, s) => sum + Number(s.basePay || 0),
    0
  );

  const shiftTips = weekShifts.reduce(
    (sum, s) => sum + Number(s.tips || 0),
    0
  );

  const displayBasePay = payPeriod ? payPeriod.basePay : shiftBasePay;
  const displayTips = payPeriod ? payPeriod.tips : shiftTips;
  const displayAdjustments = adjustments.reduce((sum, a) => sum + a.amount, 0);
  const displayBonuses = payPeriod ? payPeriod.bonuses : 0;
  const displayReimbursements = payPeriod ? payPeriod.reimbursements : 0;

  const grossEarnings = payPeriod
    ? payPeriod.grossPay
    : shiftGross + displayAdjustments;

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + i);

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  });

  const dailyGross = weekDates.map((date) =>
    shifts
      .filter((s) => s.date === date)
      .reduce((sum, s) => sum + Number(s.grossPay || 0), 0)
  );

  const maxDailyGross = Math.max(...dailyGross, 1);

  const daySummaries: DaySummary[] = weekDates.map((date, i) => {
    const dayShifts = shifts.filter((s) => s.date === date);

    const deliveries = dayShifts.reduce(
      (sum, s) => sum + Number(s.deliveries || 0),
      0
    );

    const hours = dayShifts.reduce(
      (sum, s) => sum + Number(s.hoursWorked || 0),
      0
    );

    const mileage = dayShifts.reduce(
      (sum, s) =>
        sum + (Number(s.endingMileage || 0) - Number(s.beginningMileage || 0)),
      0
    );

    const grossPay = dayShifts.reduce(
      (sum, s) => sum + Number(s.grossPay || 0),
      0
    );

    return {
      date,
      label: DAY_NAMES[i],
      deliveries,
      hours,
      mileage,
      grossPay,
      hasData: dayShifts.length > 0,
    };
  });

  return (
    <main className={`${inter.variable} min-h-screen bg-[#020814] font-sans text-white`}>
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-28 pt-8">
        <header>
          <h1 className="text-[2rem] font-extrabold tracking-tight text-white">
            Records
          </h1>
          <p className="mt-1 text-[0.95rem] font-medium leading-6 text-slate-400">
            Review earnings by pay period
          </p>
        </header>

        <div className="mt-6 rounded-3xl border border-slate-700/70 bg-slate-950/60 p-4 shadow-[0_0_30px_rgba(59,130,246,0.08)]">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-2xl font-medium text-slate-300 active:bg-slate-800"
            >
              ‹
            </button>

            <div className="text-center">
              <p className="text-lg font-extrabold tracking-tight text-slate-50">
                {formatDate(weekStart)} – {formatDate(weekEnd)}
              </p>
              <p className="mt-0.5 text-xs font-medium tracking-wide text-slate-500">
                Pay Period • Mon – Sun
              </p>
            </div>

            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-2xl font-medium text-slate-300 active:bg-slate-800"
            >
              ›
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-blue-500" />
            <p className="text-sm font-medium">Loading pay period…</p>
          </div>
        ) : (
          <>
            <section className="mt-5 rounded-[2rem] border border-blue-500/20 bg-gradient-to-br from-blue-950/80 via-slate-950 to-slate-950 p-5 shadow-[0_0_40px_rgba(37,99,235,0.16)]">
              <p className="text-sm font-semibold tracking-wide text-blue-200/80">
                Gross Earnings
              </p>

              <p className="mt-2 text-5xl font-extrabold tracking-tight text-white">
                {formatCurrency(grossEarnings)}
              </p>

              <div className="mt-5 flex items-end gap-1.5">
                {dailyGross.map((val, i) => {
                  const heightPct = Math.max((val / maxDailyGross) * 100, 4);
                  const isToday =
                    weekDates[i] === new Date().toISOString().slice(0, 10);

                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div className="w-full rounded-sm" style={{ height: 52 }}>
                        <div
                          className={`w-full rounded-md transition-all ${
                            val > 0
                              ? isToday
                                ? "bg-blue-300"
                                : "bg-blue-500"
                              : "bg-slate-800"
                          }`}
                          style={{
                            height: `${heightPct}%`,
                            marginTop: `${100 - heightPct}%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {DAY_LABELS[i]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: "Deliveries", value: totalDeliveries.toString() },
                { label: "Hours", value: totalHours.toFixed(2) },
                { label: "Mileage", value: `${totalMileage} mi` },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-4 text-center"
                >
                  <p className="text-2xl font-extrabold tracking-tight text-white">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {stat.label}
                  </p>
                </div>
              ))}
            </section>

            <section className="mt-4 rounded-[2rem] border border-slate-700/70 bg-slate-900/80 p-5">
              <p className="mb-3 text-base font-bold tracking-tight text-slate-100">
                Earnings Breakdown
              </p>

              {[
                { label: "Base Pay", value: displayBasePay, color: "text-white" },
                { label: "Tips", value: displayTips, color: "text-emerald-300" },
                {
                  label: "Adjustments",
                  value: displayAdjustments,
                  color: "text-blue-300",
                },
                { label: "Bonuses", value: displayBonuses, color: "text-yellow-300" },
                {
                  label: "Reimbursements",
                  value: displayReimbursements,
                  color: "text-purple-300",
                },
                { label: "Fuel Cost", value: -totalFuelCost, color: "text-red-300" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between border-b border-slate-800 py-2.5 last:border-0"
                >
                  <span className="text-sm font-medium text-slate-400">
                    {row.label}
                  </span>
                  <span className={`text-sm font-bold ${row.color}`}>
                    {row.label === "Fuel Cost" && totalFuelCost > 0 ? "−" : ""}
                    {formatCurrency(Math.abs(row.value))}
                  </span>
                </div>
              ))}

              <div className="mt-4 flex items-center justify-between border-t border-slate-700 pt-4">
                <span className="text-base font-extrabold text-white">
                  Gross Earnings
                </span>
                <span className="text-xl font-extrabold tracking-tight text-white">
                  {formatCurrency(grossEarnings)}
                </span>
              </div>
            </section>

            <button
              onClick={() => router.push(`/records/adjustments?week=${weekStart}`)}
              className="mt-4 flex w-full items-center justify-between rounded-3xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 text-left active:bg-blue-500/20"
            >
              <div>
                <p className="text-base font-bold text-blue-200">Adjustments</p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  {adjustments.length} adjustment
                  {adjustments.length !== 1 ? "s" : ""} •{" "}
                  {formatCurrency(displayAdjustments)} this week
                </p>
              </div>
              <span className="text-2xl font-light text-slate-400">›</span>
            </button>

            <section className="mt-4 overflow-hidden rounded-[2rem] border border-slate-700/70 bg-slate-900/80">
              <div className="px-5 pb-3 pt-5">
                <p className="text-base font-bold tracking-tight text-slate-100">
                  Daily Breakdown
                </p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Tap a day to view shifts, fuel, and notes
                </p>
              </div>

              {daySummaries.map((day, i) => (
                <button
                  key={day.date}
                  onClick={() => router.push(`/records/${day.date}`)}
                  className={`flex w-full items-center justify-between px-5 py-4 text-left active:bg-slate-800 ${
                    i < 6 ? "border-b border-slate-800" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12">
                      <p className="text-sm font-extrabold text-slate-200">
                        {day.label}
                      </p>
                      <p className="text-xs font-medium text-slate-600">
                        {new Date(day.date + "T00:00:00").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )}
                      </p>
                    </div>

                    {day.hasData ? (
                      <div>
                        <p className="text-sm font-semibold text-slate-300">
                          {day.deliveries} deliveries
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-slate-500">
                          {day.hours.toFixed(1)} hrs • {day.mileage} mi
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-slate-600">
                        No activity
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-extrabold ${
                        day.hasData ? "text-white" : "text-slate-700"
                      }`}
                    >
                      {day.hasData ? formatCurrency(day.grossPay) : "—"}
                    </span>
                    <span className="text-xl text-slate-600">›</span>
                  </div>
                </button>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}