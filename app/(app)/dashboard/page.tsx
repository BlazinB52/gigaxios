"use client";

/* =========================================================
   GIGAXIOS HOME PAGE
   ---------------------------------------------------------
   Main dashboard screen for mobile-first gig tracking app.
   This screen shows:
   - Net profit
   - Work miles
   - Revenue metrics
   - Active shift statussetPayEntries(loadedPayEntries);
   - Quick action buttons
   ========================================================= */

import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

import { useEffect, useState } from "react";
import AppLoadingScreen from "@/app/components/AppLoadingScreen";
import { useRefreshOnFocus } from "@/app/lib/useRefreshOnFocus";


/* =========================================================
   STORAGE IMPORTS
   ========================================================= */

import { loadShiftsFromSupabase } from "@/app/lib/storage";
import { SavedShift } from "@/app/lib/types";
import { getShiftsDeductionsTotal } from "@/app/lib/shiftDeductions";
import {
  FuelEntry,
  getFuelEntryTotalCost,
  loadFuelEntriesFromSupabase,
} from "@/app/lib/fuelStorage";
import { calculateSimpleWorkFuelCost } from "@/app/lib/fuelCost";
import {
  ServiceEntry,
  ServiceInterval,
  loadServiceEntriesFromSupabase,
  loadServiceIntervalsFromSupabase,
} from "@/app/lib/garageStorage";
import {
  SubscriptionAccessState,
  loadSubscriptionAccess,
} from "@/app/lib/subscriptionAccess";

type PayAdjustment = {
  amount: number;
  week_start: string;
};

function parseOptionalDateTime(value: string | undefined) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function isDateInRange(dateStr: string, rangeStart: string, rangeEnd: string) {
  return dateStr >= rangeStart && dateStr <= rangeEnd;
}

function normalizeServiceType(serviceType: string) {
  return serviceType.trim().toLowerCase();
}

function getShiftVehicleKey(shift: SavedShift) {
  return shift.vehicleId || "unassigned";
}

function getFuelVehicleKey(entry: FuelEntry) {
  return entry.vehicleId || "unassigned";
}

function getShiftMiles(shift: SavedShift) {
  const beginning = Number(shift.beginningMileage);
  const ending = Number(shift.endingMileage);

  if (!beginning || !ending || ending < beginning) {
    return 0;
  }

  return ending - beginning;
}

function getMatchingServiceInterval(
  service: ServiceEntry,
  intervals: ServiceInterval[]
) {
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
) {
  const intervalMiles = Number(
    getMatchingServiceInterval(service, intervals)?.intervalMiles
  );
  if (Number.isFinite(intervalMiles) && intervalMiles > 0) return intervalMiles;
  if (normalizeServiceType(service.serviceType) === "tires") return 50000;
  return null;
}

function getMileageRangeOverlapMiles(
  rangeStart: number,
  rangeEnd: number,
  windowStart: number,
  windowEnd: number
) {
  if (!(rangeStart > 0 && rangeEnd > rangeStart && windowStart > 0 && windowEnd > windowStart)) {
    return 0;
  }

  return Math.max(0, Math.min(rangeEnd, windowEnd) - Math.max(rangeStart, windowStart));
}

function hasRecordedHours(shift: SavedShift) {
  return shift.hoursWorked.trim().length > 0 && Number.isFinite(Number(shift.hoursWorked));
}

function hasRecordedDeliveries(shift: SavedShift) {
  return shift.deliveries.trim().length > 0 && Number.isFinite(Number(shift.deliveries));
}

function formatHoursAndMinutes(hours: number) {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  return `${wholeHours}h ${minutes.toString().padStart(2, "0")}m`;
}

/* =========================================================
   HOME COMPONENT
   ========================================================= */

export default function Home() {



  /* =========================================================
     ROUTER
     Used for page navigation buttons
     ========================================================= */

  const router = useRouter();

  /* =========================================================
     STATE VARIABLES
     ========================================================= */

  const [savedShifts, setSavedShifts] = useState<SavedShift[]>([]);

  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);
  const [serviceEntries, setServiceEntries] = useState<ServiceEntry[]>([]);
  const [serviceIntervals, setServiceIntervals] = useState<ServiceInterval[]>([]);
  const [payAdjustments, setPayAdjustments] = useState<PayAdjustment[]>([]);
  const [accessState, setAccessState] =
    useState<SubscriptionAccessState | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [hasPostShiftSignal, setHasPostShiftSignal] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useRefreshOnFocus(() => setRefreshToken((current) => current + 1));

  const activeShift = savedShifts.find((shift) => shift.status === "open");

  /* =========================================================
     DATA_LOADING
     Loads all local storage data when app starts
     ========================================================= */

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const [shifts, fuel, service, intervals, adjustmentsResult, access] = await Promise.all([
          loadShiftsFromSupabase(user.id),
          loadFuelEntriesFromSupabase(user.id),
          loadServiceEntriesFromSupabase(user.id),
          loadServiceIntervalsFromSupabase(user.id),
          supabase
            .from("pay_adjustments")
            .select("amount, week_start")
            .eq("user_id", user.id),
          loadSubscriptionAccess({
            userId: user.id,
            userCreatedAt: user.created_at,
          }),
        ]);

        if (!isMounted) return;

        setSavedShifts(shifts);
        setFuelEntries(fuel);
        setServiceEntries(service);
        setServiceIntervals(intervals);
        setPayAdjustments((adjustmentsResult.data ?? []) as PayAdjustment[]);
        setAccessState(access);

        const shiftEnded = sessionStorage.getItem("gigaxios_shift_ended") === "1";
        if (shiftEnded) {
          sessionStorage.removeItem("gigaxios_shift_ended");
          setHasPostShiftSignal(!access.isSubscribed);
        } else if (access.isSubscribed) {
          sessionStorage.removeItem("gigaxios_shift_ended");
          setHasPostShiftSignal(false);
        }
      } finally {
        if (isMounted) {
          setIsLoadingDashboard(false);
        }
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };

  }, [refreshToken, router]);

  /* =========================================================
    ACTIVE_SHIFT_LOOKUP --
    Finds currently open shift
    ========================================================= */

  const openShift = savedShifts.find(
    (shift) => shift.status === "open"
  );


  function parseLocalDate(dateString: string) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  /* =========================================================
     CURRENT_WEEK_FILTER
     Monday through Sunday current pay cycle
     ========================================================= */

  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() + mondayOffset);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  const currentPeriodStart = formatISODate(startOfWeek);
  const currentPeriodEnd = formatISODate(endOfWeek);

  const currentWeekShifts = savedShifts.filter((shift) => {
    const shiftDate = parseLocalDate(shift.date);
    return shiftDate >= startOfWeek && shiftDate <= endOfWeek;
  });

  /* =========================================================
     BASIC_SHIFT_METRICS
     ========================================================= */

  const activeShiftCount = currentWeekShifts.filter(
    (shift) => shift.status === "open"
  ).length;

  const closedShifts = currentWeekShifts.filter(
    (shift) => shift.status === "closed"
  );
  const totalShifts = closedShifts.length;

  /* =========================================================
     WORK_MILE_CALCULATIONS
     ========================================================= */

  const totalWorkMiles = closedShifts.reduce((total, shift) => {
    return total + getShiftMiles(shift);
  }, 0);

  /* =========================================================
     FUEL_CALCULATIONS
     Shared work-mile fuel cost model
     ========================================================= */

  /* =========================================================
     PAY_CALCULATIONS
     ========================================================= */

  const shiftGrossPay = closedShifts.reduce((total, shift) => {
    return total + Number(shift.grossPay || 0);
  }, 0);
  const currentPeriodAdjustments = payAdjustments.filter((adjustment) =>
    isDateInRange(adjustment.week_start, currentPeriodStart, currentPeriodEnd)
  );
  const totalAdjustments =
    closedShifts.length === 0
      ? 0
      : currentPeriodAdjustments.reduce(
          (total, adjustment) => total + Number(adjustment.amount || 0),
          0
        );
  const totalGrossPay = shiftGrossPay + totalAdjustments;
  const platformFeesAndDeductions = getShiftsDeductionsTotal(closedShifts);

  /* =========================================================
     NET_PROFIT_CALCULATIONS
     ========================================================= */

  const selectedVehicleKeys = [...new Set(closedShifts.map(getShiftVehicleKey))];
  const selectedVehicleIds = selectedVehicleKeys.filter(
    (vehicleId) => vehicleId !== "unassigned"
  );
  const scopedFuelEntries = fuelEntries.filter((entry) =>
    selectedVehicleKeys.includes(getFuelVehicleKey(entry))
  );
  const completedFuelCycles = selectedVehicleKeys.flatMap((vehicleKey) => {
    const fullFillUps = scopedFuelEntries
      .filter((entry) => getFuelVehicleKey(entry) === vehicleKey)
      .filter((entry) => entry.isFullFillUp ?? true)
      .sort((a, b) => {
        const odometerDiff = Number(a.odometer || 0) - Number(b.odometer || 0);
        if (odometerDiff !== 0) return odometerDiff;

        const dateDiff = parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;

        return parseOptionalDateTime(a.createdAt) - parseOptionalDateTime(b.createdAt);
      });

    return fullFillUps
      .slice(1)
      .map((endFill, index) => {
        const startFill = fullFillUps[index];
        return {
          vehicleKey,
          startOdometer: Number(startFill.odometer || 0),
          endOdometer: Number(endFill.odometer || 0),
          endDate: endFill.date,
          cycleMiles: Number(endFill.odometer || 0) - Number(startFill.odometer || 0),
          gallons: Number(endFill.gallons || 0),
          fuelCost: getFuelEntryTotalCost(endFill),
        };
      })
      .filter((cycle) => cycle.endOdometer > cycle.startOdometer);
  });
  const selectedRangeFuelCycles = completedFuelCycles.filter((cycle) =>
    isDateInRange(cycle.endDate, currentPeriodStart, currentPeriodEnd)
  );
  const fuelCostResult = calculateSimpleWorkFuelCost({
    workMiles: totalWorkMiles,
    completedFuelCycles: selectedRangeFuelCycles,
  });
  const workFuelCost = fuelCostResult.workFuelCost;
  const assignedVehicleServices = serviceEntries.filter(
    (service) =>
      !!service.vehicleId && selectedVehicleIds.includes(service.vehicleId)
  );
  const calculateServiceCostForShifts = (bucketShifts: SavedShift[]) => assignedVehicleServices.reduce((total, service) => {
    const serviceCost = Number(service.cost || 0);
    if (!(serviceCost > 0)) return total;

    const intervalMileage = getServiceIntervalMileage(service, serviceIntervals);
    if (!intervalMileage) return total;

    const serviceStartOdometer = Number(service.odometer || 0);
    const serviceEndOdometer = serviceStartOdometer + intervalMileage;
    const serviceVehicleKey = service.vehicleId || "unassigned";
    const costPerMile = serviceCost / intervalMileage;
    const periodWorkMilesSinceService = closedShifts
      .filter((shift) => getShiftVehicleKey(shift) === serviceVehicleKey)
      .reduce((sum, shift) => {
        const shiftStart = Number(shift.beginningMileage);
        const shiftEnd = Number(shift.endingMileage);
        return (
          sum +
          getMileageRangeOverlapMiles(
            shiftStart,
            shiftEnd,
            serviceStartOdometer,
            serviceEndOdometer
          )
        );
      }, 0);
    if (!(periodWorkMilesSinceService > 0)) return total;

    const periodAllocatedServiceCost = Math.min(
      serviceCost,
      periodWorkMilesSinceService * costPerMile
    );
    const bucketWorkMilesSinceService = bucketShifts
      .filter((shift) => getShiftVehicleKey(shift) === serviceVehicleKey)
      .reduce((sum, shift) => {
        const shiftStart = Number(shift.beginningMileage);
        const shiftEnd = Number(shift.endingMileage);
        return (
          sum +
          getMileageRangeOverlapMiles(
            shiftStart,
            shiftEnd,
            serviceStartOdometer,
            serviceEndOdometer
          )
        );
      }, 0);

    return total + (bucketWorkMilesSinceService / periodWorkMilesSinceService) * periodAllocatedServiceCost;
  }, 0);
  const serviceCostUsed = calculateServiceCostForShifts(closedShifts);

  const netProfit = totalGrossPay - platformFeesAndDeductions - workFuelCost - serviceCostUsed;
  const calculateNetProfitForShifts = (bucketShifts: SavedShift[]) => {
    const bucketShiftGrossPay = bucketShifts.reduce((total, shift) => {
      return total + Number(shift.grossPay || 0);
    }, 0);
    const bucketAdjustments =
      shiftGrossPay > 0
        ? totalAdjustments * (bucketShiftGrossPay / shiftGrossPay)
        : 0;
    const bucketGrossPay = bucketShiftGrossPay + bucketAdjustments;
    const bucketPlatformFees = getShiftsDeductionsTotal(bucketShifts);
    const bucketFuelCost = bucketShifts.reduce((total, shift) => {
      return total + getShiftMiles(shift) * fuelCostResult.effectiveCostPerMile;
    }, 0);
    const bucketServiceCost = calculateServiceCostForShifts(bucketShifts);

    return bucketGrossPay - bucketPlatformFees - bucketFuelCost - bucketServiceCost;
  };

  /* =========================================================
     HOURS_WORKED_CALCULATIONS
     ========================================================= */

  const shiftsWithRecordedHours = closedShifts.filter(hasRecordedHours);
  const shiftsWithMissingHoursCount = closedShifts.length - shiftsWithRecordedHours.length;
  const totalHoursWorked = shiftsWithRecordedHours.reduce((total, shift) => {
    return total + Number(shift.hoursWorked || 0);
  }, 0);
  const hasClosedShifts = closedShifts.length > 0;
  const allClosedShiftsMissingHours =
    hasClosedShifts && shiftsWithRecordedHours.length === 0;
  const someClosedShiftsMissingHours =
    shiftsWithMissingHoursCount > 0 && shiftsWithRecordedHours.length > 0;
  const hoursCoverageText = `Based on ${shiftsWithRecordedHours.length} of ${closedShifts.length} shifts`;

  /* =========================================================
     REVENUE_PER_MILE totalWorkMiles > 0 ? totalGrossPay / totalWorkMiles : 0;

  /* =========================================================
     REAL_HOURLY_RATE
     ========================================================= */

  const hourlyMetricNetProfit = calculateNetProfitForShifts(shiftsWithRecordedHours);
  const realHourlyRate =
    totalHoursWorked > 0 ? hourlyMetricNetProfit / totalHoursWorked : 0;
  const hourlyRateIncomplete =
    shiftsWithMissingHoursCount > 0 && totalHoursWorked <= 0;

  /* =========================================================
     DELIVERY_METRICS
     ========================================================= */

  const shiftsWithRecordedDeliveries = closedShifts.filter(hasRecordedDeliveries);
  const shiftsWithMissingDeliveriesCount =
    closedShifts.length - shiftsWithRecordedDeliveries.length;
  const someClosedShiftsMissingDeliveries =
    shiftsWithMissingDeliveriesCount > 0 && shiftsWithRecordedDeliveries.length > 0;
  const deliveriesCoverageText = `Based on ${shiftsWithRecordedDeliveries.length} of ${closedShifts.length} shifts`;
  const totalDeliveries = shiftsWithRecordedDeliveries.reduce((total, shift) => {
    return total + Number(shift.deliveries || 0);
  }, 0);
  const deliveryMetricNetProfit = calculateNetProfitForShifts(shiftsWithRecordedDeliveries);
  const netPerDelivery =
    totalDeliveries > 0 ? deliveryMetricNetProfit / totalDeliveries : 0;
  const perDeliveryIncomplete =
    shiftsWithMissingDeliveriesCount > 0 && totalDeliveries <= 0;

  const isSubscribed = accessState?.isSubscribed ?? false;
  const trialRequired = accessState?.trialRequired ?? false;
  const importDayDisabled = trialRequired && !activeShift;
  const showPostShiftCtaModal =
    !isSubscribed &&
    !trialRequired &&
    hasPostShiftSignal;

  function dismissPostShiftModal() {
    setHasPostShiftSignal(false);
    sessionStorage.removeItem("gigaxios_shift_ended");
  }

  async function handleStartTrial() {
    setStartingCheckout(true);
    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok || !data.url) {
        alert(data.error || "Could not start checkout. Please try again.");
        return;
      }

      window.location.href = data.url;
    } catch {
      alert("Could not start checkout. Please try again.");
    } finally {
      setStartingCheckout(false);
    }
  }
  /* =========================================================
     MAIN_PAGE_RENDER
     ========================================================= */

  if (isLoadingDashboard) {
    return <AppLoadingScreen />;
  }

  return (

    <main className="min-h-screen bg-[#020814] text-white">

      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-24 pt-4">

        {/* =====================================================
            HOME_HEADER
            App title + notification button now handeled in layout.tsx
           ===================================================== */}


        {/* =====================================================
            GREETING_SECTION
           ===================================================== */}



        {/* =====================================================
            MAIN_METRIC_CARD
            Main weekly overview card
           ===================================================== */}

        <section className="rounded-3xl border border-blue-500/30 bg-blue-950/30 p-6 shadow-[0_0_40px_rgba(59,130,246,0.15)]">

          <p className="mb-3 text-sm font-semibold tracking-wide text-blue-400">
            This Week
          </p>

          {/* NET_PROFIT_DISPLAY */}

          <p className="text-5xl font-bold">
            ${netProfit.toFixed(2)}
          </p>

          <p
            className="mt-2 text-slate-200"
          >
            True Net Profit
          </p>

          <p className="mt-1 text-sm text-amber-300">
            After fees + fuel + service
          </p>
          {platformFeesAndDeductions > 0 && (
            <p className="mt-2 text-xs text-slate-400">
              Platform fees & deductions: -${platformFeesAndDeductions.toFixed(2)}
            </p>
          )}

          {/* MAIN_CARD_METRICS */}

          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-slate-700/60 pt-5 text-center">

            <div>
              <p className="text-lg font-semibold">
                {allClosedShiftsMissingHours
                  ? "Not tracked"
                  : formatHoursAndMinutes(totalHoursWorked)}
              </p>
              <p className="text-xs text-slate-400">Active Time</p>
              {allClosedShiftsMissingHours ? (
                <p className="mt-0.5 text-[11px] text-amber-300">Not tracked</p>
              ) : someClosedShiftsMissingHours ? (
                <p className="mt-0.5 text-[11px] text-amber-300">
                  Partial - {shiftsWithRecordedHours.length} of {closedShifts.length} shifts
                </p>
              ) : null}
            </div>

            <div>
              <p className="text-lg font-semibold">{totalShifts}</p>
              <p className="text-xs text-slate-400">Shifts</p>
            </div>

            <div>
              <p className="text-lg font-semibold">
                {totalWorkMiles} mi
              </p>

              <p className="text-xs text-slate-400">
                Work Miles
              </p>
            </div>

          </div>
        </section>

        {/* =====================================================
            ACTIVE_SHIFT_CARD
            Only shows if a shift is open
           ===================================================== */}

        {openShift && (

          <section className="mt-5 rounded-3xl border border-emerald-400/40 bg-emerald-950/30 p-5 shadow-[0_0_30px_rgba(52,211,153,0.12)]">

            <p className="text-sm font-semibold text-emerald-400">
              Shift Active
            </p>

            <div className="mt-3 space-y-1 text-sm text-slate-300">

              <p>Platform: {openShift.platform}</p>

              <p>Date: {openShift.date}</p>

              {openShift.startTime && <p>Started: {openShift.startTime}</p>}

              <p>
                Beginning Mileage: {openShift.beginningMileage}
              </p>

              {activeShiftCount > 1 && (
                <p className="text-amber-300">Open shifts found: {activeShiftCount}</p>
              )}

            </div>

          </section>
        )}

        {/* =====================================================
            SECONDARY_METRIC_CARDS
           ===================================================== */}

        <section className="mt-5 grid grid-cols-2 gap-4">

          {/* HOURLY_RATE_CARD */}

          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-950/20 p-5">

            <p className="text-xs font-semibold tracking-wide text-emerald-400">
              Hourly Rate
            </p>

            <p className="mt-3 text-3xl font-bold">
              {hourlyRateIncomplete ? "Not tracked" : `$${realHourlyRate.toFixed(2)}/hr`}
            </p>

            <p className="mt-1 text-sm text-slate-400">
              {hourlyRateIncomplete
                ? "No recorded hours"
                : someClosedShiftsMissingHours
                  ? hoursCoverageText
                  : "Net / Active Hour"}
            </p>

          </div>

          {/* DELIVERY_CARD */}

          <div className="rounded-3xl border border-amber-400/20 bg-amber-950/20 p-5">

            <p className="text-xs font-semibold tracking-wide text-amber-400">
              Per Delivery
            </p>

            <p className="mt-3 text-3xl font-bold">
              {perDeliveryIncomplete ? "Not tracked" : `$${netPerDelivery.toFixed(2)}`}
            </p>

            <p className="mt-1 text-sm text-slate-400">
              {perDeliveryIncomplete
                ? "No recorded deliveries"
                : someClosedShiftsMissingDeliveries
                  ? deliveriesCoverageText
                  : "Net / Delivery"}
            </p>

          </div>

        </section>

        {/* =====================================================
            WEEK_AT_A_GLANCE
            Detailed weekly metrics
           ===================================================== */}

        {/* KEEP YOUR EXISTING SECTION HERE */}

        {/* =====================================================
            SHIFT_BUTTONS
            Main action buttons
           ===================================================== */}

        {/* KEEP YOUR EXISTING SECTION HERE */}

        {/* =====================================================
            INSIGHT_CARD
            Future AI/business coaching section
           ===================================================== */}

        {/* KEEP YOUR EXISTING SECTION HERE */}

      </div>

      {showPostShiftCtaModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 px-5 pb-24 pt-8 sm:items-center sm:pb-8">
          <section className="w-full max-w-md rounded-3xl border border-blue-500/30 bg-slate-950 p-5 text-white shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-2xl font-bold leading-tight">
                See what you actually made today
              </h2>
              <button
                type="button"
                onClick={dismissPostShiftModal}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-700 text-xl text-slate-400"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-300">
              GigAxios has started turning your shift data into real profit insight.
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              Start your free 7-day trial to continue after your preview period.
            </p>

            <div className="mt-4 space-y-1 text-sm font-semibold text-slate-200">
              <p>No charge today.</p>
              <p>Then $3.99/month for your first year.</p>
              <p>Cancel anytime.</p>
            </div>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={dismissPostShiftModal}
                className="w-full rounded-full bg-blue-500 px-4 py-3 text-base font-bold text-white"
              >
                View My Results
              </button>

              <button
                type="button"
                onClick={handleStartTrial}
                disabled={startingCheckout}
                className="w-full rounded-full border border-slate-700 bg-slate-900 px-4 py-3 text-base font-bold text-slate-200 disabled:opacity-60"
              >
                {startingCheckout ? "Opening checkout..." : "Start Free Trial"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================
         HOME_ACTION_PANEL
       ===================================================== */}
      <section className="pointer-events-none fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-0 right-0 z-30 mx-auto max-w-md px-5">
        <div className="pointer-events-auto space-y-3 rounded-3xl border border-slate-700 bg-slate-950/95 p-3 shadow-2xl">
          {trialRequired && !activeShift && (
            <div className="rounded-2xl border border-blue-500/30 bg-blue-950/30 p-4">
              <h2 className="text-lg font-bold">Start your free trial to continue</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Your free GigAxios preview has ended.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Start your 7-day free trial to continue adding shifts and fuel entries.
              </p>
              <div className="mt-3 space-y-1 text-sm font-semibold text-slate-200">
                <p>No charge today.</p>
                <p>Then $3.99/month for your first year.</p>
                <p>Cancel anytime.</p>
              </div>
              <button
                onClick={handleStartTrial}
                disabled={startingCheckout}
                className="mt-4 w-full rounded-full bg-blue-500 px-4 py-3 text-base font-bold text-white disabled:opacity-60"
              >
                {startingCheckout ? "Opening checkout..." : "Start Free Trial"}
              </button>
            </div>
          )}

          <button
            onClick={() => {
              if (importDayDisabled) return;
              router.push("/shifts");
            }}
            disabled={importDayDisabled}
            className={`w-full rounded-full px-4 py-3 text-base font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 ${
              activeShift ? "bg-emerald-500" : "bg-blue-500"
            }`}
          >
            {importDayDisabled ? "Trial required to start" : activeShift ? "End Shift" : "Start Shift"}
          </button>
        </div>
      </section>

    </main>
  );
}
