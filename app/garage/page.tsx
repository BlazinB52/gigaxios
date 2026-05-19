"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";
import { supabase } from "@/app/lib/supabaseClient";
import {
  ServiceEntry,
  MaintenanceReminder,
  loadServiceEntriesFromSupabase,
  loadMaintenanceRemindersFromSupabase,
  saveServiceEntryToSupabase,
} from "@/app/lib/garageStorage";

export default function GaragePage() {
  const router = useRouter();

  const [serviceEntries, setServiceEntries] = useState<ServiceEntry[]>([]);
  const [maintenanceReminders, setMaintenanceReminders] =
    useState<MaintenanceReminder[]>([]);

  const [showServiceForm, setShowServiceForm] = useState(false);

  const [serviceDate, setServiceDate] = useState("");
  const [serviceOdometer, setServiceOdometer] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [serviceCost, setServiceCost] = useState("");
  const [serviceNotes, setServiceNotes] = useState("");


  useEffect(() => {
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

      setServiceDate("");
      setServiceOdometer("");
      setServiceType("");
      setServiceCost("");
      setServiceNotes("");

      setShowServiceForm(false);
    }
    async function loadGarageData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const services = await loadServiceEntriesFromSupabase(user.id);

      const reminders =
        await loadMaintenanceRemindersFromSupabase(user.id);

      setServiceEntries(services);
      setMaintenanceReminders(reminders);
    }

    loadGarageData();
  }, [router]);

  return (
    <main className="min-h-screen bg-[#020814] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-24 pt-8">
        <h1 className="text-4xl font-bold tracking-tight">Garage</h1>

        <p className="mt-2 text-base text-slate-400">
          Your vehicle. Your business.
        </p>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-blue-950/20">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-3xl">
              🔧
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-bold">Service</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Track major maintenance and repairs you&apos;ve already completed.
              </p>
            </div>
          </div>

          <div className="mt-5 border-t border-slate-800 pt-5">
            <p className="text-sm text-slate-400">Last Major Service</p>
            <p className="mt-1 text-xl font-bold text-white">
              {serviceEntries[0]?.serviceType || "No services yet"}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-blue-400">
                  ${serviceEntries[0]?.cost || "0"}
                </p>
                <p className="text-xs text-slate-400">Cost</p>
              </div>

              <div className="border-x border-slate-800">
                <p className="text-lg font-bold text-blue-400">
                  {serviceEntries[0]?.odometer || "--"}
                </p>
                <p className="text-xs text-slate-400">Miles</p>
              </div>

              <div>
                <p className="text-lg font-bold text-blue-400">
                  {serviceEntries.length}
                </p>
                <p className="text-xs text-slate-400">Recent</p>
              </div>
            </div>
          </div>

          <button className="mt-5 w-full rounded-2xl bg-blue-500 px-4 py-3 text-sm font-bold text-white">
            + Add Service
          </button>
        </section>

        <section className="mt-6 rounded-3xl border border-amber-900/60 bg-slate-950/80 p-5 shadow-lg shadow-amber-950/20">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-950/60 text-3xl">
              ⚠️
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-bold">Upcoming Maintenance</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Stay ahead of what&apos;s due so you can avoid problems.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4 border-t border-slate-800 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-white">
                  {maintenanceReminders[0]?.title || "No reminders"}
                </p>
                <p className="text-sm text-slate-400">
                  Due at {maintenanceReminders[0]?.dueOdometer || "--"} mi
                </p>
              </div>
              <p className="text-sm font-semibold text-amber-300">
                {maintenanceReminders[0]?.dueDate || "--"}
              </p>
            </div>

            {maintenanceReminders[1] && (
              <div className="border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white">
                      {maintenanceReminders[1].title}
                    </p>
                    <p className="text-sm text-slate-400">
                      Due at {maintenanceReminders[1].dueOdometer || "--"} mi
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-amber-300">
                    {maintenanceReminders[1].dueDate || "--"}
                  </p>
                </div>
              </div>
            )}
          </div>
          <button className="mt-5 w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950">
            + Add Reminder
          </button>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}