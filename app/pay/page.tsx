"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { useEffect, useState } from "react";
import BottomNav from "@/app/components/BottomNav";
import {
  PayEntry,
  loadPayEntriesFromSupabase,
  savePayEntryToSupabase,
} from "@/app/lib/payStorage";
import { SavedShift } from "@/app/lib/types";
import { loadShiftsFromSupabase } from "@/app/lib/storage";


export default function PayPage() {

  const [date, setDate] = useState("");
  const [platform, setPlatform] = useState("GoPuff");
  const [entryType, setEntryType] =
  useState<"shift" | "mga" | "delayed_tip" | "bonus" | "correction">("shift");
  const [payPeriodStart, setPayPeriodStart] = useState("");
  const [payPeriodEnd, setPayPeriodEnd] = useState("");
  const [deliveries, setDeliveries] = useState("");
  const [hours, setHours] = useState("");
  const [basePay, setBasePay] = useState("");
  const [tips, setTips] = useState("");
  const [adjustments, setAdjustments] = useState("");
  const [notes, setNotes] = useState("");
  const [payEntries, setPayEntries] = useState<PayEntry[]>([]);
  const [savedShifts, setSavedShifts] = useState<SavedShift[]>([]);
  const router = useRouter();

  /* This gives the Pay page access to completed shift records */

  useEffect(() => {
    async function loadCloudData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const entries = await loadPayEntriesFromSupabase(user.id);
      setPayEntries(entries);

      const shifts = await loadShiftsFromSupabase(user.id);
      setSavedShifts(shifts);
    }

    loadCloudData();
  }, [router]);



  async function handleSavePay() {
    if (!date) {
      alert("Enter a date.");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    // =========================================================
    // NEW PAY ENTRY
    // =========================================================

    const grossPay =
      entryType === "shift"
        ? (
          Number(basePay || 0) +
          Number(tips || 0) +
          Number(adjustments || 0)
        ).toFixed(2)
        : Number(adjustments || 0).toFixed(2);

    const newEntry = {
      id: crypto.randomUUID(),
      userId: user.id,
      date,
      platform,
      entryType,
      payPeriodStart,
      payPeriodEnd,
      deliveries: entryType === "shift" ? deliveries : "",
      hours: entryType === "shift" ? hours : "",
      basePay: entryType === "shift" ? basePay : "",
      tips: entryType === "shift" ? tips : "",
      adjustments,
      grossPay,
      notes,
    };

    // =========================================================
    // MATCH CLOSED SHIFT BY DATE
    // =========================================================

    const matchingShift =
      entryType === "shift"
        ? savedShifts.find(
          (shift) =>
            shift.date === date &&
            shift.status === "closed"
        )
        : undefined;



    const updatedEntries = [newEntry, ...payEntries];

    // =========================================================
    // UPDATE MATCHING SHIFT WITH PAY DATA
    // =========================================================

    const updatedShifts = savedShifts.map((shift) => {
      if (matchingShift && shift.id === matchingShift.id) {
        return {
          ...shift,
          platform,
          deliveries,
          hoursWorked: hours,
          basePay,
          tips,
          otherPay: adjustments,
          gross_pay: (
            Number(basePay || 0) +
            Number(tips || 0) +
            Number(adjustments || 0)
          ).toFixed(2),
        };
      }

      return shift;
    });

    await savePayEntryToSupabase(newEntry);

    if (matchingShift) {
      await supabase
        .from("shifts")
        .update({
          platform,
          deliveries,
          hours_worked: hours,
          base_pay: basePay,
          tips,
          other_pay: adjustments,
          gross_pay: (
            Number(basePay || 0) +
            Number(tips || 0) +
            Number(adjustments || 0)
          ).toFixed(2),
        })
        .eq("id", matchingShift.id);
    }

    setSavedShifts(updatedShifts);
    setPayEntries(updatedEntries);

    router.push("/");
  }

  return (
    <main className="min-h-screen bg-[#020814] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-24 pt-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Pay</h1>
          <p className="mt-1 text-sm text-slate-400">
            Enter daily income after it appears in your work app.
          </p>
        </div>

        <section className="rounded-3xl border border-slate-700/70 bg-slate-950/70 p-5">
          <h2 className="text-lg font-bold">Add Pay Entry</h2>

          <div className="mt-5 space-y-3">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
            />

            <select
              value={entryType}
              onChange={(event) =>
                setEntryType(
  event.target.value as "shift" | "mga" | "delayed_tip" | "bonus" | "correction"
)
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
            >
              <option value="shift">Shift Pay</option>
              <option value="mga">MGA</option>
              <option value="delayed_tip">Delayed Tip</option>
              <option value="bonus">Bonus</option>
              <option value="correction">Correction</option>
            </select>
            {entryType !== "shift" && (
              <>
                <div>
                  <p className="mb-1 text-sm text-slate-400">
                    Pay Period Start
                  </p>

                  <input
                    type="date"
                    value={payPeriodStart}
                    onChange={(event) => setPayPeriodStart(event.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
                  />
                </div>

                <div>
                  <p className="mb-1 text-sm text-slate-400">
                    Pay Period End
                  </p>

                  <input
                    type="date"
                    value={payPeriodEnd}
                    onChange={(event) => setPayPeriodEnd(event.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
                  />
                </div>
              </>
            )}

            {entryType === "shift" && (
              <>

                <select

                  value={platform}
                  onChange={(event) => setPlatform(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
                >
                  <option value="GoPuff">GoPuff</option>
                  <option value="Amazon Flex">Amazon Flex</option>
                  <option value="Other">Other</option>
                </select>

                <input
                  type="number"
                  value={deliveries}
                  onChange={(event) => setDeliveries(event.target.value)}
                  placeholder="Deliveries"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                />

                <input
                  type="number"
                  value={hours}
                  onChange={(event) => setHours(event.target.value)}
                  placeholder="Hours"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                />

                <input
                  type="number"
                  value={basePay}
                  onChange={(event) => setBasePay(event.target.value)}
                  placeholder="Base pay"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                />


                <input
                  type="number"
                  value={tips}
                  onChange={(event) => setTips(event.target.value)}
                  placeholder="Tips"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                />

              </>
            )}

            <input
              type="number"
              value={adjustments}
              onChange={(event) => setAdjustments(event.target.value)}
              placeholder={
                entryType === "shift"
                  ? "Adjustments"
                  : "Amount"
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
            />

            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notes"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
            />

            <button
              onClick={handleSavePay}
              className="w-full rounded-xl bg-blue-600/90 p-3 font-bold text-white shadow-lg shadow-blue-500/20"
            >
              Save Pay Entry
            </button>
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}