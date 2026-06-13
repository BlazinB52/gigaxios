"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { loadShiftsFromSupabase } from "@/app/lib/storage";
import {
  calculateSimpleWorkFuelCost,
  calculateWorkFuelCost,
} from "@/app/lib/fuelCost";
import {
  FuelEntry,
  getFuelEntryTotalCost,
  loadFuelEntriesFromSupabase,
} from "@/app/lib/fuelStorage";
import {
  ServiceEntry,
  ServiceInterval,
  loadServiceEntriesFromSupabase,
  loadServiceIntervalsFromSupabase,
} from "@/app/lib/garageStorage";
import { PayAdjustment, SavedShift } from "@/app/lib/types";

type RangeType = "current_pay_period" | "previous_pay_period" | "month" | "quarter" | "year";

type DateRangeOption = {
  label: string;
  rangeStart: string;
  rangeEnd: string;
  type: RangeType;
};

type FormulaCardProps = {
  title: string;
  purpose: string;
  formula: string;
  values: string;
  result: string;
  source: string;
  warning?: string;
};

type WarningItem = {
  title: string;
  description: string;
  detail: string;
};

type CompletedFuelCycle = {
  id: string;
  vehicleKey: string;
  startEntry: FuelEntry;
  endEntry: FuelEntry;
  partialFillUps: FuelEntry[];
  cycleMiles: number;
  gallons: number;
  fuelCost: number;
  mpg: number;
  fuelCostPerMile: number;
  workMiles: number;
  businessUse: number;
  workFuelCost: number;
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

const fmtCurrency = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD" });

const fmtNumber = (value: number, digits = 2) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date(0);
  if (dateStr.includes("/")) {
    const [month, day, year] = dateStr.split("/");
    return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
  }
  return new Date(`${dateStr}T12:00:00`);
}

function toISODate(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  if (date.getTime() === 0 || Number.isNaN(date.getTime())) return "";
  return formatISODate(date);
}

function formatISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
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

function FormulaCard({
  title,
  purpose,
  formula,
  values,
  result,
  source,
  warning,
}: FormulaCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">{purpose}</p>
        </div>
        <div className="rounded-md bg-slate-950 px-4 py-2 text-right text-lg font-bold text-white">
          {warning ? "Warning" : result}
        </div>
      </div>

      {warning && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {warning}
        </div>
      )}

      <dl className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-3 text-sm">
        <dt className="font-semibold text-slate-700">Formula</dt>
        <dd className="font-mono text-slate-950">{formula}</dd>
        <dt className="font-semibold text-slate-700">Values Used</dt>
        <dd className="text-slate-950">{values}</dd>
        <dt className="font-semibold text-slate-700">Result</dt>
        <dd className="font-semibold text-slate-950">{result}</dd>
        <dt className="font-semibold text-slate-700">Source</dt>
        <dd className="text-slate-600">{source}</dd>
      </dl>
    </article>
  );
}

function getFuelSortValue(entry: FuelEntry): number {
  const odometer = Number(entry.odometer || 0);
  if (odometer > 0) return odometer;

  const dateValue = parseLocalDate(entry.date).getTime();
  return Number.isFinite(dateValue) ? dateValue : 0;
}

function getVehicleCycleKey(entry: FuelEntry): string {
  return entry.vehicleId || "unassigned";
}

function getShiftCycleVehicleKey(shift: SavedShift): string {
  return shift.vehicleId || "unassigned";
}

function getRecordVehicleKey(record: { vehicleId?: string }): string {
  return record.vehicleId || "unassigned";
}

function getShiftCycleOverlapMiles(
  shift: SavedShift,
  cycleStartOdometer: number,
  cycleEndOdometer: number
): number {
  const shiftStart = Number(shift.beginningMileage || 0);
  const shiftEnd = Number(shift.endingMileage || 0);
  if (!(shiftStart > 0 && shiftEnd > shiftStart)) return 0;

  return Math.max(
    0,
    Math.min(shiftEnd, cycleEndOdometer) - Math.max(shiftStart, cycleStartOdometer)
  );
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

  return (
    intervals.find(
      (interval) =>
        normalizeServiceType(interval.serviceType) === serviceType &&
        interval.vehicleId === null
    ) ?? null
  );
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
  const serviceDate = parseLocalDate(service.date).getTime();
  const serviceOdometer = Number(service.odometer);
  const hasServiceOdometer = Number.isFinite(serviceOdometer) && serviceOdometer > 0;

  return shifts.reduce((sum, shift) => {
    const shiftDate = parseLocalDate(shift.date).getTime();
    if (shiftDate < serviceDate) return sum;

    const beginning = Number(shift.beginningMileage);
    const ending = Number(shift.endingMileage);
    if (!(beginning > 0 && ending > beginning)) return sum;
    if (hasServiceOdometer && ending <= serviceOdometer) return sum;

    const effectiveBeginning = hasServiceOdometer
      ? Math.max(beginning, serviceOdometer)
      : beginning;
    return sum + Math.max(0, ending - effectiveBeginning);
  }, 0);
}

function WarningCard({ warning }: { warning: WarningItem }) {
  return (
    <article className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-sm">
      <h3 className="text-lg font-semibold">{warning.title}</h3>
      <p className="mt-2 text-sm">{warning.description}</p>
      <p className="mt-3 rounded-md bg-white/70 px-3 py-2 text-sm font-medium">
        {warning.detail}
      </p>
    </article>
  );
}

export default function BugcheckPage() {
  const router = useRouter();
  const [shifts, setShifts] = useState<SavedShift[]>([]);
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);
  const [serviceEntries, setServiceEntries] = useState<ServiceEntry[]>([]);
  const [serviceIntervals, setServiceIntervals] = useState<ServiceInterval[]>([]);
  const [adjustments, setAdjustments] = useState<PayAdjustment[]>([]);
  const [weekStartsOn, setWeekStartsOn] = useState(1);
  const [selectedRangeKey, setSelectedRangeKey] = useState<RangeType>("current_pay_period");
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

      const resolvedWeekStartsOn = getWeekStartDay();
      setWeekStartsOn(resolvedWeekStartsOn);

      const [
        loadedShifts,
        loadedFuelEntries,
        loadedServiceEntries,
        loadedServiceIntervals,
        adjustmentRes,
      ] = await Promise.all([
        loadShiftsFromSupabase(user.id),
        loadFuelEntriesFromSupabase(user.id),
        loadServiceEntriesFromSupabase(user.id),
        loadServiceIntervalsFromSupabase(user.id),
        supabase.from("pay_adjustments").select("*").eq("user_id", user.id),
      ]);

      setShifts(loadedShifts as SavedShift[]);
      setFuelEntries(loadedFuelEntries);
      setServiceEntries(loadedServiceEntries);
      setServiceIntervals(loadedServiceIntervals);
      setAdjustments(
        (adjustmentRes.data ?? []).map((adjustment) => ({
          id: adjustment.id,
          userId: adjustment.user_id,
          platform: adjustment.platform,
          weekStart: adjustment.week_start,
          weekEnd: adjustment.week_end,
          adjustmentType: adjustment.adjustment_type,
          amount: Number(adjustment.amount || 0),
          notes: adjustment.notes,
          createdAt: adjustment.created_at,
        }))
      );
      setIsLoaded(true);
    }

    load();
  }, [router]);

  const rangeOptions = useMemo<DateRangeOption[]>(() => {
    const today = new Date();
    const currentPayPeriod = getPayPeriodForDate(today, weekStartsOn);
    const previousPayPeriodStart = parseLocalDate(currentPayPeriod.weekStart);
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

  const completedPeriodShifts = useMemo(
    () =>
      shifts.filter(
        (shift) =>
          shift.status === "closed" &&
          isDateInRange(shift.date, selectedRange.rangeStart, selectedRange.rangeEnd)
      ),
    [selectedRange.rangeEnd, selectedRange.rangeStart, shifts]
  );
  const selectedPeriodVehicleIds = useMemo(
    () =>
      Array.from(
        new Set(
          completedPeriodShifts
            .map((shift) => shift.vehicleId)
            .filter((vehicleId): vehicleId is string => Boolean(vehicleId))
        )
      ),
    [completedPeriodShifts]
  );
  const selectedPeriodVehicleKeys = useMemo(
    () =>
      selectedPeriodVehicleIds.length > 0
        ? selectedPeriodVehicleIds
        : completedPeriodShifts.some((shift) => !shift.vehicleId)
          ? ["unassigned"]
          : [],
    [completedPeriodShifts, selectedPeriodVehicleIds]
  );
  const scopedFuelEntries = useMemo(
    () =>
      selectedPeriodVehicleIds.length > 0
        ? fuelEntries.filter((entry) => entry.vehicleId && selectedPeriodVehicleIds.includes(entry.vehicleId))
        : fuelEntries.filter((entry) => !entry.vehicleId),
    [fuelEntries, selectedPeriodVehicleIds]
  );
  const scopedServiceEntries = useMemo(
    () =>
      serviceEntries.filter(
        (entry) => entry.vehicleId && selectedPeriodVehicleIds.includes(entry.vehicleId)
      ),
    [selectedPeriodVehicleIds, serviceEntries]
  );
  const unassignedServiceEntries = useMemo(
    () => serviceEntries.filter((entry) => !entry.vehicleId),
    [serviceEntries]
  );

  const periodFuelEntries = useMemo(
    () =>
      scopedFuelEntries
        .filter((entry) =>
          isDateInRange(entry.date, selectedRange.rangeStart, selectedRange.rangeEnd)
        )
        .sort((a, b) => Number(a.odometer || 0) - Number(b.odometer || 0)),
    [scopedFuelEntries, selectedRange.rangeEnd, selectedRange.rangeStart]
  );
  const chronologicalPeriodFuelEntries = useMemo(
    () =>
      scopedFuelEntries
        .filter((entry) =>
          isDateInRange(entry.date, selectedRange.rangeStart, selectedRange.rangeEnd)
        )
        .sort((a, b) => {
          const dateCompare = toISODate(a.date).localeCompare(toISODate(b.date));
          if (dateCompare !== 0) return dateCompare;
          return getFuelSortValue(a) - getFuelSortValue(b);
        }),
    [scopedFuelEntries, selectedRange.rangeEnd, selectedRange.rangeStart]
  );

  const periodAdjustments = useMemo(
    () =>
      adjustments.filter((adjustment) =>
        isDateInRange(adjustment.weekStart, selectedRange.rangeStart, selectedRange.rangeEnd)
      ),
    [adjustments, selectedRange.rangeEnd, selectedRange.rangeStart]
  );

  const shiftGrossPay = completedPeriodShifts.reduce(
    (sum, shift) => sum + Number(shift.grossPay || 0),
    0
  );
  const adjustmentTotal = periodAdjustments.reduce(
    (sum, adjustment) => sum + Number(adjustment.amount || 0),
    0
  );
  const totalIncome = shiftGrossPay + adjustmentTotal;
  const workMiles = completedPeriodShifts.reduce((sum, shift) => {
    const beginning = Number(shift.beginningMileage || 0);
    const ending = Number(shift.endingMileage || 0);
    return sum + Math.max(0, ending - beginning);
  }, 0);
  const vehicleFuelCostResults = selectedPeriodVehicleKeys.map((vehicleKey) => {
    const vehicleShifts = completedPeriodShifts.filter(
      (shift) => getShiftCycleVehicleKey(shift) === vehicleKey
    );
    const vehicleWorkMiles = vehicleShifts.reduce((sum, shift) => {
      const beginning = Number(shift.beginningMileage || 0);
      const ending = Number(shift.endingMileage || 0);
      return sum + Math.max(0, ending - beginning);
    }, 0);
    const vehicleFuelEntries = periodFuelEntries.filter(
      (entry) => getRecordVehicleKey(entry) === vehicleKey
    );
    const result = calculateWorkFuelCost({
      workMiles: vehicleWorkMiles,
      fuelEntries: vehicleFuelEntries,
    });

    return {
      vehicleKey,
      workMiles: vehicleWorkMiles,
      result,
    };
  });
  function getLatestKnownOdometer(vehicleId?: string): number {
    const odometerValues = [
      ...fuelEntries
        .filter((entry) => !vehicleId || entry.vehicleId === vehicleId)
        .map((entry) => Number(entry.odometer || 0)),
      ...shifts
        .filter((shift) => !vehicleId || shift.vehicleId === vehicleId)
        .flatMap((shift) => [
          Number(shift.beginningMileage || 0),
          Number(shift.endingMileage || 0),
        ]),
      ...serviceEntries
        .filter((entry) => !vehicleId || entry.vehicleId === vehicleId)
        .map((entry) => Number(entry.odometer || 0)),
    ].filter((value) => Number.isFinite(value) && value > 0);

    return odometerValues.length > 0 ? Math.max(...odometerValues) : 0;
  }

  const closedShifts = useMemo(
    () => shifts.filter((shift) => shift.status === "closed"),
    [shifts]
  );
  const completedFuelCycles = useMemo<CompletedFuelCycle[]>(() => {
    const fuelByVehicle = new Map<string, FuelEntry[]>();

    scopedFuelEntries.forEach((entry) => {
      const vehicleKey = getVehicleCycleKey(entry);
      fuelByVehicle.set(vehicleKey, [...(fuelByVehicle.get(vehicleKey) ?? []), entry]);
    });

    const cycles: CompletedFuelCycle[] = [];

    fuelByVehicle.forEach((vehicleFuelEntries, vehicleKey) => {
      const sortedFullFillUps = vehicleFuelEntries
        .filter((entry) => (entry.isFullFillUp ?? true) && Number(entry.odometer || 0) > 0)
        .sort((a, b) => {
          const odometerDiff = Number(a.odometer || 0) - Number(b.odometer || 0);
          if (odometerDiff !== 0) return odometerDiff;
          return toISODate(a.date).localeCompare(toISODate(b.date));
        });

      for (let index = 1; index < sortedFullFillUps.length; index += 1) {
        const startEntry = sortedFullFillUps[index - 1];
        const endEntry = sortedFullFillUps[index];
        const startOdometer = Number(startEntry.odometer || 0);
        const endOdometer = Number(endEntry.odometer || 0);
        const cycleMiles = endOdometer - startOdometer;
        const gallons = Number(endEntry.gallons || 0);
        const fuelCost = getFuelEntryTotalCost(endEntry);

        if (!(cycleMiles > 0)) continue;

        const cycleShifts =
          vehicleKey === "unassigned"
            ? closedShifts
            : closedShifts.filter((shift) => getShiftCycleVehicleKey(shift) === vehicleKey);
        const workMiles = cycleShifts.reduce(
          (sum, shift) => sum + getShiftCycleOverlapMiles(shift, startOdometer, endOdometer),
          0
        );
        const fuelCostPerMile = fuelCost > 0 ? fuelCost / cycleMiles : 0;
        const partialFillUps = vehicleFuelEntries
          .filter((entry) => {
            const odometer = Number(entry.odometer || 0);
            return (
              !(entry.isFullFillUp ?? true) &&
              odometer > startOdometer &&
              odometer < endOdometer
            );
          })
          .sort((a, b) => Number(a.odometer || 0) - Number(b.odometer || 0));

        cycles.push({
          id: `${vehicleKey}-${startEntry.id}-${endEntry.id}`,
          vehicleKey,
          startEntry,
          endEntry,
          partialFillUps,
          cycleMiles,
          gallons,
          fuelCost,
          mpg: gallons > 0 ? cycleMiles / gallons : 0,
          fuelCostPerMile,
          workMiles,
          businessUse: cycleMiles > 0 ? workMiles / cycleMiles : 0,
          workFuelCost: workMiles * fuelCostPerMile,
        });
      }
    });

    return cycles.sort((a, b) => {
      const dateCompare = toISODate(b.endEntry.date).localeCompare(toISODate(a.endEntry.date));
      if (dateCompare !== 0) return dateCompare;
      return Number(b.endEntry.odometer || 0) - Number(a.endEntry.odometer || 0);
    });
  }, [closedShifts, scopedFuelEntries]);
  const periodFuelCycleCoverage = useMemo(
    () =>
      completedFuelCycles.filter((cycle) =>
        isDateInRange(cycle.endEntry.date, selectedRange.rangeStart, selectedRange.rangeEnd)
      ),
    [completedFuelCycles, selectedRange.rangeEnd, selectedRange.rangeStart]
  );
  const totalFuelOdometerMiles = periodFuelCycleCoverage.reduce(
    (sum, cycle) => sum + cycle.cycleMiles,
    0
  );
  const fuelCycleCoverageValues =
    periodFuelCycleCoverage.length > 0
      ? periodFuelCycleCoverage
          .map(
            (cycle) =>
              `${fmtNumber(Number(cycle.endEntry.odometer || 0), 0)} - ${fmtNumber(
                Number(cycle.startEntry.odometer || 0),
                0
              )}`
          )
          .join(" + ")
      : "No completed full-fill cycles closing in range";
  const primaryFuelCostResult = calculateSimpleWorkFuelCost({
    workMiles,
    completedFuelCycles: periodFuelCycleCoverage,
  });
  const businessUse =
    totalFuelOdometerMiles > 0 ? workMiles / totalFuelOdometerMiles : 0;
  const businessUseWarning =
    workMiles > totalFuelOdometerMiles
      ? `Work miles (${fmtNumber(workMiles)}) are greater than completed fuel-cycle odometer miles (${fmtNumber(
          totalFuelOdometerMiles
        )}). Business Use final verification is pending for open-cycle miles.`
      : "";
  const verifiedCompletedFuelCycles = useMemo<CompletedFuelCycle[]>(
    () =>
      completedFuelCycles
        .map((cycle) => {
          const startOdometer = Number(cycle.startEntry.odometer || 0);
          const endOdometer = Number(cycle.endEntry.odometer || 0);
          const cycleShifts =
            cycle.vehicleKey === "unassigned"
              ? completedPeriodShifts
              : completedPeriodShifts.filter(
                  (shift) => getShiftCycleVehicleKey(shift) === cycle.vehicleKey
                );
          const periodWorkMiles = cycleShifts.reduce(
            (sum, shift) =>
              sum + getShiftCycleOverlapMiles(shift, startOdometer, endOdometer),
            0
          );

          return {
            ...cycle,
            workMiles: periodWorkMiles,
            businessUse: cycle.cycleMiles > 0 ? periodWorkMiles / cycle.cycleMiles : 0,
            workFuelCost: periodWorkMiles * cycle.fuelCostPerMile,
          };
        })
        .filter((cycle) => cycle.workMiles > 0),
    [completedFuelCycles, completedPeriodShifts]
  );
  const fuelCostAuditTotal = verifiedCompletedFuelCycles.reduce(
    (sum, cycle) => sum + cycle.workFuelCost,
    0
  );
  const verifiedCompletedCycleWorkMiles = verifiedCompletedFuelCycles.reduce(
    (sum, cycle) => sum + cycle.workMiles,
    0
  );
  const openCycleUnverifiedWorkMiles = Math.max(
    0,
    workMiles - verifiedCompletedCycleWorkMiles
  );
  const openCycleFuelEstimateResults = selectedPeriodVehicleKeys.map((vehicleKey) => {
    const vehicleWorkMiles =
      vehicleFuelCostResults.find((vehicle) => vehicle.vehicleKey === vehicleKey)
        ?.workMiles ?? 0;
    const completedCycleWorkMiles = verifiedCompletedFuelCycles
      .filter((cycle) => cycle.vehicleKey === vehicleKey)
      .reduce((sum, cycle) => sum + cycle.workMiles, 0);
    const openCycleWorkMiles = Math.max(0, vehicleWorkMiles - completedCycleWorkMiles);
    const vehicleFuelEntries = periodFuelEntries.filter(
      (entry) => getRecordVehicleKey(entry) === vehicleKey
    );
    const result = calculateWorkFuelCost({
      workMiles: openCycleWorkMiles,
      fuelEntries: vehicleFuelEntries,
    });

    return {
      vehicleKey,
      openCycleWorkMiles,
      result,
    };
  });
  const completedCycleFuelCost = fuelCostAuditTotal;
  const openCycleFuelCostEstimate = openCycleFuelEstimateResults.reduce(
    (sum, vehicle) => sum + vehicle.result.workFuelCost,
    0
  );
  const fuelCostNeedsMpg = workMiles > 0 && primaryFuelCostResult.needsMpg;
  const fuelCostResult = {
    workFuelCost: primaryFuelCostResult.workFuelCost,
    effectiveCostPerMile: primaryFuelCostResult.effectiveCostPerMile,
    averageMpg: primaryFuelCostResult.averageMpg,
    averageFuelPricePerGallon: primaryFuelCostResult.averageFuelPricePerGallon,
    estimatedGallonsUsed: primaryFuelCostResult.estimatedGallonsUsed,
    cycleCount: primaryFuelCostResult.cycleCount,
    completedCycleFuelCost,
    openCycleFuelCostEstimate,
    isEstimated: true,
    needsMpg: fuelCostNeedsMpg,
    source: fuelCostNeedsMpg ? "unavailable" : "average_mpg_and_price",
  };
  const openFuelCycles = useMemo(() => {
    const fuelByVehicle = new Map<string, FuelEntry[]>();

    scopedFuelEntries.forEach((entry) => {
      const vehicleKey = getVehicleCycleKey(entry);
      fuelByVehicle.set(vehicleKey, [...(fuelByVehicle.get(vehicleKey) ?? []), entry]);
    });

    return Array.from(fuelByVehicle.entries())
      .map(([vehicleKey, vehicleFuelEntries]) => {
        const lastFullFillUp = vehicleFuelEntries
          .filter((entry) => (entry.isFullFillUp ?? true) && Number(entry.odometer || 0) > 0)
          .sort((a, b) => Number(b.odometer || 0) - Number(a.odometer || 0))[0];

        if (!lastFullFillUp) return null;

        const partialFillUps = vehicleFuelEntries
          .filter(
            (entry) =>
              !(entry.isFullFillUp ?? true) &&
              Number(entry.odometer || 0) > Number(lastFullFillUp.odometer || 0)
          )
          .sort((a, b) => Number(a.odometer || 0) - Number(b.odometer || 0));

        return {
          vehicleKey,
          lastFullFillUp,
          partialFillUps,
        };
      })
      .filter((cycle): cycle is {
        vehicleKey: string;
        lastFullFillUp: FuelEntry;
        partialFillUps: FuelEntry[];
      } => cycle !== null)
      .sort((a, b) => Number(b.lastFullFillUp.odometer || 0) - Number(a.lastFullFillUp.odometer || 0));
  }, [scopedFuelEntries]);
  const serviceDiagnostics = scopedServiceEntries
    .slice()
    .sort((a, b) => Number(a.odometer || 0) - Number(b.odometer || 0))
    .map((service) => {
    const matchingInterval = getMatchingServiceInterval(service, serviceIntervals);
    const intervalMileage = getServiceIntervalMileage(service, serviceIntervals);
    const serviceCost = Number(service.cost || 0);
    const serviceStartOdometer = Number(service.odometer || 0);
    const serviceEndOdometer =
      intervalMileage && serviceStartOdometer > 0
        ? serviceStartOdometer + intervalMileage
        : null;
    const costPerMile = intervalMileage ? serviceCost / intervalMileage : null;
    const serviceShifts = service.vehicleId
      ? completedPeriodShifts.filter((shift) => shift.vehicleId === service.vehicleId)
      : completedPeriodShifts;
    const allTimeServiceShifts = service.vehicleId
      ? closedShifts.filter((shift) => shift.vehicleId === service.vehicleId)
      : closedShifts;
    const workMilesInActiveWindow =
      serviceEndOdometer === null
        ? 0
        : serviceShifts.reduce((sum, shift) => {
            const beginning = Number(shift.beginningMileage || 0);
            const ending = Number(shift.endingMileage || 0);
            return (
              sum +
              getMileageRangeOverlapMiles(
                beginning,
                ending,
                serviceStartOdometer,
                serviceEndOdometer
              )
            );
          }, 0);
    const allTimeWorkMilesInActiveWindow =
      serviceEndOdometer === null
        ? 0
        : allTimeServiceShifts.reduce((sum, shift) => {
            const beginning = Number(shift.beginningMileage || 0);
            const ending = Number(shift.endingMileage || 0);
            return (
              sum +
              getMileageRangeOverlapMiles(
                beginning,
                ending,
                serviceStartOdometer,
                serviceEndOdometer
              )
            );
          }, 0);
    const allocatedServiceCost =
      costPerMile === null
        ? null
        : Math.min(serviceCost, workMilesInActiveWindow * costPerMile);
    const allTimeAllocatedServiceCost =
      costPerMile === null
        ? null
        : Math.min(serviceCost, allTimeWorkMilesInActiveWindow * costPerMile);
    const remainingServiceValue =
      allTimeAllocatedServiceCost === null
        ? null
        : Math.max(0, serviceCost - allTimeAllocatedServiceCost);
    const latestKnownOdometer = getLatestKnownOdometer(service.vehicleId);
    const remainingServiceMiles =
      serviceEndOdometer === null
        ? null
        : Math.max(0, serviceEndOdometer - latestKnownOdometer);
    const status =
      intervalMileage === null
        ? "Unallocated - missing interval"
        : latestKnownOdometer < serviceStartOdometer
          ? "Future service window"
          : (remainingServiceValue ?? 0) <= 0 || (remainingServiceMiles ?? 0) <= 0
            ? "Fully allocated"
            : "Active";
    const usesTireFallback =
      normalizeServiceType(service.serviceType) === "tires" &&
      !matchingInterval &&
      intervalMileage === 50000;

    return {
      service,
      serviceCost,
      matchingInterval,
      intervalMileage,
      serviceStartOdometer,
      serviceEndOdometer,
      costPerMile,
      workMilesSinceService: workMilesInActiveWindow,
      allocatedServiceCost,
      allTimeWorkMilesInActiveWindow,
      allTimeAllocatedServiceCost,
      remainingServiceValue,
      remainingServiceMiles,
      latestKnownOdometer,
      status,
      usesTireFallback,
    };
  });
  const allocatedServiceCost = serviceDiagnostics.reduce(
    (sum, diagnostic) => sum + (diagnostic.allocatedServiceCost ?? 0),
    0
  );
  const totalRemainingServiceValue = serviceDiagnostics.reduce(
    (sum, diagnostic) => sum + (diagnostic.remainingServiceValue ?? 0),
    0
  );
  const verifiedServiceAudit = scopedServiceEntries.reduce(
    (audit, service) => {
    const intervalMileage = getServiceIntervalMileage(service, serviceIntervals);
    const serviceStartOdometer = Number(service.odometer || 0);
    const serviceCost = Number(service.cost || 0);

    if (!(intervalMileage && serviceStartOdometer > 0 && serviceCost > 0)) {
      return audit;
    }

    const serviceEndOdometer = serviceStartOdometer + intervalMileage;
    const costPerMile = serviceCost / intervalMileage;
    const serviceShifts = service.vehicleId
      ? completedPeriodShifts.filter((shift) => shift.vehicleId === service.vehicleId)
      : completedPeriodShifts;

    const verifiedMilesForService = serviceShifts.reduce((shiftTotal, shift) => {
      const shiftStart = Number(shift.beginningMileage || 0);
      const shiftEnd = Number(shift.endingMileage || 0);
      if (!(shiftStart > 0 && shiftEnd > shiftStart)) return shiftTotal;

      const cycleMilesForShift = verifiedCompletedFuelCycles.reduce((cycleTotal, cycle) => {
        if (
          service.vehicleId &&
          cycle.vehicleKey !== getShiftCycleVehicleKey(shift)
        ) {
          return cycleTotal;
        }

        const cycleStart = Number(cycle.startEntry.odometer || 0);
        const cycleEnd = Number(cycle.endEntry.odometer || 0);
        const overlapStart = Math.max(shiftStart, serviceStartOdometer, cycleStart);
        const overlapEnd = Math.min(shiftEnd, serviceEndOdometer, cycleEnd);

        return cycleTotal + Math.max(0, overlapEnd - overlapStart);
      }, 0);

      return shiftTotal + cycleMilesForShift;
    }, 0);
    const selectedPeriodMilesInServiceWindow = serviceShifts.reduce((shiftTotal, shift) => {
      const shiftStart = Number(shift.beginningMileage || 0);
      const shiftEnd = Number(shift.endingMileage || 0);

      return (
        shiftTotal +
        getMileageRangeOverlapMiles(
          shiftStart,
          shiftEnd,
          serviceStartOdometer,
          serviceEndOdometer
        )
      );
    }, 0);
    const verifiedCostForService = Math.min(
      serviceCost,
      verifiedMilesForService * costPerMile
    );
    const selectedPeriodCostForService = Math.min(
      serviceCost,
      selectedPeriodMilesInServiceWindow * costPerMile
    );

    return {
      verifiedMiles: audit.verifiedMiles + verifiedMilesForService,
      verifiedCost: audit.verifiedCost + verifiedCostForService,
      selectedPeriodMiles: audit.selectedPeriodMiles + selectedPeriodMilesInServiceWindow,
      selectedPeriodCost: audit.selectedPeriodCost + selectedPeriodCostForService,
    };
  },
    {
      verifiedMiles: 0,
      verifiedCost: 0,
      selectedPeriodMiles: 0,
      selectedPeriodCost: 0,
    }
  );
  const verifiedServiceCost = verifiedServiceAudit.verifiedCost;
  const openCycleServiceWearMiles = Math.max(
    0,
    verifiedServiceAudit.selectedPeriodMiles - verifiedServiceAudit.verifiedMiles
  );
  const openCycleServiceWearCost = Math.max(
    0,
    verifiedServiceAudit.selectedPeriodCost - verifiedServiceAudit.verifiedCost
  );
  const trueNetProfit =
    totalIncome - fuelCostResult.workFuelCost - allocatedServiceCost;
  const keepPercentage = totalIncome > 0 ? trueNetProfit / totalIncome : 0;

  const dataWarnings = useMemo<WarningItem[]>(() => {
    const warnings: WarningItem[] = [];

    if (workMiles > totalFuelOdometerMiles) {
      warnings.push({
        title: "Work Miles Greater Than Total Fuel Miles",
        description:
          "Business Use cannot be fully verified because work miles exceed completed fuel-cycle coverage.",
        detail: `${fmtNumber(workMiles)} work miles > ${fmtNumber(
          totalFuelOdometerMiles
        )} fuel odometer miles.`,
      });
    }

    const duplicateMap = new Map<string, SavedShift[]>();
    completedPeriodShifts.forEach((shift) => {
      const key = [
        toISODate(shift.date),
        shift.platform || "",
        shift.beginningMileage || "",
        shift.endingMileage || "",
      ].join("|");
      duplicateMap.set(key, [...(duplicateMap.get(key) ?? []), shift]);
    });
    const duplicates = Array.from(duplicateMap.values()).filter(
      (group) => group.length > 1
    );
    if (duplicates.length > 0) {
      warnings.push({
        title: "Duplicate Closed Shifts",
        description:
          "Closed shifts with the same date, platform, beginning mileage, and ending mileage were found.",
        detail: `${duplicates.length} duplicate group(s), ${duplicates.reduce(
          (sum, group) => sum + group.length,
          0
        )} total matching shifts.`,
      });
    }

    const outOfOrderFuelEntries = chronologicalPeriodFuelEntries.filter((entry, index) => {
      if (index === 0) return false;
      const previous = chronologicalPeriodFuelEntries[index - 1];
      return Number(entry.odometer || 0) < Number(previous.odometer || 0);
    });
    if (outOfOrderFuelEntries.length > 0) {
      warnings.push({
        title: "Fuel Entries Out Of Odometer Order",
        description:
          "Fuel odometer readings should increase as fuel entry dates move forward.",
        detail: `${outOfOrderFuelEntries.length} fuel entr${
          outOfOrderFuelEntries.length === 1 ? "y is" : "ies are"
        } lower than the previous dated fuel entry.`,
      });
    }

    const allFullFillUpsByOdometer = scopedFuelEntries
      .filter((entry) => (entry.isFullFillUp ?? true) && Number(entry.odometer || 0) > 0)
      .sort((a, b) => Number(a.odometer || 0) - Number(b.odometer || 0));
    const missingPreviousFullFillReference = periodFuelEntries.filter((entry) => {
      if (!(entry.isFullFillUp ?? true)) return false;
      const odometer = Number(entry.odometer || 0);
      if (!(odometer > 0)) return true;

      const hasPrevious = allFullFillUpsByOdometer.some(
        (candidate) => candidate.id !== entry.id && Number(candidate.odometer || 0) < odometer
      );
      return !hasPrevious && (!entry.mpg || entry.mpg <= 0 || !entry.costPerMile || entry.costPerMile <= 0);
    });
    if (missingPreviousFullFillReference.length > 0) {
      warnings.push({
        title: "Full-Fill MPG Missing Previous Reference",
        description:
          "A full fill-up needs an earlier full fill-up odometer to calculate MPG and cost per mile.",
        detail: `${missingPreviousFullFillReference.length} full fill-up entr${
          missingPreviousFullFillReference.length === 1 ? "y is" : "ies are"
        } missing a previous full-fill reference.`,
      });
    }

    const servicesMissingIntervals = serviceDiagnostics.filter(
      (diagnostic) => diagnostic.intervalMileage === null
    );
    if (servicesMissingIntervals.length > 0) {
      warnings.push({
        title: "Service Entries Missing Intervals",
        description:
          "Non-tire service entries without valid service intervals cannot be allocated.",
        detail: `${servicesMissingIntervals.length} service entr${
          servicesMissingIntervals.length === 1 ? "y has" : "ies have"
        } unallocated service cost.`,
      });
    }

    const missingBeginningMileage = completedPeriodShifts.filter(
      (shift) => !(Number(shift.beginningMileage || 0) > 0)
    );
    if (missingBeginningMileage.length > 0) {
      warnings.push({
        title: "Completed Shifts Missing Beginning Mileage",
        description:
          "Work miles cannot be verified when a completed shift has no beginning mileage.",
        detail: `${missingBeginningMileage.length} completed shift${
          missingBeginningMileage.length === 1 ? "" : "s"
        } missing beginning mileage.`,
      });
    }

    const missingEndingMileage = completedPeriodShifts.filter(
      (shift) => !(Number(shift.endingMileage || 0) > 0)
    );
    if (missingEndingMileage.length > 0) {
      warnings.push({
        title: "Completed Shifts Missing Ending Mileage",
        description:
          "Work miles cannot be verified when a completed shift has no ending mileage.",
        detail: `${missingEndingMileage.length} completed shift${
          missingEndingMileage.length === 1 ? "" : "s"
        } missing ending mileage.`,
      });
    }

    return warnings;
  }, [
    chronologicalPeriodFuelEntries,
    completedPeriodShifts,
    periodFuelEntries,
    serviceDiagnostics,
    scopedFuelEntries,
    totalFuelOdometerMiles,
    workMiles,
  ]);

  return (
    <main className="min-h-screen bg-slate-100 px-8 py-10 pb-28 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">Bugcheck</h1>
          <p className="max-w-4xl text-lg text-slate-700">
            Developer diagnostic page. Values are shown to verify GigAxios
            calculations.
          </p>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 border-b border-slate-200 pb-4">
            <h2 className="text-2xl font-semibold">Date Range Selector</h2>
          </div>

          <div className="grid grid-cols-[360px_1fr] gap-8">
            <label className="space-y-2">
              <span className="block text-sm font-semibold text-slate-700">Date Range</span>
              <select
                value={selectedRange.type}
                onChange={(event) => setSelectedRangeKey(event.target.value as RangeType)}
                className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-950 shadow-sm"
                disabled={!isLoaded}
              >
                {rangeOptions.map((range) => (
                  <option key={range.type} value={range.type}>
                    {range.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Selected Range
              </p>
              <p className="mt-2 text-2xl font-bold">
                {formatLongDate(selectedRange.rangeStart)} -{" "}
                {formatLongDate(selectedRange.rangeEnd)}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Week starts on {DAY_NAMES[weekStartsOn]}. If no setting is available,
                Bugcheck defaults to Monday-Sunday.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-2xl font-semibold">Income</h2>
          <div className="grid grid-cols-3 gap-5">
            <FormulaCard
              title="Shift Gross Pay"
              purpose="Total completed shift earnings inside the selected range."
              formula="sum(completed shift gross_pay)"
              values={`${completedPeriodShifts.length} closed shifts`}
              result={fmtCurrency(shiftGrossPay)}
              source={`shifts count: ${completedPeriodShifts.length}`}
            />
            <FormulaCard
              title="Pay Adjustments"
              purpose="Total adjustment amounts assigned to the selected range."
              formula="sum(pay adjustment amounts)"
              values={`${periodAdjustments.length} adjustments`}
              result={fmtCurrency(adjustmentTotal)}
              source={`pay_adjustments count: ${periodAdjustments.length}`}
            />
            <FormulaCard
              title="Total Income"
              purpose="Combined shift gross pay and pay adjustments."
              formula="Shift Gross Pay + Pay Adjustments"
              values={`${fmtCurrency(shiftGrossPay)} + ${fmtCurrency(adjustmentTotal)}`}
              result={fmtCurrency(totalIncome)}
              source="Derived from Income formulas above"
            />
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-2xl font-semibold">Mileage</h2>
          <div className="grid grid-cols-3 gap-5">
            <FormulaCard
              title="Work Miles"
              purpose="Mileage driven during completed shifts in the selected range."
              formula="sum(ending_mileage - beginning_mileage)"
              values={`${completedPeriodShifts.length} closed shifts`}
              result={`${fmtNumber(workMiles)} miles`}
              source={`shifts count: ${completedPeriodShifts.length}`}
            />
            <FormulaCard
              title="Total Fuel Odometer Miles"
              purpose="Completed fuel-cycle odometer coverage for cycles whose closing full fill-up is in the selected range."
              formula="sum(closing full-fill odometer - previous full-fill odometer)"
              values={fuelCycleCoverageValues}
              result={`${fmtNumber(totalFuelOdometerMiles)} miles`}
              source={`${periodFuelCycleCoverage.length} completed fuel cycle${periodFuelCycleCoverage.length === 1 ? "" : "s"} closing in range`}
            />
            <FormulaCard
              title="Business Use %"
              purpose="Share of odometer miles represented by work miles."
              formula="Work Miles / Total Fuel Odometer Miles"
              values={`${fmtNumber(workMiles)} / ${fmtNumber(totalFuelOdometerMiles)}`}
              result={`${fmtNumber(businessUse * 100, 1)}%`}
              source="Derived from Mileage formulas above"
              warning={businessUseWarning}
            />
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Fuel</h2>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-medium text-slate-700">
              {periodFuelEntries.length} fuel entries
            </span>
          </div>

          <div className="grid grid-cols-3 gap-5">
            <FormulaCard
              title="Selected-Range Work Miles"
              purpose="Work miles driven during completed shifts in the selected range."
              formula="sum(ending_mileage - beginning_mileage)"
              values={`${completedPeriodShifts.length} closed shifts`}
              result={`${fmtNumber(workMiles)} miles`}
              source="Shift mileage"
            />
            <FormulaCard
              title="Selected Fuel Cycles Used"
              purpose="Completed full-fill cycles used for the primary fuel calculation."
              formula="cycles where closing full fill-up date is inside selected range"
              values={fuelCycleCoverageValues}
              result={`${periodFuelCycleCoverage.length} cycle${periodFuelCycleCoverage.length === 1 ? "" : "s"}`}
              source="Completed Fuel Cycles"
            />
            <FormulaCard
              title="Average MPG Used"
              purpose="Weighted average MPG from completed full-fill cycles."
              formula="sum(cycle miles) / sum(closing fill-up gallons)"
              values={`${fuelCostResult.cycleCount} completed full-fill cycle${fuelCostResult.cycleCount === 1 ? "" : "s"}`}
              result={fuelCostResult.needsMpg ? "Pending" : `${fmtNumber(fuelCostResult.averageMpg, 1)} MPG`}
              source="Completed Fuel Cycles"
            />
            <FormulaCard
              title="Average Fuel Price Used"
              purpose="Weighted average fuel price from the same completed full-fill cycles."
              formula="sum(closing fill-up fuel cost) / sum(closing fill-up gallons)"
              values={`${fuelCostResult.cycleCount} completed full-fill cycle${fuelCostResult.cycleCount === 1 ? "" : "s"}`}
              result={fuelCostResult.needsMpg ? "Pending" : `${fmtCurrency(fuelCostResult.averageFuelPricePerGallon)}/gal`}
              source="Completed Fuel Cycles"
            />
            <FormulaCard
              title="Estimated Gallons Used"
              purpose="Fuel gallons consumed by selected-range work miles."
              formula="Work Miles / Average MPG"
              values={`${fmtNumber(workMiles)} / ${fmtNumber(fuelCostResult.averageMpg, 1)}`}
              result={fuelCostResult.needsMpg ? "Pending" : `${fmtNumber(fuelCostResult.estimatedGallonsUsed)} gal`}
              source="Primary fuel calculation"
            />
            <FormulaCard
              title="Work Fuel Cost"
              purpose="Fuel cost for selected-range work miles."
              formula="Estimated Gallons Used x Average Fuel Price"
              values={`${fmtNumber(fuelCostResult.estimatedGallonsUsed)} gal x ${fmtCurrency(fuelCostResult.averageFuelPricePerGallon)}/gal`}
              result={fuelCostResult.needsMpg ? "Pending" : fmtCurrency(fuelCostResult.workFuelCost)}
              source="Primary fuel calculation used by Metrics"
              warning={fuelCostResult.needsMpg ? "Add at least two full fill-ups to calculate average MPG and fuel price." : undefined}
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 border-b border-slate-200 pb-4">
              <h3 className="text-xl font-semibold">Fuel Detail Table</h3>
              <p className="mt-1 text-sm text-slate-600">
                MPG = Miles Between Full Fill-Ups / Gallons Purchased. Fuel Cost Per Mile =
                Fuel Cost / Miles Between Full Fill-Ups. Partial fill-ups are shown but
                excluded from MPG calculations.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Odometer</th>
                    <th className="px-4 py-3 font-semibold">Gallons</th>
                    <th className="px-4 py-3 font-semibold">Cost</th>
                    <th className="px-4 py-3 font-semibold">Full Fill-Up</th>
                    <th className="px-4 py-3 font-semibold">MPG</th>
                    <th className="px-4 py-3 font-semibold">Cost Per Mile</th>
                    <th className="px-4 py-3 font-semibold">Diagnostic Note</th>
                  </tr>
                </thead>
                <tbody>
                  {periodFuelEntries.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-600" colSpan={8}>
                        No fuel entries in the selected range.
                      </td>
                    </tr>
                  ) : (
                    periodFuelEntries.map((entry) => {
                      const isFullFillUp = entry.isFullFillUp ?? true;
                      return (
                        <tr key={entry.id} className="border-b border-slate-100">
                          <td className="px-4 py-3 font-medium">{formatLongDate(entry.date)}</td>
                          <td className="px-4 py-3">{fmtNumber(Number(entry.odometer || 0), 0)}</td>
                          <td className="px-4 py-3">{fmtNumber(Number(entry.gallons || 0), 3)}</td>
                          <td className="px-4 py-3">{fmtCurrency(getFuelEntryTotalCost(entry))}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                isFullFillUp
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-800"
                              }`}
                            >
                              {isFullFillUp ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {isFullFillUp && entry.mpg && entry.mpg > 0
                              ? fmtNumber(entry.mpg, 1)
                              : "-"}
                          </td>
                          <td className="px-4 py-3">
                            {isFullFillUp && entry.costPerMile && entry.costPerMile > 0
                              ? `${fmtCurrency(entry.costPerMile)}/mi`
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {isFullFillUp
                              ? "Included when MPG and cost-per-mile values exist."
                              : "Partial fill-up: excluded from MPG calculations."}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Fuel Cost Audit Detail</h2>
              <p className="mt-1 text-sm text-slate-600">
                Verified completed-cycle fuel cost detail. Partial fill-ups are shown
                inside cycles but excluded from MPG and do not close cycles.
              </p>
            </div>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-medium text-slate-700">
              {verifiedCompletedFuelCycles.length} verified cycles
            </span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 border-b border-slate-200 pb-4">
              <h3 className="text-xl font-semibold">Fuel Cost Formulas</h3>
              <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-700">
                <p>
                  <span className="font-semibold">cycle miles</span> = end full-fill
                  odometer - start full-fill odometer
                </p>
                <p>
                  <span className="font-semibold">MPG</span> = cycle miles / closing
                  full-fill gallons
                </p>
                <p>
                  <span className="font-semibold">fuel cost per mile</span> = closing
                  full-fill fuel cost / cycle miles
                </p>
                <p>
                  <span className="font-semibold">work miles inside cycle</span> =
                  mileage overlap between completed shifts and cycle odometer range
                </p>
                <p>
                  <span className="font-semibold">cycle work fuel cost</span> = work
                  miles inside cycle x fuel cost per mile
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1540px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th className="px-4 py-3 font-semibold">Cycle Label</th>
                    <th className="px-4 py-3 font-semibold">Start Date</th>
                    <th className="px-4 py-3 font-semibold">End Date</th>
                    <th className="px-4 py-3 font-semibold">Start Odometer</th>
                    <th className="px-4 py-3 font-semibold">End Odometer</th>
                    <th className="px-4 py-3 font-semibold">Total Cycle Miles</th>
                    <th className="px-4 py-3 font-semibold">Closing Full-Fill Gallons</th>
                    <th className="px-4 py-3 font-semibold">Closing Full-Fill Fuel Cost</th>
                    <th className="px-4 py-3 font-semibold">MPG</th>
                    <th className="px-4 py-3 font-semibold">Fuel Cost Per Mile</th>
                    <th className="px-4 py-3 font-semibold">Work Miles Inside Cycle</th>
                    <th className="px-4 py-3 font-semibold">Work Fuel Cost For Cycle</th>
                    <th className="px-4 py-3 font-semibold">Partial Fill-Up Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {verifiedCompletedFuelCycles.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-600" colSpan={13}>
                        No selected-range work miles fall inside completed fuel cycles yet.
                        Open-cycle work miles are excluded until the next full fill-up.
                      </td>
                    </tr>
                  ) : (
                    verifiedCompletedFuelCycles.map((cycle, index) => (
                      <tr key={`fuel-audit-${cycle.id}`} className="border-b border-slate-100 align-top">
                        <td className="px-4 py-3 font-semibold">
                          Cycle {verifiedCompletedFuelCycles.length - index}
                        </td>
                        <td className="px-4 py-3">{formatLongDate(cycle.startEntry.date)}</td>
                        <td className="px-4 py-3">{formatLongDate(cycle.endEntry.date)}</td>
                        <td className="px-4 py-3">
                          {fmtNumber(Number(cycle.startEntry.odometer || 0), 0)}
                        </td>
                        <td className="px-4 py-3">
                          {fmtNumber(Number(cycle.endEntry.odometer || 0), 0)}
                        </td>
                        <td className="px-4 py-3">{fmtNumber(cycle.cycleMiles)} mi</td>
                        <td className="px-4 py-3">{fmtNumber(cycle.gallons, 3)}</td>
                        <td className="px-4 py-3">{fmtCurrency(cycle.fuelCost)}</td>
                        <td className="px-4 py-3">{fmtNumber(cycle.mpg, 1)}</td>
                        <td className="px-4 py-3">
                          {fmtCurrency(cycle.fuelCostPerMile)}/mi
                        </td>
                        <td className="px-4 py-3">{fmtNumber(cycle.workMiles)} mi</td>
                        <td className="px-4 py-3 font-semibold">
                          {fmtCurrency(cycle.workFuelCost)}
                        </td>
                        <td className="px-4 py-3">
                          {cycle.partialFillUps.length === 0 ? (
                            <span className="text-slate-500">None</span>
                          ) : (
                            <div className="space-y-2">
                              {cycle.partialFillUps.map((entry) => (
                                <div
                                  key={`fuel-audit-partial-${entry.id}`}
                                  className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                                >
                                  <div className="font-semibold">
                                    {formatLongDate(entry.date)} at{" "}
                                    {fmtNumber(Number(entry.odometer || 0), 0)} mi
                                  </div>
                                  <div>
                                    {fmtNumber(Number(entry.gallons || 0), 3)} gal,{" "}
                                    {fmtCurrency(getFuelEntryTotalCost(entry))}
                                  </div>
                                  <div>Excluded from MPG. Does not close cycle.</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50">
                    <td className="px-4 py-4 text-base font-bold" colSpan={11}>
                      Completed-Cycle Fuel Cost = sum(cycle work fuel cost)
                    </td>
                    <td className="px-4 py-4 text-base font-bold">
                      {fmtCurrency(fuelCostAuditTotal)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      Diagnostic only. Primary Metrics fuel cost uses average MPG and average fuel price.
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 text-blue-950 shadow-sm">
            <div className="flex items-center justify-between border-b border-blue-200 pb-4">
              <div>
                <h3 className="text-xl font-semibold">Open Fuel Cycle</h3>
                <p className="mt-1 text-sm">
                  Open cycle not included until next full fill-up.
                </p>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium">
                {openFuelCycles.length} open cycle{openFuelCycles.length === 1 ? "" : "s"}
              </span>
            </div>

            {openFuelCycles.length === 0 ? (
              <p className="mt-5 text-sm">No open fuel cycle is available.</p>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-blue-200 bg-white/60">
                      <th className="px-4 py-3 font-semibold">Vehicle Scope</th>
                      <th className="px-4 py-3 font-semibold">Last Full Fill-Up Date</th>
                      <th className="px-4 py-3 font-semibold">Last Full Fill-Up Odometer</th>
                      <th className="px-4 py-3 font-semibold">Partial Fill-Ups Since</th>
                      <th className="px-4 py-3 font-semibold">Audit Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openFuelCycles.map((cycle) => (
                      <tr key={`fuel-audit-open-${cycle.vehicleKey}`} className="border-b border-blue-100 align-top">
                        <td className="px-4 py-3 font-medium">{cycle.vehicleKey}</td>
                        <td className="px-4 py-3">
                          {formatLongDate(cycle.lastFullFillUp.date)}
                        </td>
                        <td className="px-4 py-3">
                          {fmtNumber(Number(cycle.lastFullFillUp.odometer || 0), 0)}
                        </td>
                        <td className="px-4 py-3">
                          {cycle.partialFillUps.length === 0 ? (
                            "None"
                          ) : (
                            <div className="space-y-1">
                              {cycle.partialFillUps.map((entry) => (
                                <div key={`fuel-audit-open-partial-${entry.id}`}>
                                  {formatLongDate(entry.date)} -{" "}
                                  {fmtNumber(Number(entry.odometer || 0), 0)} mi,{" "}
                                  {fmtCurrency(getFuelEntryTotalCost(entry))}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          Open cycle not included until next full fill-up.
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Completed Fuel Cycles</h2>
              <p className="mt-1 text-sm text-slate-600">
                Diagnostic-only cycle accounting for comparison against current Metrics math.
                Completed cycle = previous full fill-up - next full fill-up.
              </p>
            </div>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-medium text-slate-700">
              {completedFuelCycles.length} completed cycles
            </span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 border-b border-slate-200 pb-4">
              <h3 className="text-xl font-semibold">Cycle Formulas</h3>
              <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-700">
                <p>
                  <span className="font-semibold">cycle miles</span> = end full-fill
                  odometer - start full-fill odometer
                </p>
                <p>
                  <span className="font-semibold">MPG</span> = cycle miles / closing
                  full-fill gallons
                </p>
                <p>
                  <span className="font-semibold">fuel cost per mile</span> = closing
                  full-fill total cost / cycle miles
                </p>
                <p>
                  <span className="font-semibold">work miles in cycle</span> = overlap
                  of completed shift mileage ranges with cycle odometer range
                </p>
                <p>
                  <span className="font-semibold">business use</span> = work miles in
                  cycle / cycle miles
                </p>
                <p>
                  <span className="font-semibold">work fuel cost</span> = work miles in
                  cycle x fuel cost per mile
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th className="px-4 py-3 font-semibold">Cycle Start Date</th>
                    <th className="px-4 py-3 font-semibold">Cycle End Date</th>
                    <th className="px-4 py-3 font-semibold">Start Odometer</th>
                    <th className="px-4 py-3 font-semibold">End Odometer</th>
                    <th className="px-4 py-3 font-semibold">Total Cycle Miles</th>
                    <th className="px-4 py-3 font-semibold">Closing Gallons</th>
                    <th className="px-4 py-3 font-semibold">Closing Fuel Cost</th>
                    <th className="px-4 py-3 font-semibold">MPG</th>
                    <th className="px-4 py-3 font-semibold">Fuel Cost Per Mile</th>
                    <th className="px-4 py-3 font-semibold">Work Miles Inside Cycle</th>
                    <th className="px-4 py-3 font-semibold">Business Use %</th>
                    <th className="px-4 py-3 font-semibold">Work Fuel Cost</th>
                    <th className="px-4 py-3 font-semibold">Partial Fill-Ups Inside Cycle</th>
                  </tr>
                </thead>
                <tbody>
                  {completedFuelCycles.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-600" colSpan={13}>
                        No completed fuel cycles yet. Enter at least two full fill-ups to
                        close the first cycle.
                      </td>
                    </tr>
                  ) : (
                    completedFuelCycles.map((cycle) => (
                      <tr key={cycle.id} className="border-b border-slate-100 align-top">
                        <td className="px-4 py-3 font-medium">
                          {formatLongDate(cycle.startEntry.date)}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {formatLongDate(cycle.endEntry.date)}
                        </td>
                        <td className="px-4 py-3">
                          {fmtNumber(Number(cycle.startEntry.odometer || 0), 0)}
                        </td>
                        <td className="px-4 py-3">
                          {fmtNumber(Number(cycle.endEntry.odometer || 0), 0)}
                        </td>
                        <td className="px-4 py-3">{fmtNumber(cycle.cycleMiles)} mi</td>
                        <td className="px-4 py-3">{fmtNumber(cycle.gallons, 3)}</td>
                        <td className="px-4 py-3">{fmtCurrency(cycle.fuelCost)}</td>
                        <td className="px-4 py-3">{fmtNumber(cycle.mpg, 1)}</td>
                        <td className="px-4 py-3">
                          {fmtCurrency(cycle.fuelCostPerMile)}/mi
                        </td>
                        <td className="px-4 py-3">{fmtNumber(cycle.workMiles)} mi</td>
                        <td className="px-4 py-3">
                          {fmtNumber(cycle.businessUse * 100, 1)}%
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {fmtCurrency(cycle.workFuelCost)}
                        </td>
                        <td className="px-4 py-3">
                          {cycle.partialFillUps.length === 0 ? (
                            <span className="text-slate-500">None</span>
                          ) : (
                            <div className="space-y-2">
                              {cycle.partialFillUps.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                                >
                                  <div className="font-semibold">
                                    {formatLongDate(entry.date)} at{" "}
                                    {fmtNumber(Number(entry.odometer || 0), 0)} mi
                                  </div>
                                  <div>
                                    {fmtNumber(Number(entry.gallons || 0), 3)} gal,{" "}
                                    {fmtCurrency(getFuelEntryTotalCost(entry))}
                                  </div>
                                  <div>Partial fill-up: excluded from MPG.</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 text-blue-950 shadow-sm">
            <div className="flex items-center justify-between border-b border-blue-200 pb-4">
              <div>
                <h3 className="text-xl font-semibold">Open Fuel Cycle Status</h3>
                <p className="mt-1 text-sm">
                  Awaiting next full fill-up to finalize this cycle.
                </p>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium">
                {openFuelCycles.length} open cycle{openFuelCycles.length === 1 ? "" : "s"}
              </span>
            </div>

            {openFuelCycles.length === 0 ? (
              <p className="mt-5 text-sm">No full fill-up has been entered yet.</p>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-blue-200 bg-white/60">
                      <th className="px-4 py-3 font-semibold">Vehicle Scope</th>
                      <th className="px-4 py-3 font-semibold">Last Full Fill-Up Date</th>
                      <th className="px-4 py-3 font-semibold">Last Full Fill-Up Odometer</th>
                      <th className="px-4 py-3 font-semibold">Partial Fill-Ups Since</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openFuelCycles.map((cycle) => (
                      <tr key={cycle.vehicleKey} className="border-b border-blue-100 align-top">
                        <td className="px-4 py-3 font-medium">{cycle.vehicleKey}</td>
                        <td className="px-4 py-3">
                          {formatLongDate(cycle.lastFullFillUp.date)}
                        </td>
                        <td className="px-4 py-3">
                          {fmtNumber(Number(cycle.lastFullFillUp.odometer || 0), 0)}
                        </td>
                        <td className="px-4 py-3">
                          {cycle.partialFillUps.length === 0 ? (
                            "None"
                          ) : (
                            <div className="space-y-1">
                              {cycle.partialFillUps.map((entry) => (
                                <div key={entry.id}>
                                  {formatLongDate(entry.date)} -{" "}
                                  {fmtNumber(Number(entry.odometer || 0), 0)} mi,{" "}
                                  {fmtCurrency(getFuelEntryTotalCost(entry))}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          Awaiting next full fill-up to finalize this cycle.
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {unassignedServiceEntries.length > 0 && (
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Unassigned Service Records</h2>
                <p className="mt-1 text-sm text-amber-700">
                  These service records have no vehicle_id and are excluded from
                  vehicle-specific cost calculations until assigned to a vehicle.
                </p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">
                {unassignedServiceEntries.length} warning
                {unassignedServiceEntries.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-amber-300 bg-amber-50 shadow-sm">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm text-amber-950">
                <thead>
                  <tr className="border-b border-amber-200 bg-amber-100/70">
                    <th className="px-4 py-3 font-semibold">Service Type</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Odometer</th>
                    <th className="px-4 py-3 font-semibold">Cost</th>
                    <th className="px-4 py-3 font-semibold">Service ID</th>
                    <th className="px-4 py-3 font-semibold">Warning</th>
                  </tr>
                </thead>
                <tbody>
                  {unassignedServiceEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-amber-200 align-top">
                      <td className="px-4 py-3 font-medium">
                        {entry.serviceType || "Service"}
                      </td>
                      <td className="px-4 py-3">{formatLongDate(entry.date)}</td>
                      <td className="px-4 py-3">
                        {entry.odometer ? fmtNumber(Number(entry.odometer || 0), 0) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {fmtCurrency(Number(entry.cost || 0))}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{entry.id}</td>
                      <td className="px-4 py-3 font-semibold">
                        This record is excluded from vehicle-specific cost calculations
                        until assigned to a vehicle.
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Service</h2>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-medium text-slate-700">
              {serviceDiagnostics.length} service entries
            </span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 border-b border-slate-200 pb-4">
              <h3 className="text-xl font-semibold">Service Cost Audit Detail</h3>
              <p className="mt-1 text-sm text-slate-600">
                Service entries create active mileage windows. Service Cost Per Mile =
                Service Cost / Service Interval. Allocated Service Cost = selected-range
                shift miles overlapping the active service window x Cost Per Mile, capped
                at the original service cost. All-time allocation and remaining value are
                shown for each active service window. Tires fall back to 50,000 miles when
                no configured interval exists.
              </p>
              <p className="mt-2 text-sm font-medium text-slate-700">
                Service records may come from earlier dates. They are included only when
                selected-range work miles fall inside that service&apos;s active mileage
                window.
              </p>
              <p className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                Example: brakes installed before this week can still be charged this week
                because this week&apos;s work miles used part of that brake life.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1900px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th className="px-4 py-3 font-semibold">Service Type</th>
                    <th className="px-4 py-3 font-semibold">Service Performed Date</th>
                    <th className="px-4 py-3 font-semibold">Service Odometer</th>
                    <th className="px-4 py-3 font-semibold">Original Service Cost</th>
                    <th className="px-4 py-3 font-semibold">Service Interval Miles</th>
                    <th className="px-4 py-3 font-semibold">Service End Odometer</th>
                    <th className="px-4 py-3 font-semibold">Cost Per Mile</th>
                    <th className="px-4 py-3 font-semibold">
                      Selected Range Miles Charged
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Selected Range Service Cost
                    </th>
                    <th className="px-4 py-3 font-semibold">All-Time Service Cost Used</th>
                    <th className="px-4 py-3 font-semibold">Remaining Unused Service Value</th>
                    <th className="px-4 py-3 font-semibold">Remaining Service Miles</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceDiagnostics.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-600" colSpan={13}>
                        No service entries available for allocation.
                      </td>
                    </tr>
                  ) : (
                    serviceDiagnostics.map((diagnostic) => {
                      const {
                        service,
                        serviceCost,
                        matchingInterval,
                        intervalMileage,
                        serviceStartOdometer,
                        serviceEndOdometer,
                        costPerMile,
                        workMilesSinceService,
                        allocatedServiceCost,
                        allTimeAllocatedServiceCost,
                        remainingServiceValue,
                        remainingServiceMiles,
                        status,
                        usesTireFallback,
                      } = diagnostic;
                      const unallocated = intervalMileage === null;

                      return (
                        <tr key={service.id} className="border-b border-slate-100 align-top">
                          <td className="px-4 py-3 font-medium">
                            {service.serviceType || "Service"}
                          </td>
                          <td className="px-4 py-3">{formatLongDate(service.date)}</td>
                          <td className="px-4 py-3">
                            {service.odometer
                              ? fmtNumber(Number(service.odometer || 0), 0)
                              : "-"}
                          </td>
                          <td className="px-4 py-3">{fmtCurrency(serviceCost)}</td>
                          <td className="px-4 py-3">
                            {unallocated ? (
                              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                                Unallocated - missing interval
                              </span>
                            ) : (
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {fmtNumber(intervalMileage, 0)} miles
                                </div>
                                <div className="text-xs text-slate-500">
                                  {usesTireFallback
                                    ? "Tires fallback interval"
                                    : matchingInterval?.vehicleId
                                      ? "Vehicle-specific interval"
                                      : "Default interval"}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {serviceEndOdometer === null ? (
                              "-"
                            ) : (
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {fmtNumber(serviceStartOdometer, 0)} -{" "}
                                  {fmtNumber(serviceEndOdometer, 0)} mi
                                </div>
                                <div className="text-xs text-slate-500">
                                  start odometer + interval miles
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {costPerMile === null ? "-" : `${fmtCurrency(costPerMile)}/mi`}
                          </td>
                          <td className="px-4 py-3">
                            {unallocated ? "-" : `${fmtNumber(workMilesSinceService)} mi`}
                          </td>
                          <td className="px-4 py-3">
                            {allocatedServiceCost === null ? (
                              <span className="font-semibold text-amber-800">
                                Unallocated Service Cost
                              </span>
                            ) : (
                              <div className="space-y-1">
                                <div className="font-semibold">
                                  {fmtCurrency(allocatedServiceCost)}
                                </div>
                                <div className="text-xs text-slate-500">
                                  min({fmtCurrency(serviceCost)},{" "}
                                  {fmtNumber(workMilesSinceService)} mi x{" "}
                                  {fmtCurrency(costPerMile ?? 0)}/mi)
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {allTimeAllocatedServiceCost === null
                              ? "-"
                              : fmtCurrency(allTimeAllocatedServiceCost)}
                          </td>
                          <td className="px-4 py-3">
                            {remainingServiceValue === null
                              ? "-"
                              : fmtCurrency(remainingServiceValue)}
                          </td>
                          <td className="px-4 py-3">
                            {remainingServiceMiles === null
                              ? "-"
                              : `${fmtNumber(remainingServiceMiles)} mi`}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                status === "Active"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : status === "Fully allocated"
                                    ? "bg-slate-100 text-slate-700"
                                    : status === "Future service window"
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-amber-50 text-amber-800"
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50">
                    <td className="px-4 py-4 text-base font-bold" colSpan={8}>
                      Total Allocated Service Cost
                    </td>
                    <td className="px-4 py-4 text-base font-bold">
                      {fmtCurrency(allocatedServiceCost)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600" colSpan={4}>
                      Reconciles to the Allocated Service Cost row in True Cost.
                    </td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="px-4 py-4 text-base font-bold" colSpan={10}>
                      Total Remaining Service Value
                    </td>
                    <td className="px-4 py-4 text-base font-bold">
                      {fmtCurrency(totalRemainingServiceValue)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600" colSpan={2}>
                      Sum of max(0, service cost - all-time allocated cost).
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold">True Cost</h2>
            <p className="mt-1 text-sm text-amber-700">
              Current selected-range view. Not fully verified when selected-range
              work miles include open-cycle miles that have not been finalized by a
              next full fill-up.
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[1180px] table-fixed border-collapse text-left text-sm">
              <colgroup>
                <col className="w-[170px]" />
                <col className="w-[240px]" />
                <col className="w-[300px]" />
                <col className="w-[260px]" />
                <col className="w-[150px]" />
                <col className="w-[190px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Purpose</th>
                  <th className="px-4 py-3 font-semibold">Formula</th>
                  <th className="px-4 py-3 font-semibold">Values Used</th>
                  <th className="px-4 py-3 font-semibold">Result</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 align-top">
                  <td className="px-4 py-4 text-base font-semibold">Total Income</td>
                  <td className="px-4 py-4 text-slate-700">
                    Income available before fuel and allocated service costs.
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-950">
                    Shift Gross Pay + Pay Adjustments
                  </td>
                  <td className="px-4 py-4 text-slate-950">
                    {fmtCurrency(shiftGrossPay)} + {fmtCurrency(adjustmentTotal)}
                  </td>
                  <td className="px-4 py-4 text-base font-bold text-slate-950">
                    {fmtCurrency(totalIncome)}
                  </td>
                  <td className="px-4 py-4 text-slate-600">Income section</td>
                </tr>
                <tr className="border-b border-slate-100 align-top">
                  <td className="px-4 py-4 text-base font-semibold">Work Fuel Cost</td>
                  <td className="px-4 py-4 text-slate-700">
                    Fuel cost allocated to selected-range work miles.
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-950">
                    (Work Miles / Average MPG) x Average Fuel Price
                  </td>
                  <td className="px-4 py-4 text-slate-950">
                    ({fmtNumber(workMiles)} / {fmtNumber(fuelCostResult.averageMpg, 1)}) x{" "}
                    {fmtCurrency(fuelCostResult.averageFuelPricePerGallon)}
                  </td>
                  <td className="px-4 py-4 text-base font-bold text-slate-950">
                    {fuelCostResult.needsMpg ? "Pending" : fmtCurrency(fuelCostResult.workFuelCost)}
                  </td>
                  <td className="px-4 py-4 text-slate-600">Fuel section</td>
                </tr>
                <tr className="border-b border-slate-100 align-top">
                  <td className="px-4 py-4 text-base font-semibold">
                    Allocated Service Cost
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    Prior and current services allocated to selected-range work miles
                    when those miles fall inside active service mileage windows.
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-950">
                    sum(min(Service Cost, Range Work Miles In Service Window x Cost Per Mile))
                  </td>
                  <td className="px-4 py-4 text-slate-950">
                    {serviceDiagnostics.length} service entries
                  </td>
                  <td className="px-4 py-4 text-base font-bold text-slate-950">
                    {fmtCurrency(allocatedServiceCost)}
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    Service section allocated rows
                  </td>
                </tr>
                <tr className="border-b border-slate-100 align-top">
                  <td className="px-4 py-4 text-base font-semibold">True Net Profit</td>
                  <td className="px-4 py-4 text-slate-700">
                    Income remaining after work fuel and allocated service costs.
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-950">
                    Total Income - Work Fuel Cost - Allocated Service Cost
                  </td>
                  <td className="px-4 py-4 text-slate-950">
                    {fmtCurrency(totalIncome)} - {fmtCurrency(fuelCostResult.workFuelCost)} -{" "}
                    {fmtCurrency(allocatedServiceCost)}
                  </td>
                  <td className="px-4 py-4 text-base font-bold text-slate-950">
                    {fmtCurrency(trueNetProfit)}
                  </td>
                  <td className="px-4 py-4 text-slate-600">True Cost formulas above</td>
                </tr>
                <tr className="align-top">
                  <td className="px-4 py-4 text-base font-semibold">Keep Percentage</td>
                  <td className="px-4 py-4 text-slate-700">
                    Percentage of total income kept after true costs.
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-950">
                    True Net Profit / Total Income
                  </td>
                  <td className="px-4 py-4 text-slate-950">
                    {fmtCurrency(trueNetProfit)} / {fmtCurrency(totalIncome)}
                  </td>
                  <td className="px-4 py-4 text-base font-bold text-slate-950">
                    {totalIncome > 0 ? `${fmtNumber(keepPercentage * 100, 1)}%` : "Pending"}
                  </td>
                  <td className="px-4 py-4 text-slate-600">True Cost formulas above</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold">Verified Completed-Cycle True Cost</h2>
            <p className="mt-1 text-sm text-slate-600">
              Uses only selected-range work miles that fall inside completed fuel
              cycles. Open-cycle miles are not estimated here.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-5">
            <FormulaCard
              title="Selected-Range Work Miles"
              purpose="All completed shift work miles in the selected range."
              formula="sum(ending_mileage - beginning_mileage)"
              values={`${completedPeriodShifts.length} closed shifts`}
              result={`${fmtNumber(workMiles)} miles`}
              source="Mileage section"
            />
            <FormulaCard
              title="Completed-Cycle Verified Work Miles"
              purpose="Selected-range work miles that fall inside closed fuel-cycle odometer ranges."
              formula="sum(shift mileage overlap with completed fuel cycles)"
              values={`${verifiedCompletedFuelCycles.length} completed fuel cycles with selected-range work miles`}
              result={`${fmtNumber(verifiedCompletedCycleWorkMiles)} miles`}
              source="Fuel Cost Audit Detail"
            />
            <FormulaCard
              title="Open-Cycle / Unverified Work Miles"
              purpose="Selected-range work miles not yet covered by a completed fuel cycle."
              formula="Selected-Range Work Miles - Completed-Cycle Verified Work Miles"
              values={`${fmtNumber(workMiles)} - ${fmtNumber(verifiedCompletedCycleWorkMiles)}`}
              result={`${fmtNumber(openCycleUnverifiedWorkMiles)} miles`}
              source="Derived from verified fuel-cycle coverage"
            />
          </div>

          <div className="grid grid-cols-3 gap-5">
            <FormulaCard
              title="Current-Range Service Cost"
              purpose="Current-range service wear uses all selected-range work miles inside active service windows."
              formula="sum(selected-range service-window work miles x service cost per mile)"
              values={`${fmtNumber(verifiedServiceAudit.selectedPeriodMiles)} service-window miles`}
              result={fmtCurrency(allocatedServiceCost)}
              source="Service Cost Audit Detail / current True Cost"
            />
            <FormulaCard
              title="Verified Completed-Cycle Service Cost"
              purpose="Verified service wear uses only work miles that overlap completed fuel cycles and active service windows."
              formula="sum(overlap(completed shift range, completed fuel cycle range, service window) x service cost per mile)"
              values={`${fmtNumber(verifiedServiceAudit.verifiedMiles)} verified service-window miles`}
              result={fmtCurrency(verifiedServiceCost)}
              source="Completed fuel cycles intersected with service windows"
            />
            <FormulaCard
              title="Open-Cycle Service Wear Excluded"
              purpose="Service wear tied to open-cycle work miles is excluded from the verified view."
              formula="Current-range service wear - verified completed-cycle service wear"
              values={`${fmtCurrency(verifiedServiceAudit.selectedPeriodCost)} - ${fmtCurrency(
                verifiedServiceCost
              )}`}
              result={`${fmtCurrency(openCycleServiceWearCost)} (${fmtNumber(
                openCycleServiceWearMiles
              )} mi)`}
              source="Open-cycle miles excluded from verified completed-cycle view"
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[1180px] table-fixed border-collapse text-left text-sm">
              <colgroup>
                <col className="w-[220px]" />
                <col className="w-[300px]" />
                <col className="w-[320px]" />
                <col className="w-[260px]" />
                <col className="w-[170px]" />
                <col className="w-[220px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Purpose</th>
                  <th className="px-4 py-3 font-semibold">Formula</th>
                  <th className="px-4 py-3 font-semibold">Values Used</th>
                  <th className="px-4 py-3 font-semibold">Result</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 align-top">
                  <td className="px-4 py-4 text-base font-semibold">
                    Verified Work Fuel Cost
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    Fuel cost from completed fuel cycles only. Open-cycle work miles are excluded.
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-950">
                    sum(completed cycle work fuel cost)
                  </td>
                  <td className="px-4 py-4 text-slate-950">
                    Completed Cycle Fuel Audit Total
                  </td>
                  <td className="px-4 py-4 text-base font-bold text-slate-950">
                    {fmtCurrency(fuelCostAuditTotal)}
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    Fuel Cost Audit Detail
                  </td>
                </tr>
                <tr className="border-b border-slate-100 align-top">
                  <td className="px-4 py-4 text-base font-semibold">
                    Verified Service Cost
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    Service allocation only for selected-range work miles that also
                    fall inside completed fuel cycles.
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-950">
                    sum(min(Service Cost, Verified Work Miles In Service Window x Cost Per Mile))
                  </td>
                  <td className="px-4 py-4 text-slate-950">
                    {fmtNumber(verifiedCompletedCycleWorkMiles)} verified work miles
                  </td>
                  <td className="px-4 py-4 text-base font-bold text-slate-950">
                    {fmtCurrency(verifiedServiceCost)}
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    Service windows intersected with completed fuel cycles
                  </td>
                </tr>
                <tr className="align-top">
                  <td className="px-4 py-4 text-base font-semibold">
                    Verified True Net Profit
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    Requires a safe way to tie income to completed fuel-cycle miles.
                  </td>
                  <td className="px-4 py-4 font-mono text-slate-950">
                    Income tied to completed-cycle work miles - Verified Work Fuel Cost - Verified Service Cost
                  </td>
                  <td className="px-4 py-4 text-amber-800">
                    Income allocation by completed fuel cycle is not finalized yet.
                  </td>
                  <td className="px-4 py-4 text-base font-bold text-amber-800">
                    Pending
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    Requires income allocation policy
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-sm">
            <h3 className="text-lg font-semibold">
              Income allocation by completed fuel cycle is not finalized yet.
            </h3>
            <p className="mt-2 text-sm">
              Verified fuel and service costs are shown, but verified true net profit is
              not calculated because shift/pay-adjustment income has not been safely
              allocated to completed fuel cycles.
            </p>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Data Checks</h2>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                dataWarnings.length > 0
                  ? "bg-amber-100 text-amber-900"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {dataWarnings.length} warning{dataWarnings.length === 1 ? "" : "s"}
            </span>
          </div>

          {dataWarnings.length === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-emerald-900 shadow-sm">
              <h3 className="text-lg font-semibold">No Data Check Warnings</h3>
              <p className="mt-2 text-sm">
                No selected-range warnings were found for mileage, duplicate shifts,
                fuel odometer order, full-fill MPG references, service intervals, or
                missing completed-shift mileage.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-5">
              {dataWarnings.map((warning) => (
                <WarningCard key={warning.title} warning={warning} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
