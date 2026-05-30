"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import BottomNav from "@/app/components/BottomNav";
import { supabase } from "@/app/lib/supabaseClient";

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

export default function NewVehiclePage() {
  const router = useRouter();

  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  const [vin, setVin] = useState("");
  const [startingOdometer, setStartingOdometer] = useState("");
  const [isPrimary, setIsPrimary] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function checkExistingVehicles() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("vehicles")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1);

      setIsPrimary(!data || data.length === 0);
    }

    checkExistingVehicles();
  }, [router]);

  async function handleSave() {
    if (!year || !make || !model) {
      alert("Year, make, and model are required.");
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    if (isPrimary) {
      await supabase
        .from("vehicles")
        .update({ is_primary: false })
        .eq("user_id", user.id);
    }

    const baseRecord = {
      user_id: user.id,
      year,
      make,
      model,
      trim: trim || null,
      vin: vin || null,
      status: "active",
      is_primary: isPrimary,
    };

    let inserted = false;

    if (startingOdometer) {
      try {
        const { error } = await supabase.from("vehicles").insert({
          ...baseRecord,
          starting_odometer: startingOdometer,
        });
        if (!error) inserted = true;
      } catch {
        // starting_odometer column not yet in DB — fall through
      }
    }

    if (!inserted) {
      await supabase.from("vehicles").insert(baseRecord);
    }

    router.push("/settings");
  }

  const inputClass =
    "w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white placeholder:text-slate-500";

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
            <h1 className="text-4xl font-bold tracking-tight">Add Vehicle</h1>
            <p className="mt-1 text-sm text-slate-400">Tell us about your vehicle.</p>
          </div>
        </div>

        {/* VEHICLE FORM */}
        <div className="relative mt-6">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-blue-500" />
          <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg">

            <div className="space-y-3">
              <input
                type="number"
                placeholder="2023"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Toyota"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Tacoma"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="TRD Sport (optional)"
                value={trim}
                onChange={(e) => setTrim(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="VIN (optional)"
                value={vin}
                onChange={(e) => setVin(e.target.value)}
                className={inputClass}
              />
              <div>
                <input
                  type="number"
                  placeholder="Odometer when you started tracking"
                  value={startingOdometer}
                  onChange={(e) => setStartingOdometer(e.target.value)}
                  className={inputClass}
                />
                <p className="mt-1 px-1 text-xs text-slate-500">
                  Used as your baseline for lifetime calculations.
                </p>
              </div>
            </div>

            {/* SET AS PRIMARY TOGGLE */}
            <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-5">
              <span className="text-sm text-slate-300">Set as primary vehicle</span>
              <Toggle on={isPrimary} onToggle={() => setIsPrimary((v) => !v)} />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-5 w-full rounded-2xl bg-blue-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Add Vehicle"}
            </button>
          </section>
        </div>

      </div>
      <BottomNav />
    </main>
  );
}
