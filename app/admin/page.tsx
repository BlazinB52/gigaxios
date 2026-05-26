"use client";

import { useEffect, useState } from "react";

import { supabase } from "../lib/supabaseClient";
import { SavedShift } from "@/app/lib/types";
import { FuelEntry, loadFuelEntriesFromSupabase } from "@/app/lib/fuelStorage";
import { PayEntry, loadPayEntriesFromSupabase } from "@/app/lib/payStorage";
import { loadShiftsFromSupabase } from "@/app/lib/storage";

const GIGAXIOS_KEYS = [
    "savedShifts",
    "gigaxios-fuel",
    "gigaxios-pay",
    "gigaxios-expenses",
];

export default function AdminPage() {

    const [savedShifts, setSavedShifts] = useState<any[]>([]);
    const [fuelEntries, setFuelEntries] = useState<any[]>([]);
    const [payEntries, setPayEntries] = useState<any[]>([]);
    const [supabaseStatus, setSupabaseStatus] = useState("Checking Supabase...");

    useEffect(() => {
        async function loadAdminData() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) return;

            const shifts = await loadShiftsFromSupabase(user.id);
            const fuel = await loadFuelEntriesFromSupabase(user.id);
            const pay = await loadPayEntriesFromSupabase(user.id);

            setSavedShifts(shifts);
            setFuelEntries(fuel);
            setPayEntries(pay);
            setSupabaseStatus("Supabase connected successfully.");
        }

        loadAdminData();
    }, []);

    async function handleExportBackup() {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data: shifts, error: shiftsError } = await supabase
            .from("shifts")
            .select("*")
            .eq("user_id", user.id);

        const { data: fuelEntries, error: fuelError } = await supabase
            .from("fuel_entries")
            .select("*")
            .eq("user_id", user.id);

        const { data: payEntries, error: payError } = await supabase
            .from("pay_entries")
            .select("*")
            .eq("user_id", user.id);

        if (shiftsError || fuelError || payError) {
            alert("Could not export Supabase backup. Check console for details.");
            console.error({ shiftsError, fuelError, payError });
            return;
        }

        const backup = {
            exportedAt: new Date().toISOString(),
            source: "supabase",
            user_id: user.id,
            shifts: shifts ?? [],
            fuel_entries: fuelEntries ?? [],
            pay_entries: payEntries ?? [],
        };

        const backupFile = new Blob([JSON.stringify(backup, null, 2)], {
            type: "application/json",
        });

        const downloadUrl = URL.createObjectURL(backupFile);
        const link = document.createElement("a");

        link.href = downloadUrl;
        link.download = `gigaxios-supabase-backup-${new Date()
            .toISOString()
            .slice(0, 10)}.json`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(downloadUrl);
    }


    function handlePurgeData() {
        const confirmed = window.confirm(
            "This will permanently delete all saved GigAxios data from this browser. Are you sure?"
        );

        if (!confirmed) return;

        GIGAXIOS_KEYS.forEach((key) => {
            localStorage.removeItem(key);
        });

        alert("GigAxios data has been purged.");
        window.location.reload();
    }

    async function handleDeletePayEntry(payId: string) {
        const confirmed = window.confirm(
            "Delete this pay entry? This cannot be undone."
        );

        if (!confirmed) return;

        const { error } = await supabase
            .from("pay_entries")
            .delete()
            .eq("id", payId);

        if (error) {
            alert("Could not delete pay entry. Check console.");
            console.error(error);
            return;
        }

        setPayEntries((currentEntries) =>
            currentEntries.filter((entry) => entry.id !== payId)
        );

        alert("Pay entry deleted.");
    }

    return (

        <main className="min-h-screen bg-slate-950 p-4 text-white">
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-sm text-emerald-200">
                {supabaseStatus}
            </div>

            <div className="mx-auto max-w-md space-y-6">
                <div>
                    <p className="text-sm text-slate-400">GigAxios maintenance</p>
                    <h1 className="text-2xl font-bold">Admin</h1>
                </div>

                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg">
                    <h2 className="text-lg font-semibold">Backup & Export</h2>
                    <p className="mt-2 text-sm text-slate-400">
                        Export a backup file of your saved GigAxios data only.
                    </p>

                    <button
                        onClick={handleExportBackup}
                        className="mt-4 w-full rounded-xl bg-blue-500 p-3 font-bold text-white hover:bg-blue-400"
                    >
                        Export Records / Backup
                    </button>
                </section>

                <section className="rounded-2xl border border-red-900 bg-slate-900 p-4 shadow-lg">
                    <h2 className="text-lg font-semibold text-red-300">Purge Data</h2>
                    <p className="mt-2 text-sm text-slate-400">
                        Delete all saved GigAxios data from this browser and start fresh.
                    </p>

                    <button
                        onClick={handlePurgeData}
                        className="mt-4 w-full rounded-xl bg-red-600 p-3 font-bold text-white hover:bg-red-500"
                    >
                        Purge GigAxios Data
                    </button>
                </section>

                {/* Saved Shift Section */}

                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg">
                    <h2 className="text-lg font-semibold">Saved Shifts</h2>

                    <div className="mt-4 space-y-3">
                        {savedShifts.length === 0 && (
                            <p className="text-sm text-slate-400">No shifts saved.</p>
                        )}

                        {savedShifts.map((shift) => (
                            <div
                                key={shift.id}
                                className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm"
                            >
                                <p>Date: {shift.date}</p>
                                <p>Status: {shift.status}</p>
                                <p>Beginning: {shift.beginningMileage}</p>
                                <p>Ending: {shift.endingMileage || "-"}</p>

                                <div className="mt-3 border-t border-slate-700 pt-3">
                                    <p>Platform: {shift.platform || "Not entered"}</p>
                                    <p>Deliveries: {shift.deliveries || "Not entered"}</p>
                                    <p>Hours: {shift.hoursWorked || "Not entered"}</p>
                                    <p>Base Pay: {shift.basePay ? `$${shift.basePay}` : "Not entered"}</p>
                                    <p>Tips: {shift.tips ? `$${shift.tips}` : "Not entered"}</p>
                                    <p>Other Pay: {shift.otherPay ? `$${shift.otherPay}` : "Not entered"}</p>
                                    <p>Total: {shift.grossPay ? `$${shift.grossPay}` : "Not entered"}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* End Saved Shift Section */}

                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg">
                    <h2 className="text-lg font-semibold">Pay Entries</h2>

                    <div className="mt-4 space-y-3">
                        {payEntries.length === 0 && (
                            <p className="text-sm text-slate-400">No pay entries saved.</p>
                        )}

                        {payEntries.map((entry) => (
                            <div
                                key={entry.id}
                                className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm"
                            >
                                <p>Date: {entry.date}</p>
                                <p>Platform: {entry.platform}</p>
                                <p>Deliveries: {entry.deliveries}</p>
                                <p>Base Pay: ${entry.basePay}</p>
                                <p>Tips: ${entry.tips}</p>
                                <p>Total: ${entry.grossPay}</p>

                                <button
                                    onClick={() => handleDeletePayEntry(entry.id)}
                                    className="mt-3 w-full rounded-xl bg-red-600 p-2 text-sm font-bold text-white"
                                >
                                    Delete Pay Entry
                                </button>
                            </div>
                        ))}
                    </div>
                </section>


                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg">
                    <h2 className="text-lg font-semibold">Fuel Entries</h2>

                    <div className="mt-4 space-y-3">
                        {fuelEntries.length === 0 && (
                            <p className="text-sm text-slate-400">No fuel entries saved.</p>
                        )}

                        {fuelEntries.map((entry, index) => (
                            <div
                                key={index}
                                className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm"
                            >
                                <p>Date: {entry.date}</p>
                                <p>Odometer: {entry.odometer}</p>
                                <p>Gallons: {entry.gallons}</p>
                                <p>Price/Gal: {entry.pricePerGallon}</p>
                            </div>
                        ))}
                    </div>
                </section>

            </div>
        </main>
    );
}