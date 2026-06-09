"use client";

/* =========================================================
   FUEL PAGE---
   ---------------------------------------------------------
   Lets the user log fuel fill-ups (date, odometer, gallons,
   price per gallon, optional notes).  Saves to Supabase and
   shows the 5 most recent entries below the form.
   ========================================================= */

import { ChangeEvent, useEffect, useRef, useState } from "react";
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
import {
  convertImportDayHeicToJpeg,
  detectImportDayHeic,
  getImportDayConversionErrorMessage,
  isImportDayAcceptedImage,
} from "@/app/lib/importDayImage";

type FuelOcrKind = "odometer" | "receipt";
type FuelOcrStatus = "idle" | "preparing" | "reading";
type FuelOcrResult =
  | {
      kind: "odometer";
      mileage: number | null;
      confidence: "high" | "medium" | "low";
      notes: string;
    }
  | {
      kind: "receipt";
      date: string | null;
      gallons: number | null;
      pricePerGallon: number | null;
      stationName: string | null;
      confidence: "high" | "medium" | "low";
      notes: string;
    };

const OCR_TIMEOUT_MS = 45_000;

function numberToInput(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function isValidFuelDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function mergeNotes(currentNotes: string, nextNotes: string[]) {
  const additions = nextNotes
    .map((note) => note.trim())
    .filter((note) => note.length > 0 && !currentNotes.includes(note));

  return [currentNotes, ...additions].filter(Boolean).join("\n");
}

export default function FuelPage() {

  /* =========================================================
     ROUTER  no changes made
     Used for redirecting after save or cancel
     ========================================================= */

  const router = useRouter();
  const fileInputRefs = useRef<Record<FuelOcrKind, HTMLInputElement | null>>({
    odometer: null,
    receipt: null,
  });

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
  const [showMileageException, setShowMileageException] = useState(false);
  const [accessState, setAccessState] =
    useState<SubscriptionAccessState | null>(null);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<Record<FuelOcrKind, FuelOcrStatus>>({
    odometer: "idle",
    receipt: "idle",
  });
  const [ocrError, setOcrError] = useState("");
  const [ocrMessage, setOcrMessage] = useState("");

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

  const trialRequired = accessState?.trialRequired ?? false;

  function resetMileageException() {
    setShowMileageException(false);
    setAllowMileageException(false);
    setMileageExceptionReason("");
  }

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

  function patchOcrStatus(kind: FuelOcrKind, status: FuelOcrStatus) {
    setOcrStatus((current) => ({ ...current, [kind]: status }));
  }

  function openScanPicker(kind: FuelOcrKind) {
    setOcrError("");
    setOcrMessage("");
    fileInputRefs.current[kind]?.click();
  }

  function applyFuelOcrResult(result: FuelOcrResult) {
    if (result.kind === "odometer") {
      const nextOdometer = numberToInput(result.mileage);
      if (nextOdometer) {
        setOdometer(nextOdometer);
        resetMileageException();
      }
      setOcrMessage(
        nextOdometer
          ? "Odometer scanned. Review it before saving."
          : "OCR could not find a clear odometer reading."
      );
      return;
    }

    const nextDate = isValidFuelDate(result.date) ? result.date || "" : "";
    const nextGallons = numberToInput(result.gallons);
    const nextPricePerGallon = numberToInput(result.pricePerGallon);
    const stationNote = result.stationName ? `Station: ${result.stationName}` : "";

    if (nextDate) setDate(nextDate);
    if (nextGallons) setGallons(nextGallons);
    if (nextPricePerGallon) setPricePerGallon(nextPricePerGallon);
    setNotes((current) => mergeNotes(current, [stationNote]));

    const filledFields = [
      nextDate ? "date" : "",
      nextGallons ? "gallons" : "",
      nextPricePerGallon ? "price per gallon" : "",
      stationNote ? "station note" : "",
    ].filter(Boolean);

    setOcrMessage(
      filledFields.length > 0
        ? `Receipt scanned: filled ${filledFields.join(", ")}. Review before saving.`
        : "OCR could not find clear receipt values."
    );
  }

  async function handleFuelOcrFileChange(
    kind: FuelOcrKind,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    setOcrError("");
    setOcrMessage("");

    if (!file) return;

    if (trialRequired) {
      setOcrError("Your free preview has ended. Start your free trial to use OCR.");
      return;
    }

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      abortController.abort();
    }, OCR_TIMEOUT_MS);

    try {
      patchOcrStatus(kind, "preparing");
      const detectedHeic = await detectImportDayHeic(file);

      if (!isImportDayAcceptedImage(file, detectedHeic)) {
        setOcrError("Upload a valid image file.");
        return;
      }

      const readyFile = detectedHeic.isHeic
        ? await convertImportDayHeicToJpeg(file)
        : file;
      const formData = new FormData();
      formData.append("image", readyFile);
      formData.append("kind", kind);

      patchOcrStatus(kind, "reading");

      const response = await fetch("/api/fuel/ocr", {
        method: "POST",
        body: formData,
        signal: abortController.signal,
      });
      const data = (await response.json()) as {
        result?: FuelOcrResult;
        warning?: string | null;
        error?: string;
      };

      if (!response.ok || !data.result) {
        setOcrError(data.error || "OpenAI could not read this image.");
        return;
      }

      applyFuelOcrResult(data.result);
      if (data.warning) {
        setOcrError(data.warning);
      }
    } catch (error) {
      setOcrError(
        abortController.signal.aborted
          ? "OCR took too long. Please try again."
          : `OCR failed. ${getImportDayConversionErrorMessage(error)}`
      );
    } finally {
      window.clearTimeout(timeoutId);
      patchOcrStatus(kind, "idle");
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
      setShowMileageException(true);
      return;
    }

    setShowMileageException(false);

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

      <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-5 pb-28 pt-7">

        {/* =====================================================
            PAGE HEADER -
           ===================================================== */}

        <div className="mb-2">
          <h1 className="text-3xl font-bold tracking-tight">Fuel</h1>
          <p className="mt-1 text-sm text-slate-400">
            Track fill-ups, gallons, and fuel cost.
          </p>
        </div>

        <input
          ref={(element) => {
            fileInputRefs.current.odometer = element;
          }}
          type="file"
          accept="image/*,.heic,.heif"
          className="hidden"
          onChange={(event) => handleFuelOcrFileChange("odometer", event)}
        />
        <input
          ref={(element) => {
            fileInputRefs.current.receipt = element;
          }}
          type="file"
          accept="image/*,.heic,.heif"
          className="hidden"
          onChange={(event) => handleFuelOcrFileChange("receipt", event)}
        />

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
            RECENT FUEL ENTRIES
            Shows the 5 most recent fill-ups.
           ===================================================== */}

        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm shadow-black/20">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold">Recent fuel</h2>
            {fuelEntries.length > 5 && (
              <p className="text-xs text-slate-500">Latest 5</p>
            )}
          </div>

          {fuelEntries.length === 0 ? (

            /* EMPTY STATE */
            <p className="mt-2 text-sm text-slate-400">
              No fuel entries yet.
            </p>

          ) : (

            /* ENTRY LIST */
            <div className="mt-3 space-y-2">
              {fuelEntries.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{entry.date}</p>
                      <p className="truncate text-sm text-slate-400">
                        Odometer: {entry.odometer}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold">${entry.totalCost}</p>
                      <p className="text-xs text-slate-400">
                        {entry.gallons} gal
                      </p>
                    </div>
                  </div>

                  {entry.notes && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                      {entry.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>

          )}
        </section>

        {/* =====================================================
            ADD FUEL FORM
            Required: date, odometer, gallons, price per gallon.
            Optional: notes.
            [color-scheme:dark] on the date input forces the
            browser's native calendar icon to render white.
           ===================================================== */}

        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm shadow-black/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Add fuel</h2>
              <p className="text-xs text-slate-500">Scan helpers fill drafts only.</p>
            </div>
            <button
              type="button"
              onClick={() => openScanPicker("receipt")}
              disabled={trialRequired || ocrStatus.receipt !== "idle"}
              className="shrink-0 rounded-full border border-blue-400/40 bg-blue-500/10 px-3.5 py-2 text-sm font-bold text-blue-100 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500"
            >
              {ocrStatus.receipt === "idle" ? "Scan Receipt" : "Reading..."}
            </button>
          </div>

          {(ocrError || ocrMessage || ocrStatus.odometer !== "idle" || ocrStatus.receipt !== "idle") && (
            <div className="mt-3 space-y-2">
              {(ocrStatus.odometer !== "idle" || ocrStatus.receipt !== "idle") && (
                <p className="rounded-2xl border border-blue-400/30 bg-blue-950/30 px-4 py-3 text-sm text-blue-100">
                  {ocrStatus.odometer !== "idle"
                    ? ocrStatus.odometer === "preparing"
                      ? "Preparing odometer photo..."
                      : "Reading odometer photo..."
                    : ocrStatus.receipt === "preparing"
                      ? "Preparing receipt photo..."
                      : "Reading receipt photo..."}
                </p>
              )}
              {ocrMessage && (
                <p className="rounded-2xl border border-emerald-400/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100">
                  {ocrMessage}
                </p>
              )}
              {ocrError && (
                <p className="rounded-2xl border border-amber-400/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
                  {ocrError}
                </p>
              )}
            </div>
          )}

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
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white [color-scheme:dark]"
            />

            {/* ODOMETER */}
            <div className="flex overflow-hidden rounded-xl border border-slate-700 bg-slate-900 focus-within:border-blue-400/70">
              <input
                type="number"
                placeholder="Odometer"
                value={odometer}
                onChange={(e) => {
                  setOdometer(e.target.value);
                  resetMileageException();
                }}
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-white outline-none placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => openScanPicker("odometer")}
                disabled={trialRequired || ocrStatus.odometer !== "idle"}
                className="shrink-0 border-l border-slate-700 bg-slate-800/80 px-3.5 py-2 text-sm font-bold text-blue-100 disabled:cursor-not-allowed disabled:text-slate-500"
              >
                {ocrStatus.odometer === "idle" ? "Scan" : "Reading..."}
              </button>
            </div>

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

            <div className="grid grid-cols-2 gap-2">
              {/* GALLONS */}
              <input
                type="number"
                placeholder="Gallons"
                value={gallons}
                onChange={(e) => setGallons(e.target.value)}
                className="min-w-0 rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
              />

              {/* PRICE PER GALLON */}
              <input
                type="number"
                placeholder="Price / gal"
                value={pricePerGallon}
                onChange={(e) => setPricePerGallon(e.target.value)}
                className="min-w-0 rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
              />
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5">
              <input
                type="checkbox"
                checked={isFullFillUp}
                onChange={(e) => setIsFullFillUp(e.target.checked)}
                className="h-4 w-4 accent-blue-500"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">
                  Full fill-up
                </span>
                <span className="block text-xs text-slate-400">
                  Use this fuel entry for MPG calculations.
                </span>
              </span>
            </label>

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
                className="rounded-xl bg-blue-500 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {trialRequired ? "Start Trial" : "Save Fuel Entry"}
              </button>

              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-xl border border-slate-700 bg-slate-900 py-2.5 font-bold text-slate-300"
              >
                Cancel
              </button>
            </div>

          </div>
        </section>

      </div>

    </main>
  );
}
