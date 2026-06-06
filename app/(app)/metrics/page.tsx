"use client";

/* =========================================================
   METRICS PAGE
   ---------------------------------------------------------
   Full earnings analytics for a selected calendar year.
   Pulls shifts, fuel entries, service entries, and pay
   adjustments from Supabase, then computes:
     • KPI overview (deliveries, hours, gross, fuel, net)
     • Retention percentage bar
     • Monthly gross vs net bar chart
     • True Cost View (includes vehicle maintenance share)
   ========================================================= */

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { SavedShift } from "@/app/lib/types";
import { FuelEntry, loadFuelEntriesFromSupabase } from "@/app/lib/fuelStorage";
import { calculateWorkFuelCost } from "@/app/lib/fuelCost";
import { loadShiftsFromSupabase } from "@/app/lib/storage";
import {
  ServiceEntry,
  ServiceInterval,
  loadServiceEntriesFromSupabase,
  loadServiceIntervalsFromSupabase,
} from "@/app/lib/garageStorage";
import BottomNav from "@/app/components/BottomNav";

/* =========================================================
   FORMATTING HELPERS
   ========================================================= */

/** Formats a number to 2 decimal places with thousands commas */
const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Formats a 0–1 ratio as a percentage string, e.g. 0.823 → "82.3%" */
const fmtPct = (n: number) => (n * 100).toFixed(1) + "%";

/** Formats a number as a dollar string, e.g. 123.4 → "$123.40" */
const fmtDollar = (n: number) => "$" + fmt(n);

function parseOptionalDateTime(value: string | undefined): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/* =========================================================
   DATE PARSING
   Handles both MM/DD/YYYY (legacy) and YYYY-MM-DD formats.
   Noon time prevents timezone-offset edge cases.
   ========================================================= */

function parseShiftDate(dateStr: string): Date {
  if (!dateStr) return new Date(0);
  if (dateStr.includes("/")) {
    const [month, day, year] = dateStr.split("/");
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
  }
  return new Date(dateStr + "T12:00:00");
}

/* =========================================================
   BUSINESS USE PERCENTAGE
   Returns the fraction of total miles driven that were for
   work.  Capped at 1.0 — can't be more than 100% business.
   ========================================================= */

function getWorkMilePercentage(workMiles: number, totalOdometerMiles: number): number {
  if (totalOdometerMiles <= 0) return 0;
  return workMiles / totalOdometerMiles;
}

function normalizeServiceType(serviceType: string): string {
  return serviceType.trim().toLowerCase();
}

function getMatchingServiceInterval(
  service: ServiceEntry,
  intervals: ServiceInterval[]
): ServiceInterval | null {
  const serviceType = normalizeServiceType(service.serviceType);
  const vehicleMatch = intervals.find(
    (interval) =>
      normalizeServiceType(interval.serviceType) === serviceType &&
      interval.vehicleId === service.vehicleId
  );

  if (vehicleMatch) return vehicleMatch;

  return intervals.find(
    (interval) =>
      normalizeServiceType(interval.serviceType) === serviceType &&
      interval.vehicleId === null
  ) ?? null;
}

function getServiceIntervalMileage(
  service: ServiceEntry,
  intervals: ServiceInterval[]
): number | null {
  const intervalMiles = Number(getMatchingServiceInterval(service, intervals)?.intervalMiles);
  if (Number.isFinite(intervalMiles) && intervalMiles > 0) return intervalMiles;
  if (normalizeServiceType(service.serviceType) === "tires") return 50000;
  return null;
}

function getWorkMilesSinceService(service: ServiceEntry, shifts: SavedShift[]): number {
  const serviceDate = parseShiftDate(service.date).getTime();
  const serviceOdometer = Number(service.odometer);
  const hasServiceOdometer = Number.isFinite(serviceOdometer) && serviceOdometer > 0;

  return shifts.reduce((sum, shift) => {
    const shiftDate = parseShiftDate(shift.date).getTime();
    if (shiftDate < serviceDate) return sum;

    const begin = Number(shift.beginningMileage);
    const end = Number(shift.endingMileage);
    if (!(begin > 0 && end > begin)) return sum;
    if (hasServiceOdometer && end <= serviceOdometer) return sum;

    const effectiveBegin = hasServiceOdometer ? Math.max(begin, serviceOdometer) : begin;
    return sum + Math.max(0, end - effectiveBegin);
  }, 0);
}

/* =========================================================
   METRICS PAGE COMPONENT
   ========================================================= */

export default function MetricsPage() {
  const router = useRouter();

  /* =========================================================
     STATE VARIABLES
     ========================================================= */

  const [shifts, setShifts] = useState<SavedShift[]>([]);
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);
  const [serviceEntries, setServiceEntries] = useState<ServiceEntry[]>([]);
  const [serviceIntervals, setServiceIntervals] = useState<ServiceInterval[]>([]);
  const [adjustments, setAdjustments] = useState<{ amount: number; week_start: string }[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isLoaded, setIsLoaded] = useState(false);
  const [vehicles, setVehicles] = useState<Array<{
    id: string;
    year: string;
    make: string;
    model: string;
    is_primary: boolean;
  }>>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("all");

  /* =========================================================
     DATA LOADING
     Fetches all four data sources in parallel.  isLoaded
     gates the loading spinner so the page doesn't flash
     empty before data arrives.
     ========================================================= */

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const [s, f, sv, intervals, adjRes, vRes] = await Promise.all([
          loadShiftsFromSupabase(user.id),
          loadFuelEntriesFromSupabase(user.id),
          loadServiceEntriesFromSupabase(user.id),
          loadServiceIntervalsFromSupabase(user.id),
          supabase.from("pay_adjustments").select("amount, week_start").eq("user_id", user.id),
          supabase
            .from("vehicles")
            .select("id, year, make, model, is_primary, status")
            .eq("user_id", user.id)
            .eq("status", "active")
            .order("is_primary", { ascending: false }),
        ]);

        setShifts(s as SavedShift[]);
        setFuelEntries(f);
        setServiceEntries(sv);
        setServiceIntervals(intervals);
        setAdjustments((adjRes.data ?? []) as { amount: number; week_start: string }[]);
        const vehicleData = vRes.data || [];
        setVehicles(vehicleData);
        const primary = vehicleData.find((v: { is_primary: boolean }) => v.is_primary);
        setSelectedVehicleId(primary?.id || "all");
      } finally {
        setIsLoaded(true);
      }
    }

    load();
  }, [router]);

  /* =========================================================
     AVAILABLE YEARS
     Derived from shift dates — always includes the current
     year even if no data exists for it yet.
     ========================================================= */

  const availableYears = useMemo(() => {
    const filtered = selectedVehicleId === "all"
      ? shifts
      : shifts.filter((s) => s.vehicleId === selectedVehicleId);
    const years = [
      ...new Set(filtered.map((s) => parseShiftDate(s.date).getFullYear())),
    ].sort((a, b) => b - a);
    const currentYear = new Date().getFullYear();
    if (!years.includes(currentYear)) return [currentYear, ...years];
    return years;
  }, [shifts, selectedVehicleId]);

  /* =========================================================
     METRICS COMPUTATION
     All calculations are memoized and re-run whenever the
     selected year or any data source changes.
     ========================================================= */

  const metrics = useMemo(() => {

    /* Filter by vehicle first (when not "all"), then by year */
    const vehicleShifts = selectedVehicleId === "all" ? shifts : shifts.filter((s) => s.vehicleId === selectedVehicleId);
    const vehicleFuel = selectedVehicleId === "all" ? fuelEntries : fuelEntries.filter((f) => f.vehicleId === selectedVehicleId);
    const vehicleServices = selectedVehicleId === "all" ? serviceEntries : serviceEntries.filter((sv) => sv.vehicleId === selectedVehicleId);

    const yearShifts = vehicleShifts.filter(
      (s) => parseShiftDate(s.date).getFullYear() === selectedYear
    );
    const yearFuel = vehicleFuel.filter(
      (f) => parseShiftDate(f.date).getFullYear() === selectedYear
    );
    const yearServices = vehicleServices.filter(
      (sv) => parseShiftDate(sv.date).getFullYear() === selectedYear
    );
    const completedYearShifts = yearShifts.filter((shift) => shift.status === "closed");

    /* Pay adjustments (MGA, bonuses, etc.) — excluded when vehicle has no shifts,
       since adjustments are driver-level and cannot be attributed to a specific vehicle */
    const yearAdjustments = adjustments.filter(
      (a) => new Date(a.week_start + "T12:00:00").getFullYear() === selectedYear
    );
    const totalAdjustments = vehicleShifts.length === 0
      ? 0
      : yearAdjustments.reduce((sum, a) => sum + Number(a.amount || 0), 0);

    /* Basic shift totals */
    const totalDeliveries = completedYearShifts.reduce((s, x) => s + Number(x.deliveries || 0), 0);
    const totalHours = completedYearShifts.reduce((s, x) => s + Number(x.hoursWorked || 0), 0);
    const shiftGrossPay = completedYearShifts.reduce((s, x) => s + Number(x.grossPay || 0), 0);
    const totalGrossPay = shiftGrossPay + totalAdjustments;
    const totalFuelCost = yearFuel.reduce((s, x) => s + Number(x.totalCost || 0), 0);

    /* Work miles — difference between ending and beginning mileage per shift */
    const totalShiftMiles = completedYearShifts.reduce((sum, s) => {
      const begin = Number(s.beginningMileage);
      const end = Number(s.endingMileage);
      return begin > 0 && end > begin ? sum + (end - begin) : sum;
    }, 0);

    /* Total miles driven — first to last odometer reading from fuel entries. */
    const sortedFuel = [...yearFuel].sort((a, b) => {
      const dateDiff = parseShiftDate(a.date).getTime() - parseShiftDate(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;

      const odometerDiff = Number(a.odometer || 0) - Number(b.odometer || 0);
      if (odometerDiff !== 0) return odometerDiff;

      return parseOptionalDateTime(a.createdAt) - parseOptionalDateTime(b.createdAt);
    });
    let totalMilesDriven = 0;
    if (sortedFuel.length >= 2) {
      const firstOdo = Number(sortedFuel[0].odometer);
      const lastOdo = Number(sortedFuel[sortedFuel.length - 1].odometer);
      if (lastOdo > firstOdo) totalMilesDriven = lastOdo - firstOdo;
    }

    const businessUseInvalid = totalMilesDriven > 0 && totalShiftMiles > totalMilesDriven;
    const businessUsePct = businessUseInvalid
      ? null
      : getWorkMilePercentage(totalShiftMiles, totalMilesDriven);
    const fuelCostResult = calculateWorkFuelCost({
      workMiles: totalShiftMiles,
      fuelEntries: yearFuel,
    });
    const workFuelCost = fuelCostResult.workFuelCost;

    /* Profitability */
    const netProfit = totalGrossPay - workFuelCost;
    const netProfitPct = totalGrossPay > 0 ? netProfit / totalGrossPay : 0;
    const fuelPct = totalGrossPay > 0 ? workFuelCost / totalGrossPay : 0;

    const hourlyRate = totalHours > 0 ? netProfit / totalHours : 0;
    const profitPerDelivery = totalDeliveries > 0 ? netProfit / totalDeliveries : 0;

    /* True cost view — allocates service cost by configured service interval mileage */
    const serviceAllocation = yearServices.reduce(
      (totals, service) => {
        const serviceCost = Number(service.cost || 0);
        if (!(serviceCost > 0)) return totals;

        totals.yearServiceCost += serviceCost;

        const intervalMileage = getServiceIntervalMileage(service, serviceIntervals);
        if (!intervalMileage) {
          totals.unallocatedServiceCost += serviceCost;
          totals.serviceDetails.push({
            serviceType: service.serviceType || "Service",
            serviceCost,
            intervalMileage: null,
            costPerMile: null,
            workMilesSinceService: 0,
            allocatedServiceCost: 0,
            isAllocated: false,
          });
          return totals;
        }

        const serviceShifts = service.vehicleId
          ? completedYearShifts.filter((shift) => shift.vehicleId === service.vehicleId)
          : completedYearShifts;
        const workMilesSinceService = getWorkMilesSinceService(service, serviceShifts);
        const costPerMile = serviceCost / intervalMileage;
        const allocatedServiceCost = Math.min(
          serviceCost,
          workMilesSinceService * costPerMile
        );

        totals.businessServiceCost += allocatedServiceCost;
        totals.serviceDetails.push({
          serviceType: service.serviceType || "Service",
          serviceCost,
          intervalMileage,
          costPerMile,
          workMilesSinceService,
          allocatedServiceCost,
          isAllocated: true,
        });
        return totals;
      },
      {
        yearServiceCost: 0,
        businessServiceCost: 0,
        unallocatedServiceCost: 0,
        serviceDetails: [] as Array<{
          serviceType: string;
          serviceCost: number;
          intervalMileage: number | null;
          costPerMile: number | null;
          workMilesSinceService: number;
          allocatedServiceCost: number;
          isAllocated: boolean;
        }>,
      }
    );

    const yearServiceCost = serviceAllocation.yearServiceCost;
    const businessServiceCost = serviceAllocation.businessServiceCost;
    const unallocatedServiceCost = serviceAllocation.unallocatedServiceCost;
    const serviceDetails = serviceAllocation.serviceDetails;
    const trueNetProfit = netProfit - businessServiceCost;
    const trueNetPct = totalGrossPay > 0 ? trueNetProfit / totalGrossPay : 0;
    const serviceCostPct = totalGrossPay > 0 ? businessServiceCost / totalGrossPay : 0;

    /* Monthly breakdown — builds one entry per month that has shift data */
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthlyData = MONTHS.map((month, i) => {
      const mShifts = completedYearShifts.filter(
        (s) => parseShiftDate(s.date).getMonth() === i
      );
      const mAdjTotal = yearAdjustments
        .filter((a) => new Date(a.week_start + "T12:00:00").getMonth() === i)
        .reduce((sum, a) => sum + Number(a.amount || 0), 0);
      const gross = mShifts.reduce((sum, s) => sum + Number(s.grossPay || 0), 0) + mAdjTotal;
      const mWorkMiles = mShifts.reduce((sum, s) => {
        const begin = Number(s.beginningMileage);
        const end = Number(s.endingMileage);
        return begin > 0 && end > begin ? sum + (end - begin) : sum;
      }, 0);
      const mWorkFuel = calculateWorkFuelCost({
        workMiles: mWorkMiles,
        fuelEntries: yearFuel,
      }).workFuelCost;
      const net = Math.max(gross - mWorkFuel, 0);
      return { month, grossPay: gross, netProfit: net, hasData: mShifts.length > 0 || mAdjTotal > 0 };
    }).filter((m) => m.hasData);

    const maxMonthlyValue = Math.max(...monthlyData.map((m) => m.grossPay), 1);

    /* Average MPG from full fill-up fuel entries that have an mpg value */
    const validMpgEntries = fuelEntries.filter(
      (f) => (f.isFullFillUp ?? true) && f.mpg && f.mpg > 0
    );
    const avgMpg = validMpgEntries.length > 0
      ? validMpgEntries.reduce((sum, f) => sum + f.mpg!, 0) / validMpgEntries.length
      : 0;

    return {
      totalDeliveries, totalHours, totalGrossPay, totalFuelCost, totalAdjustments,
      shiftGrossPay, totalShiftMiles, totalMilesDriven, businessUsePct, businessUseInvalid,
      workFuelCost, netProfit, netProfitPct, fuelPct,
      fuelCostPerMile: fuelCostResult.effectiveCostPerMile,
      fuelCostSource: fuelCostResult.source,
      fuelCostNeedsMpg: fuelCostResult.needsMpg,
      hourlyRate, profitPerDelivery,
      yearServiceCost, businessServiceCost, unallocatedServiceCost, serviceDetails, trueNetProfit, trueNetPct, serviceCostPct,
      monthlyData, maxMonthlyValue, avgMpg,
      hasData: completedYearShifts.length > 0 || totalAdjustments > 0,
    };
  }, [shifts, fuelEntries, serviceEntries, serviceIntervals, adjustments, selectedYear, selectedVehicleId]);

  /* =========================================================
     LOADING STATE
     Shown while Supabase data is in flight.
     ========================================================= */

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020814] text-white">
        <p className="text-slate-400">Loading metrics…</p>
      </main>
    );
  }

  /* Destructure computed metrics for cleaner JSX references */
  const {
    totalDeliveries, totalHours, totalGrossPay, totalAdjustments,
    shiftGrossPay, totalShiftMiles, totalMilesDriven, businessUsePct, businessUseInvalid,
    workFuelCost, netProfit, netProfitPct, fuelPct, fuelCostNeedsMpg, fuelCostPerMile, fuelCostSource,
    profitPerDelivery,
    yearServiceCost, businessServiceCost, unallocatedServiceCost, serviceDetails, trueNetProfit, trueNetPct,
    monthlyData, maxMonthlyValue, avgMpg,
    hasData,
  } = metrics;

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <main className="min-h-screen bg-[#020814] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-24 pt-3">

        {/* PAGE HEADER */}
        <div className="pt-2 pb-4">
          <h1 className="text-4xl font-bold tracking-tight">Metrics</h1>
          <p className="mt-1 text-base text-slate-400">Your earnings. Your truth.</p>
        </div>

        {/* VEHICLE SELECTOR */}
        {vehicles.length > 1 && (
          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm text-slate-400">Vehicle:</span>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="all">All Vehicles</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.year} {v.make} {v.model}{v.is_primary ? " (Primary)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

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

        {/* NO DATA STATE */}
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
                    { label: "Gross Pay",     value: fmtDollar(shiftGrossPay),            sub: "Completed shifts" },
                    ...(totalAdjustments !== 0
                      ? [{ label: "Adjustments", value: fmtDollar(totalAdjustments), sub: "Pay records" }]
                      : []),
                    {
                      label: "Fuel Cost",
                      value: fuelCostNeedsMpg ? "Pending" : fmtDollar(workFuelCost),
                      sub: fuelCostNeedsMpg ? "Add MPG history" : "Work miles only",
                    },
                    {
                      label: "Net Profit",
                      value: fmtDollar(netProfit),
                      sub: fuelCostNeedsMpg ? "Fuel cost pending" : "After fuel",
                      emerald: true,
                    },
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
                {fuelCostNeedsMpg ? (
                  <>
                    <p className="text-sm text-slate-400">Fuel history needed</p>
                    <p className="text-3xl font-bold text-amber-400">Fuel cost pending</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Add another fill-up to calculate after-fuel take-home.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-400">You keep</p>
                    <p className="text-4xl font-bold text-emerald-400">{fmtPct(netProfitPct)}</p>
                    <p className="mt-0.5 text-sm text-slate-400">of what you earn (after fuel)</p>
                  </>
                )}

                {/* PROGRESS BAR */}
                <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${fuelCostNeedsMpg ? 0 : Math.max(0, Math.min(netProfitPct * 100, 100))}%` }}
                  />
                </div>

                {/* LEGEND */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-400">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                      {fuelCostNeedsMpg ? "Profit pending fuel" : "Net Profit"}
                    </span>
                    <span className="text-emerald-400">
                      {fmtDollar(netProfit)}{" "}
                      {!fuelCostNeedsMpg && (
                        <span className="text-slate-500">({fmtPct(netProfitPct)})</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-400">
                      <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
                      {fuelCostNeedsMpg ? "Fuel cost pending" : "Fuel Cost"}
                    </span>
                    <span className="text-blue-400">
                      {fuelCostNeedsMpg ? (
                        "Add MPG history"
                      ) : (
                        <>
                          {fmtDollar(workFuelCost)}{" "}
                          <span className="text-slate-500">({fmtPct(fuelPct)})</span>
                        </>
                      )}
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
                  <div className="mb-5 flex items-center justify-center gap-2">
                    <h2 className="text-lg font-bold">Monthly Breakdown</h2>
                    <span className="rounded-full bg-purple-950 px-2 py-0.5 text-xs text-purple-400">
                      {selectedYear}
                    </span>
                  </div>

                  {/* BAR CHART — grey = gross, green = net */}
                  <div className="flex items-end justify-center gap-2 overflow-x-auto pb-2">
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

                  {/* CHART LEGEND */}
                  <div className="mt-3 flex items-center justify-center gap-4">
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="inline-block h-2 w-4 rounded-sm bg-slate-600" />
                      Gross Pay
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="inline-block h-2 w-4 rounded-sm bg-emerald-500" />
                      {fuelCostNeedsMpg ? "Profit pending fuel" : "Net Profit"}
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

                {/* REQUIRES MILEAGE DATA */}
                {totalMilesDriven === 0 ? (
                  <p className="text-center text-sm text-slate-500">
                    Add fuel entries and shift mileage to unlock this view.
                  </p>
                ) : (
                  <>
                    {/* BUSINESS USE PERCENTAGE */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300">Business Use</span>
                        <span className={`font-semibold ${businessUseInvalid ? "text-amber-400" : "text-blue-400"}`}>
                          {businessUseInvalid || businessUsePct === null ? "Data check needed" : fmtPct(businessUsePct)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {totalShiftMiles.toLocaleString()} work mi /{" "}
                        {totalMilesDriven.toLocaleString()} total mi
                      </p>
                      {businessUseInvalid ? (
                        <p className="mt-2 rounded-2xl border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-200">
                          Data check needed: work miles exceed total miles. Add or correct fuel/odometer entries.
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-slate-500">
                          Business use = work miles / total miles
                        </p>
                      )}
                    </div>

                    {/* AVG MPG — only shown if fuel entries include MPG data */}
                    {avgMpg > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-300">Avg MPG from full fill-ups</span>
                          <span className="font-semibold text-amber-400">{avgMpg.toFixed(1)}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">all-time average</p>
                      </div>
                    )}

                    {/* COST BREAKDOWN TABLE */}
                    <div className="mt-4 border-t border-slate-800 pt-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-300">Shift Gross Pay</span>
                          <span className="text-sm text-white">{fmtDollar(shiftGrossPay)}</span>
                        </div>
                        {totalAdjustments !== 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-300">Pay Adjustments</span>
                            <span className="text-sm text-white">{fmtDollar(totalAdjustments)}</span>
                          </div>
                        )}
                        {totalAdjustments !== 0 && (
                          <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                            <span className="text-sm text-slate-300">Total Income</span>
                            <span className="text-sm text-white">{fmtDollar(totalGrossPay)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-300">− Work Fuel Cost</span>
                          <span className="text-sm text-red-400">
                            {fuelCostNeedsMpg ? "Pending" : `−${fmtDollar(workFuelCost)}`}
                          </span>
                        </div>
                        {fuelCostNeedsMpg && (
                          <p className="text-right text-xs text-slate-500">
                            Add MPG history to estimate fuel cost
                          </p>
                        )}
                        {!fuelCostNeedsMpg && (
                          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
                            <div className="flex items-center justify-between">
                              <span>Work miles used</span>
                              <span>{totalShiftMiles.toLocaleString()} mi</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between">
                              <span>Fuel cost per mile</span>
                              <span>{fmtDollar(fuelCostPerMile)}/mi</span>
                            </div>
                            <p className="mt-2 text-slate-500">
                              Work fuel cost = {totalShiftMiles.toLocaleString()} mi × {fmtDollar(fuelCostPerMile)}/mi = {fmtDollar(workFuelCost)}
                            </p>
                            <p className="mt-1 text-slate-500">
                              Source: {fuelCostSource === "actual_history" ? "recent fuel cost-per-mile history" : "vehicle MPG estimate"}
                            </p>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-300">− Service (your share)</span>
                            <span className="text-sm text-red-400">−{fmtDollar(businessServiceCost)}</span>
                          </div>
                          <p className="mt-0.5 text-right text-xs text-slate-500">
                            ${yearServiceCost.toFixed(2)} total, allocated by service intervals
                          </p>
                        </div>
                        {unallocatedServiceCost > 0 && (
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-300">Unallocated service cost</span>
                              <span className="text-sm text-slate-400">{fmtDollar(unallocatedServiceCost)}</span>
                            </div>
                            <p className="mt-0.5 text-right text-xs text-slate-500">
                              Missing or invalid mileage interval
                            </p>
                          </div>
                        )}
                        {serviceDetails.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Service allocation detail
                            </p>
                            {serviceDetails.map((service, index) => (
                              <div
                                key={`${service.serviceType}-${index}`}
                                className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400"
                              >
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="font-semibold text-slate-200">{service.serviceType}</span>
                                  <span className="text-slate-200">{fmtDollar(service.allocatedServiceCost)}</span>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span>Service cost</span>
                                    <span>{fmtDollar(service.serviceCost)}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span>Service interval miles</span>
                                    <span>
                                      {service.intervalMileage
                                        ? `${service.intervalMileage.toLocaleString()} mi`
                                        : "Missing"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span>Cost per mile</span>
                                    <span>
                                      {service.costPerMile !== null
                                        ? `${fmtDollar(service.costPerMile)}/mi`
                                        : "Unallocated"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span>Work miles since service</span>
                                    <span>{service.workMilesSinceService.toLocaleString()} mi</span>
                                  </div>
                                </div>
                                {service.isAllocated && service.costPerMile !== null ? (
                                  <p className="mt-2 text-slate-500">
                                    Allocated service cost = min({fmtDollar(service.serviceCost)}, {service.workMilesSinceService.toLocaleString()} mi × {fmtDollar(service.costPerMile)}/mi) = {fmtDollar(service.allocatedServiceCost)}
                                  </p>
                                ) : (
                                  <p className="mt-2 text-slate-500">
                                    Not allocated because the mileage interval is missing or invalid.
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* TRUE NET PROFIT */}
                        <div className="border-t border-slate-800 pt-3">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-200">
                              {fuelCostNeedsMpg ? "True Net Profit Pending" : "True Net Profit"}
                            </span>
                            <span className="text-xl font-bold text-emerald-400">
                              {fmtDollar(trueNetProfit)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* TRUE RETENTION BAR */}
                      <div className="mt-5">
                        <p className="mb-2 text-sm text-slate-300">
                          {fuelCostNeedsMpg ? (
                            "Fuel history needed"
                          ) : (
                            <>
                              You truly keep{" "}
                              <span className="font-semibold text-emerald-400">{fmtPct(trueNetPct)}</span>
                            </>
                          )}
                        </p>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                            style={{ width: `${fuelCostNeedsMpg ? 0 : Math.max(0, Math.min(trueNetPct * 100, 100))}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-slate-500">
                          {fuelCostNeedsMpg
                            ? "Add another fill-up to calculate after-fuel take-home."
                            : `vs ${fmtPct(netProfitPct)} fuel-only view`}
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
