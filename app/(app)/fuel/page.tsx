"use client";

/* =========================================================
   FUEL PAGE---
   ---------------------------------------------------------
   Lets the user log fuel fill-ups (date, odometer, gallons,
   price per gallon, optional notes).  Saves to Supabase and
   shows the 5 most recent entries below the form.
   ========================================================= */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

import {
  FuelEntry,
  saveFuelEntries,
  loadFuelEntriesFromSupabase,
  saveFuelEntryToSupabase,
} from "@/app/lib/fuelStorage";
import {
  SubscriptionAccessState,
  loadSubscriptionAccess,
} from "@/app/lib/subscriptionAccess";
import {
  loadHighestMileageReading,
  needsMileageException,
} from "@/app/lib/mileageValidation";

export default function FuelPage() {

  /* =========================================================
     ROUTER  no changes made
     Used for redirecting after save or cancel
     ========================================================= */

  const router = useRouter();

  /* =========================================================
     STATE VARIABLES
     ========================================================= */

  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);
  const [vehicles, setVehicles] = useState<Array<{
    id: string; year: string; make: string; model: string; is_primary: boolean;
  }>>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [date, setDate] = useState("");
  const [odometer, setOdometer] = useState("");
  const [gallons, setGallons] = useState("");
  const [pricePerGallon, setPricePerGallon] = useState("");
  const [notes, setNotes] = useState("");
  const [isFullFillUp, setIsFullFillUp] = useState(true);
  const [allowMileageException, setAllowMileageException] = useState(false);
  const [mileageExceptionReason, setMileageExceptionReason] = useState("");
  const [highestMileage, setHighestMileage] = useState<number | null>(null);
  const [accessState, setAccessState] =
    useState<SubscriptionAccessState | null>(null);
  const [startingCheckout, setStartingCheckout] = useState(false);

  /* =========================================================
     DATA LOADING
     Runs once on mount — verifies auth, loads saved fuel
     entries from Supabase, and pre-fills today's date.
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

      const entries = await loadFuelEntriesFromSupabase(user.id);
      setFuelEntries(entries);

      const access = await loadSubscriptionAccess({
        userId: user.id,
        userCreatedAt: user.created_at,
      });
      setAccessState(access);

      const { data: vehicleData } = await supabase
        .from("vehicles")
        .select("id, year, make, model, is_primary, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("is_primary", { ascending: false });

      const loadedVehicles = vehicleData || [];
      setVehicles(loadedVehicles);
      const primary = loadedVehicles.find((v) => v.is_primary) || loadedVehicles[0] || null;
      setSelectedVehicleId(primary?.id || "");

      const today = new Date();
      const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      setDate(localDate);
    }

    load();
  }, [router]);

  useEffect(() => {
    async function loadMileageThreshold() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const highest = await loadHighestMileageReading({
        userId: user.id,
        vehicleId: selectedVehicleId || undefined,
      });

      setHighestMileage(highest);
    }

    loadMileageThreshold();
  }, [selectedVehicleId]);

  const trialRequired = accessState?.trialRequired ?? false;
  const showMileageException = needsMileageException({
    mileage: odometer,
    highestMileage,
  });

  async function handleStartTrial() {
    setStartingCheckout(true);
    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok || !data.url) {
        return;
      }

      window.location.href = data.url;
    } finally {
      setStartingCheckout(false);
    }
  }

  /* =========================================================
     SAVE FUEL ENTRY
     Validates required fields, builds a FuelEntry object,
     persists it locally and to Supabase, then navigates home.
     ========================================================= */

  async function handleSaveFuel() {
    if (trialRequired) {
      return;
    }

    if (!date || !odometer || !gallons || !pricePerGallon) {
      alert("Date, odometer, gallons, and price per gallon are required.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const calculatedTotalCost = Number(gallons) * Number(pricePerGallon);
    const latestHighestMileage = await loadHighestMileageReading({
      userId: user.id,
      vehicleId: selectedVehicleId || undefined,
    });
    const mileageIsLower = needsMileageException({
      mileage: odometer,
      highestMileage: latestHighestMileage,
    });

    if (
      mileageIsLower &&
      (!allowMileageException || mileageExceptionReason.trim().length === 0)
    ) {
      alert(
        "This mileage appears to be lower than an existing entry. Only continue if you are backfilling or correcting older data."
      );
      return;
    }

    const newEntry: FuelEntry = {
      id: crypto.randomUUID(),
      userId: user.id,
      vehicleId: selectedVehicleId || undefined,
      date,
      odometer,
      gallons,
      pricePerGallon,
      totalCost: calculatedTotalCost.toFixed(2),
      notes,
      isFullFillUp,
      overrideMileageValidation: mileageIsLower && allowMileageException,
      overrideMileageReason:
        mileageIsLower && allowMileageException
          ? mileageExceptionReason.trim()
          : null,
    };

    const updatedEntries = [newEntry, ...fuelEntries];

    saveFuelEntries(updatedEntries);
    setFuelEntries(updatedEntries);

    await saveFuelEntryToSupabase(newEntry);

    alert("Fuel entry saved.");
    router.push("/");
  }

  /* =========================================================
     RENDER -
     ========================================================= */

  return (
    <main className="min-h-screen bg-[#020814] text-white">

      <div className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-5 pb-28 pt-8">

        {/* =====================================================
            PAGE HEADER -
           ===================================================== */}

        <div className="mb-2">
          <h1 className="text-3xl font-bold tracking-tight">Fuel</h1>
          <p className="mt-1 text-sm text-slate-400">
            Track fill-ups, gallons, and fuel cost.
          </p>
        </div>

        {trialRequired && (
          <section className="rounded-3xl border border-blue-500/30 bg-blue-950/30 p-5">
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
              className="mt-4 w-full rounded-xl bg-blue-500 p-3 font-bold text-white disabled:opacity-60"
            >
              {startingCheckout ? "Opening checkout..." : "Start Free Trial"}
            </button>
          </section>
        )}

        {/* =====================================================
            ADD FUEL FORM
            Required: date, odometer, gallons, price per gallon.
            Optional: notes.
            [color-scheme:dark] on the date input forces the
            browser's native calendar icon to render white.
           ===================================================== */}

        <section className="rounded-3xl border border-slate-700/70 bg-slate-950/70 p-5">
          <h2 className="text-lg font-bold">Add fuel</h2>

          <div className="mt-4 space-y-3">

            {/* VEHICLE SELECTOR — only shown when user has multiple vehicles */}
            {vehicles.length > 1 && (
              <div>
                <label className="text-sm text-slate-400">Vehicle</label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.year} {v.make} {v.model}{v.is_primary ? " (Primary)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* DATE — [color-scheme:dark] fixes the black calendar icon */}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white [color-scheme:dark]"
            />

            {/* ODOMETER */}
            <input
              type="number"
              placeholder="Odometer"
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
            />

            {showMileageException && (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-950/20 p-4">
                <p className="text-sm leading-6 text-amber-100">
                  This mileage appears to be lower than an existing entry. Only continue if you are backfilling or correcting older data.
                </p>
                <label className="mt-3 flex items-center gap-3 text-sm font-semibold text-white">
                  <input
                    type="checkbox"
                    checked={allowMileageException}
                    onChange={(e) => setAllowMileageException(e.target.checked)}
                    className="h-4 w-4 accent-blue-500"
                  />
                  Allow mileage exception
                </label>
                {allowMileageException && (
                  <textarea
                    value={mileageExceptionReason}
                    onChange={(e) => setMileageExceptionReason(e.target.value)}
                    placeholder="Reason for exception"
                    className="mt-3 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                  />
                )}
              </div>
            )}

            {/* GALLONS */}
            <input
              type="number"
              placeholder="Gallons"
              value={gallons}
              onChange={(e) => setGallons(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
            />

            <label className="flex items-start gap-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
              <input
                type="checkbox"
                checked={isFullFillUp}
                onChange={(e) => setIsFullFillUp(e.target.checked)}
                className="mt-1 h-4 w-4 accent-blue-500"
              />
              <span>
                <span className="block text-sm font-semibold text-white">
                  Full fill-up
                </span>
                <span className="mt-1 block text-xs text-slate-400">
                  Use this fuel entry for MPG calculations.
                </span>
              </span>
            </label>

            {/* PRICE PER GALLON */}
            <input
              type="number"
              placeholder="Price per gallon"
              value={pricePerGallon}
              onChange={(e) => setPricePerGallon(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
            />

            {/* NOTES (optional) */}
            <input
              type="text"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
            />

            {/* ACTION BUTTONS */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleSaveFuel}
                disabled={trialRequired}
                className="rounded-xl bg-blue-500 py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {trialRequired ? "Start Trial" : "Save Fuel Entry"}
              </button>

              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-xl border border-slate-700 bg-slate-900 py-2 font-bold text-slate-300"
              >
                Cancel
              </button>
            </div>

          </div>
        </section>

        {/* =====================================================
            RECENT FUEL ENTRIES
            Shows the 5 most recent fill-ups.  Each card
            displays date, odometer, total cost, gallons, and
            optional notes.
           ===================================================== */}

        <section className="rounded-3xl border border-slate-700/70 bg-slate-950/70 p-5">
          <h2 className="text-lg font-bold">Recent fuel</h2>

          {fuelEntries.length === 0 ? (

            /* EMPTY STATE */
            <p className="mt-2 text-sm text-slate-400">
              No fuel entries yet.
            </p>

          ) : (

            /* ENTRY LIST */
            <div className="mt-3 space-y-3">
              {fuelEntries.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4"
                >
                  {/* ENTRY HEADER — date left, cost right */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{entry.date}</p>
                      <p className="text-sm text-slate-400">
                        Odometer: {entry.odometer}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold">${entry.totalCost}</p>
                      <p className="text-xs text-slate-400">
                        {entry.gallons} gal
                      </p>
                    </div>
                  </div>

                  {/* OPTIONAL NOTES */}
                  {entry.notes && (
                    <p className="mt-2 text-sm text-slate-400">
                      {entry.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>

          )}
        </section>

      </div>

    </main>
  );
}
