"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  saveServiceEntryToSupabase,
  saveMaintenanceReminderToSupabase,
  computeServiceStats,
  getIntervalForServiceType,
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
  if (dueOdo > 0 && currentOdometer > 0) {
    const miles = Math.round(dueOdo - currentOdometer);
    if (miles < 0) return `${Math.abs(miles).toLocaleString()} mi overdue`;
    return `Due in ${miles.toLocaleString()} mi`;
  }
  if (reminder.dueDate) {
    const days = Math.ceil(
      (new Date(reminder.dueDate + "T12:00:00").getTime() - Date.now()) / 86400000
    );
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return "Due today";
    return `Due in ${days} day${days !== 1 ? "s" : ""}`;
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
  if (milesRemaining <= 500 || daysRemaining <= 14) return "text-amber-400";
  return "text-blue-400";
}

function computeHealthStatus(
  reminders: MaintenanceReminder[],
  keyword: string,
  currentOdometer: number
): { status: string; colorClass: string } {
  const reminder = reminders.find((r) => r.title.toLowerCase().includes(keyword));
  if (!reminder) return { status: "—", colorClass: "text-slate-400" };

  const dueOdo = parseFloat(reminder.dueOdometer) || 0;
  const interval = parseFloat(reminder.intervalMiles) || 1;
  const milesRemaining = dueOdo - currentOdometer;

  if (milesRemaining < 0) return { status: "Due", colorClass: "text-red-400" };
  if (milesRemaining <= interval * 0.2) return { status: "Monitor", colorClass: "text-amber-400" };
  return { status: "Good", colorClass: "text-emerald-400" };
}

const HEALTH_INDICATORS = [
  { label: "Oil Life", keyword: "oil", icon: "🛢️" },
  { label: "Tires", keyword: "tire", icon: "🔄" },
  { label: "Brakes", keyword: "brake", icon: "🔵" },
  { label: "Battery", keyword: "battery", icon: "🔋" },
];

export default function GaragePage() {
  const router = useRouter();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [serviceEntries, setServiceEntries] = useState<ServiceEntry[]>([]);
  const [maintenanceReminders, setMaintenanceReminders] = useState<MaintenanceReminder[]>([]);
  const [currentOdometer, setCurrentOdometer] = useState(0);
  const [serviceIntervals, setServiceIntervals] = useState<ServiceInterval[]>([]);

  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [serviceOdometer, setServiceOdometer] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [serviceCost, setServiceCost] = useState("");
  const [serviceNotes, setServiceNotes] = useState("");

  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderLastOdometer, setReminderLastOdometer] = useState("");
  const [reminderIntervalMiles, setReminderIntervalMiles] = useState("");
  const [reminderDueDate, setReminderDueDate] = useState("");
  const [reminderNotes, setReminderNotes] = useState("");

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

  function handleReminderTypeSelect(type: string) {
    setReminderTitle(type);
    const match = getIntervalForServiceType(serviceIntervals, type);
    if (match?.intervalMiles) {
      setReminderIntervalMiles(String(match.intervalMiles));
    }
  }

  async function handleSaveService() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const newService: ServiceEntry = {
      id: crypto.randomUUID(),
      userId: user.id,
      date: serviceDate,
      odometer: serviceOdometer,
      serviceType,
      cost: serviceCost,
      notes: serviceNotes,
    };

    await saveServiceEntryToSupabase(newService);
    const updatedServices = await loadServiceEntriesFromSupabase(user.id);
    setServiceEntries(updatedServices);

    setServiceDate(new Date().toISOString().split("T")[0]);
    setServiceOdometer("");
    setServiceType("");
    setServiceCost("");
    setServiceNotes("");
    setShowServiceForm(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSaveReminder() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const newReminder: MaintenanceReminder = {
      id: crypto.randomUUID(),
      userId: user.id,
      title: reminderTitle,
      lastDoneOdometer: reminderLastOdometer,
      intervalMiles: reminderIntervalMiles,
      dueOdometer: String(
        Number(reminderLastOdometer || 0) + Number(reminderIntervalMiles || 0)
      ),
      dueDate: reminderDueDate,
      notes: reminderNotes,
    };

    await saveMaintenanceReminderToSupabase(newReminder);
    const updatedReminders = await loadMaintenanceRemindersFromSupabase(user.id);
    setMaintenanceReminders(updatedReminders);

    setReminderTitle("");
    setReminderLastOdometer("");
    setReminderIntervalMiles("");
    setReminderDueDate("");
    setReminderNotes("");
    setShowReminderForm(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const { totalServices, totalSpent, lastServiceOdometer } = computeServiceStats(serviceEntries);

  return (
    <main className="min-h-screen bg-[#020814] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-24 pt-8">

        {/* PAGE HEADER */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Garage</h1>
            <p className="mt-2 text-base text-slate-400">Your vehicle. Your business.</p>
          </div>
          {vehicle ? (
            <button
              onClick={() => router.push("/settings")}
              className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-base">
                🚗
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </p>
                <p className="text-xs text-slate-400">
                  {currentOdometer.toLocaleString()} mi
                </p>
              </div>
              <Settings className="h-4 w-4 text-slate-400" />
            </button>
          ) : (
            <button
              onClick={() => router.push("/settings")}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-300"
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
                  <Link href="/garage/service">
                    <ChevronRight className="h-5 w-5 text-slate-500" />
                  </Link>
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

            <button
              onClick={() => setShowServiceForm(!showServiceForm)}
              className="mt-5 w-full rounded-2xl bg-blue-500 px-4 py-3 text-sm font-bold text-white"
            >
              + Add Service
            </button>

            {showServiceForm && (
              <div className="mt-5 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white [color-scheme:dark]"
                />
                <input
                  type="number"
                  placeholder="Odometer"
                  value={serviceOdometer}
                  onChange={(e) => setServiceOdometer(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                />
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                >
                  <option value="">Select service type</option>
                  <option value="Oil Change">Oil Change</option>
                  <option value="Tire Rotation">Tire Rotation</option>
                  <option value="Brake Job">Brake Job</option>
                  <option value="Tires">Tires</option>
                  <option value="Battery">Battery</option>
                  <option value="Wipers">Wipers</option>
                  <option value="Repair">Repair</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  type="number"
                  placeholder="Cost"
                  value={serviceCost}
                  onChange={(e) => setServiceCost(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                />
                <textarea
                  placeholder="Notes"
                  value={serviceNotes}
                  onChange={(e) => setServiceNotes(e.target.value)}
                  className="min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                />
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleSaveService}
                    className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setServiceDate(new Date().toISOString().split("T")[0]);
                      setServiceOdometer("");
                      setServiceType("");
                      setServiceCost("");
                      setServiceNotes("");
                      setShowServiceForm(false);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
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
                  <Link href="/garage/overhead">
                    <ChevronRight className="h-5 w-5 text-slate-500" />
                  </Link>
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
                  <Link href="/garage/health">
                    <ChevronRight className="h-5 w-5 text-slate-500" />
                  </Link>
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Quick overview of your vehicle&apos;s current health.
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-800 pt-5">
              <div className="grid grid-cols-4 gap-2 text-center">
                {HEALTH_INDICATORS.map(({ label, keyword, icon }) => {
                  const { status, colorClass } = computeHealthStatus(
                    maintenanceReminders,
                    keyword,
                    currentOdometer
                  );
                  return (
                    <div key={keyword}>
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
                  <Link href="/garage/maintenance">
                    <ChevronRight className="h-5 w-5 text-slate-500" />
                  </Link>
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
                        <p className="text-sm text-slate-400">
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

            <button
              onClick={() => setShowReminderForm(!showReminderForm)}
              className="mt-5 w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950"
            >
              + Add Reminder
            </button>

            {showReminderForm && (
              <div className="mt-5 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <select
                  value={reminderTitle}
                  onChange={(e) => handleReminderTypeSelect(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                >
                  <option value="">Select service type</option>
                  <option value="Oil Change">Oil Change</option>
                  <option value="Tire Rotation">Tire Rotation</option>
                  <option value="Brake Inspection">Brake Inspection</option>
                  <option value="Transmission Service">Transmission Service</option>
                  <option value="Battery Check">Battery Check</option>
                  <option value="Tires">Tires</option>
                  <option value="Wipers">Wipers</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Registration Renewal">Registration Renewal</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  type="number"
                  placeholder="Last Done Odometer"
                  value={reminderLastOdometer}
                  onChange={(e) => setReminderLastOdometer(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                />
                <div>
                  <input
                    type="number"
                    placeholder="Interval Miles"
                    value={reminderIntervalMiles}
                    onChange={(e) => setReminderIntervalMiles(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                  />
                  <p className="mt-1 px-1 text-xs text-slate-500">
                    e.g. 5000 for every 5,000 miles
                  </p>
                </div>
                <input
                  type="date"
                  value={reminderDueDate}
                  onChange={(e) => setReminderDueDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white [color-scheme:dark]"
                />
                <textarea
                  placeholder="Notes (optional)"
                  value={reminderNotes}
                  onChange={(e) => setReminderNotes(e.target.value)}
                  className="min-h-20 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                />
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleSaveReminder}
                    className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setReminderTitle("");
                      setReminderLastOdometer("");
                      setReminderIntervalMiles("");
                      setReminderDueDate("");
                      setReminderNotes("");
                      setShowReminderForm(false);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

      </div>
      <BottomNav />
    </main>
  );
}
