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

    const calculatedGrossPay =
      Number(basePay || 0) + Number(tips || 0) + Number(adjustments || 0);

    const newEntry: PayEntry = {
      id: crypto.randomUUID(),
      userId: user.id,
      date,
      platform,
      deliveries,
      hours,
      basePay,
      tips,
      adjustments,
      grossPay: calculatedGrossPay.toFixed(2),
      notes,
    };

    // =========================================================
    // MATCH CLOSED SHIFT BY DATE
    // =========================================================

    const matchingShift = savedShifts.find(
      (shift) =>
        shift.date === date &&
        shift.status === "closed"
    );



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
          grossPay: calculatedGrossPay.toFixed(2),
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
      gross_pay: calculatedGrossPay.toFixed(2),
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

            <input
              type="number"
              value={adjustments}
              onChange={(event) => setAdjustments(event.target.value)}
              placeholder="Adjustments"
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