"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";

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
    const router = useRouter();

    useEffect(() => {
        async function loadAdminData() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }

            const { data: shifts, error: shiftsError } = await supabase
                .from("shifts")
                .select("*")
                .eq("userId", user.id)
                .order("date", { ascending: false });

            const { data: fuel, error: fuelError } = await supabase
                .from("fuel_entries")
                .select("*")
                .eq("userId", user.id)
                .order("date", { ascending: false });

            const { data: pay, error: payError } = await supabase
                .from("pay_entries")
                .select("*")
                .eq("userId", user.id)
                .order("date", { ascending: false });

            if (shiftsError || fuelError || payError) {
                setSupabaseStatus("Supabase error. Check console.");
                console.error({ shiftsError, fuelError, payError });
                return;
            }

            setSavedShifts(shifts || []);
            setFuelEntries(fuel || []);
            setPayEntries(pay || []);
            setSupabaseStatus("Supabase connected successfully.");
        }

        loadAdminData();
    }, [router]);

    async function handleExportBackup() {
        const { data: shifts, error: shiftsError } = await supabase
            .from("shifts")
            .select("*");

        const { data: fuelEntries, error: fuelError } = await supabase
            .from("fuel_entries")
            .select("*");

        const { data: payEntries, error: payError } = await supabase
            .from("pay_entries")
            .select("*");

        if (shiftsError || fuelError || payError) {
            alert("Could not export Supabase backup. Check console for details.");
            console.error({ shiftsError, fuelError, payError });
            return;
        }

        const backup = {
            exportedAt: new Date().toISOString(),
            source: "supabase",
            shifts: shifts ?? [],
            fuel_entries: fuelEntries ?? [],
            pay_entries: payEntries ?? [],
        };

        const hasData =
            backup.shifts.length > 0 ||
            backup.fuel_entries.length > 0 ||
            backup.pay_entries.length > 0;

        if (!hasData) {
            alert("No GigAxios Supabase data found to export yet.");
            return;
        }

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

    function handleDeletePayEntry(payId: string) {
        const confirmed = window.confirm(
            "Delete this pay entry? This cannot be undone."
        );

        if (!confirmed) return;

        const updatedPayEntries = payEntries.filter((entry) => entry.id !== payId);

        localStorage.setItem("gigaxios-pay", JSON.stringify(updatedPayEntries));
        setPayEntries(updatedPayEntries);

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
                                {(() => {
                                    const payForShift = payEntries.find(
                                        (entry) => entry.date === shift.date
                                    );

                                    return (
                                        <>
                                            <p>Date: {shift.date}</p>
                                            <p>Status: {shift.status}</p>
                                            <p>Beginning: {shift.beginningMileage}</p>
                                            <p>Ending: {shift.endingMileage || "-"}</p>

                                            <div className="mt-3 border-t border-slate-700 pt-3">
                                                <p>
                                                    Deliveries:{" "}
                                                    {payForShift?.deliveries || "Not entered"}
                                                </p>

                                                <p>
                                                    Base Pay:{" "}
                                                    {payForShift?.basePay
                                                        ? `$${payForShift.basePay}`
                                                        : "Not entered"}
                                                </p>

                                                <p>
                                                    Tips:{" "}
                                                    {payForShift?.tips
                                                        ? `$${payForShift.tips}`
                                                        : "Not entered"}
                                                </p>

                                                <p>
                                                    Total:{" "}
                                                    {payForShift?.grossPay
                                                        ? `$${payForShift.grossPay}`
                                                        : "Not entered"}
                                                </p>

                                                {payForShift && (
                                                    <button
                                                        onClick={() => handleDeletePayEntry(payForShift.id)}
                                                        className="mt-3 w-full rounded-xl bg-red-600 p-2 text-sm font-bold text-white"
                                                    >
                                                        Delete Pay Entry
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    );
                                })()}
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