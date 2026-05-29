"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { loadShiftsFromSupabase } from "@/app/lib/storage";
import { loadFuelEntriesFromSupabase } from "@/app/lib/fuelStorage";
import { SavedShift } from "@/app/lib/types";
import { FuelEntry } from "@/app/lib/fuelStorage";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseShiftDate(dateStr: string): Date {
  if (!dateStr) return new Date(0);
  if (dateStr.includes("/")) {
    const [month, day, year] = dateStr.split("/");
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
  }
  return new Date(dateStr + "T12:00:00");
}

function toISODate(dateStr: string): string {
  const d = parseShiftDate(dateStr);
  if (d.getTime() === 0) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatCurrency(val: number) {
  return val.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function getWorkMilePercentage(workMiles: number, totalOdometerMiles: number): number {
  if (totalOdometerMiles <= 0) return 1;
  return Math.min(workMiles / totalOdometerMiles, 1);
}

const PLATFORMS = ["GoPuff", "Amazon Flex", "Uber Eats", "DoorDash", "Other"];

// ─── Component ───────────────────────────────────────────────────────────────

export default function DayDetailPage() {
  const router = useRouter();
  const params = useParams();
  const dateStr = params.date as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [shifts, setShifts] = useState<SavedShift[]>([]);
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [vehicles, setVehicles] = useState<Array<{
    id: string; year: string; make: string; model: string; is_primary: boolean;
  }>>([]);

  // Edit shift state
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [editShiftVehicleId, setEditShiftVehicleId] = useState("");
  const [editPlatform, setEditPlatform] = useState("");
  const [editBeginningMileage, setEditBeginningMileage] = useState("");
  const [editEndingMileage, setEditEndingMileage] = useState("");
  const [editDeliveries, setEditDeliveries] = useState("");
  const [editHoursWorked, setEditHoursWorked] = useState("");
  const [editBasePay, setEditBasePay] = useState("");
  const [editTips, setEditTips] = useState("");
  const [editOtherPay, setEditOtherPay] = useState("");

  // Edit fuel state
  const [editingFuelId, setEditingFuelId] = useState<string | null>(null);
  const [editFuelVehicleId, setEditFuelVehicleId] = useState("");
  const [editFuelOdometer, setEditFuelOdometer] = useState("");
  const [editFuelGallons, setEditFuelGallons] = useState("");
  const [editFuelPricePerGallon, setEditFuelPricePerGallon] = useState("");
  const [editFuelNotes, setEditFuelNotes] = useState("");

  // ─── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const [allShifts, allFuel] = await Promise.all([
        loadShiftsFromSupabase(user.id),
        loadFuelEntriesFromSupabase(user.id),
      ]);

      setShifts(allShifts.filter((s) => toISODate(s.date) === dateStr));
      setFuelEntries(allFuel.filter((f) => toISODate(f.date) === dateStr));

      const { data: vehicleData } = await supabase
        .from("vehicles")
        .select("id, year, make, model, is_primary, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("is_primary", { ascending: false });

      setVehicles(vehicleData || []);
      setLoading(false);
    }
    load();
  }, [dateStr, router]);

  // ─── Derived ────────────────────────────────────────────────────────────────

  const totalDeliveries = shifts.reduce((sum, s) => sum + Number(s.deliveries || 0), 0);
  const totalHours = shifts.reduce((sum, s) => sum + Number(s.hoursWorked || 0), 0);
  const totalMileage = shifts.reduce(
    (sum, s) => sum + (Number(s.endingMileage || 0) - Number(s.beginningMileage || 0)),
    0
  );
  const totalBasePay = shifts.reduce((sum, s) => sum + Number(s.basePay || 0), 0);
  const totalTips = shifts.reduce((sum, s) => sum + Number(s.tips || 0), 0);
  const totalOtherPay = shifts.reduce((sum, s) => sum + Number(s.otherPay || 0), 0);
  const totalGross = shifts.reduce((sum, s) => sum + Number(s.grossPay || 0), 0);
  const totalFuelCost = fuelEntries.reduce((sum, f) => sum + Number(f.totalCost || 0), 0);

  const highestEndingMileage = shifts.length > 0
    ? shifts.reduce((max, s) => Math.max(max, Number(s.endingMileage || 0)), 0)
    : 0;
  const lowestFuelOdometer = fuelEntries.length > 0
    ? fuelEntries.reduce((min, f) => Math.min(min, Number(f.odometer || 0)), Infinity)
    : 0;
  const totalMilesDriven =
    highestEndingMileage > lowestFuelOdometer && lowestFuelOdometer > 0
      ? highestEndingMileage - lowestFuelOdometer
      : 0;
  const workMilePct = getWorkMilePercentage(totalMileage, totalMilesDriven);
  const workFuelCost = totalFuelCost * workMilePct;

  // ─── Helpers ────────────────────────────────────────────────────────────────

  async function reloadDateData(uid: string) {
    const [allShifts, allFuel] = await Promise.all([
      loadShiftsFromSupabase(uid),
      loadFuelEntriesFromSupabase(uid),
    ]);
    setShifts(allShifts.filter((s) => toISODate(s.date) === dateStr));
    setFuelEntries(allFuel.filter((f) => toISODate(f.date) === dateStr));
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function openEditShift(shift: SavedShift) {
    setEditingShiftId(shift.id);
    setEditPlatform(shift.platform);
    setEditBeginningMileage(shift.beginningMileage);
    setEditEndingMileage(shift.endingMileage);
    setEditDeliveries(shift.deliveries);
    setEditHoursWorked(shift.hoursWorked);
    setEditBasePay(shift.basePay);
    setEditTips(shift.tips);
    setEditOtherPay(shift.otherPay);
    const primaryId = vehicles.find((v) => v.is_primary)?.id || vehicles[0]?.id || "";
    setEditShiftVehicleId(shift.vehicleId || primaryId);
  }

  async function handleUpdateShift(shift: SavedShift) {
    const grossPay = (
      Number(editBasePay || 0) +
      Number(editTips || 0) +
      Number(editOtherPay || 0)
    ).toFixed(2);

    const updated: SavedShift = {
      ...shift,
      platform: editPlatform,
      beginningMileage: editBeginningMileage,
      endingMileage: editEndingMileage,
      deliveries: editDeliveries,
      hoursWorked: editHoursWorked,
      basePay: editBasePay,
      tips: editTips,
      otherPay: editOtherPay,
      grossPay,
    };

    const { error } = await supabase
      .from("shifts")
      .update({
        vehicle_id: editShiftVehicleId || null,
        platform: updated.platform,
        beginning_mileage: updated.beginningMileage,
        ending_mileage: updated.endingMileage,
        deliveries: updated.deliveries,
        hours_worked: updated.hoursWorked,
        base_pay: updated.basePay,
        tips: updated.tips,
        other_pay: updated.otherPay,
        gross_pay: updated.grossPay,
      })
      .eq("id", shift.id);

    if (error) { alert(error.message); return; }

    await reloadDateData(userId!);
    setEditingShiftId(null);
  }

  async function handleDeleteShift(id: string) {
    const confirmed = confirm("Delete this shift?");
    if (!confirmed) return;
    const { error } = await supabase.from("shifts").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setShifts((prev) => prev.filter((s) => s.id !== id));
  }

  function openEditFuel(fuel: FuelEntry) {
    setEditingFuelId(fuel.id);
    setEditFuelOdometer(fuel.odometer);
    setEditFuelGallons(fuel.gallons);
    setEditFuelPricePerGallon(fuel.pricePerGallon || "");
    setEditFuelNotes(fuel.notes || "");
    const primaryId = vehicles.find((v) => v.is_primary)?.id || vehicles[0]?.id || "";
    setEditFuelVehicleId(fuel.vehicleId || primaryId);
  }

  async function handleUpdateFuel(fuel: FuelEntry) {
    const totalCost = (
      Number(editFuelGallons || 0) * Number(editFuelPricePerGallon || 0)
    ).toFixed(2);

    const updated: FuelEntry = {
      ...fuel,
      odometer: editFuelOdometer,
      gallons: editFuelGallons,
      pricePerGallon: editFuelPricePerGallon,
      totalCost,
      notes: editFuelNotes,
    };

    const { error } = await supabase
      .from("fuel_entries")
      .update({
        vehicle_id: editFuelVehicleId || null,
        odometer: updated.odometer,
        gallons: updated.gallons,
        price_per_gallon: updated.pricePerGallon,
        total_cost: updated.totalCost,
        notes: updated.notes,
      })
      .eq("id", fuel.id);

    if (error) { alert(error.message); return; }

    await reloadDateData(userId!);
    setEditingFuelId(null);
  }

  async function handleDeleteFuel(id: string) {
    const confirmed = confirm("Delete this fuel entry?");
    if (!confirmed) return;
    const { error } = await supabase.from("fuel_entries").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setFuelEntries((prev) => prev.filter((f) => f.id !== id));
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#020814] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-28 pt-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 text-xl text-slate-400 active:bg-slate-800"
          >
            ‹
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" })}
            </h1>
            <p className="text-sm text-slate-400">
              {new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-blue-500" />
            <p className="text-sm">Loading…</p>
          </div>
        ) : (
          <>
            {/* ── Day Summary Card ── */}
            <section className="mt-5 rounded-3xl border border-slate-700/60 bg-slate-900/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Day Summary</p>

              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Deliveries", value: totalDeliveries.toString() },
                  { label: "Hours", value: totalHours.toFixed(2) },
                  { label: "Mileage", value: `${totalMileage} mi` },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-slate-500">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-slate-800 pt-4">
                <p className="text-sm text-slate-400">Gross Earnings</p>
                <p className="text-4xl font-bold text-white">{formatCurrency(totalGross)}</p>
              </div>
            </section>

            {/* ── Earnings Rows ── */}
            <section className="mt-4 rounded-3xl border border-slate-700/60 bg-slate-900/80 p-5">
              {[
                { label: "Base Pay", value: totalBasePay, color: "text-white" },
                { label: "Tips", value: totalTips, color: "text-emerald-400" },
                { label: "Other Pay", value: totalOtherPay, color: "text-blue-400" },
                { label: "Fuel Cost", value: workFuelCost, color: "text-red-400", negative: true },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-slate-800 last:border-0">
                  <span className="text-sm text-slate-400">{row.label}</span>
                  <span className={`text-sm font-semibold ${row.color}`}>
                    {row.negative && row.value > 0 ? "−" : ""}{formatCurrency(row.value)}
                  </span>
                </div>
              ))}

              <div className="mt-3 flex items-center justify-between">
                <span className="font-bold text-white">Gross Earnings</span>
                <span className="text-lg font-bold text-white">{formatCurrency(totalGross)}</span>
              </div>
            </section>

            {/* ── Shifts ── */}
            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-300">Shifts</p>
                <span className="text-xs text-slate-600">{shifts.length} shift{shifts.length !== 1 ? "s" : ""}</span>
              </div>

              {shifts.length === 0 && (
                <p className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-500">
                  No shifts recorded for this day.
                </p>
              )}

              <div className="space-y-3">
                {shifts.map((shift) => {
                  const miles = Number(shift.endingMileage || 0) - Number(shift.beginningMileage || 0);
                  const isEditing = editingShiftId === shift.id;

                  return (
                    <div key={shift.id} className="rounded-3xl border border-slate-700/60 bg-slate-900/80 p-5">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-white">{shift.platform}</p>
                        <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
                          Shift
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-400">
                        {miles} mi • {shift.deliveries || 0} deliveries • {Number(shift.hoursWorked || 0).toFixed(2)} hrs
                      </p>

                      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                        {[
                          { label: "Base", value: formatCurrency(Number(shift.basePay || 0)) },
                          { label: "Tips", value: formatCurrency(Number(shift.tips || 0)) },
                          { label: "Gross", value: formatCurrency(Number(shift.grossPay || 0)) },
                        ].map((s) => (
                          <div key={s.label} className="rounded-xl bg-slate-800/60 p-2">
                            <p className="text-xs text-slate-500">{s.label}</p>
                            <p className="text-sm font-bold text-white">{s.value}</p>
                          </div>
                        ))}
                      </div>

                      {isEditing ? (
                        <div className="mt-4 space-y-3 rounded-2xl border border-blue-500/30 bg-slate-950 p-4">
                          <p className="font-bold text-blue-300">Edit Shift</p>

                          {vehicles.length > 1 && (
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-400">Vehicle</label>
                              <select
                                value={editShiftVehicleId}
                                onChange={(e) => setEditShiftVehicleId(e.target.value)}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
                              >
                                {vehicles.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.year} {v.make} {v.model}{v.is_primary ? " (Primary)" : ""}
                                  </option>
                                ))}
                              </select>
                              <p className="mt-1 text-xs text-amber-400">Changing vehicle affects mileage and cost calculations.</p>
                            </div>
                          )}

                          <select
                            value={editPlatform}
                            onChange={(e) => setEditPlatform(e.target.value)}
                            className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
                          >
                            {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                          </select>

                          {[
                            { label: "Beginning Mileage", val: editBeginningMileage, set: setEditBeginningMileage },
                            { label: "Ending Mileage", val: editEndingMileage, set: setEditEndingMileage },
                            { label: "Deliveries", val: editDeliveries, set: setEditDeliveries },
                            { label: "Hours Worked", val: editHoursWorked, set: setEditHoursWorked },
                            { label: "Base Pay", val: editBasePay, set: setEditBasePay },
                            { label: "Tips", val: editTips, set: setEditTips },
                            { label: "Other Pay", val: editOtherPay, set: setEditOtherPay },
                          ].map((field) => (
                            <div key={field.label}>
                              <label className="mb-1 block text-xs font-semibold text-slate-400">
                                {field.label}
                              </label>
                              <input
                                type="number"
                                value={field.val}
                                onChange={(e) => field.set(e.target.value)}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-600"
                              />
                            </div>
                          ))}

                          <button
                            onClick={() => handleUpdateShift(shift)}
                            className="w-full rounded-xl bg-emerald-500 p-3 font-bold text-white active:bg-emerald-600"
                          >
                            Save Changes
                          </button>
                          <button
                            onClick={() => setEditingShiftId(null)}
                            className="w-full rounded-xl border border-slate-700 p-3 font-bold text-slate-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <button
                            onClick={() => openEditShift(shift)}
                            className="rounded-xl bg-blue-500 p-3 font-bold text-white active:bg-blue-600"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteShift(shift.id)}
                            className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 font-bold text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ── Fuel Entries ── */}
            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-300">Fuel</p>
                <span className="text-xs text-slate-600">{fuelEntries.length} entr{fuelEntries.length !== 1 ? "ies" : "y"}</span>
              </div>

              {fuelEntries.length === 0 && (
                <p className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-500">
                  No fuel entries for this day.
                </p>
              )}

              <div className="space-y-3">
                {fuelEntries.map((fuel) => {
                  const isEditing = editingFuelId === fuel.id;

                  return (
                    <div key={fuel.id} className="rounded-3xl border border-slate-700/60 bg-slate-900/80 p-5">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-white">Fuel Entry</p>
                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                          ⛽ Fuel
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-400">
                        {fuel.gallons} gal • ${fuel.pricePerGallon}/gal • {formatCurrency(Number(fuel.totalCost || 0))} total
                      </p>
                      <p className="text-xs text-slate-500">Odometer: {fuel.odometer} mi</p>

                      {isEditing ? (
                        <div className="mt-4 space-y-3 rounded-2xl border border-blue-500/30 bg-slate-950 p-4">
                          <p className="font-bold text-blue-300">Edit Fuel</p>

                          {vehicles.length > 1 && (
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-400">Vehicle</label>
                              <select
                                value={editFuelVehicleId}
                                onChange={(e) => setEditFuelVehicleId(e.target.value)}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
                              >
                                {vehicles.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.year} {v.make} {v.model}{v.is_primary ? " (Primary)" : ""}
                                  </option>
                                ))}
                              </select>
                              <p className="mt-1 text-xs text-amber-400">Changing vehicle affects mileage and cost calculations.</p>
                            </div>
                          )}

                          {[
                            { label: "Odometer", val: editFuelOdometer, set: setEditFuelOdometer },
                            { label: "Gallons", val: editFuelGallons, set: setEditFuelGallons },
                            { label: "Price per Gallon", val: editFuelPricePerGallon, set: setEditFuelPricePerGallon },
                          ].map((field) => (
                            <div key={field.label}>
                              <label className="mb-1 block text-xs font-semibold text-slate-400">{field.label}</label>
                              <input
                                type="number"
                                value={field.val}
                                onChange={(e) => field.set(e.target.value)}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
                              />
                            </div>
                          ))}

                          <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-400">Notes</label>
                            <input
                              type="text"
                              value={editFuelNotes}
                              onChange={(e) => setEditFuelNotes(e.target.value)}
                              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
                            />
                          </div>

                          <button
                            onClick={() => handleUpdateFuel(fuel)}
                            className="w-full rounded-xl bg-emerald-500 p-3 font-bold text-white"
                          >
                            Save Changes
                          </button>
                          <button
                            onClick={() => setEditingFuelId(null)}
                            className="w-full rounded-xl border border-slate-700 p-3 font-bold text-slate-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <button
                            onClick={() => openEditFuel(fuel)}
                            className="rounded-xl bg-blue-500 p-3 font-bold text-white active:bg-blue-600"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteFuel(fuel.id)}
                            className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 font-bold text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}