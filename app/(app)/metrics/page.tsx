"use client";

/* =========================================================
   METRICS PAGE
   ---------------------------------------------------------
   Full earnings analytics for a selected pay period.
   Pulls shifts, fuel entries, service entries, and pay
   adjustments from Supabase, then computes:
     • KPI overview (deliveries, hours, gross, fuel, net)
     • Retention percentage bar
     • Pay-period gross vs net summary
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

type PayPeriodOption = {
  label: string;
  weekStart: string;
  weekEnd: string;
};

const WEEK_START_STORAGE_KEYS = [
  "gigaxios-week-start",
  "gigaxios-week-starts-on",
  "gigaxios-weekStartsOn",
];

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

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

function formatISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function toISODate(dateStr: string): string {
  const date = parseShiftDate(dateStr);
  if (date.getTime() === 0 || Number.isNaN(date.getTime())) return "";
  return formatISODate(date);
}

function formatLongDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getWeekStartDay(): number {
  if (typeof window === "undefined") return 1;

  for (const key of WEEK_START_STORAGE_KEYS) {
    const value = localStorage.getItem(key)?.toLowerCase();
    if (!value) continue;

    const numeric = Number(value);
    if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) return numeric;

    const index = DAY_NAMES.findIndex((day) => day.toLowerCase() === value);
    if (index >= 0) return index;
  }

  return 1;
}

function getPayPeriodForDate(date: Date, weekStartsOn: number) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const offset = (start.getDay() - weekStartsOn + 7) % 7;
  start.setDate(start.getDate() - offset);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    weekStart: formatISODate(start),
    weekEnd: formatISODate(end),
  };
}

function isDateInRange(dateStr: string, weekStart: string, weekEnd: string): boolean {
  const iso = toISODate(dateStr);
  return iso >= weekStart && iso <= weekEnd;
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

function getMileageRangeOverlapMiles(
  rangeStart: number,
  rangeEnd: number,
  windowStart: number,
  windowEnd: number
): number {
  if (!(rangeStart > 0 && rangeEnd > rangeStart && windowStart > 0 && windowEnd > windowStart)) {
    return 0;
  }

  return Math.max(0, Math.min(rangeEnd, windowEnd) - Math.max(rangeStart, windowStart));
}

function getShiftVehicleKey(shift: SavedShift): string {
  return shift.vehicleId || "unassigned";
}

function getFuelVehicleKey(entry: FuelEntry): string {
  return entry.vehicleId || "unassigned";
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
  const [weekStartsOn, setWeekStartsOn] = useState(1);
  const [selectedPeriodKey, setSelectedPeriodKey] = useState("");
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
        const resolvedWeekStartsOn = getWeekStartDay();
        setWeekStartsOn(resolvedWeekStartsOn);

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
        setSelectedVehicleId("all");
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

  const currentPayPeriod = useMemo(
    () => getPayPeriodForDate(new Date(), weekStartsOn),
    [weekStartsOn]
  );

  const payPeriodOptions = useMemo<PayPeriodOption[]>(() => {
    const periodMap = new Map<string, PayPeriodOption>();

    function addPeriodForDate(dateStr: string) {
      const date = parseShiftDate(dateStr);
      if (date.getTime() === 0 || Number.isNaN(date.getTime())) return;
      const period = getPayPeriodForDate(date, weekStartsOn);
      periodMap.set(period.weekStart, {
        ...period,
        label: `${formatLongDate(period.weekStart)} - ${formatLongDate(period.weekEnd)}`,
      });
    }

    periodMap.set(currentPayPeriod.weekStart, {
      ...currentPayPeriod,
      label: `Current pay period: ${formatLongDate(currentPayPeriod.weekStart)} - ${formatLongDate(
        currentPayPeriod.weekEnd
      )}`,
    });

    shifts.forEach((shift) => addPeriodForDate(shift.date));
    fuelEntries.forEach((entry) => addPeriodForDate(entry.date));
    serviceEntries.forEach((entry) => addPeriodForDate(entry.date));
    adjustments.forEach((adjustment) => addPeriodForDate(adjustment.week_start));

    return Array.from(periodMap.values()).sort((a, b) =>
      b.weekStart.localeCompare(a.weekStart)
    );
  }, [adjustments, currentPayPeriod, fuelEntries, serviceEntries, shifts, weekStartsOn]);

  useEffect(() => {
    if (!selectedPeriodKey && payPeriodOptions.length > 0) {
      setSelectedPeriodKey(currentPayPeriod.weekStart);
    }
  }, [currentPayPeriod.weekStart, payPeriodOptions.length, selectedPeriodKey]);

  const selectedPayPeriod =
    payPeriodOptions.find((period) => period.weekStart === selectedPeriodKey) ??
    payPeriodOptions[0] ??
    currentPayPeriod;

  /* =========================================================
     METRICS COMPUTATION
     All calculations are memoized and re-run whenever the
     selected pay period or any data source changes.
     ========================================================= */

  const metrics = useMemo(() => {

    /* Filter by vehicle first (when not "all"), then by selected pay period */
    const vehicleShifts = selectedVehicleId === "all" ? shifts : shifts.filter((s) => s.vehicleId === selectedVehicleId);
    const vehicleFuel = selectedVehicleId === "all" ? fuelEntries : fuelEntries.filter((f) => f.vehicleId === selectedVehicleId);
    const periodShifts = vehicleShifts.filter(
      (s) => isDateInRange(s.date, selectedPayPeriod.weekStart, selectedPayPeriod.weekEnd)
    );
    const periodFuel = vehicleFuel.filter(
      (f) => isDateInRange(f.date, selectedPayPeriod.weekStart, selectedPayPeriod.weekEnd)
    );
    const completedPeriodShifts = periodShifts.filter((shift) => shift.status === "closed");
    const selectedVehicleKeys = [...new Set(completedPeriodShifts.map(getShiftVehicleKey))];
    const selectedVehicleIds = selectedVehicleKeys.filter((vehicleId) => vehicleId !== "unassigned");
    const scopedPeriodFuel = periodFuel.filter((entry) =>
      selectedVehicleKeys.includes(getFuelVehicleKey(entry))
    );
    const scopedAllFuel = vehicleFuel.filter((entry) =>
      selectedVehicleKeys.includes(getFuelVehicleKey(entry))
    );
    const assignedVehicleServices = selectedVehicleId === "all"
      ? serviceEntries.filter(
          (service) => !!service.vehicleId && selectedVehicleIds.includes(service.vehicleId)
        )
      : serviceEntries.filter((service) => service.vehicleId === selectedVehicleId);
    const unassignedServiceRecords = selectedVehicleId === "all"
      ? serviceEntries.filter((service) => !service.vehicleId)
      : [];

    /* Pay adjustments (MGA, bonuses, etc.) — excluded when vehicle has no shifts,
       since adjustments are driver-level and cannot be attributed to a specific vehicle */
    const periodAdjustments = adjustments.filter(
      (a) => isDateInRange(a.week_start, selectedPayPeriod.weekStart, selectedPayPeriod.weekEnd)
    );
    const totalAdjustments = completedPeriodShifts.length === 0
      ? 0
      : periodAdjustments.reduce((sum, a) => sum + Number(a.amount || 0), 0);

    /* Basic shift totals */
    const totalDeliveries = completedPeriodShifts.reduce((s, x) => s + Number(x.deliveries || 0), 0);
    const totalHours = completedPeriodShifts.reduce((s, x) => s + Number(x.hoursWorked || 0), 0);
    const shiftGrossPay = completedPeriodShifts.reduce((s, x) => s + Number(x.grossPay || 0), 0);
    const totalGrossPay = shiftGrossPay + totalAdjustments;
    const totalFuelCost = scopedPeriodFuel.reduce((s, x) => s + Number(x.totalCost || 0), 0);
    const shiftsMissingBeginningMileage = completedPeriodShifts.filter(
      (shift) => !(Number(shift.beginningMileage) > 0)
    );
    const shiftsMissingEndingMileage = completedPeriodShifts.filter(
      (shift) => !(Number(shift.endingMileage) > 0)
    );

    /* Work miles — difference between ending and beginning mileage per shift */
    const totalShiftMiles = completedPeriodShifts.reduce((sum, s) => {
      const begin = Number(s.beginningMileage);
      const end = Number(s.endingMileage);
      return begin > 0 && end > begin ? sum + (end - begin) : sum;
    }, 0);

    /* Total miles driven — first to last odometer reading from fuel entries. */
    const totalMilesDriven = selectedVehicleKeys.reduce((sum, vehicleKey) => {
      const sortedFuel = scopedPeriodFuel
        .filter((entry) => getFuelVehicleKey(entry) === vehicleKey)
        .sort((a, b) => {
          const dateDiff = parseShiftDate(a.date).getTime() - parseShiftDate(b.date).getTime();
          if (dateDiff !== 0) return dateDiff;

          const odometerDiff = Number(a.odometer || 0) - Number(b.odometer || 0);
          if (odometerDiff !== 0) return odometerDiff;

          return parseOptionalDateTime(a.createdAt) - parseOptionalDateTime(b.createdAt);
        });

      if (sortedFuel.length < 2) return sum;

      const firstOdo = Number(sortedFuel[0].odometer);
      const lastOdo = Number(sortedFuel[sortedFuel.length - 1].odometer);
      return lastOdo > firstOdo ? sum + (lastOdo - firstOdo) : sum;
    }, 0);

    const businessUseInvalid = totalMilesDriven > 0 && totalShiftMiles > totalMilesDriven;
    const businessUsePct = businessUseInvalid
      ? null
      : getWorkMilePercentage(totalShiftMiles, totalMilesDriven);
    const vehicleFuelCostResults = selectedVehicleKeys.map((vehicleKey) => {
      const vehicleCompletedShifts = completedPeriodShifts.filter(
        (shift) => getShiftVehicleKey(shift) === vehicleKey
      );
      const vehicleWorkMiles = vehicleCompletedShifts.reduce((sum, shift) => {
        const begin = Number(shift.beginningMileage);
        const end = Number(shift.endingMileage);
        return begin > 0 && end > begin ? sum + (end - begin) : sum;
      }, 0);
      const vehicleFuel = scopedPeriodFuel.filter((entry) => getFuelVehicleKey(entry) === vehicleKey);
      const result = calculateWorkFuelCost({
        workMiles: vehicleWorkMiles,
        fuelEntries: vehicleFuel,
      });

      return { vehicleKey, vehicleWorkMiles, result };
    });
    const workFuelCost = vehicleFuelCostResults.reduce(
      (sum, vehicle) => sum + vehicle.result.workFuelCost,
      0
    );
    const fuelCostNeedsMpg = totalShiftMiles > 0 && vehicleFuelCostResults.some(
      (vehicle) => vehicle.vehicleWorkMiles > 0 && vehicle.result.needsMpg
    );
    const hasFuelCostHistoryGap = vehicleFuelCostResults.some(
      (vehicle) => vehicle.vehicleWorkMiles > 0 && vehicle.result.source === "unavailable"
    );
    const fuelCostPerMile = totalShiftMiles > 0 ? workFuelCost / totalShiftMiles : 0;
    const fuelCostSource = vehicleFuelCostResults.some(
      (vehicle) => vehicle.result.source === "actual_history"
    )
      ? "actual_history"
      : vehicleFuelCostResults.some((vehicle) => vehicle.result.source === "vehicle_estimate")
        ? "vehicle_estimate"
        : "unavailable";

    const completedFuelCycles = selectedVehicleKeys.flatMap((vehicleKey) => {
      const fullFillUps = scopedAllFuel
        .filter((entry) => getFuelVehicleKey(entry) === vehicleKey)
        .filter((entry) => entry.isFullFillUp ?? true)
        .sort((a, b) => {
          const odometerDiff = Number(a.odometer || 0) - Number(b.odometer || 0);
          if (odometerDiff !== 0) return odometerDiff;

          const dateDiff = parseShiftDate(a.date).getTime() - parseShiftDate(b.date).getTime();
          if (dateDiff !== 0) return dateDiff;

          return parseOptionalDateTime(a.createdAt) - parseOptionalDateTime(b.createdAt);
        });

      return fullFillUps.slice(1).map((endFill, index) => {
        const startFill = fullFillUps[index];
        return {
          vehicleKey,
          startOdometer: Number(startFill.odometer || 0),
          endOdometer: Number(endFill.odometer || 0),
        };
      }).filter((cycle) => cycle.endOdometer > cycle.startOdometer);
    });

    const verifiedCompletedCycleWorkMiles = completedPeriodShifts.reduce((sum, shift) => {
      const shiftStart = Number(shift.beginningMileage);
      const shiftEnd = Number(shift.endingMileage);
      const vehicleKey = getShiftVehicleKey(shift);
      const cycleMiles = completedFuelCycles
        .filter((cycle) => cycle.vehicleKey === vehicleKey)
        .reduce(
          (cycleSum, cycle) =>
            cycleSum + getMileageRangeOverlapMiles(
              shiftStart,
              shiftEnd,
              cycle.startOdometer,
              cycle.endOdometer
            ),
          0
        );

      return sum + cycleMiles;
    }, 0);
    const openCycleMiles = Math.max(0, totalShiftMiles - verifiedCompletedCycleWorkMiles);

    /* Profitability */
    const fuelOnlyProfit = totalGrossPay - workFuelCost;
    const fuelOnlyProfitPct = totalGrossPay > 0 ? fuelOnlyProfit / totalGrossPay : 0;
    const fuelPct = totalGrossPay > 0 ? workFuelCost / totalGrossPay : 0;

    /* True cost view — allocates service cost by configured service interval mileage */
    const serviceAllocation = assignedVehicleServices.reduce(
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

        const serviceStartOdometer = Number(service.odometer || 0);
        const serviceEndOdometer = serviceStartOdometer + intervalMileage;
        const serviceVehicleKey = service.vehicleId || "unassigned";
        const costPerMile = serviceCost / intervalMileage;
        const workMilesSinceService = completedPeriodShifts
          .filter((shift) => getShiftVehicleKey(shift) === serviceVehicleKey)
          .reduce((sum, shift) => {
            const shiftStart = Number(shift.beginningMileage);
            const shiftEnd = Number(shift.endingMileage);
            return sum + getMileageRangeOverlapMiles(
              shiftStart,
              shiftEnd,
              serviceStartOdometer,
              serviceEndOdometer
            );
          }, 0);
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
    const trueNetProfit = totalGrossPay - workFuelCost - businessServiceCost;
    const trueNetPct = totalGrossPay > 0 ? trueNetProfit / totalGrossPay : 0;
    const serviceCostPct = totalGrossPay > 0 ? businessServiceCost / totalGrossPay : 0;

    const periodSummaryData = [
      {
        label: "This period",
        grossPay: totalGrossPay,
        netProfit: Math.max(trueNetProfit, 0),
      },
    ];

    const maxPeriodSummaryValue = Math.max(totalGrossPay, Math.max(trueNetProfit, 0), 1);

    /* Average MPG from selected-period full fill-up fuel entries that have an mpg value */
    const validMpgEntries = scopedPeriodFuel.filter(
      (f) => (f.isFullFillUp ?? true) && f.mpg && f.mpg > 0
    );
    const avgMpg = validMpgEntries.length > 0
      ? validMpgEntries.reduce((sum, f) => sum + f.mpg!, 0) / validMpgEntries.length
      : 0;
    const periodMpgEntryCount = validMpgEntries.length;
    const warnings: Array<{ title: string; description: string }> = [];

    if (unassignedServiceRecords.length > 0) {
      warnings.push({
        title: "Unassigned service records excluded",
        description: `${unassignedServiceRecords.length} service record${unassignedServiceRecords.length === 1 ? "" : "s"} without a vehicle are excluded from service cost allocation.`,
      });
    }
    if (hasFuelCostHistoryGap) {
      warnings.push({
        title: "Fuel cost history needed",
        description: "Work miles exist, but there is no fuel cost-per-mile history for the selected vehicle scope.",
      });
    }
    if (openCycleMiles > 0) {
      warnings.push({
        title: "Open-cycle miles included",
        description: "Includes open-cycle miles; final fuel-cycle verification occurs after next full fill-up.",
      });
    }
    if (shiftsMissingBeginningMileage.length > 0) {
      warnings.push({
        title: "Beginning mileage missing",
        description: `${shiftsMissingBeginningMileage.length} completed shift${shiftsMissingBeginningMileage.length === 1 ? "" : "s"} missing beginning mileage were excluded from work miles.`,
      });
    }
    if (shiftsMissingEndingMileage.length > 0) {
      warnings.push({
        title: "Ending mileage missing",
        description: `${shiftsMissingEndingMileage.length} completed shift${shiftsMissingEndingMileage.length === 1 ? "" : "s"} missing ending mileage were excluded from work miles.`,
      });
    }

    return {
      totalDeliveries, totalHours, totalGrossPay, totalFuelCost, totalAdjustments,
      shiftGrossPay, totalShiftMiles, totalMilesDriven, businessUsePct, businessUseInvalid,
      workFuelCost, netProfit: trueNetProfit, netProfitPct: trueNetPct, fuelPct,
      fuelCostPerMile,
      fuelCostSource,
      fuelCostNeedsMpg,
      hourlyRate: totalHours > 0 ? trueNetProfit / totalHours : 0,
      profitPerDelivery: totalDeliveries > 0 ? trueNetProfit / totalDeliveries : 0,
      yearServiceCost, businessServiceCost, unallocatedServiceCost, serviceDetails, trueNetProfit, trueNetPct, serviceCostPct,
      periodSummaryData, maxPeriodSummaryValue, avgMpg, periodMpgEntryCount, warnings, openCycleMiles, fuelOnlyProfitPct,
      hasData: completedPeriodShifts.length > 0 || totalAdjustments > 0,
    };
  }, [shifts, fuelEntries, serviceEntries, serviceIntervals, adjustments, selectedPayPeriod, selectedVehicleId]);

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
    periodSummaryData, maxPeriodSummaryValue, avgMpg, periodMpgEntryCount, warnings, fuelOnlyProfitPct,
    hasData,
  } = metrics;
  const visibleServiceDetails = serviceDetails.filter(
    (service) => service.workMilesSinceService > 0 || service.allocatedServiceCost > 0
  );

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

        {/* PAY PERIOD SELECTOR */}
        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm text-slate-400">Pay period:</span>
          <select
            value={selectedPayPeriod.weekStart}
            onChange={(e) => setSelectedPeriodKey(e.target.value)}
            className="max-w-[260px] rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          >
            {payPeriodOptions.map((period) => (
              <option key={period.weekStart} value={period.weekStart}>
                {period.label}
              </option>
            ))}
          </select>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          {formatLongDate(selectedPayPeriod.weekStart)} - {formatLongDate(selectedPayPeriod.weekEnd)}
        </p>

        {warnings.length > 0 && (
          <div className="mt-4 space-y-2">
            {warnings.map((warning) => (
              <div
                key={warning.title}
                className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-3"
              >
                <p className="text-sm font-semibold text-amber-200">{warning.title}</p>
                <p className="mt-0.5 text-xs text-amber-100/80">{warning.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* NO DATA STATE */}
        {!hasData ? (
          <div className="mt-16 text-center">
            <p className="text-slate-500">No data for this pay period.</p>
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
                    This pay period
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Deliveries",    value: totalDeliveries.toLocaleString(),    sub: "Total" },
                    { label: "Hours Worked",  value: totalHours.toFixed(2),               sub: "Total" },
                    { label: "Total Income",  value: fmtDollar(totalGrossPay),            sub: "Shift gross + adjustments" },
                    ...(totalAdjustments !== 0
                      ? [{ label: "Pay Adjustments", value: fmtDollar(totalAdjustments), sub: "Pay records" }]
                      : []),
                    {
                      label: "Work Fuel Cost",
                      value: fuelCostNeedsMpg ? "Pending" : fmtDollar(workFuelCost),
                      sub: fuelCostNeedsMpg ? "Add MPG history" : "Work miles only",
                    },
                    {
                      label: "True Net Profit",
                      value: fmtDollar(netProfit),
                      sub: fuelCostNeedsMpg ? "Fuel cost pending" : "After fuel + service",
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
                    <p className="text-sm text-slate-400">You truly keep</p>
                    <p className="text-4xl font-bold text-emerald-400">{fmtPct(netProfitPct)}</p>
                    <p className="mt-0.5 text-sm text-slate-400">of what you earn (after fuel + service)</p>
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
                      {fuelCostNeedsMpg ? "Profit pending fuel" : "True Net Profit"}
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
                      {fuelCostNeedsMpg ? "Fuel cost pending" : "Work Fuel Cost"}
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

            {/* ── SECTION 3: PERIOD SUMMARY ── */}
            {periodSummaryData.length > 0 && (
              <div className="relative mt-6">
                <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-purple-500" />
                <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">
                  <div className="mb-5 flex items-center justify-center gap-2">
                    <h2 className="text-lg font-bold">Pay Period Breakdown</h2>
                    <span className="rounded-full bg-purple-950 px-2 py-0.5 text-xs text-purple-400">
                      Selected period
                    </span>
                  </div>

                  {/* BAR CHART — grey = gross, green = net */}
                  <div className="flex items-end justify-center gap-2 overflow-x-auto pb-2">
                    {periodSummaryData.map((m) => {
                      const grossH = Math.max(
                        Math.round((m.grossPay / maxPeriodSummaryValue) * 80),
                        2
                      );
                      const netH = Math.max(
                        Math.round((m.netProfit / maxPeriodSummaryValue) * 80),
                        2
                      );
                      return (
                        <div key={m.label} className="flex flex-col items-center gap-1">
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
                          <span className="text-xs text-slate-400">{m.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* CHART LEGEND */}
                  <div className="mt-3 flex items-center justify-center gap-4">
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="inline-block h-2 w-4 rounded-sm bg-slate-600" />
                      Total Income
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="inline-block h-2 w-4 rounded-sm bg-emerald-500" />
                      {fuelCostNeedsMpg ? "Profit pending fuel" : "True Net Profit"}
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
                        <span className="font-semibold text-blue-400">
                          {businessUseInvalid || businessUsePct === null ? "Pending fill-up" : fmtPct(businessUsePct)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {totalShiftMiles.toLocaleString()} work mi /{" "}
                        {totalMilesDriven.toLocaleString()} total mi
                      </p>
                      {businessUseInvalid ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Some work miles are awaiting the next full fill-up for final fuel-cycle verification.
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-slate-500">
                          Business use = work miles / total miles
                        </p>
                      )}
                    </div>

                    {/* AVG MPG */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300">Avg MPG from full fill-ups this pay period</span>
                        <span className="font-semibold text-amber-400">
                          {periodMpgEntryCount > 0
                            ? avgMpg.toFixed(1)
                            : "Not enough full fill-ups this period"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {periodMpgEntryCount > 0
                          ? `${periodMpgEntryCount} period full fill-up${periodMpgEntryCount === 1 ? "" : "s"}`
                          : "Needs a period full fill-up with MPG"}
                      </p>
                    </div>

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
                            <span className="text-sm text-slate-300">− Service Cost Used</span>
                            <span className="text-sm text-red-400">−{fmtDollar(businessServiceCost)}</span>
                          </div>
                          <p className="mt-0.5 text-right text-xs text-slate-500">
                            ${yearServiceCost.toFixed(2)} service value, allocated by active service windows
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
                            <p className="text-xs text-slate-500">
                              Expired or non-overlapping service records with $0 charged are hidden.
                            </p>
                            {visibleServiceDetails.map((service, index) => (
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
                                    <span>This-period miles charged</span>
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
                            : `vs ${fmtPct(fuelOnlyProfitPct)} fuel-only view`}
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
