"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
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

export default function EditVehiclePage() {
  const router = useRouter();
  const params = useParams();
  const vehicleId = params.id as string;

  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  const [vin, setVin] = useState("");
  const [startingOdometer, setStartingOdometer] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [originalIsPrimary, setOriginalIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", vehicleId)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        router.push("/settings");
        return;
      }

      setYear(data.year ?? "");
      setMake(data.make ?? "");
      setModel(data.model ?? "");
      setTrim(data.trim ?? "");
      setVin(data.vin ?? "");
      setStartingOdometer(data.starting_odometer ? String(data.starting_odometer) : "");
      setIsPrimary(data.is_primary ?? false);
      setOriginalIsPrimary(data.is_primary ?? false);
    }

    load();
  }, [router, vehicleId]);

  async function handleSave() {
    if (!year || !make || !model) {
      alert("Year, make, and model are required.");
      return;
    }

    setErrorMsg("");
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    if (!isPrimary && originalIsPrimary) {
      const { data: others } = await supabase
        .from("vehicles")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .eq("is_primary", false)
        .neq("id", vehicleId);

      if (!others || others.length === 0) {
        setErrorMsg("At least one vehicle must be primary.");
        setSaving(false);
        return;
      }
    }

    if (isPrimary && !originalIsPrimary) {
      await supabase
        .from("vehicles")
        .update({ is_primary: false })
        .eq("user_id", user.id);
    }

    const baseUpdate = {
      year,
      make,
      model,
      trim: trim || null,
      vin: vin || null,
      is_primary: isPrimary,
    };

    let updated = false;

    if (startingOdometer) {
      try {
        const { error } = await supabase
          .from("vehicles")
          .update({ ...baseUpdate, starting_odometer: startingOdometer })
          .eq("id", vehicleId)
          .eq("user_id", user.id);
        if (!error) updated = true;
      } catch {
        // starting_odometer column not yet in DB — fall through
      }
    }

    if (!updated) {
      await supabase
        .from("vehicles")
        .update(baseUpdate)
        .eq("id", vehicleId)
        .eq("user_id", user.id);
    }

    router.push("/settings");
  }

  async function handleRetire() {
    if (!confirm("Retire this vehicle? Historical records will be preserved.")) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: activeVehicles } = await supabase
      .from("vehicles")
      .select("id, is_primary")
      .eq("user_id", user.id)
      .eq("status", "active");

    const otherActiveVehicle = activeVehicles?.find((vehicle) => vehicle.id !== vehicleId);

    if (!activeVehicles || !otherActiveVehicle) {
      alert("You must have at least one other active vehicle before retiring this one.");
      return;
    }

    const retiringVehicle = activeVehicles.find((vehicle) => vehicle.id === vehicleId);

    if (retiringVehicle?.is_primary) {
      await supabase
        .from("vehicles")
        .update({ is_primary: true })
        .eq("id", otherActiveVehicle.id)
        .eq("user_id", user.id);
    }

    await supabase
      .from("vehicles")
      .update({ status: "archived", is_primary: false })
      .eq("id", vehicleId)
      .eq("user_id", user.id);
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
            <h1 className="text-4xl font-bold tracking-tight">Edit Vehicle</h1>
            <p className="mt-1 text-sm text-slate-400">Update your vehicle details.</p>
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

            {errorMsg && (
              <p className="mt-3 text-sm text-red-400">{errorMsg}</p>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-5 w-full rounded-2xl bg-blue-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </section>
        </div>

        {/* RETIRE VEHICLE */}
        <div className="mt-4">
          <button
            onClick={handleRetire}
            className="w-full rounded-2xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-300"
          >
            Retire Vehicle
          </button>
        </div>

      </div>
    </main>
  );
}
