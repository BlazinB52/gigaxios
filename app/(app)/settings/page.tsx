"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Archive, LogOut, User, Wrench } from "lucide-react";
import BottomNav from "../components/BottomNav";
import { supabase } from "@/app/lib/supabaseClient";
import { Vehicle, loadVehiclesFromSupabase } from "@/app/lib/garageStorage";
import JSZip from "jszip";

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const headerRow = headers.join(",");
  const dataRows = rows.map((row) =>
    headers.map((h) => escape(row[h])).join(",")
  );
  return [headerRow, ...dataRows].join("\n");
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative h-6 w-12 rounded-full transition-colors ${on ? "bg-blue-500" : "bg-slate-700"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          on ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleOdometers, setVehicleOdometers] = useState<Record<string, string>>({});
  const [userEmail, setUserEmail] = useState("");
  const [defaultPlatform, setDefaultPlatform] = useState("GoPuff");
  const [notifMaintenance, setNotifMaintenance] = useState(true);
  const [notifWeeklySummary, setNotifWeeklySummary] = useState(false);
  const [notifLowFuel, setNotifLowFuel] = useState(false);
  const [workPaySaved, setWorkPaySaved] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function fetchVehicles(uid: string) {
    const loaded = await loadVehiclesFromSupabase(uid);
    setVehicles(loaded);

    const { data: fuelData } = await supabase
      .from("fuel_entries")
      .select("vehicle_id, odometer")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    const odometerMap: Record<string, string> = {};
    if (fuelData) {
      for (const entry of fuelData) {
        if (entry.vehicle_id && !odometerMap[entry.vehicle_id]) {
          odometerMap[entry.vehicle_id] = entry.odometer ?? "";
        }
      }
    }
    setVehicleOdometers(odometerMap);
  }

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? "");
      await fetchVehicles(user.id);
      setDefaultPlatform(localStorage.getItem("gigaxios-default-platform") || "GoPuff");
      setNotifMaintenance(localStorage.getItem("gigaxios-notif-maintenance") !== "false");
      setIsLoaded(true);
    }

    load();
  }, [router]);

  async function handleSetPrimary(vehicleId: string) {
    if (!userId) return;
    await supabase.from("vehicles").update({ is_primary: false }).eq("user_id", userId);
    await supabase.from("vehicles").update({ is_primary: true }).eq("id", vehicleId);
    await fetchVehicles(userId);
  }

  async function handleArchiveVehicle(vehicleId: string) {
    if (!confirm("Archive this vehicle?")) return;
    const activeVehicles = vehicles.filter((v) => v.status === "active");
    if (activeVehicles.length <= 1) {
      alert("You must have at least one active vehicle.");
      return;
    }
    await supabase.from("vehicles").update({ status: "archived" }).eq("id", vehicleId);
    if (userId) await fetchVehicles(userId);
  }

  async function handleExportData() {
    setExporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        shiftsRes,
        fuelRes,
        serviceRes,
        remindersRes,
        periodsRes,
        adjustmentsRes,
      ] = await Promise.all([
        supabase.from("shifts").select("*").eq("user_id", user.id),
        supabase.from("fuel_entries").select("*").eq("user_id", user.id),
        supabase.from("service_entries").select("*").eq("user_id", user.id),
        supabase.from("maintenance_reminders").select("*").eq("user_id", user.id),
        supabase.from("pay_periods").select("*").eq("user_id", user.id),
        supabase.from("pay_adjustments").select("*").eq("user_id", user.id),
      ]);

      const zip = new JSZip();
      const date = new Date().toISOString().split("T")[0];

      const files: [string, unknown[]][] = [
        ["shifts.csv", shiftsRes.data || []],
        ["fuel_entries.csv", fuelRes.data || []],
        ["service_entries.csv", serviceRes.data || []],
        ["maintenance_reminders.csv", remindersRes.data || []],
        ["pay_periods.csv", periodsRes.data || []],
        ["pay_adjustments.csv", adjustmentsRes.data || []],
      ];

      files.forEach(([filename, data]) => {
        zip.file(filename, toCSV(data as Record<string, unknown>[]));
      });

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `gigaxios-export-${date}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-[#020814] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-24 pt-8">

        {/* PAGE HEADER */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-300"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Settings</h1>
            <p className="mt-1 text-sm text-slate-400">Manage your preferences and app settings.</p>
          </div>
        </div>

        {/* =====================================================
            SECTION 1 — VEHICLES
           ===================================================== */}
        <div className="relative mt-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-blue-500" />
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">

            {/* HEADER ROW */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-950/60 text-lg">
                  🚗
                </div>
                <div>
                  <p className="text-xs font-bold tracking-wider text-slate-400">VEHICLES</p>
                  <p className="text-sm text-slate-500">Manage your vehicles and set your primary.</p>
                </div>
              </div>
              <button
                onClick={() => router.push("/settings/vehicle/new")}
                className="shrink-0 rounded-xl bg-blue-500 px-3 py-2 text-sm font-semibold text-white"
              >
                + Add Vehicle
              </button>
            </div>

            {/* VEHICLE LIST */}
            {isLoaded && (
              <div className="mt-4 border-t border-slate-800 pt-2">
                {vehicles.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No vehicles yet. Add one to get started.</p>
                ) : (
                  vehicles.map((vehicle) => (
                    <div
                      key={vehicle.id}
                      className={`mt-3 rounded-2xl border p-4 ${
                        vehicle.isPrimary
                          ? "border-blue-500/50 bg-blue-950/20"
                          : "border-slate-700 bg-slate-900/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-base">
                          🚗
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-white">
                              {vehicle.year} {vehicle.make} {vehicle.model}
                            </p>
                            {vehicle.isPrimary && (
                              <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">
                                PRIMARY
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-400">
                            {vehicleOdometers[vehicle.id]
                              ? `${parseInt(vehicleOdometers[vehicle.id]).toLocaleString()} mi`
                              : "—"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <button
                            onClick={() => handleArchiveVehicle(vehicle.id)}
                            className="flex items-center gap-1 text-xs text-red-400"
                          >
                            <Archive size={14} />
                          </button>
                          <button onClick={() => router.push(`/settings/vehicle/${vehicle.id}`)}>
                            <ChevronRight className="h-5 w-5 text-slate-500" />
                          </button>
                        </div>
                      </div>
                      {!vehicle.isPrimary && (
                        <button
                          onClick={() => handleSetPrimary(vehicle.id)}
                          className="mt-2 text-xs text-blue-400"
                        >
                          Set as Primary
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* INFO NOTE */}
            <p className="mt-4 flex items-center gap-1 text-xs text-slate-500">
              ℹ️ Primary vehicle is used for default views and calculations.
            </p>
          </section>
        </div>

        {/* =====================================================
            SECTION 2 — SERVICE INTERVALS (navigation row)
           ===================================================== */}
        <div className="relative mt-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-amber-500" />
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">
            <button
              className="flex w-full items-center gap-3"
              onClick={() => router.push("/settings/intervals")}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-950/60">
                <Wrench className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-xs font-bold tracking-wider text-slate-400">SERVICE INTERVALS</p>
                <p className="text-sm text-slate-500">Manage maintenance items and intervals.</p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-500" />
            </button>
          </section>
        </div>

        {/* =====================================================
            SECTION 3 — WORK & PAY
           ===================================================== */}
        <div className="relative mt-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-emerald-500" />
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-950/60 text-lg font-bold text-emerald-400">
                $
              </div>
              <div>
                <p className="text-xs font-bold tracking-wider text-slate-400">WORK & PAY</p>
                <p className="text-sm text-slate-500">Configure work week and default platform.</p>
              </div>
            </div>

            <div className="mt-4 space-y-4 border-t border-slate-800 pt-4">

              <div>
                <p className="mb-1 text-sm text-slate-300">Week starts on</p>
                <select
                  value="Monday"
                  disabled
                  className="rounded-xl border border-slate-700 bg-slate-950 p-2 text-sm text-white"
                >
                  <option value="Monday">Monday</option>
                </select>
              </div>

              <div>
                <p className="mb-1 text-sm text-slate-300">Default platform</p>
                <select
                  value={defaultPlatform}
                  onChange={(e) => {
                    setDefaultPlatform(e.target.value);
                    localStorage.setItem("gigaxios-default-platform", e.target.value);
                    setWorkPaySaved(true);
                    setTimeout(() => setWorkPaySaved(false), 1500);
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-950 p-2 text-sm text-white"
                >
                  <option value="GoPuff">GoPuff</option>
                  <option value="DoorDash">DoorDash</option>
                  <option value="Amazon Flex">Amazon Flex</option>
                  <option value="Shipt">Shipt</option>
                  <option value="Uber Eats">Uber Eats</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <p className="mb-1 text-sm text-slate-300">Pay period</p>
                <p className="text-sm text-white">
                  Weekly <span className="text-slate-400">Monday – Sunday</span>
                </p>
              </div>

            </div>

            {workPaySaved && <p className="mt-3 text-sm text-emerald-400">Saved.</p>}
          </section>
        </div>

        {/* =====================================================
            SECTION 4 — NOTIFICATIONS
           ===================================================== */}
        <div className="relative mt-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-purple-500" />
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-950/60 text-lg">
                🔔
              </div>
              <div>
                <p className="text-xs font-bold tracking-wider text-slate-400">NOTIFICATIONS</p>
                <p className="text-sm text-slate-500">Choose what notifications you want to receive.</p>
              </div>
            </div>

            <div className="mt-4 space-y-4 border-t border-slate-800 pt-4">

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Maintenance reminders</span>
                <Toggle
                  on={notifMaintenance}
                  onToggle={() => {
                    const next = !notifMaintenance;
                    setNotifMaintenance(next);
                    localStorage.setItem("gigaxios-notif-maintenance", String(next));
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-300">Weekly summary</span>
                  <span className="text-xs text-slate-500">(coming soon)</span>
                </div>
                <Toggle on={notifWeeklySummary} onToggle={() => setNotifWeeklySummary((v) => !v)} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-300">Low fuel warning</span>
                  <span className="text-xs text-slate-500">(coming soon)</span>
                </div>
                <Toggle on={notifLowFuel} onToggle={() => setNotifLowFuel((v) => !v)} />
              </div>

            </div>
          </section>
        </div>

        {/* =====================================================
            SECTION 5 — ACCOUNT
           ===================================================== */}
        <div className="relative mt-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-slate-500" />
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800">
                <User className="h-5 w-5 text-slate-400" />
              </div>
              <div>
                <p className="text-xs font-bold tracking-wider text-slate-400">ACCOUNT</p>
                <p className="text-sm text-slate-500">Manage your account and access.</p>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Email address</span>
                <span className="max-w-[55%] truncate text-right text-sm text-slate-400">{userEmail}</span>
              </div>
            </div>

            <button
              onClick={handleExportData}
              disabled={exporting}
              className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm font-semibold text-slate-300 disabled:opacity-50"
            >
              {exporting ? "Preparing export..." : "⬇️ Export My Data"}
            </button>
            <p className="mt-1 text-center text-xs text-slate-500">
              Downloads a ZIP file with all your data as CSV files
            </p>

            <button
              onClick={handleSignOut}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-300"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </section>
        </div>

        {/* =====================================================
            SECTION 6 — TAX INFORMATION (stub)
           ===================================================== */}
        <div className="mt-6 opacity-60">
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800 text-lg">
                📄
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold tracking-wider text-slate-400">TAX INFORMATION</p>
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                    coming soon
                  </span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-500" />
            </div>
          </section>
        </div>

      </div>
      <BottomNav />
    </main>
  );
}
