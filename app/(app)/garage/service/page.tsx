"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Trash2 } from "lucide-react";
import BottomNav from "@/app/components/BottomNav";
import { supabase } from "@/app/lib/supabaseClient";
import {
  ServiceEntry,
  loadServiceEntriesFromSupabase,
  saveServiceEntryToSupabase,
  deleteServiceEntryFromSupabase,
  autoUpdateIntervalFromService,
  clearIntervalLastDone,
  generateRemindersFromIntervals,
} from "@/app/lib/garageStorage";
import {
  SubscriptionAccessState,
  loadSubscriptionAccess,
} from "@/app/lib/subscriptionAccess";

function getTodayLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getServiceIcon(serviceType: string): string {
  const t = serviceType.toLowerCase();
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

function ServicePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vehicleIdParam = searchParams.get("vehicleId") || "";

  const [userId, setUserId] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [vehicleLabel, setVehicleLabel] = useState("");
  const [serviceEntries, setServiceEntries] = useState<ServiceEntry[]>([]);
  const [vehicles, setVehicles] = useState<Array<{
    id: string; year: string; make: string; model: string; is_primary: boolean;
  }>>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [serviceDate, setServiceDate] = useState(getTodayLocal());
  const [serviceType, setServiceType] = useState("");
  const [serviceOdometer, setServiceOdometer] = useState("");
  const [serviceCost, setServiceCost] = useState("");
  const [serviceNotes, setServiceNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [accessState, setAccessState] =
    useState<SubscriptionAccessState | null>(null);
  const [startingCheckout, setStartingCheckout] = useState(false);

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

      const access = await loadSubscriptionAccess({
        userId: user.id,
        userCreatedAt: user.created_at,
      });
      setAccessState(access);

      const vid = vehicleIdParam;
      setVehicleId(vid);

      if (vid) {
        const { data: vd } = await supabase
          .from("vehicles")
          .select("year, make, model")
          .eq("id", vid)
          .single();
        if (vd) {
          setVehicleLabel(`${vd.year} ${vd.make} ${vd.model}`);
        }
      }

      const entries = await loadServiceEntriesFromSupabase(user.id, vid || undefined);
      setServiceEntries(entries);

      const { data: vehicleData } = await supabase
        .from("vehicles")
        .select("id, year, make, model, is_primary, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("is_primary", { ascending: false });

      const loadedVehicles = vehicleData || [];
      setVehicles(loadedVehicles);
      const primary = loadedVehicles.find((v) => v.is_primary) || loadedVehicles[0] || null;
      setSelectedVehicleId(vid || primary?.id || "");
    }

    load();
  }, [router, vehicleIdParam]);

  async function handleDeleteEntry(id: string) {
    if (!userId) return;

    const deletedEntry = serviceEntries.find((e) => e.id === id);
    const confirmed = window.confirm(
      `Delete this ${deletedEntry?.serviceType ?? "service"} record? This cannot be undone.`
    );
    if (!confirmed) return;

    await deleteServiceEntryFromSupabase(id);

    if (deletedEntry) {
      const entryVehicleId = deletedEntry.vehicleId || selectedVehicleId;

      let remainingQuery = supabase
        .from("service_entries")
        .select("date, odometer")
        .eq("user_id", userId)
        .eq("service_type", deletedEntry.serviceType)
        .order("date", { ascending: false })
        .limit(1);

      if (entryVehicleId) {
        remainingQuery = remainingQuery.eq("vehicle_id", entryVehicleId);
      }

      const { data: remaining } = await remainingQuery;

      if (remaining && remaining.length > 0) {
        if (entryVehicleId) {
          await autoUpdateIntervalFromService(
            userId,
            deletedEntry.serviceType,
            parseFloat(remaining[0].odometer) || 0,
            remaining[0].date,
            entryVehicleId
          );
        }
      } else {
        await clearIntervalLastDone(userId, deletedEntry.serviceType, entryVehicleId);
        if (entryVehicleId) {
          await generateRemindersFromIntervals(userId, entryVehicleId);
        }
      }
    }

    const updated = await loadServiceEntriesFromSupabase(userId, vehicleId || undefined);
    setServiceEntries(updated);
  }

  async function handleSaveService() {
    if (trialRequired) return;
    if (!serviceType || !userId) return;
    setSaving(true);

    const entry: ServiceEntry = {
      id: crypto.randomUUID(),
      userId,
      vehicleId: selectedVehicleId || undefined,
      date: serviceDate,
      odometer: serviceOdometer,
      serviceType,
      cost: serviceCost,
      notes: serviceNotes,
    };

    await saveServiceEntryToSupabase(entry);

    if (serviceType !== "Other" && serviceOdometer && selectedVehicleId) {
      await autoUpdateIntervalFromService(
        userId,
        serviceType,
        parseFloat(serviceOdometer),
        serviceDate,
        selectedVehicleId
      );
    }

    const updated = await loadServiceEntriesFromSupabase(userId, vehicleId || undefined);
    setServiceEntries(updated);

    setServiceDate(getTodayLocal());
    setServiceType("");
    setServiceOdometer("");
    setServiceCost("");
    setServiceNotes("");
    setShowForm(false);
    setSaving(false);
  }

  async function handleStartTrial() {
    setStartingCheckout(true);
    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok || !data.url) {
        alert(data.error || "Could not start checkout. Please try again.");
        return;
      }

      window.location.href = data.url;
    } catch {
      alert("Could not start checkout. Please try again.");
    } finally {
      setStartingCheckout(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white";
  const trialRequired = accessState?.trialRequired ?? false;

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
            <h1 className="text-4xl font-bold tracking-tight">Service</h1>
            <p className="mt-1 text-sm text-slate-400">Your maintenance history.</p>
          </div>
        </div>

        {vehicleLabel && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3">
            <span className="text-xl">🚗</span>
            <div>
              <p className="text-sm font-semibold text-white">{vehicleLabel}</p>
              <p className="text-xs text-slate-400">Showing service history for this vehicle</p>
            </div>
          </div>
        )}

        {trialRequired && (
          <section className="mt-5 rounded-3xl border border-blue-500/30 bg-blue-950/30 p-5">
            <h2 className="text-lg font-bold">Start your free trial to continue</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Your free GigAxios preview has ended.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Start your 7-day free trial to continue adding service records.
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

        {/* ADD SERVICE FORM */}
        <div className="relative mt-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-blue-500" />
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">
            <button
              onClick={() => {
                if (trialRequired) return;
                setShowForm((v) => !v);
              }}
              disabled={trialRequired}
              className="flex w-full items-center justify-between disabled:cursor-not-allowed"
            >
              <p className="text-lg font-semibold text-white">Add Service</p>
              <span className="text-2xl font-light text-blue-400">{trialRequired ? "" : showForm ? "−" : "+"}</span>
            </button>

            {showForm && (
              <div className="mt-5 space-y-3">
                {vehicles.length > 1 && (
                  <div>
                    <label className="text-sm text-slate-400">Vehicle</label>
                    <select
                      value={selectedVehicleId}
                      onChange={(e) => setSelectedVehicleId(e.target.value)}
                      className={`mt-1 ${inputClass}`}
                    >
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.year} {v.make} {v.model}{v.is_primary ? " (Primary)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className={`${inputClass} [color-scheme:dark]`}
                />

                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
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

                <input
                  type="number"
                  placeholder="Odometer at time of service"
                  value={serviceOdometer}
                  onChange={(e) => setServiceOdometer(e.target.value)}
                  className={inputClass}
                />

                <input
                  type="number"
                  placeholder="Cost ($)"
                  value={serviceCost}
                  onChange={(e) => setServiceCost(e.target.value)}
                  className={inputClass}
                />

                <textarea
                  placeholder="Notes (optional)"
                  value={serviceNotes}
                  onChange={(e) => setServiceNotes(e.target.value)}
                  className={`${inputClass} min-h-20`}
                />

                <button
                  onClick={handleSaveService}
                  disabled={saving || !serviceType || trialRequired}
                  className="w-full rounded-2xl bg-blue-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : trialRequired ? "Start Trial to Save Service" : "Save Service"}
                </button>
                <button
                  onClick={() => {
                    setServiceDate(getTodayLocal());
                    setServiceType("");
                    setServiceOdometer("");
                    setServiceCost("");
                    setServiceNotes("");
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

        {/* SERVICE HISTORY */}
        <div className="relative mt-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-blue-500" />
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">
            <p className="mb-4 text-lg font-semibold text-slate-300">History</p>

            {serviceEntries.length === 0 ? (
              <p className="text-sm text-slate-400">No service history yet.</p>
            ) : (
              serviceEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  className={index > 0 ? "mt-4 border-t border-slate-800 pt-4" : ""}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-xl leading-none">
                        {getServiceIcon(entry.serviceType)}
                      </span>
                      <div>
                        <p className="font-semibold text-white">{entry.serviceType}</p>
                        <p className="text-sm text-slate-400">{formatDate(entry.date)}</p>
                        {entry.odometer && (
                          <p className="text-xs text-slate-500">
                            {parseInt(entry.odometer).toLocaleString()} mi
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        {entry.cost && (
                          <p className="text-sm font-semibold text-emerald-400">
                            ${parseFloat(entry.cost).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="text-slate-600 active:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        </div>

      </div>
      <BottomNav />
    </main>
  );
}

export default function ServicePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#020814] flex items-center justify-center">
        <p className="text-slate-400">Loading...</p>
      </main>
    }>
      <ServicePageInner />
    </Suspense>
  );
}
