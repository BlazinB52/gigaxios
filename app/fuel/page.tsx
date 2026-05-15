"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadShifts } from "@/app/lib/storage";

import {
  FuelEntry,
  loadFuelEntries,
  saveFuelEntries,
} from "@/app/lib/fuelStorage";

export default function FuelPage() {
  const router = useRouter();

  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);
  const [date, setDate] = useState("");
  const [odometer, setOdometer] = useState("");
  const [gallons, setGallons] = useState("");
  const [pricePerGallon, setPricePerGallon] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setFuelEntries(loadFuelEntries());

    const today = new Date().toISOString().slice(0, 10);
    setDate(today);
  }, []);

  function handleSaveFuel() {
    if (!date || !odometer || !gallons || !pricePerGallon) {
      alert("Date, odometer, gallons, and price per gallon are required.");
      return;
    }

    const shifts = loadShifts();

    const closedShifts = shifts.filter(
      (shift) => shift.status === "closed" && shift.endingMileage
    );

    const lastClosedShift = closedShifts[closedShifts.length - 1];

    if (
      lastClosedShift &&
      Number(odometer) < Number(lastClosedShift.endingMileage)
    ) {
      alert(
        `Fuel odometer cannot be less than the last shift ending mileage of ${lastClosedShift.endingMileage}.`
      );
      return;
    }

    const calculatedTotalCost = Number(gallons) * Number(pricePerGallon);

    const newEntry: FuelEntry = {
      id: crypto.randomUUID(),
      date,
      odometer,
      gallons,
      pricePerGallon,
      totalCost: calculatedTotalCost.toFixed(2),
      notes,
    };

    const updatedEntries = [newEntry, ...fuelEntries];

    saveFuelEntries(updatedEntries);
    setFuelEntries(updatedEntries);

    alert("Fuel entry saved.");
    router.push("/");
  }







  return (
    <main className="min-h-screen bg-[#020814] text-white">

      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-28 pt-8">
        <div className="mb-2">
          <h1 className="text-3xl font-bold tracking-tight">Fuel</h1>
          <p className="mt-1 text-sm text-slate-400">
            Track fill-ups, gallons, and fuel cost.
          </p>
        </div>

        <section className="rounded-3xl border border-slate-700/70 bg-slate-950/70 p-5">
          <h2 className="text-lg font-bold">Add fuel</h2>

          <div className="mt-4 space-y-3">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-500"
            />

            <input
              type="number"
              placeholder="Odometer"
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
            />

            <input
              type="number"
              placeholder="Gallons"
              value={gallons}
              onChange={(e) => setGallons(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
            />

            <input
              type="number"
              placeholder="Price per gallon"
              value={pricePerGallon}
              onChange={(e) => setPricePerGallon(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
            />

            <input
              type="text"
              placeholder="Notes optional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
            />

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleSaveFuel}
                className="rounded-xl bg-blue-500 py-2 font-bold text-white"
              >
                Save Fuel Entry
              </button>

              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-xl border border-slate-700 bg-slate-900 py-2 font-bold text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-700/70 bg-slate-950/70 p-5">
          <h2 className="text-lg font-bold">Recent fuel</h2>

          {fuelEntries.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">
              No fuel entries yet.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {fuelEntries.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{entry.date}</p>
                      <p className="text-sm text-slate-400">
                        Odometer: {entry.odometer}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold">${entry.totalCost}</p>
                      <p className="text-xs text-slate-400">
                        {entry.gallons} gal
                      </p>
                    </div>
                  </div>

                  {entry.notes && (
                    <p className="mt-2 text-sm text-slate-400">
                      {entry.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

    </main>
  );
}