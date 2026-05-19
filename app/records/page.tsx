"use client";

import { useEffect, useState } from "react";
import { SavedShift } from "@/app/lib/types";
import { loadShiftsFromSupabase } from "@/app/lib/storage";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { FuelEntry, loadFuelEntriesFromSupabase } from "@/app/lib/fuelStorage";

export default function RecordsPage() {
    const [savedShifts, setSavedShifts] = useState<SavedShift[]>([]);
    const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);
    const [weekOffset, setWeekOffset] = useState(0);
    const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
    const [editPlatform, setEditPlatform] = useState("");

    const today = new Date();

    const todayString = `${today.getFullYear()}-${String(
        today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const [selectedDate, setSelectedDate] = useState(todayString);

    const baseDate = new Date(today);
    const dayOfWeek = baseDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    baseDate.setDate(baseDate.getDate() + mondayOffset + weekOffset * 7);

    const [editBeginningMileage, setEditBeginningMileage] = useState("");
    const [editEndingMileage, setEditEndingMileage] = useState("");
    const [editDeliveries, setEditDeliveries] = useState("");
    const [editHoursWorked, setEditHoursWorked] = useState("");
    const [editBasePay, setEditBasePay] = useState("");
    const [editTips, setEditTips] = useState("");
    const [editOtherPay, setEditOtherPay] = useState("");

    const [editingFuelId, setEditingFuelId] = useState<string | null>(null);
    const [editFuelOdometer, setEditFuelOdometer] = useState("");
    const [editFuelGallons, setEditFuelGallons] = useState("");
    const [editFuelPricePerGallon, setEditFuelPricePerGallon] = useState("");
    const [editFuelTotalCost, setEditFuelTotalCost] = useState("");
    const [editFuelNotes, setEditFuelNotes] = useState("");





    const weekDays = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(baseDate);

        date.setDate(baseDate.getDate() + index);

        return {
            label: date.toLocaleDateString("en-US", {
                weekday: "short",
            })[0],

            day: date.getDate(),

            date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
        };
    });

    const router = useRouter();


useEffect(() => {
  async function loadCloudShifts() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const shifts = await loadShiftsFromSupabase(user.id);
    setSavedShifts(shifts);

    const fuel = await loadFuelEntriesFromSupabase(user.id);
    setFuelEntries(fuel);
  }

  loadCloudShifts();
}, [router]);

useEffect(() => {
  setWeekOffset(0);
  setSelectedDate(todayString);
}, [todayString]);

    const shiftsForSelectedDate = savedShifts.filter(
        (shift) => shift.date === selectedDate
    );

    const fuelForSelectedDate = fuelEntries.filter(
        (fuel) => fuel.date === selectedDate
    );

    async function handleDeleteShift(id: string) {
        const confirmed = confirm("Delete this shift?");
        if (!confirmed) return;

        const updatedShifts = savedShifts.filter((shift) => shift.id !== id);
        setSavedShifts(updatedShifts);

        await supabase
            .from("shifts")
            .delete()
            .eq("id", id);
    }
    async function handleUpdateShift(updatedShift: SavedShift) {
        const { error } = await supabase
            .from("shifts")
            .update({
                platform: updatedShift.platform,
                beginning_mileage: updatedShift.beginningMileage,
                ending_mileage: updatedShift.endingMileage,
                deliveries: updatedShift.deliveries,
                hours_worked: updatedShift.hoursWorked,
                base_pay: updatedShift.basePay,
                tips: updatedShift.tips,
                other_pay: updatedShift.otherPay,
                gross_pay: updatedShift.grossPay,
                status: updatedShift.status,
            })
            .eq("id", updatedShift.id);

        if (error) {
            console.error("Supabase shift update error:", error.message);
            alert(error.message);
            return;
        }

        const updatedShifts = savedShifts.map((shift) =>
            shift.id === updatedShift.id ? updatedShift : shift
        );

        setSavedShifts(updatedShifts);
        setEditingShiftId(null);
    }
    async function handleUpdateFuel(fuel: FuelEntry) {
        const calculatedTotalCost =
            Number(fuel.gallons || 0) * Number(fuel.pricePerGallon || 0);

        const updatedFuel = {
            ...fuel,
            totalCost: calculatedTotalCost.toFixed(2),
        };

        const { error } = await supabase
            .from("fuel_entries")
            .update({
                odometer: updatedFuel.odometer,
                gallons: updatedFuel.gallons,
                price_per_gallon: updatedFuel.pricePerGallon,
                total_cost: updatedFuel.totalCost,
                notes: updatedFuel.notes,
            })
            .eq("id", updatedFuel.id);

        if (error) {
            alert(error.message);
            return;
        }

        setFuelEntries((current) =>
            current.map((entry) =>
                entry.id === updatedFuel.id ? updatedFuel : entry
            )
        );

        setEditingFuelId(null);
    }

    return (
        <main className="min-h-screen bg-[#020814] text-white">
            <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-28 pt-8">
                <h1 className="text-4xl font-bold tracking-tight">Records</h1>
                <p className="mt-1 text-sm text-slate-400">
                    Review, edit, or delete completed shifts
                </p>

                <section className="mt-8 rounded-3xl border border-slate-700 bg-slate-950/70 p-5">
                    <div className="text-center">
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => setWeekOffset((current) => current - 1)}
                                className="text-3xl text-slate-400"
                            >
                                ‹
                            </button>

                            <p className="text-xl font-bold text-slate-200">
                                {new Date(weekDays[0].date + "T00:00:00").toLocaleDateString("en-US", {
                                    month: "long",
                                })}{" "}
                                {weekDays[0].day}–{weekDays[6].day}
                            </p>

                            <button
                                onClick={() => setWeekOffset((current) => current + 1)}
                                className="text-3xl text-slate-400"
                            >
                                ›
                            </button>
                        </div>
                    </div>

                    <div className="mt-5 grid grid-cols-7 gap-2 text-center">
                        {weekDays.map((day) => {
                            const isSelected = day.date === selectedDate;

                            return (
                                <button
                                    key={day.date}
                                    onClick={() => setSelectedDate(day.date)}
                                    className="flex flex-col items-center gap-2"
                                >
                                    <span className="text-xs font-bold text-slate-400">
                                        {day.label}
                                    </span>

                                    <span
                                        className={`flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold ${isSelected
                                            ? "bg-blue-500 text-white"
                                            : "text-slate-200"
                                            }`}
                                    >
                                        {day.day}
                                    </span>

                                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="mt-6 space-y-4">
                    <h2 className="text-xl font-bold">
                        Records for{" "}
                        {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                        })}
                    </h2>

                    {shiftsForSelectedDate.length === 0 && (
                        <p className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-slate-400">
                            No shifts recorded for this date.
                        </p>
                    )}

                    {shiftsForSelectedDate.map((shift) => {
                        const miles =
                            Number(shift.endingMileage || 0) -
                            Number(shift.beginningMileage || 0);

                        return (
                            <div
                                key={shift.id}
                                className="rounded-3xl border border-slate-700 bg-slate-950/70 p-5"
                            >
                                <p className="text-lg font-bold text-white">
                                    {shift.platform}
                                </p>

                                <p className="mt-1 text-sm text-slate-400">
                                    {miles} mi • {shift.deliveries || 0} deliveries • $
                                    {Number(shift.grossPay || 0).toFixed(2)} gross
                                </p>



                                {editingShiftId === shift.id ? (
                                    <div className="mt-4 space-y-3 rounded-2xl border border-blue-500/30 bg-slate-900 p-4">
                                        <p className="font-bold text-blue-300">Edit Shift</p>

                                        <select
                                            value={editPlatform}
                                            onChange={(event) => setEditPlatform(event.target.value)}
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                                        >
                                            <option value="GoPuff">GoPuff</option>
                                            <option value="Amazon Flex">Amazon Flex</option>
                                            <option value="Uber Eats">Uber Eats</option>
                                            <option value="DoorDash">DoorDash</option>
                                            <option value="Other">Other</option>
                                        </select>

                                        <label className="text-sm font-semibold text-slate-400">
                                            Beginning Mileage
                                        </label>

                                        <input
                                            type="number"
                                            value={editBeginningMileage}
                                            onChange={(event) => setEditBeginningMileage(event.target.value)}
                                            placeholder="Beginning Mileage"
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white placeholder:text-slate-500"
                                        />

                                        <label className="text-sm font-semibold text-slate-400">
                                            Ending Mileage
                                        </label>
                                        <input
                                            type="number"
                                            value={editEndingMileage}
                                            onChange={(event) => setEditEndingMileage(event.target.value)}
                                            placeholder="Ending Mileage"
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white placeholder:text-slate-500"
                                        />

                                        <label className="text-sm font-semibold text-slate-400">
                                            Deliveries
                                        </label>
                                        <input
                                            type="number"
                                            value={editDeliveries}
                                            onChange={(event) => setEditDeliveries(event.target.value)}
                                            placeholder="Deliveries"
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white placeholder:text-slate-500"
                                        />

                                        <label className="text-sm font-semibold text-slate-400">
                                            Hours Worked
                                        </label>
                                        <input
                                            type="number"
                                            value={editHoursWorked}
                                            onChange={(event) => setEditHoursWorked(event.target.value)}
                                            placeholder="Hours Worked"
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white placeholder:text-slate-500"
                                        />

                                        <label className="text-sm font-semibold text-slate-400">
                                            Base Pay
                                        </label>
                                        <input
                                            type="number"
                                            value={editBasePay}
                                            onChange={(event) => setEditBasePay(event.target.value)}
                                            placeholder="Base Pay"
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white placeholder:text-slate-500"
                                        />

                                        <label className="text-sm font-semibold text-slate-400">
                                            Tips
                                        </label>
                                        <input
                                            type="number"
                                            value={editTips}
                                            onChange={(event) => setEditTips(event.target.value)}
                                            placeholder="Tips"
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white placeholder:text-slate-500"
                                        />

                                        <label className="text-sm font-semibold text-slate-400">
                                            Other Pay
                                        </label>
                                        <input
                                            type="number"
                                            value={editOtherPay}
                                            onChange={(event) => setEditOtherPay(event.target.value)}
                                            placeholder="Other Pay / Adjustment"
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white placeholder:text-slate-500"
                                        />


                                        <button
                                            onClick={() => {
                                                const calculatedGrossPay =
                                                    Number(editBasePay || 0) +
                                                    Number(editTips || 0) +
                                                    Number(editOtherPay || 0);

                                                handleUpdateShift({
                                                    ...shift,
                                                    platform: editPlatform,
                                                    beginningMileage: editBeginningMileage,
                                                    endingMileage: editEndingMileage,
                                                    deliveries: editDeliveries,
                                                    hoursWorked: editHoursWorked,
                                                    basePay: editBasePay,
                                                    tips: editTips,
                                                    otherPay: editOtherPay,
                                                    grossPay: calculatedGrossPay.toFixed(2),
                                                });
                                            }}
                                            className="w-full rounded-xl bg-emerald-500 p-3 font-bold text-white"
                                        >
                                            Save Changes
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setEditingShiftId(null)}
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-bold text-slate-300"
                                        >
                                            Cancel
                                        </button>

                                    </div>
                                ) : (
                                    <div className="mt-4 grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => {
                                                setEditingShiftId(shift.id);
                                                setEditPlatform(shift.platform);

                                                setEditBeginningMileage(shift.beginningMileage);
                                                setEditEndingMileage(shift.endingMileage);
                                                setEditDeliveries(shift.deliveries);
                                                setEditHoursWorked(shift.hoursWorked);
                                                setEditBasePay(shift.basePay);
                                                setEditTips(shift.tips);
                                                setEditOtherPay(shift.otherPay);
                                            }}
                                            className="rounded-xl bg-blue-500 p-3 font-bold text-white"
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

                    {fuelForSelectedDate.map((fuel) => (
                        <div
                            key={fuel.id}
                            className="rounded-3xl border border-emerald-700 bg-slate-950/70 p-5"
                        >
                            <p className="text-lg font-bold text-white">Fuel</p>

                            <p className="mt-1 text-sm text-slate-400">
                                Odometer: {fuel.odometer}
                            </p>

                            <p className="text-sm text-slate-400">
                                Gallons: {fuel.gallons}
                            </p>

                            <p className="text-sm text-slate-400">
                                Price/Gal: ${fuel.pricePerGallon || "Not entered"}
                            </p>

                            <p className="text-sm text-slate-400">
                                Total Cost: ${fuel.totalCost || "Not entered"}
                            </p>

                            <button
                                onClick={() => {
                                    setEditingFuelId(fuel.id);
                                    setEditFuelOdometer(fuel.odometer);
                                    setEditFuelGallons(fuel.gallons);
                                    setEditFuelPricePerGallon(fuel.pricePerGallon || "");
                                    setEditFuelTotalCost(fuel.totalCost || "");
                                    setEditFuelNotes(fuel.notes || "");
                                }}
                                className="mt-4 w-full rounded-xl border border-blue-500/60 bg-blue-500/10 p-3 font-semibold text-blue-300"
                            >
                                Edit Fuel
                            </button>
                            {editingFuelId === fuel.id && (
                                <div className="mt-4 rounded-2xl border border-blue-700/60 bg-slate-900 p-4">
                                    <h3 className="text-lg font-bold text-blue-300">Edit Fuel</h3>

                                    <div className="mt-4 space-y-4">
                                        <input
                                            type="number"
                                            value={editFuelOdometer}
                                            onChange={(e) => setEditFuelOdometer(e.target.value)}
                                            placeholder="Odometer"
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                                        />

                                        <input
                                            type="number"
                                            value={editFuelGallons}
                                            onChange={(e) => setEditFuelGallons(e.target.value)}
                                            placeholder="Gallons"
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                                        />

                                        <input
                                            type="number"
                                            value={editFuelPricePerGallon}
                                            onChange={(e) => setEditFuelPricePerGallon(e.target.value)}
                                            placeholder="Price per gallon"
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                                        />

                                        <input
                                            type="number"
                                            value={editFuelTotalCost}
                                            onChange={(e) => setEditFuelTotalCost(e.target.value)}
                                            placeholder="Total cost"
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                                        />

                                        <button
                                            onClick={() =>
                                                handleUpdateFuel({
                                                    ...fuel,
                                                    odometer: editFuelOdometer,
                                                    gallons: editFuelGallons,
                                                    pricePerGallon: editFuelPricePerGallon,
                                                    notes: editFuelNotes,
                                                })
                                            }
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

                                        <button className="w-full rounded-xl border border-red-500/70 bg-red-500/10 p-3 font-bold text-red-300">
                                            Delete Fuel Entry
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </section>
            </div>

        </main>
    );
}