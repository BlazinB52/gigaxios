"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Settings } from "lucide-react";
import BottomNav from "../components/BottomNav";
import { supabase } from "@/app/lib/supabaseClient";
import {
  ServiceEntry,
  MaintenanceReminder,
  Vehicle,
  ServiceInterval,
  loadServiceEntriesFromSupabase,
  loadMaintenanceRemindersFromSupabase,
  loadVehicleFromSupabase,
  loadCurrentOdometer,
  loadServiceIntervalsFromSupabase,
  computeServiceStats,
} from "@/app/lib/garageStorage";

function getServiceIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("oil")) return "🛢️";
  if (t.includes("tire")) return "🔄";
  if (t.includes("brake")) return "🔵";
  if (t.includes("battery")) return "🔋";
  if (t.includes("registration")) return "📋";
  if (t.includes("inspection")) return "🔍";
  if (t.includes("wiper")) return "💧";
  if (t.includes("transmission")) return "⚙️";
  return "🔧";
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDueText(reminder: MaintenanceReminder, currentOdometer: number): string {
  const dueOdo = parseFloat(reminder.dueOdometer) || 0;
  if (dueOdo > 0) {
    const miles = Math.round(dueOdo - currentOdometer);
    if (miles < 0) return `${Math.abs(miles).toLocaleString()} mi overdue`;
    return `Due in ${miles.toLocaleString()} mi`;
  }
  if (reminder.dueDate) {
    return `Due ${formatDate(reminder.dueDate)}`;
  }
  return "—";
}

function getReminderUrgencyColor(reminder: MaintenanceReminder, currentOdometer: number): string {
  const dueOdo = parseFloat(reminder.dueOdometer) || 0;
  const milesRemaining = dueOdo > 0 ? dueOdo - currentOdometer : Infinity;

  let daysRemaining = Infinity;
  if (reminder.dueDate) {
    daysRemaining = Math.ceil(
      (new Date(reminder.dueDate + "T12:00:00").getTime() - Date.now()) / 86400000
    );
  }

  if (milesRemaining < 0 || daysRemaining < 0) return "text-red-400";
  if (milesRemaining <= 500 || daysRemaining <= 30) return "text-amber-400";
  return "text-blue-400";
}

function computeHealthStatus(
  intervals: ServiceInterval[],
  serviceType: string,
  currentOdometer: number
): { status: string; colorClass: string } {
  const interval = intervals.find((i) => i.serviceType === serviceType);
  if (!interval || interval.lastDoneOdometer === null || interval.intervalMiles === null) {
    return { status: "—", colorClass: "text-slate-400" };
  }

  const milesRemaining =
    interval.lastDoneOdometer + interval.intervalMiles - currentOdometer;
  const percentRemaining = milesRemaining / interval.intervalMiles;

  if (percentRemaining < 0) return { status: "Due", colorClass: "text-red-400" };
  if (percentRemaining <= 0.2) return { status: "Monitor", colorClass: "text-amber-400" };
  return { status: "Good", colorClass: "text-emerald-400" };
}

const HEALTH_INDICATORS = [
  { label: "Oil Life", serviceType: "Oil Change", icon: "🛢️" },
  { label: "Tires", serviceType: "Tires", icon: "🔄" },
  { label: "Brakes", serviceType: "Brake Inspection", icon: "🔵" },
  { label: "Battery", serviceType: "Battery Check", icon: "🔋" },
];

export default function GaragePage() {
  const router = useRouter();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [serviceEntries, setServiceEntries] = useState<ServiceEntry[]>([]);
  const [maintenanceReminders, setMaintenanceReminders] = useState<MaintenanceReminder[]>([]);
  const [serviceIntervals, setServiceIntervals] = useState<ServiceInterval[]>([]);
  const [currentOdometer, setCurrentOdometer] = useState(0);

  useEffect(() => {
    async function loadGarageData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const [services, reminders, vehicleData, odo, intervals] = await Promise.all([
        loadServiceEntriesFromSupabase(user.id),
        loadMaintenanceRemindersFromSupabase(user.id),
        loadVehicleFromSupabase(user.id),
        loadCurrentOdometer(user.id),
        loadServiceIntervalsFromSupabase(user.id),
      ]);

      setServiceEntries(services);
      setMaintenanceReminders(reminders);
      setVehicle(vehicleData);
      setCurrentOdometer(odo);
      setServiceIntervals(intervals);
    }

    loadGarageData();
  }, [router]);

  const { totalServices, totalSpent, lastServiceOdometer } = computeServiceStats(serviceEntries);

  return (
    <main className="min-h-screen bg-[#020814] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-24 pt-8">

        {/* PAGE HEADER */}
        <div className="grid grid-cols-2 items-start gap-3">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Garage</h1>
            <p className="mt-2 text-base text-slate-400">Your vehicle. Your business.</p>
          </div>
          {vehicle ? (
            <button
              onClick={() => router.push("/settings")}
              className="flex w-full items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2"
            >
              <span className="text-base leading-none">🚗</span>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-semibold leading-snug text-white">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </p>
                <p className="text-xs text-slate-400">
                  {currentOdometer.toLocaleString()} mi
                </p>
              </div>
              <Settings className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          ) : (
            <button
              onClick={() => router.push("/settings")}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-300"
            >
              ⚙️ Settings
            </button>
          )}
        </div>

        {/* SERVICE CARD */}
        <div className="relative mt-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-[#3b82f6]" />
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-blue-950/20">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-950/60 text-3xl">
                🔧
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Service</h2>
                  <button onClick={() => router.push("/garage/service")}>
                    <ChevronRight className="h-5 w-5 text-slate-500" />
                  </button>
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Track major maintenance and repairs.
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-800 pt-5">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-blue-400">{totalServices}</p>
                  <p className="text-xs text-slate-400">Total Services</p>
                </div>
                <div className="border-x border-slate-800">
                  <p className="text-lg font-bold text-blue-400">
                    $
                    {totalSpent.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-xs text-slate-400">Total Spent</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-400">
                    {lastServiceOdometer !== "--"
                      ? parseInt(lastServiceOdometer).toLocaleString()
                      : "--"}
                  </p>
                  <p className="text-xs text-slate-400">Last Service mi</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* OVERHEAD CARD */}
        <div className="relative mt-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-[#22c55e]" />
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-emerald-950/20">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-950/60 text-3xl">
                💵
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold">Overhead</h2>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                      Coming soon
                    </span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-500" />
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Recurring costs that affect your bottom line.
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-800 pt-5">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-emerald-400">—</p>
                  <p className="text-xs text-slate-400">Monthly Est.</p>
                </div>
                <div className="border-x border-slate-800">
                  <p className="text-lg font-bold text-emerald-400">—</p>
                  <p className="text-xs text-slate-400">Active Items</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-400">—</p>
                  <p className="text-xs text-slate-400">This Year</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* VEHICLE HEALTH CARD */}
        <div className="relative mt-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-[#a855f7]" />
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-purple-950/20">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-950/60 text-3xl">
                💜
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Vehicle Health</h2>
                  <ChevronRight className="h-5 w-5 text-slate-500" />
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Quick overview of your vehicle&apos;s current health.
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-800 pt-5">
              <div className="grid grid-cols-4 gap-2 text-center">
                {HEALTH_INDICATORS.map(({ label, serviceType, icon }) => {
                  const { status, colorClass } = computeHealthStatus(
                    serviceIntervals,
                    serviceType,
                    currentOdometer
                  );
                  return (
                    <div key={serviceType}>
                      <p className="text-xl">{icon}</p>
                      <p className={`mt-1 text-sm font-bold ${colorClass}`}>{status}</p>
                      <p className="text-xs text-slate-400">{label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* UPCOMING MAINTENANCE CARD */}
        <div className="relative mt-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-[#f59e0b]" />
          <section className="rounded-3xl border border-amber-900/60 bg-slate-950/80 p-5 shadow-lg shadow-amber-950/20">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-950/60 text-3xl">
                ⚠️
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Upcoming Maintenance</h2>
                  <button onClick={() => router.push("/garage/maintenance")}>
                    <ChevronRight className="h-5 w-5 text-slate-500" />
                  </button>
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Stay ahead of what&apos;s due so you can avoid problems.
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-800 pt-5">
              {maintenanceReminders.length === 0 ? (
                <p className="text-sm text-slate-500">No reminders yet.</p>
              ) : (
                maintenanceReminders.map((reminder, index) => (
                  <div
                    key={reminder.id}
                    className={`flex items-center justify-between py-4 ${
                      index > 0 ? "border-t border-slate-800" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{getServiceIcon(reminder.title)}</span>
                      <div>
                        <p className="font-bold text-white">{reminder.title}</p>
                        <p className={`text-sm ${getReminderUrgencyColor(reminder, currentOdometer)}`}>
                          {getDueText(reminder, currentOdometer)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-sm font-semibold ${getReminderUrgencyColor(
                          reminder,
                          currentOdometer
                        )}`}
                      >
                        {formatDate(reminder.dueDate)}
                      </p>
                      <ChevronRight className="h-4 w-4 text-slate-600" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

      </div>
      <BottomNav />
    </main>
  );
}
