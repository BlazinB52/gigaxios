"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Settings, Wrench } from "lucide-react";
import BottomNav from "../components/BottomNav";
import { supabase } from "@/app/lib/supabaseClient";
import {
  Vehicle,
  ServiceInterval,
  loadVehicleFromSupabase,
  loadServiceIntervalsFromSupabase,
  saveVehicleToSupabase,
  saveServiceIntervalsToSupabase,
} from "@/app/lib/garageStorage";

const DEFAULT_INTERVALS: Array<{ serviceType: string; intervalMiles: number | null; intervalMonths: number | null }> = [
  { serviceType: "Oil Change", intervalMiles: 5000, intervalMonths: null },
  { serviceType: "Tire Rotation", intervalMiles: 5000, intervalMonths: null },
  { serviceType: "Brake Inspection", intervalMiles: 20000, intervalMonths: null },
  { serviceType: "Transmission Service", intervalMiles: 40000, intervalMonths: null },
  { serviceType: "Battery Check", intervalMiles: 50000, intervalMonths: null },
  { serviceType: "Tires", intervalMiles: 50000, intervalMonths: null },
  { serviceType: "Wipers", intervalMiles: null, intervalMonths: 6 },
  { serviceType: "Inspection", intervalMiles: null, intervalMonths: 12 },
  { serviceType: "Registration Renewal", intervalMiles: null, intervalMonths: 12 },
];

type IntervalRow = {
  serviceType: string;
  intervalMiles: string;
  intervalMonths: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleTrim, setVehicleTrim] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehicleLicensePlate, setVehicleLicensePlate] = useState("");
  const [vehicleVin, setVehicleVin] = useState("");
  const [vehicleSaving, setVehicleSaving] = useState(false);

  const [intervalRows, setIntervalRows] = useState<IntervalRow[]>(
    DEFAULT_INTERVALS.map((d) => ({
      serviceType: d.serviceType,
      intervalMiles: d.intervalMiles !== null ? String(d.intervalMiles) : "",
      intervalMonths: d.intervalMonths !== null ? String(d.intervalMonths) : "",
    }))
  );
  const [intervalsSaving, setIntervalsSaving] = useState(false);

  const [weekStartsOn, setWeekStartsOn] = useState("Monday");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

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

      const [vehicle, intervals] = await Promise.all([
        loadVehicleFromSupabase(user.id),
        loadServiceIntervalsFromSupabase(user.id),
      ]);

      if (vehicle) {
        setVehicleYear(vehicle.year);
        setVehicleMake(vehicle.make);
        setVehicleModel(vehicle.model);
        setVehicleTrim(vehicle.trim);
        setVehicleColor(vehicle.color);
        setVehicleLicensePlate(vehicle.licensePlate);
        setVehicleVin(vehicle.vin);
      }

      if (intervals.length > 0) {
        setIntervalRows(
          DEFAULT_INTERVALS.map((d) => {
            const saved = intervals.find((i) => i.serviceType === d.serviceType);
            if (saved) {
              return {
                serviceType: d.serviceType,
                intervalMiles: saved.intervalMiles !== null ? String(saved.intervalMiles) : "",
                intervalMonths: saved.intervalMonths !== null ? String(saved.intervalMonths) : "",
              };
            }
            return {
              serviceType: d.serviceType,
              intervalMiles: d.intervalMiles !== null ? String(d.intervalMiles) : "",
              intervalMonths: d.intervalMonths !== null ? String(d.intervalMonths) : "",
            };
          })
        );
      }
    }

    load();
  }, [router]);

  async function handleSaveVehicle() {
    if (!userId) return;
    setVehicleSaving(true);

    const vehicle: Vehicle = {
      id: "",
      userId,
      year: vehicleYear,
      make: vehicleMake,
      model: vehicleModel,
      trim: vehicleTrim,
      color: vehicleColor,
      licensePlate: vehicleLicensePlate,
      vin: vehicleVin,
      notes: "",
    };

    await saveVehicleToSupabase(vehicle);
    setVehicleSaving(false);
  }

  async function handleSaveIntervals() {
    if (!userId) return;
    setIntervalsSaving(true);

    const intervals: ServiceInterval[] = intervalRows.map((row) => ({
      id: crypto.randomUUID(),
      userId,
      serviceType: row.serviceType,
      intervalMiles: row.intervalMiles !== "" ? Number(row.intervalMiles) : null,
      intervalMonths: row.intervalMonths !== "" ? Number(row.intervalMonths) : null,
    }));

    await saveServiceIntervalsToSupabase(userId, intervals);
    setIntervalsSaving(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function updateIntervalRow(index: number, field: "intervalMiles" | "intervalMonths", value: string) {
    setIntervalRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  const inputClass = "w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white";

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
            <p className="mt-1 text-sm text-slate-400">Configure your vehicle and preferences.</p>
          </div>
        </div>

        {/* SECTION 1 - VEHICLE PROFILE */}
        <div className="relative mt-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-blue-500" />
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-950/60 text-xl">
                🚗
              </div>
              <h2 className="text-xl font-bold">Vehicle</h2>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Year"
                value={vehicleYear}
                onChange={(e) => setVehicleYear(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Make"
                value={vehicleMake}
                onChange={(e) => setVehicleMake(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Model"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Trim (optional)"
                value={vehicleTrim}
                onChange={(e) => setVehicleTrim(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Color (optional)"
                value={vehicleColor}
                onChange={(e) => setVehicleColor(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="License Plate (optional)"
                value={vehicleLicensePlate}
                onChange={(e) => setVehicleLicensePlate(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="VIN (optional)"
                value={vehicleVin}
                onChange={(e) => setVehicleVin(e.target.value)}
                className={inputClass}
              />
            </div>

            <button
              onClick={handleSaveVehicle}
              disabled={vehicleSaving}
              className="mt-5 w-full rounded-2xl bg-blue-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {vehicleSaving ? "Saving…" : "Save Vehicle"}
            </button>
          </section>
        </div>

        {/* SECTION 2 - SERVICE INTERVALS */}
        <div className="relative mt-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-amber-500" />
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-950/60 text-xl">
                <Wrench className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-bold">Service Intervals</h2>
            </div>
            <p className="mb-5 text-sm text-slate-400">Set your default maintenance intervals.</p>

            <div className="space-y-3">
              {intervalRows.map((row, index) => (
                <div key={row.serviceType} className="flex items-center justify-between gap-3">
                  <span className="flex-1 text-sm text-slate-300">{row.serviceType}</span>
                  {row.intervalMiles !== "" || DEFAULT_INTERVALS[index].intervalMiles !== null ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={row.intervalMiles}
                        onChange={(e) => updateIntervalRow(index, "intervalMiles", e.target.value)}
                        className="w-20 rounded-xl border border-slate-700 bg-slate-950 p-2 text-right text-sm text-white"
                      />
                      <span className="text-xs text-slate-400">mi</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={row.intervalMonths}
                        onChange={(e) => updateIntervalRow(index, "intervalMonths", e.target.value)}
                        className="w-20 rounded-xl border border-slate-700 bg-slate-950 p-2 text-right text-sm text-white"
                      />
                      <span className="text-xs text-slate-400">mo</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleSaveIntervals}
              disabled={intervalsSaving}
              className="mt-5 w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-60"
            >
              {intervalsSaving ? "Saving…" : "Save Intervals"}
            </button>
          </section>
        </div>

        {/* SECTION 3 - GENERAL */}
        <div className="relative mt-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-slate-500" />
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800 text-xl">
                <Settings className="h-5 w-5 text-slate-400" />
              </div>
              <h2 className="text-xl font-bold">General</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Week starts on</span>
                <select
                  value={weekStartsOn}
                  onChange={(e) => setWeekStartsOn(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  <option value="Monday">Monday</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Notifications</span>
                <button
                  onClick={() => setNotificationsEnabled((v) => !v)}
                  className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
                    notificationsEnabled ? "bg-blue-500" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                      notificationsEnabled ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            <button className="mt-5 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-bold text-white">
              Save
            </button>
          </section>
        </div>

        {/* SIGN OUT */}
        <button
          onClick={handleSignOut}
          className="mt-8 w-full rounded-2xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-300"
        >
          Sign Out
        </button>

      </div>
      <BottomNav />
    </main>
  );
}
