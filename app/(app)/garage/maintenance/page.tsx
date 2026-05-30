"use client";

/* =========================================================
   GARAGE / MAINTENANCE PAGE
   ---------------------------------------------------------
   Full list of active maintenance reminders with urgency
   color coding.  Reminders are generated automatically by
   generateRemindersFromIntervals() in garageStorage when
   the user saves their service intervals in Settings.
   Each reminder can be dismissed (deleted) from here.
   ========================================================= */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Trash2 } from "lucide-react";
import BottomNav from "@/app/components/BottomNav";
import { supabase } from "@/app/lib/supabaseClient";
import {
  MaintenanceReminder,
  loadMaintenanceRemindersFromSupabase,
  loadCurrentOdometer,
  deleteMaintenanceReminderFromSupabase,
} from "@/app/lib/garageStorage";

/* =========================================================
   SERVICE ICON HELPER
   Maps a service type string to an emoji icon.
   Defaults to 🔧 for unrecognised types.
   ========================================================= */

function getServiceIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("oil"))          return "🛢️";
  if (t.includes("tire"))         return "🔄";
  if (t.includes("brake"))        return "🔵";
  if (t.includes("battery"))      return "🔋";
  if (t.includes("registration")) return "📋";
  if (t.includes("inspection"))   return "🔍";
  if (t.includes("wiper"))        return "💧";
  if (t.includes("transmission")) return "⚙️";
  return "🔧";
}

/* =========================================================
   DATE FORMATTER
   Converts an ISO date string to "Mon DD, YYYY".
   Noon time prevents timezone-offset edge cases.
   ========================================================= */

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* =========================================================
   URGENCY COLOR
   red   = overdue (miles or days past due)
   amber = within 500 mi or 30 days of due
   blue  = on track
   ========================================================= */

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
  if (milesRemaining <= 500 || daysRemaining <= 30) return "text-amber-400";
  return "text-blue-400";
}

/* =========================================================
   DUE TEXT
   Returns a human-readable due status string:
     "Due in X mi" / "X mi overdue" / "Due Mon DD, YYYY"
   ========================================================= */

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

export default function MaintenancePage() {
  const router = useRouter();

  /* =========================================================
     STATE VARIABLES
     ========================================================= */

  const [userId, setUserId] = useState<string | null>(null);
  const [maintenanceReminders, setMaintenanceReminders] = useState<MaintenanceReminder[]>([]);
  const [currentOdometer, setCurrentOdometer] = useState(0);

  /* =========================================================
     DATA LOADING
     Loads reminders and the current odometer reading in
     parallel.  Odometer is needed to compute miles remaining.
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

      setUserId(user.id);

      const [reminders, odo] = await Promise.all([
        loadMaintenanceRemindersFromSupabase(user.id),
        loadCurrentOdometer(user.id),
      ]);

      setMaintenanceReminders(reminders);
      setCurrentOdometer(odo);
    }

    load();
  }, [router]);

  /* =========================================================
     DELETE REMINDER
     Removes the reminder from Supabase, then re-fetches the
     list so the UI reflects the deletion immediately.
     ========================================================= */

  async function handleDeleteReminder(id: string) {
    await deleteMaintenanceReminderFromSupabase(id);
    if (userId) {
      const updated = await loadMaintenanceRemindersFromSupabase(userId);
      setMaintenanceReminders(updated);
    }
  }

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <main className="min-h-screen bg-[#020814] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-24 pt-8">

        {/* PAGE HEADER — back button returns to Garage */}
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

        {/* =====================================================
            REMINDER LIST
            Each row shows icon, name, due status, and a trash
            icon to dismiss the reminder.
           ===================================================== */}

        <div className="relative mt-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-amber-500" />
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">
            <p className="mb-4 text-lg font-semibold text-slate-300">Upcoming</p>

            {/* EMPTY STATE */}
            {maintenanceReminders.length === 0 ? (
              <p className="text-sm text-slate-400">No reminders yet.</p>
            ) : (

              /* REMINDER ROWS */
              maintenanceReminders.map((reminder, index) => {
                const urgencyColor = getUrgencyColor(reminder, currentOdometer);

                return (
                  <div
                    key={reminder.id}
                    className={index > 0 ? "mt-4 border-t border-slate-800 pt-4" : ""}
                  >
                    <div className="flex items-center justify-between gap-2">

                      {/* ICON + NAME + DUE TEXT */}
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{getServiceIcon(reminder.title)}</span>
                        <div>
                          <p className="font-semibold text-white">{reminder.title}</p>
                          <p className={`text-sm ${urgencyColor}`}>
                            {getDueText(reminder, currentOdometer)}
                          </p>
                        </div>
                      </div>

                      {/* DELETE BUTTON */}
                      <button
                        onClick={() => handleDeleteReminder(reminder.id)}
                        className="shrink-0 text-slate-600 active:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                    </div>
                  </div>
                );
              })
            )}
          </section>
        </div>

        {/* FOOTER NOTE */}
        <p className="mt-8 text-center text-sm text-slate-500">
          Reminders are automatically generated from your service history and interval settings.
        </p>

      </div>
      <BottomNav />
    </main>
  );
}
