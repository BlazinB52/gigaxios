"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { loadShiftsFromSupabase } from "@/app/lib/storage";
import { loadFuelEntriesFromSupabase } from "@/app/lib/fuelStorage";
import { SavedShift, PayPeriod, PayAdjustment } from "@/app/lib/types";
import { FuelEntry } from "@/app/lib/fuelStorage";

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseShiftDate(dateStr: string): Date {
  if (!dateStr) return new Date(0);
  if (dateStr.includes("/")) {
    const [month, day, year] = dateStr.split("/");
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
  }
  return new Date(dateStr + "T12:00:00");
}

function toISODate(dateStr: string): string {
  const d = parseShiftDate(dateStr);
  if (d.getTime() === 0) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekBounds(offsetWeeks: number): { weekStart: string; weekEnd: string } {
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset + offsetWeeks * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return { weekStart: fmt(monday), weekEnd: fmt(sunday) };
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(val: number) {
  return val.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── Types ───────────────────────────────────────────────────────────────────

type DaySummary = {
  date: string;
  label: string;
  deliveries: number;
  hours: number;
  mileage: number;
  grossPay: number;
  hasData: boolean;
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function RecordsPage() {
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [shifts, setShifts] = useState<SavedShift[]>([]);
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);
  const [payPeriod, setPayPeriod] = useState<PayPeriod | null>(null);
  const [adjustments, setAdjustments] = useState<PayAdjustment[]>([]);
  const [loading, setLoading] = useState(true);

  const { weekStart, weekEnd } = getWeekBounds(weekOffset);

  // ─── Load Data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

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

  // ─── Derived Data ──────────────────────────────────────────────────────────

  const weekShifts = shifts.filter((s) => {
    const iso = toISODate(s.date);
    return iso >= weekStart && iso <= weekEnd;
  });

  const weekFuel = fuelEntries.filter((f) => {
    const iso = toISODate(f.date);
    return iso >= weekStart && iso <= weekEnd;
  });

  const totalDeliveries = weekShifts.reduce((sum, s) => sum + Number(s.deliveries || 0), 0);
  const totalHours = weekShifts.reduce((sum, s) => sum + Number(s.hoursWorked || 0), 0);
  const totalMileage = weekShifts.reduce(
    (sum, s) => sum + (Number(s.endingMileage || 0) - Number(s.beginningMileage || 0)),
    0
  );
  const totalFuelCost = weekFuel.reduce((sum, f) => sum + Number(f.totalCost || 0), 0);

  // Gross from shifts (operational)
  const shiftGross = weekShifts.reduce((sum, s) => sum + Number(s.grossPay || 0), 0);
  const shiftBasePay = weekShifts.reduce((sum, s) => sum + Number(s.basePay || 0), 0);
  const shiftTips = weekShifts.reduce((sum, s) => sum + Number(s.tips || 0), 0);

  // Settlement layer (pay period overrides if exists)
  const displayBasePay = payPeriod ? payPeriod.basePay : shiftBasePay;
  const displayTips = payPeriod ? payPeriod.tips : shiftTips;
  const displayAdjustments = adjustments.reduce((sum, a) => sum + a.amount, 0);
  const displayBonuses = payPeriod ? payPeriod.bonuses : 0;
  const displayReimbursements = payPeriod ? payPeriod.reimbursements : 0;
  const grossEarnings = payPeriod
    ? payPeriod.grossPay
    : shiftGross + displayAdjustments;

  // Bar chart data — daily gross per day of week
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const dailyGross = weekDates.map((date) =>
    shifts
      .filter((s) => toISODate(s.date) === date)
      .reduce((sum, s) => sum + Number(s.grossPay || 0), 0)
  );

  const maxDailyGross = Math.max(...dailyGross, 1);

  // Daily breakdown rows
  const daySummaries: DaySummary[] = weekDates.map((date, i) => {
    const dayShifts = shifts.filter((s) => toISODate(s.date) === date);
    const deliveries = dayShifts.reduce((sum, s) => sum + Number(s.deliveries || 0), 0);
    const hours = dayShifts.reduce((sum, s) => sum + Number(s.hoursWorked || 0), 0);
    const mileage = dayShifts.reduce(
      (sum, s) => sum + (Number(s.endingMileage || 0) - Number(s.beginningMileage || 0)),
      0
    );
    const grossPay = dayShifts.reduce((sum, s) => sum + Number(s.grossPay || 0), 0);
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

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#020814] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-28 pt-8">

        {/* Header 
        <h1 className="text-4xl font-bold tracking-tight">Records</h1>
        <p className="mt-1 text-sm text-slate-400">Weekly pay period view</p>
         */}

        {/* Week Selector */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 text-2xl text-slate-400 active:bg-slate-800"
          >
            ‹
          </button>

          <div className="text-center">
            <p className="text-lg font-bold text-slate-100">
              {formatDate(weekStart)} – {formatDate(weekEnd)}
            </p>
            <p className="text-xs text-slate-500">Pay Period • Mon – Sun</p>
          </div>

          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 text-2xl text-slate-400 active:bg-slate-800"
          >
            ›
          </button>
        </div>

        {loading ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-blue-500" />
            <p className="text-sm">Loading pay period…</p>
          </div>
        ) : (
          <>
            {/* ── Hero Card ── */}
            <section className="mt-5 rounded-3xl border border-slate-700/60 bg-slate-900/80 p-5">
              <div className="flex items-end gap-4">
                {/* Left: earnings info */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-400">Gross Earnings</p>
                  <p className="mt-1 text-4xl font-bold tracking-tight text-white">
                    {formatCurrency(grossEarnings)}
                  </p>
                  {/* Week-over-week badge — derived inline from all-shifts state */}
                  {(() => {
                    const { weekStart: ps, weekEnd: pe } = getWeekBounds(weekOffset - 1);
                    const prev = shifts
                      .filter((s) => { const iso = toISODate(s.date); return iso >= ps && iso <= pe; })
                      .reduce((sum, s) => sum + Number(s.grossPay || 0), 0);
                    if (prev === 0) return null;
                    const pct = ((grossEarnings - prev) / prev) * 100;
                    const up = pct >= 0;
                    return (
                      <span className={`mt-2 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${up ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        {up ? "↑" : "↓"} {Math.abs(pct).toFixed(0)}% vs last week
                      </span>
                    );
                  })()}
                </div>

                {/* Right: mini bar chart */}
                <div className="flex shrink-0 items-end gap-1">
                  {dailyGross.map((val, i) => {
                    const heightPct = Math.max((val / maxDailyGross) * 100, 5);
                    const isToday = weekDates[i] === new Date().toISOString().slice(0, 10);
                    return (
                      <div key={i} className="flex flex-col items-center gap-0.5">
                        <div className="flex w-3 items-end" style={{ height: 44 }}>
                          <div
                            className={`w-full rounded-t-sm transition-all ${
                              val > 0
                                ? isToday
                                  ? "bg-blue-400"
                                  : "bg-blue-600"
                                : "bg-slate-800"
                            }`}
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-medium text-slate-600">
                          {DAY_LABELS[i]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* ── Stats Grid ── */}
            <section className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: "Deliveries", value: totalDeliveries.toString() },
                { label: "Hours", value: totalHours.toFixed(2) },
                { label: "Mileage", value: `${totalMileage} mi` },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-3 text-center"
                >
                  <p className="text-xl font-bold text-white">{stat.value}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{stat.label}</p>
                </div>
              ))}
            </section>

            {/* ── Earnings Breakdown ── */}
            <section className="mt-4 rounded-3xl border border-slate-700/60 bg-slate-900/80 p-5">
              <p className="mb-3 text-sm font-bold text-slate-300">Earnings Breakdown</p>

              {[
                { label: "Base Pay", value: displayBasePay, color: "text-white" },
                { label: "Tips", value: displayTips, color: "text-emerald-400" },
                { label: "Adjustments", value: displayAdjustments, color: "text-blue-400" },
                { label: "Bonuses", value: displayBonuses, color: "text-yellow-400" },
                { label: "Reimbursements", value: displayReimbursements, color: "text-purple-400" },
                { label: "Fuel Cost", value: -totalFuelCost, color: "text-red-400" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                  <span className="text-sm text-slate-400">{row.label}</span>
                  <span className={`text-sm font-semibold ${row.color}`}>
                    {row.label === "Fuel Cost" && totalFuelCost > 0 ? "−" : ""}
                    {formatCurrency(Math.abs(row.value))}
                  </span>
                </div>
              ))}

              <div className="mt-3 flex items-center justify-between">
                <span className="font-bold text-white">Gross Earnings</span>
                <span className="text-lg font-bold text-white">{formatCurrency(grossEarnings)}</span>
              </div>
            </section>

            {/* ── Adjustments Button ── */}
            <button
              onClick={() => router.push(`/records/adjustments?week=${weekStart}`)}
              className="mt-4 flex w-full items-center justify-between rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 text-left active:bg-blue-500/20"
            >
              <div>
                <p className="font-semibold text-blue-300">Adjustments</p>
                <p className="text-xs text-slate-500">
                  {adjustments.length} adjustment{adjustments.length !== 1 ? "s" : ""} •{" "}
                  {formatCurrency(displayAdjustments)} this week
                </p>
              </div>
              <span className="text-xl text-slate-400">›</span>
            </button>

            {/* ── Daily Breakdown ── */}
            <section className="mt-4 rounded-3xl border border-slate-700/60 bg-slate-900/80 overflow-hidden">
              <p className="px-5 pt-5 pb-3 text-sm font-bold text-slate-300">Daily Breakdown</p>

              {daySummaries.map((day, i) => (
                <button
                  key={day.date}
                  onClick={() => router.push(`/records/${day.date}`)}
                  className={`flex w-full items-center justify-between px-5 py-4 text-left active:bg-slate-800 ${
                    i < 6 ? "border-b border-slate-800" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10">
                      <p className="text-sm font-bold text-slate-300">{day.label}</p>
                      <p className="text-xs text-slate-600">
                        {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    {day.hasData ? (
                      <div>
                        <p className="text-xs text-slate-400">
                          {day.deliveries} deliveries • {day.hours.toFixed(1)} hrs
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600">No activity</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${day.hasData ? "text-white" : "text-slate-700"}`}>
                      {day.hasData ? formatCurrency(day.grossPay) : "—"}
                    </span>
                    <span className="text-slate-600">›</span>
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