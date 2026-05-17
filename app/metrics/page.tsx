"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SavedShift } from "@/app/lib/types";
import { FuelEntry } from "@/app/lib/fuelStorage";
import { supabase } from "@/app/lib/supabaseClient";
import { loadShiftsFromSupabase } from "@/app/lib/storage";
import { loadFuelEntriesFromSupabase } from "@/app/lib/fuelStorage";

export default function MetricsPage() {
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);
  const [savedShifts, setSavedShifts] = useState<SavedShift[]>([]);
  const [isAllowed, setIsAllowed] = useState(false);

  const router = useRouter();

  useEffect(() => {
    async function loadCloudMetrics() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const shifts = await loadShiftsFromSupabase(user.id);
      const fuel = await loadFuelEntriesFromSupabase(user.id);

      setSavedShifts(shifts);
      setFuelEntries(fuel);
      setIsAllowed(true);
    }

    loadCloudMetrics();
  }, [router]);

  if (!isAllowed) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#020814] p-8 text-white">
      <h1 className="text-4xl font-bold">Metrics</h1>
      <p>Metrics page is loading.</p>

      <p className="mt-4 text-slate-300">
        Shift records loaded: {savedShifts.length}
      </p>

      <p className="mt-2 text-slate-300">
        Fuel records loaded: {fuelEntries.length}
      </p>

      <section className="mt-8 grid grid-cols-2 gap-3">
        <MetricCard
          label="Deliveries"
          value={savedShifts
            .reduce((total, shift) => {
              return total + Number(shift.deliveries || 0);
            }, 0)
            .toString()}
        />

        <MetricCard
          label="Hours Worked"
          value={savedShifts
            .reduce((total, shift) => {
              return total + Number(shift.hoursWorked || 0);
            }, 0)
            .toFixed(2)}
        />

        <MetricCard
          label="Gross Pay"
          value={`$${savedShifts
            .reduce((total, shift) => {
              return total + Number(shift.grossPay || 0);
            }, 0)
            .toFixed(2)}`}
        />

        <MetricCard
          label="Fuel Cost"
          value={`$${fuelEntries
            .reduce((total, fuel) => {
              return total + Number(fuel.totalCost || 0);
            }, 0)
            .toFixed(2)}`}
        />

        <MetricCard
          label="Net Profit"
          value={`$${(
            savedShifts.reduce((total, shift) => {
              return total + Number(shift.grossPay || 0);
            }, 0) -
            fuelEntries.reduce((total, fuel) => {
              return total + Number(fuel.totalCost || 0);
            }, 0)
          ).toFixed(2)}`}
        />

        <MetricCard
          label="Profit / Delivery"
          value={`$${(() => {
            const grossPay = savedShifts.reduce((total, shift) => {
              return total + Number(shift.grossPay || 0);
            }, 0);

            const fuelCost = fuelEntries.reduce((total, fuel) => {
              return total + Number(fuel.totalCost || 0);
            }, 0);

            const deliveries = savedShifts.reduce((total, shift) => {
              return total + Number(shift.deliveries || 0);
            }, 0);

            const netProfit = grossPay - fuelCost;

            return deliveries > 0
              ? (netProfit / deliveries).toFixed(2)
              : "0.00";
          })()}`}
        />
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}