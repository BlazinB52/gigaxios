"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Wrench } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";
import {
  Vehicle,
  ServiceInterval,
  loadVehiclesFromSupabase,
  loadServiceIntervalsFromSupabase,
  saveServiceIntervalsToSupabase,
  generateRemindersFromIntervals,
} from "@/app/lib/garageStorage";
import {
  SubscriptionAccessState,
  loadSubscriptionAccess,
} from "@/app/lib/subscriptionAccess";

const DEFAULT_INTERVALS: Array<{
  serviceType: string;
  intervalMiles: number | null;
  intervalMonths: number | null;
}> = [
  { serviceType: "Oil Change",            intervalMiles: 5000,  intervalMonths: null },
  { serviceType: "Tire Rotation",         intervalMiles: 5000,  intervalMonths: null },
  { serviceType: "Brake Inspection",      intervalMiles: 20000, intervalMonths: null },
  { serviceType: "Transmission Service",  intervalMiles: 40000, intervalMonths: null },
  { serviceType: "Battery Check",         intervalMiles: 50000, intervalMonths: null },
  { serviceType: "Tires",                 intervalMiles: 50000, intervalMonths: null },
  { serviceType: "Wipers",               intervalMiles: null,  intervalMonths: 6  },
  { serviceType: "Inspection",           intervalMiles: null,  intervalMonths: 12 },
  { serviceType: "Registration Renewal", intervalMiles: null,  intervalMonths: 12 },
];

type IntervalRow = {
  serviceType: string;
  intervalMiles: string;
  intervalMonths: string;
  lastDoneOdometer: string;
  lastDoneDate: string;
};

export default function IntervalsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [intervalRows, setIntervalRows] = useState<IntervalRow[]>(
    DEFAULT_INTERVALS.map((d) => ({
      serviceType: d.serviceType,
      intervalMiles: d.intervalMiles !== null ? String(d.intervalMiles) : "",
      intervalMonths: d.intervalMonths !== null ? String(d.intervalMonths) : "",
      lastDoneOdometer: "",
      lastDoneDate: "",
    }))
  );
  const [intervalsSaving, setIntervalsSaving] = useState(false);
  const [intervalsSaved, setIntervalsSaved] = useState(false);
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

      const loadedVehicles = await loadVehiclesFromSupabase(user.id);
      setVehicles(loadedVehicles);
      const primary = loadedVehicles.find((v) => v.isPrimary) || loadedVehicles[0] || null;
      const primaryId = primary?.id || "";
      setSelectedVehicleId(primaryId);

      if (!primaryId) return;

      const intervals = await loadServiceIntervalsFromSupabase(user.id, primaryId);

      if (intervals.length > 0) {
        setIntervalRows(
          DEFAULT_INTERVALS.map((d) => {
            const saved = intervals.find((i) => i.serviceType === d.serviceType);
            return {
              serviceType: d.serviceType,
              intervalMiles:
                saved?.intervalMiles !== null && saved?.intervalMiles !== undefined
                  ? String(saved.intervalMiles)
                  : d.intervalMiles !== null ? String(d.intervalMiles) : "",
              intervalMonths:
                saved?.intervalMonths !== null && saved?.intervalMonths !== undefined
                  ? String(saved.intervalMonths)
                  : d.intervalMonths !== null ? String(d.intervalMonths) : "",
              lastDoneOdometer:
                saved?.lastDoneOdometer !== null && saved?.lastDoneOdometer !== undefined
                  ? String(saved.lastDoneOdometer)
                  : "",
              lastDoneDate: saved?.lastDoneDate ?? "",
            };
          })
        );
      }
    }

    load();
  }, [router]);

  async function handleSaveIntervals() {
    if (trialRequired) return;
    if (!userId || !selectedVehicleId) return;
    setIntervalsSaving(true);
    setIntervalsSaved(false);

    const intervals: ServiceInterval[] = intervalRows.map((row) => ({
      id: crypto.randomUUID(),
      userId,
      vehicleId: selectedVehicleId,
      serviceType: row.serviceType,
      intervalMiles: row.intervalMiles !== "" ? Number(row.intervalMiles) : null,
      intervalMonths: row.intervalMonths !== "" ? Number(row.intervalMonths) : null,
      lastDoneOdometer: row.lastDoneOdometer !== "" ? Number(row.lastDoneOdometer) : null,
      lastDoneDate: row.lastDoneDate !== "" ? row.lastDoneDate : null,
    }));

    await saveServiceIntervalsToSupabase(userId, selectedVehicleId, intervals);
    await generateRemindersFromIntervals(userId, selectedVehicleId);

    setIntervalsSaving(false);
    setIntervalsSaved(true);
    setTimeout(() => setIntervalsSaved(false), 3000);
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

  async function handleVehicleChange(vehicleId: string) {
    setSelectedVehicleId(vehicleId);
    if (!userId) return;

    const vehicleIntervals = await loadServiceIntervalsFromSupabase(userId, vehicleId);

    if (vehicleIntervals.length > 0) {
      setIntervalRows(
        DEFAULT_INTERVALS.map((d) => {
          const saved = vehicleIntervals.find((i) => i.serviceType === d.serviceType);
          return {
            serviceType: d.serviceType,
            intervalMiles:
              saved?.intervalMiles !== null && saved?.intervalMiles !== undefined
                ? String(saved.intervalMiles)
                : d.intervalMiles !== null ? String(d.intervalMiles) : "",
            intervalMonths:
              saved?.intervalMonths !== null && saved?.intervalMonths !== undefined
                ? String(saved.intervalMonths)
                : d.intervalMonths !== null ? String(d.intervalMonths) : "",
            lastDoneOdometer:
              saved?.lastDoneOdometer !== null && saved?.lastDoneOdometer !== undefined
                ? String(saved.lastDoneOdometer)
                : "",
            lastDoneDate: saved?.lastDoneDate ?? "",
          };
        })
      );
    } else {
      // No intervals saved for this vehicle yet — seed interval values from primary vehicle
      const primaryVehicle = vehicles.find((v) => v.isPrimary) || vehicles[0] || null;
      if (primaryVehicle && primaryVehicle.id !== vehicleId) {
        const primaryIntervals = await loadServiceIntervalsFromSupabase(userId, primaryVehicle.id);
        setIntervalRows(
          DEFAULT_INTERVALS.map((d) => {
            const saved = primaryIntervals.find((i) => i.serviceType === d.serviceType);
            return {
              serviceType: d.serviceType,
              intervalMiles:
                saved?.intervalMiles !== null && saved?.intervalMiles !== undefined
                  ? String(saved.intervalMiles)
                  : d.intervalMiles !== null ? String(d.intervalMiles) : "",
              intervalMonths:
                saved?.intervalMonths !== null && saved?.intervalMonths !== undefined
                  ? String(saved.intervalMonths)
                  : d.intervalMonths !== null ? String(d.intervalMonths) : "",
              lastDoneOdometer: "",
              lastDoneDate: "",
            };
          })
        );
      } else {
        setIntervalRows(
          DEFAULT_INTERVALS.map((d) => ({
            serviceType: d.serviceType,
            intervalMiles: d.intervalMiles !== null ? String(d.intervalMiles) : "",
            intervalMonths: d.intervalMonths !== null ? String(d.intervalMonths) : "",
            lastDoneOdometer: "",
            lastDoneDate: "",
          }))
        );
      }
    }
  }

  function updateIntervalRow(
    index: number,
    field: keyof Omit<IntervalRow, "serviceType">,
    value: string
  ) {
    setIntervalRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  const smallInputClass = "rounded-xl border border-slate-700 bg-slate-950 p-2 text-sm text-white";
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
            <h1 className="text-4xl font-bold tracking-tight">Service Intervals</h1>
            <p className="mt-1 text-sm text-slate-400">Set your default maintenance intervals.</p>
          </div>
        </div>

        {trialRequired && (
          <section className="mt-5 rounded-3xl border border-blue-500/30 bg-blue-950/30 p-5">
            <h2 className="text-lg font-bold">Start your free trial to continue</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Your free GigAxios preview has ended.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Start your 7-day free trial to continue saving service intervals.
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

        {/* VEHICLE TOGGLE — only shown when user has 2+ active vehicles */}
        {vehicles.length > 1 && (
          <div className="mt-4 flex gap-2">
            {vehicles.map((v) => (
              <button
                key={v.id}
                onClick={() => handleVehicleChange(v.id)}
                className={`flex-1 rounded-2xl border px-3 py-2 text-sm font-semibold transition-colors ${
                  selectedVehicleId === v.id
                    ? "border-blue-500 bg-blue-950/40 text-blue-400"
                    : "border-slate-700 bg-slate-900/40 text-slate-400"
                }`}
              >
                {v.year} {v.make} {v.model}{v.isPrimary ? " ★" : ""}
              </button>
            ))}
          </div>
        )}

        {/* INTERVALS CARD */}
        <div className="relative mt-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-amber-500" />
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-950/60">
                <Wrench className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-bold">Intervals</h2>
            </div>

            <div>
              {intervalRows.map((row, index) => {
                const isMileageBased = DEFAULT_INTERVALS[index].intervalMiles !== null;
                return (
                  <div
                    key={row.serviceType}
                    className={index > 0 ? "mt-4 border-t border-slate-800 pt-4" : ""}
                  >
                    <p className="mb-2 text-sm font-semibold text-white">{row.serviceType}</p>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">Interval</span>
                      <div className="flex items-center gap-1">
                        {isMileageBased ? (
                          <>
                            <input
                              type="number"
                              value={row.intervalMiles}
                              onChange={(e) => updateIntervalRow(index, "intervalMiles", e.target.value)}
                              className={`w-24 text-right ${smallInputClass}`}
                            />
                            <span className="text-xs text-slate-400">mi</span>
                          </>
                        ) : (
                          <>
                            <input
                              type="number"
                              value={row.intervalMonths}
                              onChange={(e) => updateIntervalRow(index, "intervalMonths", e.target.value)}
                              className={`w-24 text-right ${smallInputClass}`}
                            />
                            <span className="text-xs text-slate-400">mo</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">
                        {isMileageBased ? "Last done at" : "Last done"}
                      </span>
                      {isMileageBased ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            placeholder="—"
                            value={row.lastDoneOdometer}
                            onChange={(e) => updateIntervalRow(index, "lastDoneOdometer", e.target.value)}
                            className={`w-24 text-right ${smallInputClass}`}
                          />
                          <span className="text-xs text-slate-400">mi</span>
                        </div>
                      ) : (
                        <input
                          type="date"
                          value={row.lastDoneDate}
                          onChange={(e) => updateIntervalRow(index, "lastDoneDate", e.target.value)}
                          className={`${smallInputClass} [color-scheme:dark]`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {intervalsSaved && (
              <p className="mt-4 text-sm text-emerald-400">Intervals saved.</p>
            )}

            <button
              onClick={handleSaveIntervals}
              disabled={intervalsSaving || trialRequired}
              className="mt-5 w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {intervalsSaving ? "Saving…" : trialRequired ? "Start Trial to Save Intervals" : "Save Intervals"}
            </button>
          </section>
        </div>

      </div>
    </main>
  );
}
