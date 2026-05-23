"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ActiveShiftCard from "@/app/components/ActiveShiftCard";
import { SavedShift } from "@/app/lib/types";
import { loadShiftsFromSupabase } from "@/app/lib/storage";
import { supabase } from "@/app/lib/supabaseClient";


export default function ShiftsPage() {
    const [platform, setPlatform] = useState("GoPuff");
    const [shiftDate, setShiftDate] = useState("");
    const [beginningMileage, setBeginningMileage] = useState("");
    const [endingMileage, setEndingMileage] = useState("");

    const [deliveries, setDeliveries] = useState("");
    const [hoursWorked, setHoursWorked] = useState("");
    const [basePay, setBasePay] = useState("");
    const [tips, setTips] = useState("");
    const [otherPay, setOtherPay] = useState("");

    const [savedShifts, setSavedShifts] = useState<SavedShift[]>([]);
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
        }

        loadCloudShifts();
    }, [router]);

    const activeShift = savedShifts.find((shift) => shift.status === "open");

    async function handleStartShift() {
        if (!shiftDate || !beginningMileage) {
            alert("Enter a date and beginning mileage.");
            return;
        }

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            router.push("/login");
            return;
        }

        const existingShifts = await loadShiftsFromSupabase(user.id);

        const openShiftExists = existingShifts.some(
            (shift) => shift.status === "open"
        );




        if (openShiftExists) {
            alert("Finish your current shift first.");
            return;
        }


        // New Shift Block

        const newShift: SavedShift = {
            id: crypto.randomUUID(),
            userId: user.id,
            platform,
            date: shiftDate,
            beginningMileage,
            endingMileage: "",
            deliveries: "",
            hoursWorked: "",
            basePay: "",
            tips: "",
            otherPay: "",
            grossPay: "",
            status: "open",
        };

        setSavedShifts([...existingShifts, newShift]);
        setShiftDate("");
        setBeginningMileage("");

        await supabase.from("shifts").insert({
            id: newShift.id,
            user_id: user.id,
            date: newShift.date,
            platform: newShift.platform ?? null,
            beginning_mileage: newShift.beginningMileage,
            ending_mileage: newShift.endingMileage,
            deliveries: newShift.deliveries ?? null,
            hours_worked: newShift.hoursWorked ?? null,
            base_pay: newShift.basePay ?? null,
            tips: newShift.tips ?? null,
            other_pay: newShift.otherPay ?? null,
            gross_pay: newShift.grossPay ?? null,
            status: newShift.status,
            notes: null,
        });
        router.push("/");
    }

    async function handleEndShift() {
        if (!activeShift) return;

        if (!endingMileage) {
            alert("Ending mileage is required.");
            return;
        }

        const calculatedGrossPay =
            Number(basePay || 0) + Number(tips || 0) + Number(otherPay || 0);

        const updatedShifts = savedShifts.map((shift) => {
            if (shift.id === activeShift.id) {
                return {
                    ...shift,
                    endingMileage,
                    deliveries,
                    hoursWorked,
                    basePay,
                    tips,
                    otherPay,
                    grossPay: calculatedGrossPay.toFixed(2),
                    status: "closed" as const,
                };
            }

            return shift;
        });


        setSavedShifts(updatedShifts);

        setEndingMileage("");
        setDeliveries("");
        setHoursWorked("");
        setBasePay("");
        setTips("");
        setOtherPay("");

        await supabase
            .from("shifts")
            .update({
                ending_mileage: endingMileage,
                deliveries,
                hours_worked: hoursWorked,
                base_pay: basePay,
                tips,
                other_pay: otherPay,
                gross_pay: calculatedGrossPay.toFixed(2),
                status: "closed",
            })
            .eq("id", activeShift.id);

        router.push("/");
    }
    return (
        <main className="min-h-screen bg-[#020814] text-white">
            <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-24 pt-8">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold tracking-tight">Shifts</h1>
                    <p className="mt-1 text-sm text-slate-400">
                        Start and manage work shifts
                    </p>
                </div>

                <ActiveShiftCard
                    activeShift={activeShift}
                    endingMileage={endingMileage}
                    setEndingMileage={setEndingMileage}
                    deliveries={deliveries}
                    setDeliveries={setDeliveries}
                    hoursWorked={hoursWorked}
                    setHoursWorked={setHoursWorked}
                    basePay={basePay}
                    setBasePay={setBasePay}
                    tips={tips}
                    setTips={setTips}
                    otherPay={otherPay}
                    setOtherPay={setOtherPay}
                    onEndShift={handleEndShift}
                />

                {!activeShift && (
                    <section className="rounded-3xl border border-slate-700/70 bg-slate-950/70 p-5">
                        <h2 className="text-lg font-bold">Start Shift</h2>
                        <p className="mt-1 text-sm text-slate-400">
                            Enter your beginning mileage before you start driving.
                        </p>

                        <div className="mt-5 space-y-3">
                            <select
                                value={platform}
                                onChange={(event) => setPlatform(event.target.value)}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
                            >
                                <option value="GoPuff">GoPuff</option>
                                <option value="Amazon Flex">Amazon Flex</option>
                                <option value="Uber Eats">Uber Eats</option>
                                <option value="DoorDash">DoorDash</option>
                                <option value="Other">Other</option>
                            </select>
                            <input
                                type="date"
                                value={shiftDate}
                                onChange={(event) => setShiftDate(event.target.value)}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white [&::-webkit-calendar-picker-indicator]:invert"
                            />

                            <input
                                type="number"
                                value={beginningMileage}
                                onChange={(event) => setBeginningMileage(event.target.value)}
                                placeholder="Beginning Mileage"
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                            />

                            <button
                                onClick={handleStartShift}
                                className="w-full rounded-xl bg-emerald-500/90 p-3 font-bold text-white shadow-lg shadow-emerald-500/20"
                            >
                                Start Shift
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push("/")}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 font-bold text-slate-300"
                            >
                                Cancel
                            </button>
                        </div>
                    </section>
                )}
            </div>


        </main>
    );
}