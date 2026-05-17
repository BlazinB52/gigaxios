"use client";

/* =========================================================
   GIGAXIOS HOME PAGE
   ---------------------------------------------------------
   Main dashboard screen for mobile-first gig tracking app.
   This screen shows:
   - Net profit
   - Work miles
   - Revenue metrics
   - Active shift status
   - Quick action buttons
   ========================================================= */

import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

import { useEffect, useState } from "react";


/* =========================================================
   STORAGE IMPORTS
   ========================================================= */

import { loadShiftsFromSupabase } from "@/app/lib/storage";
import { SavedShift } from "./lib/types";
import { FuelEntry, loadFuelEntriesFromSupabase } from "./lib/fuelStorage";
import { PayEntry, loadPayEntries } from "@/app/lib/payStorage";

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

  const [payEntries, setPayEntries] = useState<PayEntry[]>([]);

  const [savedShifts, setSavedShifts] = useState<SavedShift[]>([]);

  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);

  const activeShift = savedShifts.find((shift) => shift.status === "open");

  /* =========================================================
     DATA_LOADING
     Loads all local storage data when app starts
     ========================================================= */

  useEffect(() => {

  async function loadCloudShifts() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const shifts = await loadShiftsFromSupabase(user.id);
  setSavedShifts(shifts);
}

    loadCloudShifts();

    async function loadCloudFuel() {
      const fuel = await loadFuelEntriesFromSupabase();
      setFuelEntries(fuel);
    }

    loadCloudFuel();

    const loadedPayEntries = loadPayEntries();
    setPayEntries(loadedPayEntries);

  }, []);

  /* =========================================================
     ACTIVE_SHIFT_LOOKUP
     Finds currently open shift
     ========================================================= */

  const openShift = savedShifts.find(
    (shift) => shift.status === "open"
  );

  /* =========================================================
     BASIC_SHIFT_METRICS
     ========================================================= */

  const totalShifts = savedShifts.length;

  const activeShiftCount = savedShifts.filter(
    (shift) => shift.status === "open"
  ).length;

  const closedShifts = savedShifts.filter(
    (shift) => shift.status === "closed"
  );

  /* =========================================================
     WORK_MILE_CALCULATIONS
     SAFE TO EDIT
     ========================================================= */

  const totalWorkMiles = closedShifts.reduce((total, shift) => {

    const beginning = Number(shift.beginningMileage);

    const ending = Number(shift.endingMileage);

    if (!beginning || !ending || ending < beginning) {
      return total;
    }

    return total + (ending - beginning);

  }, 0);

  /* =========================================================
     FUEL_CALCULATIONS
     ========================================================= */

  const totalFuelSpend = fuelEntries.reduce((total, entry) => {

    const cost = Number(entry.totalCost);

    if (!cost) {
      return total;
    }

    return total + cost;

  }, 0);

  const sortedFuelEntries = [...fuelEntries].sort(
  (a, b) => Number(a.odometer) - Number(b.odometer)
);

const totalVehicleMiles =
  sortedFuelEntries.length >= 2
    ? Number(sortedFuelEntries[sortedFuelEntries.length - 1].odometer) -
      Number(sortedFuelEntries[0].odometer)
    : totalWorkMiles;

const fuelCostPerMile =
  totalVehicleMiles > 0
    ? totalFuelSpend / totalVehicleMiles
    : 0;

  /* =========================================================
     PAY_CALCULATIONS
     ========================================================= */

  const totalGrossPay = savedShifts.reduce((total, shift) => {
    return total + Number(shift.grossPay || 0);
  }, 0);


  /* =========================================================
     NET_PROFIT_CALCULATIONS
     ========================================================= */

  const workFuelCost =
  totalWorkMiles > 0 ? totalWorkMiles * fuelCostPerMile : 0;

const netProfit = totalGrossPay - workFuelCost;

  /* =========================================================
     HOURS_WORKED_CALCULATIONS
     ========================================================= */

  const totalHoursWorked = savedShifts.reduce((total, shift) => {
    return total + Number(shift.hoursWorked || 0);
  }, 0);

  const activeHours = Math.floor(totalHoursWorked);
  const activeMinutes = Math.round((totalHoursWorked - activeHours) * 60);


  /* =========================================================
     REVENUE_PER_MILE
     ========================================================= */

  const revenuePerMile =
    totalWorkMiles > 0
      ? totalGrossPay / totalWorkMiles
      : 0;

  /* =========================================================
     REAL_HOURLY_RATE
     ========================================================= */

  const realHourlyRate =
    totalHoursWorked > 0
      ? netProfit / totalHoursWorked
      : 0;

  /* =========================================================
     DELIVERY_METRICS
     ========================================================= */

  const totalDeliveries = savedShifts.reduce((total, shift) => {
    return total + Number(shift.deliveries || 0);
  }, 0);

  const netPerDelivery =
    totalDeliveries > 0
      ? netProfit / totalDeliveries
      : 0;

  /* =========================================================
     MAIN_PAGE_RENDER
     ========================================================= */

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

          <p className="mt-2 text-slate-400">
            Net Profit
          </p>

          {/* MAIN_CARD_METRICS */}

          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-slate-700/60 pt-5 text-center">

            <div>
              <p className="text-lg font-semibold">
                {activeHours}h {activeMinutes.toString().padStart(2, "0")}m
              </p>
              <p className="text-xs text-slate-400">Active Time</p>
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

          <section className="mt-5 rounded-3xl border border-emerald-500/20 bg-emerald-950/20 p-5">

            <p className="text-sm font-semibold text-emerald-400">
              Active Shift
            </p>

            <div className="mt-3 space-y-1 text-sm text-slate-300">

              <p>Date: {openShift.date}</p>

              <p>
                Beginning Mileage: {openShift.beginningMileage}
              </p>

              <p>Status: {openShift.status}</p>

              <p>Open Shifts: {activeShiftCount}</p>

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
              ${realHourlyRate.toFixed(2)}/hr
            </p>

            <p className="mt-1 text-sm text-slate-400">
              Net / Active Hour
            </p>

          </div>

          {/* DELIVERY_CARD */}

          <div className="rounded-3xl border border-amber-400/20 bg-amber-950/20 p-5">

            <p className="text-xs font-semibold tracking-wide text-amber-400">
              Per Delivery
            </p>

            <p className="mt-3 text-3xl font-bold">
              ${netPerDelivery.toFixed(2)}
            </p>

            <p className="mt-1 text-sm text-slate-400">
              Net / Delivery
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

      {/* =====================================================
         HOME_ACTION_PANEL
       ===================================================== */}
      <section className="fixed bottom-20 left-0 right-0 z-40 mx-auto max-w-md px-5">
        <div className="rounded-3xl border border-slate-700 bg-slate-950/95 p-3 shadow-2xl">
          <button
            onClick={() => router.push("/shifts")}
            className="w-full rounded-full bg-blue-500 px-4 py-3 text-base font-bold text-white"
          >
            {activeShift ? "→ End Shift" : "→ Start Shift"}
          </button>
        </div>
      </section>

    </main>
  );
}