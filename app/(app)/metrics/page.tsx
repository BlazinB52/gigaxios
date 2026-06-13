"use client";

/* =========================================================
   METRICS PAGE
   ---------------------------------------------------------
   Full earnings analytics for a selected date range.
   Pulls shifts, fuel entries, service entries, and pay
   adjustments from Supabase, then computes:
     • KPI overview (deliveries, hours, gross, fuel, net)
     • Retention percentage bar
     • Date-range gross vs net summary
     • True Cost View (includes vehicle maintenance share)
   ========================================================= */

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Clock,
  DollarSign,
  Info,
  Lightbulb,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";
import { SavedShift } from "@/app/lib/types";
import {
  FuelEntry,
  getFuelEntryTotalCost,
  loadFuelEntriesFromSupabase,
} from "@/app/lib/fuelStorage";
import {
  calculateSimpleWorkFuelCost,
} from "@/app/lib/fuelCost";
import { loadShiftsFromSupabase } from "@/app/lib/storage";
import {
  ServiceEntry,
  ServiceInterval,
  loadServiceEntriesFromSupabase,
  loadServiceIntervalsFromSupabase,
} from "@/app/lib/garageStorage";
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

type RangeType = "current_pay_period" | "previous_pay_period" | "month" | "quarter" | "year";

type DateRangeOption = {
  label: string;
  rangeStart: string;
  rangeEnd: string;
  type: RangeType;
};

type BestDayBucket = {
  label: string;
  fullLabel: string;
  dayIndex: number;
  hours: number;
  grossPay: number;
  fuelCost: number;
  serviceCost: number;
  netProfit: number;
  netPerHour: number;
};

type ChartPoint = {
  x: number;
  y: number;
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

const WEEKDAY_BUCKETS = [
  { label: "Mon", fullLabel: "Monday", dayIndex: 1 },
  { label: "Tue", fullLabel: "Tuesday", dayIndex: 2 },
  { label: "Wed", fullLabel: "Wednesday", dayIndex: 3 },
  { label: "Thu", fullLabel: "Thursday", dayIndex: 4 },
  { label: "Fri", fullLabel: "Friday", dayIndex: 5 },
  { label: "Sat", fullLabel: "Saturday", dayIndex: 6 },
  { label: "Sun", fullLabel: "Sunday", dayIndex: 0 },
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

function toDateRange(
  label: string,
  start: Date,
  end: Date,
  type: RangeType
): DateRangeOption {
  return {
    label,
    rangeStart: formatISODate(start),
    rangeEnd: formatISODate(end),
    type,
  };
}

function getThisMonthRange(date: Date): DateRangeOption {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return toDateRange("This month", start, end, "month");
}

function getThisQuarterRange(date: Date): DateRangeOption {
  const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
  const start = new Date(date.getFullYear(), quarterStartMonth, 1);
  const end = new Date(date.getFullYear(), quarterStartMonth + 3, 0);
  return toDateRange("This quarter", start, end, "quarter");
}

function getThisYearRange(date: Date): DateRangeOption {
  const start = new Date(date.getFullYear(), 0, 1);
  const end = new Date(date.getFullYear(), 11, 31);
  return toDateRange("This year", start, end, "year");
}

function isDateInRange(dateStr: string, rangeStart: string, rangeEnd: string): boolean {
  const iso = toISODate(dateStr);
  return iso >= rangeStart && iso <= rangeEnd;
}

function roundUpToInterval(value: number, interval: number): number {
  return Math.ceil(Math.max(value, 0) / interval) * interval;
}

function fmtAxisDollar(value: number): string {
  const absValue = Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 });
  return value < 0 ? `-$${absValue}` : `$${absValue}`;
}

function fmtDollarPerHour(value: number): string {
  return `${fmtAxisDollar(Math.round(value))}/hr`;
}

function fmtCompactHours(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildAxisTicks(maxValue: number, interval: number): number[] {
  return Array.from(
    { length: Math.floor(maxValue / interval) + 1 },
    (_, index) => index * interval
  );
}

function getProfitPerHourYAxisInterval(maxValue: number): number {
  if (maxValue <= 50) return 10;
  if (maxValue <= 100) return 25;
  if (maxValue <= 250) return 50;
  return 100;
}

function pointsToPath(points: ChartPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

/* =========================================================
   BUSINESS USE PERCENTAGE
   Returns the fraction of total miles driven that were for
   work.  Capped at 1.0 — can't be more than 100% business.
   ========================================================= */

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
  const [selectedRangeKey, setSelectedRangeKey] = useState<RangeType>("current_pay_period");
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

  const rangeOptions = useMemo<DateRangeOption[]>(() => {
    const today = new Date();
    const currentPayPeriod = getPayPeriodForDate(today, weekStartsOn);
    const previousPayPeriodStart = parseShiftDate(currentPayPeriod.weekStart);
    previousPayPeriodStart.setDate(previousPayPeriodStart.getDate() - 7);
    const previousPayPeriod = getPayPeriodForDate(previousPayPeriodStart, weekStartsOn);

    return [
      {
        label: "Current pay period",
        rangeStart: currentPayPeriod.weekStart,
        rangeEnd: currentPayPeriod.weekEnd,
        type: "current_pay_period",
      },
      {
        label: "Previous pay period",
        rangeStart: previousPayPeriod.weekStart,
        rangeEnd: previousPayPeriod.weekEnd,
        type: "previous_pay_period",
      },
      getThisMonthRange(today),
      getThisQuarterRange(today),
      getThisYearRange(today),
    ];
  }, [weekStartsOn]);

  const selectedRange =
    rangeOptions.find((range) => range.type === selectedRangeKey) ??
    rangeOptions[0];

  /* =========================================================
     METRICS COMPUTATION
     All calculations are memoized and re-run whenever the
     selected date range or any data source changes.
     ========================================================= */

  const metrics = useMemo(() => {

    /* Filter by vehicle first (when not "all"), then by selected date range */
    const vehicleShifts = selectedVehicleId === "all" ? shifts : shifts.filter((s) => s.vehicleId === selectedVehicleId);
    const vehicleFuel = selectedVehicleId === "all" ? fuelEntries : fuelEntries.filter((f) => f.vehicleId === selectedVehicleId);
    const periodShifts = vehicleShifts.filter(
      (s) => isDateInRange(s.date, selectedRange.rangeStart, selectedRange.rangeEnd)
    );
    const completedPeriodShifts = periodShifts.filter((shift) => shift.status === "closed");
    const selectedVehicleKeys = [...new Set(completedPeriodShifts.map(getShiftVehicleKey))];
    const selectedVehicleIds = selectedVehicleKeys.filter((vehicleId) => vehicleId !== "unassigned");
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
      (a) => isDateInRange(a.week_start, selectedRange.rangeStart, selectedRange.rangeEnd)
    );
    const totalAdjustments = completedPeriodShifts.length === 0
      ? 0
      : periodAdjustments.reduce((sum, a) => sum + Number(a.amount || 0), 0);

    /* Basic shift totals */
    const totalDeliveries = completedPeriodShifts.reduce((s, x) => s + Number(x.deliveries || 0), 0);
    const totalHours = completedPeriodShifts.reduce((s, x) => s + Number(x.hoursWorked || 0), 0);
    const shiftGrossPay = completedPeriodShifts.reduce((s, x) => s + Number(x.grossPay || 0), 0);
    const totalGrossPay = shiftGrossPay + totalAdjustments;
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
          endDate: endFill.date,
          cycleMiles: Number(endFill.odometer || 0) - Number(startFill.odometer || 0),
          gallons: Number(endFill.gallons || 0),
          fuelCost: getFuelEntryTotalCost(endFill),
          fuelCostPerMile:
            Number(endFill.odometer || 0) > Number(startFill.odometer || 0)
              ? getFuelEntryTotalCost(endFill) /
              (Number(endFill.odometer || 0) - Number(startFill.odometer || 0))
              : 0,
        };
      }).filter((cycle) => cycle.endOdometer > cycle.startOdometer);
    });
    const selectedRangeFuelCycles = completedFuelCycles.filter((cycle) =>
      isDateInRange(cycle.endDate, selectedRange.rangeStart, selectedRange.rangeEnd)
    );

    const fuelCostResult = calculateSimpleWorkFuelCost({
      workMiles: totalShiftMiles,
      completedFuelCycles: selectedRangeFuelCycles,
    });

    const fuelCostNeedsMpg = totalShiftMiles > 0 && fuelCostResult.needsMpg;
    const workFuelCost = fuelCostResult.workFuelCost;
    const fuelCostPerMile = fuelCostResult.effectiveCostPerMile;

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

    let bestDayData: BestDayBucket[] = WEEKDAY_BUCKETS.map((weekday) => {
      const bucketShifts = completedPeriodShifts.filter(
        (shift) => parseShiftDate(shift.date).getDay() === weekday.dayIndex
      );
      const bucketShiftGrossPay = bucketShifts.reduce(
        (sum, shift) => sum + Number(shift.grossPay || 0),
        0
      );
      const bucketHours = bucketShifts.reduce(
        (sum, shift) => sum + Number(shift.hoursWorked || 0),
        0
      );
      const bucketAdjustments = totalHours > 0
        ? totalAdjustments * (bucketHours / totalHours)
        : 0;
      const bucketGrossPay = bucketShiftGrossPay + bucketAdjustments;

      const bucketFuelCost = bucketShifts.reduce((sum, shift) => {
        const begin = Number(shift.beginningMileage);
        const end = Number(shift.endingMileage);
        const miles = begin > 0 && end > begin ? end - begin : 0;
        return sum + miles * fuelCostPerMile;
      }, 0);

      const bucketServiceCost = assignedVehicleServices.reduce((sum, service) => {
        const serviceCost = Number(service.cost || 0);
        const intervalMileage = getServiceIntervalMileage(service, serviceIntervals);
        if (!(serviceCost > 0) || !intervalMileage) return sum;

        const serviceStartOdometer = Number(service.odometer || 0);
        const serviceEndOdometer = serviceStartOdometer + intervalMileage;
        const serviceVehicleKey = service.vehicleId || "unassigned";
        const costPerMile = serviceCost / intervalMileage;
        const periodWorkMilesSinceService = completedPeriodShifts
          .filter((shift) => getShiftVehicleKey(shift) === serviceVehicleKey)
          .reduce((miles, shift) => {
            const shiftStart = Number(shift.beginningMileage);
            const shiftEnd = Number(shift.endingMileage);
            return miles + getMileageRangeOverlapMiles(
              shiftStart,
              shiftEnd,
              serviceStartOdometer,
              serviceEndOdometer
            );
          }, 0);
        if (!(periodWorkMilesSinceService > 0)) return sum;

        const periodAllocatedServiceCost = Math.min(
          serviceCost,
          periodWorkMilesSinceService * costPerMile
        );
        const bucketWorkMilesSinceService = bucketShifts
          .filter((shift) => getShiftVehicleKey(shift) === serviceVehicleKey)
          .reduce((miles, shift) => {
            const shiftStart = Number(shift.beginningMileage);
            const shiftEnd = Number(shift.endingMileage);
            return miles + getMileageRangeOverlapMiles(
              shiftStart,
              shiftEnd,
              serviceStartOdometer,
              serviceEndOdometer
            );
          }, 0);

        return sum + (
          bucketWorkMilesSinceService / periodWorkMilesSinceService
        ) * periodAllocatedServiceCost;
      }, 0);

      const bucketNetProfit = bucketGrossPay - bucketFuelCost - bucketServiceCost;

      return {
        label: weekday.label,
        fullLabel: weekday.fullLabel,
        dayIndex: weekday.dayIndex,
        hours: roundCurrency(bucketHours),
        grossPay: roundCurrency(bucketGrossPay),
        fuelCost: roundCurrency(bucketFuelCost),
        serviceCost: roundCurrency(bucketServiceCost),
        netProfit: roundCurrency(bucketNetProfit),
        netPerHour: bucketHours > 0 ? bucketNetProfit / bucketHours : 0,
      };
    });
    const bestDayGrossDiff = roundCurrency(
      roundCurrency(totalGrossPay) -
      roundCurrency(bestDayData.reduce((sum, bucket) => sum + bucket.grossPay, 0))
    );
    const bestDayNetDiff = roundCurrency(
      roundCurrency(trueNetProfit) -
      roundCurrency(bestDayData.reduce((sum, bucket) => sum + bucket.netProfit, 0))
    );
    const reconciliationTolerance = 0.005;

    if (
      bestDayData.length > 0 &&
      (Math.abs(bestDayGrossDiff) > reconciliationTolerance ||
        Math.abs(bestDayNetDiff) > reconciliationTolerance)
    ) {
      let reconciliationIndex = bestDayData.length - 1;

      for (let index = bestDayData.length - 1; index >= 0; index -= 1) {
        if (bestDayData[index].hours > 0) {
          reconciliationIndex = index;
          break;
        }
      }

      bestDayData = bestDayData.map((bucket, index) => {
        if (index !== reconciliationIndex) return bucket;

        const grossPay = roundCurrency(bucket.grossPay + bestDayGrossDiff);
        const netProfit = roundCurrency(bucket.netProfit + bestDayNetDiff);

        return {
          ...bucket,
          grossPay,
          netProfit,
          netPerHour: bucket.hours > 0 ? netProfit / bucket.hours : 0,
        };
      });
    }

    const activeBestDayData = bestDayData.filter((bucket) => bucket.hours > 0);
    const sortedBestDayData = [...activeBestDayData].sort(
      (a, b) => b.netPerHour - a.netPerHour
    );
    const bestDayBucket = sortedBestDayData[0] ?? bestDayData[0];
    const lowestDayBucket = [...activeBestDayData].sort(
      (a, b) => a.netPerHour - b.netPerHour
    )[0] ?? bestDayData[0];
    const avgNetPerHour = totalHours > 0 ? trueNetProfit / totalHours : 0;
    const hasEnoughBestDayData = activeBestDayData.length >= 2 && completedPeriodShifts.length >= 3;
    const closeBestThreshold = Math.max(2, Math.abs(bestDayBucket.netPerHour) * 0.1);
    const closeBestDays = sortedBestDayData.filter(
      (bucket) => bestDayBucket.netPerHour - bucket.netPerHour <= closeBestThreshold
    );
    const bestDaysInsight = !hasEnoughBestDayData
      ? "Add more completed shifts to reveal your best days to work."
      : closeBestDays.length >= 2
        ? `Your strongest days are ${closeBestDays[0].fullLabel} and ${closeBestDays[1].fullLabel}.`
        : `You earn the most when you work on ${bestDayBucket.fullLabel}.`;

    const avgMpg = fuelCostResult.averageMpg;
    const avgFuelPrice = fuelCostResult.averageFuelPricePerGallon;
    const estimatedGallonsUsed = fuelCostResult.estimatedGallonsUsed;
    const warnings: Array<{ title: string; description: string }> = [];

    if (unassignedServiceRecords.length > 0) {
      warnings.push({
        title: "Unassigned service records excluded",
        description: `${unassignedServiceRecords.length} service record${unassignedServiceRecords.length === 1 ? "" : "s"} without a vehicle are excluded from service cost allocation.`,
      });
    }
    if (fuelCostNeedsMpg) {
      warnings.push({
        title: "Fuel cost history needed",
        description: "Work miles exist, but there is not enough completed full-fill history to calculate average MPG and fuel price.",
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
      totalDeliveries, totalHours, totalGrossPay, totalAdjustments,
      shiftGrossPay, totalShiftMiles,
      workFuelCost, netProfit: trueNetProfit, netProfitPct: trueNetPct, fuelPct,
      fuelCostPerMile,
      avgFuelPrice,
      estimatedGallonsUsed,
      fuelCostNeedsMpg,
      hourlyRate: totalHours > 0 ? trueNetProfit / totalHours : 0,
      profitPerDelivery: totalDeliveries > 0 ? trueNetProfit / totalDeliveries : 0,
      yearServiceCost, businessServiceCost, unallocatedServiceCost, serviceDetails, trueNetProfit, trueNetPct, serviceCostPct,
      bestDayData, bestDayBucket, lowestDayBucket, avgNetPerHour, bestDaysInsight,
      hasEnoughBestDayData, avgMpg, warnings, fuelOnlyProfitPct,
      hasData: completedPeriodShifts.length > 0 || totalAdjustments > 0,
    };
  }, [shifts, fuelEntries, serviceEntries, serviceIntervals, adjustments, selectedRange, selectedVehicleId]);

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
    shiftGrossPay, totalShiftMiles,
    workFuelCost, netProfit, netProfitPct, fuelPct, fuelCostNeedsMpg,
    avgFuelPrice, estimatedGallonsUsed,
    profitPerDelivery,
    yearServiceCost, businessServiceCost, unallocatedServiceCost, serviceDetails, trueNetProfit, trueNetPct,
    bestDayData, bestDayBucket, lowestDayBucket, avgNetPerHour, bestDaysInsight,
    hasEnoughBestDayData, avgMpg, warnings, fuelOnlyProfitPct,
    hasData,
  } = metrics;
  const visibleServiceDetails = serviceDetails.filter(
    (service) => service.workMilesSinceService > 0 || service.allocatedServiceCost > 0
  );
  const bestDaysChartHighestValue = Math.max(
    ...bestDayData.map((bucket) => bucket.netPerHour),
    avgNetPerHour,
    0
  );
  const bestDaysChartYInterval = getProfitPerHourYAxisInterval(bestDaysChartHighestValue);
  const bestDaysChartMaxValue = Math.max(
    roundUpToInterval(bestDaysChartHighestValue, bestDaysChartYInterval),
    bestDaysChartYInterval
  );
  const bestDaysChartYTicks = buildAxisTicks(bestDaysChartMaxValue, bestDaysChartYInterval);
  const bestDaysChartWidth = 360;
  const bestDaysChartHeight = 230;
  const bestDaysChartLeft = 42;
  const bestDaysChartRight = 16;
  const bestDaysChartTop = 28;
  const bestDaysChartPlotHeight = 138;
  const bestDaysChartBottom = bestDaysChartTop + bestDaysChartPlotHeight;
  const bestDaysChartPlotWidth = bestDaysChartWidth - bestDaysChartLeft - bestDaysChartRight;
  const bestDaysChartBucketWidth = bestDaysChartPlotWidth / Math.max(bestDayData.length - 1, 1);
  const getBestDaysChartX = (index: number) =>
    bestDaysChartLeft + bestDaysChartBucketWidth * index;
  const getBestDaysChartY = (value: number) =>
    bestDaysChartBottom -
    (Math.max(0, value) / bestDaysChartMaxValue) * bestDaysChartPlotHeight;
  const bestDaysLinePoints = bestDayData.map((bucket, index) => ({
    x: getBestDaysChartX(index),
    y: getBestDaysChartY(bucket.netPerHour),
  }));
  const bestDaysLinePath = pointsToPath(bestDaysLinePoints);
  const bestDaysAreaPath = bestDaysLinePoints.length > 0
    ? `${bestDaysLinePath} L ${bestDaysLinePoints[bestDaysLinePoints.length - 1].x} ${bestDaysChartBottom} L ${bestDaysLinePoints[0].x} ${bestDaysChartBottom} Z`
    : "";

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

        {/* DATE RANGE SELECTOR */}
        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm text-slate-400">Range:</span>
          <select
            value={selectedRange.type}
            onChange={(e) => setSelectedRangeKey(e.target.value as RangeType)}
            className="max-w-[260px] rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          >
            {rangeOptions.map((range) => (
              <option key={range.type} value={range.type}>
                {range.label}
              </option>
            ))}
          </select>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          {formatLongDate(selectedRange.rangeStart)} - {formatLongDate(selectedRange.rangeEnd)}
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
            <p className="text-slate-500">No data for {selectedRange.label.toLowerCase()}.</p>
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
                    {selectedRange.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Deliveries", value: totalDeliveries.toLocaleString(), sub: "Total" },
                    { label: "Hours Worked", value: totalHours.toFixed(2), sub: "Total" },
                    { label: "Total Income", value: fmtDollar(totalGrossPay), sub: "Shift gross + adjustments" },
                    ...(totalAdjustments !== 0
                      ? [{ label: "Pay Adjustments", value: fmtDollar(totalAdjustments), sub: "Pay records" }]
                      : []),
                    {
                      label: "Work Fuel Cost",
                      value: fuelCostNeedsMpg ? "Pending" : fmtDollar(workFuelCost),
                      sub: fuelCostNeedsMpg ? "Add full-fill history" : "MPG x fuel price",
                    },
                    {
                      label: "Service Cost",
                      value: fmtDollar(businessServiceCost),
                      sub: "Mileage-based allocation",
                    },
                    {
                      label: "True Net Profit",
                      value: fmtDollar(netProfit),
                      sub: fuelCostNeedsMpg ? "Fuel cost pending" : "After fuel + service",
                      emerald: true,
                    },
                    { label: "Per Delivery", value: fmtDollar(profitPerDelivery), sub: "Average" },
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

            {/* ── SECTION 3: BEST DAYS ── */}
            <div className="relative mt-6">
              <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-purple-500" />
              <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold tracking-tight">Best Days to Work</h2>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 text-slate-400">
                        <Info size={13} strokeWidth={2.4} />
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">Net profit per hour</p>
                  </div>
                  <span className="mt-1 flex shrink-0 items-center rounded-full bg-purple-950/80 px-3 py-1.5 text-xs font-semibold text-purple-300 shadow-[0_0_18px_rgba(168,85,247,0.18)]">
                    {selectedRange.label}
                  </span>
                </div>

                <div className="pt-1">
                  <svg
                    className="block w-full"
                    height={bestDaysChartHeight}
                    viewBox={`0 0 ${bestDaysChartWidth} ${bestDaysChartHeight}`}
                    role="img"
                    aria-label="Net profit per hour by day of week"
                  >
                    <defs>
                      <linearGradient id="best-days-area" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgb(168 85 247)" stopOpacity="0.34" />
                        <stop offset="100%" stopColor="rgb(168 85 247)" stopOpacity="0.03" />
                      </linearGradient>
                      <filter id="best-days-glow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    {bestDaysChartYTicks.map((tick) => {
                      const y = getBestDaysChartY(tick);

                      return (
                        <g key={tick}>
                          <line
                            x1={bestDaysChartLeft}
                            y1={y}
                            x2={bestDaysChartWidth - bestDaysChartRight}
                            y2={y}
                            stroke={tick === 0 ? "rgb(51 65 85)" : "rgb(30 41 59)"}
                            strokeWidth={tick === 0 ? "1.25" : "1"}
                            strokeDasharray={tick === 0 ? undefined : "3 5"}
                            opacity={tick === 0 ? 1 : 0.65}
                          />
                          <text
                            x={bestDaysChartLeft - 7}
                            y={y + 3}
                            textAnchor="end"
                            className="fill-slate-400 text-[11px]"
                          >
                            {fmtDollarPerHour(tick)}
                          </text>
                        </g>
                      );
                    })}

                    <path d={bestDaysAreaPath} fill="url(#best-days-area)" />
                    <path
                      d={bestDaysLinePath}
                      fill="none"
                      stroke="rgb(168 85 247)"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                      filter="url(#best-days-glow)"
                    />

                    {bestDayData.map((bucket, index) => {
                      const x = getBestDaysChartX(index);
                      const y = getBestDaysChartY(bucket.netPerHour);
                      const labelY = Math.max(8, y - 9);
                      const labelX = Math.max(
                        bestDaysChartLeft + 12,
                        Math.min(bestDaysChartWidth - bestDaysChartRight - 12, x)
                      );

                      return (
                        <g key={bucket.label}>
                          <circle
                            cx={x}
                            cy={y}
                            r="4.5"
                            fill="rgb(168 85 247)"
                            stroke="rgb(15 23 42)"
                            strokeWidth="2"
                          />
                          <text
                            x={labelX}
                            y={labelY}
                            textAnchor="middle"
                            className="fill-purple-300 text-[10px] font-semibold"
                          >
                            {fmtDollarPerHour(bucket.netPerHour)}
                          </text>
                          <text
                            x={x}
                            y={bestDaysChartHeight - 14}
                            textAnchor="middle"
                            className="fill-slate-400 text-[12px]"
                          >
                            {bucket.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="mt-2 grid grid-cols-4 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 shadow-inner shadow-black/20">
                  {[
                    {
                      label: "Best Day",
                      value: hasEnoughBestDayData ? bestDayBucket.fullLabel : "Need data",
                      sub: hasEnoughBestDayData ? fmtDollarPerHour(bestDayBucket.netPerHour) : "$0/hr",
                      Icon: TrendingUp,
                      tone: "text-emerald-400",
                      iconBg: "bg-emerald-500/10",
                      iconBorder: "border-emerald-500/30",
                    },
                    {
                      label: "Lowest Day",
                      value: hasEnoughBestDayData ? lowestDayBucket.fullLabel : "Need data",
                      sub: hasEnoughBestDayData ? fmtDollarPerHour(lowestDayBucket.netPerHour) : "$0/hr",
                      Icon: TrendingDown,
                      tone: "text-amber-400",
                      iconBg: "bg-amber-500/10",
                      iconBorder: "border-amber-500/30",
                    },
                    {
                      label: "Total Hours",
                      value: fmtCompactHours(totalHours),
                      sub: "hrs",
                      Icon: Clock,
                      tone: "text-blue-400",
                      iconBg: "bg-blue-500/10",
                      iconBorder: "border-blue-500/30",
                    },
                    {
                      label: "Avg Net / Hr",
                      value: fmtDollarPerHour(avgNetPerHour),
                      sub: "per hour",
                      Icon: DollarSign,
                      tone: "text-emerald-400",
                      iconBg: "bg-emerald-500/10",
                      iconBorder: "border-emerald-500/30",
                    },
                  ].map((stat, index) => (
                    <div
                      key={stat.label}
                      className={`min-w-0 px-2 py-3 text-center ${index === 0 ? "" : "border-l border-slate-800"
                        }`}
                    >
                      <span
                        className={`mx-auto mb-2 hidden h-8 w-8 items-center justify-center rounded-full border sm:flex ${stat.iconBg} ${stat.iconBorder} ${stat.tone}`}
                      >
                        <stat.Icon size={16} strokeWidth={2.4} />
                      </span>
                      <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                        {stat.label}
                      </p>
                      <p className={`mt-1 truncate text-sm font-bold ${stat.tone}`}>{stat.value}</p>
                      <p className="truncate text-[11px] text-slate-300">{stat.sub}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-3 rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-600/70 text-purple-50 shadow-[0_0_20px_rgba(147,51,234,0.28)]">
                    <Lightbulb size={22} strokeWidth={2.1} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">{bestDaysInsight}</p>
                    {hasEnoughBestDayData && (
                      <p className="mt-1 text-xs text-slate-400">
                        Focus your time on these days to maximize your take-home pay.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </div>

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

                {/* REQUIRES FUEL HISTORY */}
                {fuelCostNeedsMpg ? (
                  <p className="text-center text-sm text-slate-500">
                    Add at least two full fill-ups to calculate average MPG and fuel price.
                  </p>
                ) : (
                  <>
                    {/* FUEL ESTIMATE */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
                      <div className="flex items-center justify-between">
                        <span>Work miles</span>
                        <span>{totalShiftMiles.toLocaleString()} mi</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span>Average MPG</span>
                        <span>{avgMpg.toFixed(1)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span>Average fuel price</span>
                        <span>{fmtDollar(avgFuelPrice)}/gal</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span>Estimated gallons used</span>
                        <span>{estimatedGallonsUsed.toFixed(2)} gal</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between font-semibold text-slate-200">
                        <span>Work fuel cost</span>
                        <span>{fmtDollar(workFuelCost)}</span>
                      </div>
                      <p className="mt-2 text-slate-500">
                        Fuel cost = work miles ÷ average MPG × average fuel price.
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
                          <span className="text-sm text-slate-300">− Total Work Fuel Cost</span>
                          <span className="text-sm text-red-400">
                            −{fmtDollar(workFuelCost)}
                          </span>
                        </div>
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
    </main>
  );
}
