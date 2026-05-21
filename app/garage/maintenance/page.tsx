"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Trash2 } from "lucide-react";
import BottomNav from "../../components/BottomNav";
import { supabase } from "@/app/lib/supabaseClient";
import {
  MaintenanceReminder,
  ServiceInterval,
  loadMaintenanceRemindersFromSupabase,
  loadServiceIntervalsFromSupabase,
  loadCurrentOdometer,
  saveMaintenanceReminderToSupabase,
  deleteMaintenanceReminderFromSupabase,
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
  if (!dateStr) return "";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getUrgencyColor(reminder: MaintenanceReminder, currentOdometer: number): string {
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

function calcDueOdometer(lastDone: string, interval: string): string {
  const last = Number(lastDone) || 0;
  const int = Number(interval) || 0;
  if (last > 0 && int > 0) return String(last + int);
  return "";
}

export default function MaintenancePage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [maintenanceReminders, setMaintenanceReminders] = useState<MaintenanceReminder[]>([]);
  const [serviceIntervals, setServiceIntervals] = useState<ServiceInterval[]>([]);
  const [currentOdometer, setCurrentOdometer] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderLastOdometer, setReminderLastOdometer] = useState("");
  const [reminderIntervalMiles, setReminderIntervalMiles] = useState("");
  const [reminderDueOdometer, setReminderDueOdometer] = useState("");
  const [reminderDueDate, setReminderDueDate] = useState("");
  const [reminderNotes, setReminderNotes] = useState("");
  const [saving, setSaving] = useState(false);

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

      const [reminders, intervals, odo] = await Promise.all([
        loadMaintenanceRemindersFromSupabase(user.id),
        loadServiceIntervalsFromSupabase(user.id),
        loadCurrentOdometer(user.id),
      ]);

      setMaintenanceReminders(reminders);
      setServiceIntervals(intervals);
      setCurrentOdometer(odo);
    }

    load();
  }, [router]);

  function handleReminderTypeSelect(type: string) {
    setReminderTitle(type);
    const match = getIntervalForServiceType(serviceIntervals, type);
    const newInterval = match?.intervalMiles ? String(match.intervalMiles) : reminderIntervalMiles;
    if (match?.intervalMiles) {
      setReminderIntervalMiles(newInterval);
    }
    setReminderDueOdometer(calcDueOdometer(reminderLastOdometer, newInterval));
  }

  function handleLastOdometerChange(val: string) {
    setReminderLastOdometer(val);
    setReminderDueOdometer(calcDueOdometer(val, reminderIntervalMiles));
  }

  function handleIntervalMilesChange(val: string) {
    setReminderIntervalMiles(val);
    setReminderDueOdometer(calcDueOdometer(reminderLastOdometer, val));
  }

  async function handleSaveReminder() {
    if (!reminderTitle) return;
    if (!userId) return;

    setSaving(true);

    const dueOdo = Number(reminderLastOdometer || 0) + Number(reminderIntervalMiles || 0);

    const reminder: MaintenanceReminder = {
      id: crypto.randomUUID(),
      userId,
      title: reminderTitle,
      lastDoneOdometer: reminderLastOdometer,
      intervalMiles: reminderIntervalMiles,
      dueOdometer: dueOdo > 0 ? String(dueOdo) : "",
      dueDate: reminderDueDate,
      notes: reminderNotes,
    };

    await saveMaintenanceReminderToSupabase(reminder);
    const updated = await loadMaintenanceRemindersFromSupabase(userId);
    setMaintenanceReminders(updated);

    setReminderTitle("");
    setReminderLastOdometer("");
    setReminderIntervalMiles("");
    setReminderDueOdometer("");
    setReminderDueDate("");
    setReminderNotes("");
    setShowForm(false);
    setSaving(false);
  }

  async function handleDeleteReminder(id: string) {
    await deleteMaintenanceReminderFromSupabase(id);
    if (userId) {
      const updated = await loadMaintenanceRemindersFromSupabase(userId);
      setMaintenanceReminders(updated);
    }
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
            <h1 className="text-4xl font-bold tracking-tight">Maintenance</h1>
            <p className="mt-1 text-sm text-slate-400">Stay ahead of what&apos;s due.</p>
          </div>
        </div>

        {/* REMINDER LIST */}
        <div className="relative mt-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-amber-500" />
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">
            <p className="mb-4 text-lg font-semibold text-slate-300">Upcoming</p>

            {maintenanceReminders.length === 0 ? (
              <p className="text-sm text-slate-400">No reminders yet.</p>
            ) : (
              maintenanceReminders.map((reminder, index) => {
                const urgencyColor = getUrgencyColor(reminder, currentOdometer);
                const dueOdo = parseFloat(reminder.dueOdometer) || 0;
                const milesLeft = dueOdo > 0 ? Math.round(dueOdo - currentOdometer) : null;
                const isOverdue = milesLeft !== null && milesLeft < 0;

                return (
                  <div
                    key={reminder.id}
                    className={index > 0 ? "mt-4 border-t border-slate-800 pt-4" : ""}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 text-xl leading-none">
                          {getServiceIcon(reminder.title)}
                        </span>
                        <div>
                          <p className="font-semibold text-white">{reminder.title}</p>
                          <p className={`text-sm ${isOverdue ? "text-red-400" : "text-slate-400"}`}>
                            {getDueText(reminder, currentOdometer)}
                          </p>
                          {reminder.dueDate && (
                            <p className="text-xs text-slate-500">{formatDate(reminder.dueDate)}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <p className={`text-sm font-semibold ${urgencyColor}`}>
                          {reminder.dueDate ? formatDate(reminder.dueDate) : ""}
                        </p>
                        <button
                          onClick={() => handleDeleteReminder(reminder.id)}
                          className="text-slate-600 active:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </div>

        {/* ADD REMINDER FORM */}
        <div className="relative mt-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-blue-500" />
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex w-full items-center justify-between"
            >
              <p className="text-lg font-semibold text-white">Add Reminder</p>
              <span className="text-2xl font-light text-blue-400">{showForm ? "−" : "+"}</span>
            </button>

            {showForm && (
              <div className="mt-5 space-y-3">
                {/* Service Type */}
                <select
                  value={reminderTitle}
                  onChange={(e) => handleReminderTypeSelect(e.target.value)}
                  className={inputClass}
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

                {/* Last Done Odometer */}
                <div>
                  <input
                    type="number"
                    placeholder="Odometer when last done"
                    value={reminderLastOdometer}
                    onChange={(e) => handleLastOdometerChange(e.target.value)}
                    className={inputClass}
                  />
                  {reminderDueOdometer && (
                    <p className="mt-1 px-1 text-sm text-blue-400">
                      Due at {Number(reminderDueOdometer).toLocaleString()} mi
                    </p>
                  )}
                </div>

                {/* Interval Miles */}
                <div>
                  <input
                    type="number"
                    placeholder="Miles between services"
                    value={reminderIntervalMiles}
                    onChange={(e) => handleIntervalMilesChange(e.target.value)}
                    className={inputClass}
                  />
                  <p className="mt-1 px-1 text-xs text-slate-500">
                    e.g. 5,000 for every 5,000 miles
                  </p>
                </div>

                {/* Due Date */}
                <div>
                  <label className="mb-1 block px-1 text-xs text-slate-400">
                    Due Date (optional)
                  </label>
                  <input
                    type="date"
                    value={reminderDueDate}
                    onChange={(e) => setReminderDueDate(e.target.value)}
                    className={`${inputClass} [color-scheme:dark]`}
                  />
                </div>

                {/* Notes */}
                <textarea
                  placeholder="Notes (optional)"
                  value={reminderNotes}
                  onChange={(e) => setReminderNotes(e.target.value)}
                  className={`${inputClass} min-h-20`}
                />

                {/* Buttons */}
                <button
                  onClick={handleSaveReminder}
                  disabled={saving || !reminderTitle}
                  className="w-full rounded-2xl bg-blue-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Reminder"}
                </button>
                <button
                  onClick={() => {
                    setReminderTitle("");
                    setReminderLastOdometer("");
                    setReminderIntervalMiles("");
                    setReminderDueOdometer("");
                    setReminderDueDate("");
                    setReminderNotes("");
                    setShowForm(false);
                  }}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-300"
                >
                  Cancel
                </button>
              </div>
            )}
          </section>
        </div>

      </div>
      <BottomNav />
    </main>
  );
}
