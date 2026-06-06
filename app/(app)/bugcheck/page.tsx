"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { loadShiftsFromSupabase } from "@/app/lib/storage";
import { calculateWorkFuelCost } from "@/app/lib/fuelCost";
import { FuelEntry, loadFuelEntriesFromSupabase } from "@/app/lib/fuelStorage";
import {
  ServiceEntry,
  ServiceInterval,
  loadServiceEntriesFromSupabase,
  loadServiceIntervalsFromSupabase,
} from "@/app/lib/garageStorage";
import { PayAdjustment, SavedShift } from "@/app/lib/types";

type PayPeriodOption = {
  label: string;
  weekStart: string;
  weekEnd: string;
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

function isDateInRange(dateStr: string, weekStart: string, weekEnd: string): boolean {
  const iso = toISODate(dateStr);
  return iso >= weekStart && iso <= weekEnd;
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

function getFuelEntryCost(entry: FuelEntry): number {
  const storedTotal = Number(entry.totalCost || 0);
  if (storedTotal > 0) return storedTotal;

  return Number(entry.gallons || 0) * Number(entry.pricePerGallon || 0);
}

function getFuelSortValue(entry: FuelEntry): number {
  const odometer = Number(entry.odometer || 0);
  if (odometer > 0) return odometer;

  const dateValue = parseLocalDate(entry.date).getTime();
  return Number.isFinite(dateValue) ? dateValue : 0;
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
  const [selectedPeriodKey, setSelectedPeriodKey] = useState("");
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

  const currentPayPeriod = useMemo(
    () => getPayPeriodForDate(new Date(), weekStartsOn),
    [weekStartsOn]
  );

  const payPeriodOptions = useMemo<PayPeriodOption[]>(() => {
    const periodMap = new Map<string, PayPeriodOption>();

    function addPeriodForDate(dateStr: string) {
      const date = parseLocalDate(dateStr);
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
    adjustments.forEach((adjustment) => addPeriodForDate(adjustment.weekStart));

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

  const completedPeriodShifts = useMemo(
    () =>
      shifts.filter(
        (shift) =>
          shift.status === "closed" &&
          isDateInRange(shift.date, selectedPayPeriod.weekStart, selectedPayPeriod.weekEnd)
      ),
    [selectedPayPeriod.weekEnd, selectedPayPeriod.weekStart, shifts]
  );

  const periodFuelEntries = useMemo(
    () =>
      fuelEntries
        .filter((entry) =>
          isDateInRange(entry.date, selectedPayPeriod.weekStart, selectedPayPeriod.weekEnd)
        )
        .sort((a, b) => Number(a.odometer || 0) - Number(b.odometer || 0)),
    [fuelEntries, selectedPayPeriod.weekEnd, selectedPayPeriod.weekStart]
  );

  const chronologicalPeriodFuelEntries = useMemo(
    () =>
      fuelEntries
        .filter((entry) =>
          isDateInRange(entry.date, selectedPayPeriod.weekStart, selectedPayPeriod.weekEnd)
        )
        .sort((a, b) => {
          const dateCompare = toISODate(a.date).localeCompare(toISODate(b.date));
          if (dateCompare !== 0) return dateCompare;
          return getFuelSortValue(a) - getFuelSortValue(b);
        }),
    [fuelEntries, selectedPayPeriod.weekEnd, selectedPayPeriod.weekStart]
  );

  const periodAdjustments = useMemo(
    () =>
      adjustments.filter((adjustment) =>
        isDateInRange(adjustment.weekStart, selectedPayPeriod.weekStart, selectedPayPeriod.weekEnd)
      ),
    [adjustments, selectedPayPeriod.weekEnd, selectedPayPeriod.weekStart]
  );

  const periodServiceEntries = useMemo(
    () =>
      serviceEntries
        .filter((entry) =>
          isDateInRange(entry.date, selectedPayPeriod.weekStart, selectedPayPeriod.weekEnd)
        )
        .sort((a, b) => toISODate(a.date).localeCompare(toISODate(b.date))),
    [selectedPayPeriod.weekEnd, selectedPayPeriod.weekStart, serviceEntries]
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
  const firstFuelOdometer = Number(periodFuelEntries[0]?.odometer || 0);
  const lastFuelOdometer = Number(periodFuelEntries[periodFuelEntries.length - 1]?.odometer || 0);
  const totalFuelOdometerMiles =
    periodFuelEntries.length >= 2 ? Math.max(0, lastFuelOdometer - firstFuelOdometer) : 0;
  const businessUse =
    totalFuelOdometerMiles > 0 ? workMiles / totalFuelOdometerMiles : 0;
  const businessUseWarning =
    workMiles > totalFuelOdometerMiles
      ? `Work miles (${fmtNumber(workMiles)}) are greater than total fuel odometer miles (${fmtNumber(
          totalFuelOdometerMiles
        )}). Business Use % is not shown.`
      : "";
  const fuelCostResult = calculateWorkFuelCost({
    workMiles,
    fuelEntries: periodFuelEntries,
  });
  const validMpgEntries = periodFuelEntries.filter(
    (entry) => (entry.isFullFillUp ?? true) && entry.mpg && entry.mpg > 0
  );
  const avgMpg =
    validMpgEntries.length > 0
      ? validMpgEntries.reduce((sum, entry) => sum + (entry.mpg ?? 0), 0) /
        validMpgEntries.length
      : 0;
  const serviceDiagnostics = periodServiceEntries.map((service) => {
    const matchingInterval = getMatchingServiceInterval(service, serviceIntervals);
    const intervalMileage = getServiceIntervalMileage(service, serviceIntervals);
    const serviceCost = Number(service.cost || 0);
    const costPerMile = intervalMileage ? serviceCost / intervalMileage : null;
    const serviceShifts = service.vehicleId
      ? completedPeriodShifts.filter((shift) => shift.vehicleId === service.vehicleId)
      : completedPeriodShifts;
    const workMilesSinceService = intervalMileage
      ? getWorkMilesSinceService(service, serviceShifts)
      : 0;
    const allocatedServiceCost =
      costPerMile === null
        ? null
        : Math.min(serviceCost, workMilesSinceService * costPerMile);
    const usesTireFallback =
      normalizeServiceType(service.serviceType) === "tires" &&
      !matchingInterval &&
      intervalMileage === 50000;

    return {
      service,
      serviceCost,
      matchingInterval,
      intervalMileage,
      costPerMile,
      workMilesSinceService,
      allocatedServiceCost,
      usesTireFallback,
    };
  });
  const allocatedServiceCost = serviceDiagnostics.reduce(
    (sum, diagnostic) => sum + (diagnostic.allocatedServiceCost ?? 0),
    0
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
          "Business Use cannot be verified because work miles exceed the fuel odometer span.",
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

    const allFullFillUpsByOdometer = fuelEntries
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
    fuelEntries,
    periodFuelEntries,
    serviceDiagnostics,
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
            <h2 className="text-2xl font-semibold">Pay Period Selector</h2>
          </div>

          <div className="grid grid-cols-[360px_1fr] gap-8">
            <label className="space-y-2">
              <span className="block text-sm font-semibold text-slate-700">Pay Period</span>
              <select
                value={selectedPayPeriod.weekStart}
                onChange={(event) => setSelectedPeriodKey(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-950 shadow-sm"
                disabled={!isLoaded}
              >
                {payPeriodOptions.map((period) => (
                  <option key={period.weekStart} value={period.weekStart}>
                    {period.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Selected Pay Period
              </p>
              <p className="mt-2 text-2xl font-bold">
                {formatLongDate(selectedPayPeriod.weekStart)} -{" "}
                {formatLongDate(selectedPayPeriod.weekEnd)}
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
              purpose="Total completed shift earnings inside the selected pay period."
              formula="sum(completed shift gross_pay)"
              values={`${completedPeriodShifts.length} closed shifts`}
              result={fmtCurrency(shiftGrossPay)}
              source={`shifts count: ${completedPeriodShifts.length}`}
            />
            <FormulaCard
              title="Pay Adjustments"
              purpose="Total adjustment amounts assigned to the selected pay period."
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
              purpose="Mileage driven during completed shifts in the selected pay period."
              formula="sum(ending_mileage - beginning_mileage)"
              values={`${completedPeriodShifts.length} closed shifts`}
              result={`${fmtNumber(workMiles)} miles`}
              source={`shifts count: ${completedPeriodShifts.length}`}
            />
            <FormulaCard
              title="Total Fuel Odometer Miles"
              purpose="Odometer span covered by fuel entries in the selected pay period."
              formula="last fuel odometer - first fuel odometer"
              values={`${fmtNumber(lastFuelOdometer, 0)} - ${fmtNumber(firstFuelOdometer, 0)}`}
              result={`${fmtNumber(totalFuelOdometerMiles)} miles`}
              source={`fuel_entries count: ${periodFuelEntries.length}`}
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
              title="Fuel Cost Per Mile"
              purpose="Effective per-mile fuel cost from recent fuel history used by Metrics."
              formula="Fuel Cost / Miles Between Full Fill-Ups"
              values={`${validMpgEntries.length} full fill-up MPG entries with cost-per-mile history`}
              result={
                fuelCostResult.needsMpg
                  ? "Pending"
                  : `${fmtCurrency(fuelCostResult.effectiveCostPerMile)}/mi`
              }
              source={`calculateWorkFuelCost source: ${fuelCostResult.source}`}
            />
            <FormulaCard
              title="Work Fuel Cost"
              purpose="Fuel cost allocated to work miles in the selected pay period."
              formula="Work Miles x Fuel Cost Per Mile"
              values={`${fmtNumber(workMiles)} mi x ${fmtCurrency(
                fuelCostResult.effectiveCostPerMile
              )}/mi`}
              result={fuelCostResult.needsMpg ? "Pending" : fmtCurrency(fuelCostResult.workFuelCost)}
              source="calculateWorkFuelCost(workMiles, fuelEntries)"
            />
            <FormulaCard
              title="Avg MPG from Full Fill-Ups"
              purpose="Average MPG from full fill-up records that have MPG values."
              formula="sum(full fill-up MPG) / full fill-up MPG entry count"
              values={`${validMpgEntries.length} full fill-up entries with MPG`}
              result={avgMpg > 0 ? `${fmtNumber(avgMpg, 1)} MPG` : "Pending"}
              source="fuel_entries where Full Fill-Up is Yes and MPG is greater than 0"
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
                        No fuel entries in the selected pay period.
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
                          <td className="px-4 py-3">{fmtCurrency(getFuelEntryCost(entry))}</td>
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
            <h2 className="text-2xl font-semibold">Service</h2>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-medium text-slate-700">
              {periodServiceEntries.length} service entries
            </span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 border-b border-slate-200 pb-4">
              <h3 className="text-xl font-semibold">Service Allocation Table</h3>
              <p className="mt-1 text-sm text-slate-600">
                Service Cost Per Mile = Service Cost / Service Interval. Allocated
                Service Cost = Work Miles Since Service x Cost Per Mile, capped at
                the original service cost. Tires fall back to 50,000 miles when no
                configured interval exists.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th className="px-4 py-3 font-semibold">Service Type</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Odometer</th>
                    <th className="px-4 py-3 font-semibold">Cost</th>
                    <th className="px-4 py-3 font-semibold">Matching Service Interval</th>
                    <th className="px-4 py-3 font-semibold">Cost Per Mile</th>
                    <th className="px-4 py-3 font-semibold">Work Miles Since Service</th>
                    <th className="px-4 py-3 font-semibold">Allocated Service Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceDiagnostics.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-600" colSpan={8}>
                        No service entries in the selected pay period.
                      </td>
                    </tr>
                  ) : (
                    serviceDiagnostics.map((diagnostic) => {
                      const {
                        service,
                        serviceCost,
                        matchingInterval,
                        intervalMileage,
                        costPerMile,
                        workMilesSinceService,
                        allocatedServiceCost,
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
                                Unallocated Service Cost
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
          <h2 className="text-2xl font-semibold">True Cost</h2>
          <div className="grid grid-cols-5 gap-5">
            <FormulaCard
              title="Total Income"
              purpose="Income available before fuel and allocated service costs."
              formula="Shift Gross Pay + Pay Adjustments"
              values={`${fmtCurrency(shiftGrossPay)} + ${fmtCurrency(adjustmentTotal)}`}
              result={fmtCurrency(totalIncome)}
              source="Income section"
            />
            <FormulaCard
              title="Work Fuel Cost"
              purpose="Fuel cost allocated to selected-period work miles."
              formula="Work Miles x Fuel Cost Per Mile"
              values={`${fmtNumber(workMiles)} mi x ${fmtCurrency(
                fuelCostResult.effectiveCostPerMile
              )}/mi`}
              result={fuelCostResult.needsMpg ? "Pending" : fmtCurrency(fuelCostResult.workFuelCost)}
              source="Fuel section"
            />
            <FormulaCard
              title="Allocated Service Cost"
              purpose="Selected-period service cost allocated by service interval mileage."
              formula="sum(min(Service Cost, Work Miles Since Service x Cost Per Mile))"
              values={`${serviceDiagnostics.length} service entries`}
              result={fmtCurrency(allocatedServiceCost)}
              source="Service section allocated rows"
            />
            <FormulaCard
              title="True Net Profit"
              purpose="Income remaining after work fuel and allocated service costs."
              formula="Total Income - Work Fuel Cost - Allocated Service Cost"
              values={`${fmtCurrency(totalIncome)} - ${fmtCurrency(
                fuelCostResult.workFuelCost
              )} - ${fmtCurrency(allocatedServiceCost)}`}
              result={fmtCurrency(trueNetProfit)}
              source="True Cost formulas above"
            />
            <FormulaCard
              title="Keep Percentage"
              purpose="Percentage of total income kept after true costs."
              formula="True Net Profit / Total Income"
              values={`${fmtCurrency(trueNetProfit)} / ${fmtCurrency(totalIncome)}`}
              result={totalIncome > 0 ? `${fmtNumber(keepPercentage * 100, 1)}%` : "Pending"}
              source="True Cost formulas above"
            />
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
                No selected-period warnings were found for mileage, duplicate shifts,
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
