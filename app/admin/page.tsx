"use client";

/* =========================================================
   ADMIN PAGE
   ---------------------------------------------------------
   Internal maintenance panel for GigAxios data.  Provides:
     • Supabase connection status indicator
     • Full data export (shifts, fuel) as a dated JSON
       backup file downloaded directly to the browser
     • LocalStorage purge (wipes browser-cached keys)
     • Raw record viewer for shifts and fuel entries

   Route protection is handled by proxy.ts — no client-side
   auth redirect needed here.  Auth is checked inside each
   handler only to obtain the current user ID.
   ========================================================= */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "../lib/supabaseClient";

function getTodayLocal(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
import { SavedShift } from "@/app/lib/types";
import { FuelEntry, loadFuelEntriesFromSupabase } from "@/app/lib/fuelStorage";
import { loadShiftsFromSupabase } from "@/app/lib/storage";

const ADMIN_USER_ID = "b1ac6152-bee8-47a9-9bcd-d44deee99116";

/* =========================================================
   LOCAL STORAGE KEYS
   All keys written by GigAxios that should be cleared on a
   data purge.
   ========================================================= */

const GIGAXIOS_KEYS = [
    "savedShifts",
    "gigaxios-fuel",
    "gigaxios-expenses",
];

export default function AdminPage() {
    const router = useRouter();

  /* =========================================================
     STATE VARIABLES
     ========================================================= */

    const [savedShifts, setSavedShifts] = useState<any[]>([]);
    const [fuelEntries, setFuelEntries] = useState<any[]>([]);
    const [supabaseStatus, setSupabaseStatus] = useState("Checking Supabase...");
    const [isAuthorized, setIsAuthorized] = useState(false);

  /* =========================================================
     DATA LOADING
     Loads all three record types from Supabase in parallel.
     Sets the connection status banner on success.
     ========================================================= */

    useEffect(() => {
        async function loadAdminData() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }

            if (user.id !== ADMIN_USER_ID) {
                router.push("/");
                return;
            }

            setIsAuthorized(true);

            const shifts = await loadShiftsFromSupabase(user.id);
            const fuel = await loadFuelEntriesFromSupabase(user.id);

            setSavedShifts(shifts);
            setFuelEntries(fuel);
            setSupabaseStatus("Supabase connected successfully.");
        }

        loadAdminData();
    }, [router]);

  /* =========================================================
     EXPORT BACKUP
     Fetches raw rows from all three Supabase tables for the
     current user, bundles them into a single JSON object, and
     triggers a browser download named with today's date.
     ========================================================= */

    async function handleExportBackup() {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data: shifts, error: shiftsError } = await supabase
            .from("shifts")
            .select("*")
            .eq("user_id", user.id);

        const { data: fuelEntries, error: fuelError } = await supabase
            .from("fuel_entries")
            .select("*")
            .eq("user_id", user.id);

        if (shiftsError || fuelError) {
            alert("Could not export Supabase backup. Check console for details.");
            console.error({ shiftsError, fuelError });
            return;
        }

        /* -------------------------------------------------------
           BUILD BACKUP OBJECT
           Includes export timestamp, source tag, user ID, and
           both datasets.  Nullish-coalesces to [] so the file
           is always valid JSON even if a table is empty.
           ------------------------------------------------------- */

        const backup = {
            exportedAt: new Date().toISOString(),
            source: "supabase",
            user_id: user.id,
            shifts: shifts ?? [],
            fuel_entries: fuelEntries ?? [],
        };

        /* -------------------------------------------------------
           TRIGGER BROWSER DOWNLOAD
           Creates a temporary object URL, clicks it
           programmatically, then revokes the URL to free memory.
           ------------------------------------------------------- */

        const backupFile = new Blob([JSON.stringify(backup, null, 2)], {
            type: "application/json",
        });

        const downloadUrl = URL.createObjectURL(backupFile);
        const link = document.createElement("a");

        link.href = downloadUrl;
        link.download = `gigaxios-supabase-backup-${getTodayLocal()}.json`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(downloadUrl);
    }

  /* =========================================================
     PURGE LOCAL DATA
     Removes all GigAxios keys from localStorage and reloads
     the page.  Does NOT touch Supabase — Supabase records
     are preserved.
     ========================================================= */

    function handlePurgeData() {
        const confirmed = window.confirm(
            "This will permanently delete all saved GigAxios data from this browser. Are you sure?"
        );

        if (!confirmed) return;

        GIGAXIOS_KEYS.forEach((key) => {
            localStorage.removeItem(key);
        });

        alert("GigAxios data has been purged.");
        window.location.reload();
    }

  /* =========================================================
     RENDER
     ========================================================= */

    if (!isAuthorized) {
        return (
            <main className="min-h-screen bg-[#020814]" />
        );
    }

    return (

        <main className="min-h-screen bg-slate-950 p-4 text-white">

          {/* SUPABASE STATUS BANNER — green chip at the top */}
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-sm text-emerald-200">
              {supabaseStatus}
          </div>

          <div className="mx-auto max-w-md space-y-6">

            {/* PAGE HEADER */}
            <div>
                <p className="text-sm text-slate-400">GigAxios maintenance</p>
                <h1 className="text-2xl font-bold">Admin</h1>
                <p className="text-xs text-amber-400 mt-1">
                    🔒 Admin access only
                </p>
            </div>

            {/* =====================================================
                BACKUP & EXPORT
                Downloads all Supabase records as a dated JSON file.
               ===================================================== */}

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg">
                <h2 className="text-lg font-semibold">Backup & Export</h2>
                <p className="mt-2 text-sm text-slate-400">
                    Export a backup file of your saved GigAxios data only.
                </p>

                <button
                    onClick={handleExportBackup}
                    className="mt-4 w-full rounded-xl bg-blue-500 p-3 font-bold text-white hover:bg-blue-400"
                >
                    Export Records / Backup
                </button>
            </section>

            {/* =====================================================
                PURGE DATA
                Clears browser localStorage keys only.
                Supabase records are NOT affected.
               ===================================================== */}

            <section className="rounded-2xl border border-red-900 bg-slate-900 p-4 shadow-lg">
                <h2 className="text-lg font-semibold text-red-300">Purge Data</h2>
                <p className="mt-2 text-sm text-slate-400">
                    Delete all saved GigAxios data from this browser and start fresh.
                </p>

                <button
                    onClick={handlePurgeData}
                    className="mt-4 w-full rounded-xl bg-red-600 p-3 font-bold text-white hover:bg-red-500"
                >
                    Purge GigAxios Data
                </button>
            </section>

            {/* =====================================================
                SAVED SHIFTS
                Raw shift records loaded from Supabase.  Shows
                mileage, status, and pay breakdown if entered.
               ===================================================== */}

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg">
                <h2 className="text-lg font-semibold">Saved Shifts</h2>

                <div className="mt-4 space-y-3">

                  {/* EMPTY STATE */}
                  {savedShifts.length === 0 && (
                      <p className="text-sm text-slate-400">No shifts saved.</p>
                  )}

                  {/* SHIFT ROWS */}
                  {savedShifts.map((shift) => (
                      <div
                          key={shift.id}
                          className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm"
                      >
                          {/* MILEAGE + STATUS */}
                          <p>Date: {shift.date}</p>
                          <p>Status: {shift.status}</p>
                          <p>Beginning: {shift.beginningMileage}</p>
                          <p>Ending: {shift.endingMileage || "-"}</p>

                          {/* PAY BREAKDOWN — populated when a pay entry is logged */}
                          <div className="mt-3 border-t border-slate-700 pt-3">
                              <p>Platform: {shift.platform || "Not entered"}</p>
                              <p>Deliveries: {shift.deliveries || "Not entered"}</p>
                              <p>Hours: {shift.hoursWorked || "Not entered"}</p>
                              <p>Base Pay: {shift.basePay ? `$${shift.basePay}` : "Not entered"}</p>
                              <p>Tips: {shift.tips ? `$${shift.tips}` : "Not entered"}</p>
                              <p>Other Pay: {shift.otherPay ? `$${shift.otherPay}` : "Not entered"}</p>
                              <p>Total: {shift.grossPay ? `$${shift.grossPay}` : "Not entered"}</p>
                          </div>
                      </div>
                  ))}

                </div>
            </section>

            {/* =====================================================
                FUEL ENTRIES
                Raw fuel_entries records.  Read-only view —
                deletion is not exposed here.
               ===================================================== */}

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg">
                <h2 className="text-lg font-semibold">Fuel Entries</h2>

                <div className="mt-4 space-y-3">

                  {/* EMPTY STATE */}
                  {fuelEntries.length === 0 && (
                      <p className="text-sm text-slate-400">No fuel entries saved.</p>
                  )}

                  {/* FUEL ENTRY ROWS */}
                  {fuelEntries.map((entry, index) => (
                      <div
                          key={index}
                          className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm"
                      >
                          <p>Date: {entry.date}</p>
                          <p>Odometer: {entry.odometer}</p>
                          <p>Gallons: {entry.gallons}</p>
                          <p>Price/Gal: {entry.pricePerGallon}</p>
                      </div>
                  ))}

                </div>
            </section>

          </div>
        </main>
    );
}
