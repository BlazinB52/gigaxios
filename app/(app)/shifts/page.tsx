"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import ActiveShiftCard from "@/app/components/ActiveShiftCard";
import { SavedShift } from "@/app/lib/types";
import { loadShiftsFromSupabase } from "@/app/lib/storage";
import { supabase } from "@/app/lib/supabaseClient";
import {
    SubscriptionAccessState,
    loadSubscriptionAccess,
} from "@/app/lib/subscriptionAccess";


export default function ShiftsPage() {
    const [platform, setPlatform] = useState(() => {
      if (typeof window !== "undefined") {
        return localStorage.getItem("gigaxios-default-platform") || "GoPuff";
      }
      return "GoPuff";
    });
    const [shiftDate, setShiftDate] = useState("");
    const [beginningMileage, setBeginningMileage] = useState("");
    const [endingMileage, setEndingMileage] = useState("");

    const [deliveries, setDeliveries] = useState("");
    const [hoursWorked, setHoursWorked] = useState("");
    const [basePay, setBasePay] = useState("");
    const [tips, setTips] = useState("");
    const [otherPay, setOtherPay] = useState("");

    const [savedShifts, setSavedShifts] = useState<SavedShift[]>([]);
    const [vehicles, setVehicles] = useState<Array<{
      id: string; year: string; make: string; model: string; is_primary: boolean;
    }>>([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState("");
    const [accessState, setAccessState] =
        useState<SubscriptionAccessState | null>(null);
    const [startingCheckout, setStartingCheckout] = useState(false);
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

            const access = await loadSubscriptionAccess({
                userId: user.id,
                userCreatedAt: user.created_at,
            });
            setAccessState(access);

            const { data: vehicleData } = await supabase
              .from("vehicles")
              .select("id, year, make, model, is_primary, status")
              .eq("user_id", user.id)
              .eq("status", "active")
              .order("is_primary", { ascending: false });

            const loadedVehicles = vehicleData || [];
            setVehicles(loadedVehicles);
            const primary = loadedVehicles.find((v) => v.is_primary) || loadedVehicles[0] || null;
            setSelectedVehicleId(primary?.id || "");
        }

        loadCloudShifts();
    }, [router]);

    const activeShift = savedShifts.find((shift) => shift.status === "open");
    const isSubscribed = accessState?.isSubscribed ?? false;
    const trialRequired = accessState?.trialRequired ?? false;

    async function handleStartTrial() {
        setStartingCheckout(true);
        try {
            const response = await fetch("/api/stripe/create-checkout-session", {
                method: "POST",
            });
            const data = await response.json();

            if (!response.ok || !data.url) {
                return;
            }

            window.location.href = data.url;
        } finally {
            setStartingCheckout(false);
        }
    }

    async function handleStartShift() {
        if (trialRequired) {
            return;
        }

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
            vehicle_id: selectedVehicleId || null,
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
        router.push("/dashboard");
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

        if (isSubscribed) {
            sessionStorage.removeItem("gigaxios_shift_ended");
        } else {
            sessionStorage.setItem("gigaxios_shift_ended", "1");
        }
        router.push("/dashboard");
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

                {trialRequired && !activeShift && (
                    <section className="mb-5 rounded-3xl border border-blue-500/30 bg-blue-950/30 p-5">
                        <h2 className="text-lg font-bold">Start your free trial to continue</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                            Your free GigAxios preview has ended.
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                            Start your 7-day free trial to continue adding shifts and fuel entries.
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

                {!activeShift && (
                    <section className="rounded-3xl border border-slate-700/70 bg-slate-950/70 p-5">
                        <h2 className="text-lg font-bold">Start Shift</h2>
                        <p className="mt-1 text-sm text-slate-400">
                            Enter your beginning mileage before you start driving.
                        </p>

                        <div className="mt-5 space-y-3">
                            {vehicles.length > 1 && (
                              <div>
                                <label className="text-sm text-slate-400">Vehicle</label>
                                <select
                                  value={selectedVehicleId}
                                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                                >
                                  {vehicles.map((v) => (
                                    <option key={v.id} value={v.id}>
                                      {v.year} {v.make} {v.model}{v.is_primary ? " (Primary)" : ""}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
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
                            <div>
                                <label htmlFor="shift-date" className="text-sm text-slate-400">
                                    Shift Date
                                </label>
                                <div className="relative mt-1">
                                    <input
                                        id="shift-date"
                                        type="date"
                                        value={shiftDate}
                                        onChange={(event) => setShiftDate(event.target.value)}
                                        className="h-12 min-h-12 w-full appearance-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-0 pr-11 text-base leading-none text-white [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                                        style={{ WebkitAppearance: "none" }}
                                    />
                                    <Calendar className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white" />
                                </div>
                            </div>

                            <input
                                type="number"
                                value={beginningMileage}
                                onChange={(event) => setBeginningMileage(event.target.value)}
                                placeholder="Beginning Mileage"
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                            />

                            <button
                                onClick={handleStartShift}
                                disabled={trialRequired}
                                className="w-full rounded-xl bg-emerald-500/90 p-3 font-bold text-white shadow-lg shadow-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
                            >
                                {trialRequired ? "Start Trial to Continue" : "Start Shift"}
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
