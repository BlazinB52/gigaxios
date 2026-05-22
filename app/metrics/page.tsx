"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { SavedShift } from "@/app/lib/types";
import { FuelEntry, loadFuelEntriesFromSupabase } from "@/app/lib/fuelStorage";
import { loadShiftsFromSupabase } from "@/app/lib/storage";
import {
  ServiceEntry,
  loadServiceEntriesFromSupabase,
} from "@/app/lib/garageStorage";
import BottomNav from "../components/BottomNav";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) => (n * 100).toFixed(1) + "%";
const fmtDollar = (n: number) => "$" + fmt(n);

function parseShiftDate(dateStr: string): Date {
  if (!dateStr) return new Date(0);
  if (dateStr.includes("/")) {
    const [month, day, year] = dateStr.split("/");
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
  }
  return new Date(dateStr + "T12:00:00");
}

export default function MetricsPage() {
  const router = useRouter();

  const [shifts, setShifts] = useState<SavedShift[]>([]);
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);
  const [serviceEntries, setServiceEntries] = useState<ServiceEntry[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const [s, f, sv] = await Promise.all([
        loadShiftsFromSupabase(user.id),
        loadFuelEntriesFromSupabase(user.id),
        loadServiceEntriesFromSupabase(user.id),
      ]);

      setShifts(s as SavedShift[]);
      setFuelEntries(f);
      setServiceEntries(sv);
      console.log("[metrics] shifts loaded:", s.length);
      console.log("[metrics] fuel loaded:", f.length);
      console.log("[metrics] earliest shift:", s[s.length - 1]?.date);
      console.log("[metrics] latest shift:", s[0]?.date);
      setIsLoaded(true);
    }

    load();
  }, [router]);

  const availableYears = useMemo(() => {
    const years = [
      ...new Set(shifts.map((s) => parseShiftDate(s.date).getFullYear())),
    ].sort((a, b) => b - a);
    const currentYear = new Date().getFullYear();
    if (!years.includes(currentYear)) return [currentYear, ...years];
    return years;
  }, [shifts]);

  const metrics = useMemo(() => {
    const yearShifts = shifts.filter(
      (s) => parseShiftDate(s.date).getFullYear() === selectedYear
    );
    const yearFuel = fuelEntries.filter(
      (f) => parseShiftDate(f.date).getFullYear() === selectedYear
    );
    const yearServices = serviceEntries.filter(
      (sv) => parseShiftDate(sv.date).getFullYear() === selectedYear
    );

    const totalDeliveries = yearShifts.reduce((s, x) => s + Number(x.deliveries || 0), 0);
    const totalHours = yearShifts.reduce((s, x) => s + Number(x.hoursWorked || 0), 0);
    const totalGrossPay = yearShifts.reduce((s, x) => s + Number(x.grossPay || 0), 0);
    const totalFuelCost = yearFuel.reduce((s, x) => s + Number(x.totalCost || 0), 0);

    const totalShiftMiles = yearShifts.reduce((sum, s) => {
      const begin = Number(s.beginningMileage);
      const end = Number(s.endingMileage);
      return begin > 0 && end > begin ? sum + (end - begin) : sum;
    }, 0);

    const sortedFuel = [...yearFuel].sort(
      (a, b) => parseShiftDate(a.date).getTime() - parseShiftDate(b.date).getTime()
    );
    let totalMilesDriven = 0;
    if (sortedFuel.length >= 2) {
      const firstOdo = Number(sortedFuel[0].odometer);
      const lastOdo = Number(sortedFuel[sortedFuel.length - 1].odometer);
      if (lastOdo > firstOdo) totalMilesDriven = lastOdo - firstOdo;
    } else if (totalShiftMiles > 0) {
      totalMilesDriven = totalShiftMiles;
    }

    const businessUsePct =
      totalShiftMiles > 0 && totalMilesDriven > 0
        ? Math.min(totalShiftMiles / totalMilesDriven, 1)
        : 0;

    const fuelCostPerMile = totalMilesDriven > 0 ? totalFuelCost / totalMilesDriven : 0;
    const workFuelCost = totalShiftMiles * fuelCostPerMile;

    const netProfit = totalGrossPay - workFuelCost;
    const netProfitPct = totalGrossPay > 0 ? netProfit / totalGrossPay : 0;
    const fuelPct = totalGrossPay > 0 ? workFuelCost / totalGrossPay : 0;

    const hourlyRate = totalHours > 0 ? netProfit / totalHours : 0;
    const profitPerDelivery = totalDeliveries > 0 ? netProfit / totalDeliveries : 0;

    const yearServiceCost = yearServices.reduce((s, x) => s + Number(x.cost || 0), 0);
    const businessServiceCost = yearServiceCost * businessUsePct;
    const trueNetProfit = netProfit - businessServiceCost;
    const trueNetPct = totalGrossPay > 0 ? trueNetProfit / totalGrossPay : 0;
    const serviceCostPct = totalGrossPay > 0 ? businessServiceCost / totalGrossPay : 0;

    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthlyData = MONTHS.map((month, i) => {
      const mShifts = yearShifts.filter(
        (s) => parseShiftDate(s.date).getMonth() === i
      );
      const mFuel = yearFuel.filter(
        (f) => parseShiftDate(f.date).getMonth() === i
      );
      const gross = mShifts.reduce((sum, s) => sum + Number(s.grossPay || 0), 0);
      const mShiftMiles = mShifts.reduce((sum, s) => {
        const begin = Number(s.beginningMileage);
        const end = Number(s.endingMileage);
        return begin > 0 && end > begin ? sum + (end - begin) : sum;
      }, 0);
      const mFuelCostTotal = mFuel.reduce((sum, f) => sum + Number(f.totalCost || 0), 0);
      const _ = mFuelCostTotal; void _;
      const mWorkFuel = mShiftMiles * fuelCostPerMile;
      const net = Math.max(gross - mWorkFuel, 0);
      return { month, grossPay: gross, netProfit: net, hasData: mShifts.length > 0 };
    }).filter((m) => m.hasData);

    const maxMonthlyValue = Math.max(...monthlyData.map((m) => m.grossPay), 1);

    return {
      totalDeliveries, totalHours, totalGrossPay, totalFuelCost,
      totalShiftMiles, totalMilesDriven, businessUsePct,
      workFuelCost, netProfit, netProfitPct, fuelPct,
      hourlyRate, profitPerDelivery,
      yearServiceCost, businessServiceCost, trueNetProfit, trueNetPct, serviceCostPct,
      monthlyData, maxMonthlyValue,
      hasData: yearShifts.length > 0,
    };
  }, [shifts, fuelEntries, serviceEntries, selectedYear]);

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020814] text-white">
        <p className="text-slate-400">Loading metrics…</p>
      </main>
    );
  }

  const {
    totalDeliveries, totalHours, totalGrossPay,
    totalShiftMiles, totalMilesDriven, businessUsePct,
    workFuelCost, netProfit, netProfitPct, fuelPct,
    profitPerDelivery,
    yearServiceCost, businessServiceCost, trueNetProfit, trueNetPct,
    monthlyData, maxMonthlyValue,
    hasData,
  } = metrics;

  return (
    <main className="min-h-screen bg-[#020814] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-24 pt-8">

        {/* HEADER */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Metrics</h1>
          <p className="mt-2 text-base text-slate-400">Your earnings. Your truth.</p>
        </div>

        {/* YEAR SELECTOR */}
        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm text-slate-400">Viewing:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </div>

        {!hasData ? (
          <div className="mt-16 text-center">
            <p className="text-slate-500">No data for {selectedYear}.</p>
          </div>
        ) : (
          <>
            {/* ── SECTION 1: KPI GRID ── */}
            <div className="relative mt-6">
              <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-blue-500" />
              <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-lg">📊</span>
                  <h2 className="text-lg font-bold">Overview</h2>
                  <span className="ml-1 rounded-full bg-blue-950 px-2 py-0.5 text-xs text-blue-400">
                    {selectedYear}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Deliveries",    value: totalDeliveries.toLocaleString(),    sub: "Total" },
                    { label: "Hours Worked",  value: totalHours.toFixed(2),               sub: "Total" },
                    { label: "Gross Pay",     value: fmtDollar(totalGrossPay),            sub: "Total" },
                    { label: "Fuel Cost",     value: fmtDollar(workFuelCost),             sub: "Work miles only" },
                    { label: "Net Profit",    value: fmtDollar(netProfit),                sub: "After fuel",  emerald: true },
                    { label: "Per Delivery",  value: fmtDollar(profitPerDelivery),        sub: "Average" },
                  ].map(({ label, value, sub, emerald }) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                    >
                      <p className="mb-1 text-xs text-slate-400">{label}</p>
                      <p className={`text-2xl font-bold ${emerald ? "text-emerald-400" : "text-white"}`}>
                        {value}
                      </p>
                      <p className="text-xs text-slate-500">{sub}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* ── SECTION 2: RETENTION BAR ── */}
            <div className="relative mt-6">
              <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-emerald-500" />
              <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">
                <p className="text-sm text-slate-400">You keep</p>
                <p className="text-4xl font-bold text-emerald-400">{fmtPct(netProfitPct)}</p>
                <p className="mt-0.5 text-sm text-slate-400">of what you earn (after fuel)</p>

                <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${Math.max(0, Math.min(netProfitPct * 100, 100))}%` }}
                  />
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-400">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                      Net Profit
                    </span>
                    <span className="text-emerald-400">
                      {fmtDollar(netProfit)}{" "}
                      <span className="text-slate-500">({fmtPct(netProfitPct)})</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-400">
                      <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
                      Fuel Cost
                    </span>
                    <span className="text-blue-400">
                      {fmtDollar(workFuelCost)}{" "}
                      <span className="text-slate-500">({fmtPct(fuelPct)})</span>
                    </span>
                  </div>
                </div>
              </section>
            </div>

            {/* ── SECTION 3: MONTHLY CHART ── */}
            {monthlyData.length > 0 && (
              <div className="relative mt-6">
                <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-purple-500" />
                <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">
                  <div className="mb-5 flex items-center gap-2">
                    <h2 className="text-lg font-bold">Monthly Breakdown</h2>
                    <span className="rounded-full bg-purple-950 px-2 py-0.5 text-xs text-purple-400">
                      {selectedYear}
                    </span>
                  </div>

                  <div className="flex items-end gap-2 overflow-x-auto pb-2">
                    {monthlyData.map((m) => {
                      const grossH = Math.max(
                        Math.round((m.grossPay / maxMonthlyValue) * 80),
                        2
                      );
                      const netH = Math.max(
                        Math.round((m.netProfit / maxMonthlyValue) * 80),
                        2
                      );
                      return (
                        <div key={m.month} className="flex flex-col items-center gap-1">
                          <div
                            className="flex items-end gap-0.5"
                            style={{ height: "80px" }}
                          >
                            <div
                              className="w-4 rounded-t-sm bg-slate-600"
                              style={{ height: `${grossH}px` }}
                            />
                            <div
                              className="w-4 rounded-t-sm bg-emerald-500"
                              style={{ height: `${netH}px` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400">{m.month}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="inline-block h-2 w-4 rounded-sm bg-slate-600" />
                      Gross Pay
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="inline-block h-2 w-4 rounded-sm bg-emerald-500" />
                      Net Profit
                    </span>
                  </div>
                </section>
              </div>
            )}

            {/* ── SECTION 4: TRUE COST VIEW ── */}
            <div className="relative mt-6">
              <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-amber-500" />
              <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  <h2 className="text-lg font-bold">True Cost View</h2>
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  Full picture including vehicle maintenance. Scroll here when you&apos;re ready for the complete truth.
                </p>

                <div className="my-4 border-t border-slate-800" />

                {businessUsePct === 0 ? (
                  <p className="text-center text-sm text-slate-500">
                    Add fuel entries and shift mileage to unlock this view.
                  </p>
                ) : (
                  <>
                    {/* Business use */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300">Business Use</span>
                        <span className="font-semibold text-blue-400">{fmtPct(businessUsePct)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {totalShiftMiles.toLocaleString()} work mi /{" "}
                        {totalMilesDriven.toLocaleString()} total mi
                      </p>
                    </div>

                    <div className="mt-4 border-t border-slate-800 pt-4">
                      {/* Cost breakdown */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-300">Gross Pay</span>
                          <span className="text-sm text-white">{fmtDollar(totalGrossPay)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-300">− Work Fuel Cost</span>
                          <span className="text-sm text-red-400">−{fmtDollar(workFuelCost)}</span>
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-300">− Service (your share)</span>
                            <span className="text-sm text-red-400">−{fmtDollar(businessServiceCost)}</span>
                          </div>
                          <p className="mt-0.5 text-right text-xs text-slate-500">
                            ${yearServiceCost.toFixed(2)} total × {(businessUsePct * 100).toFixed(1)}% business use
                          </p>
                        </div>

                        <div className="border-t border-slate-800 pt-3">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-200">True Net Profit</span>
                            <span className="text-xl font-bold text-emerald-400">
                              {fmtDollar(trueNetProfit)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* True retention bar */}
                      <div className="mt-5">
                        <p className="mb-2 text-sm text-slate-300">
                          You truly keep{" "}
                          <span className="font-semibold text-emerald-400">{fmtPct(trueNetPct)}</span>
                        </p>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                            style={{ width: `${Math.max(0, Math.min(trueNetPct * 100, 100))}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-slate-500">
                          vs {fmtPct(netProfitPct)} fuel-only view
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </div>
          </>
        )}

      </div>
      <BottomNav />
    </main>
  );
}
