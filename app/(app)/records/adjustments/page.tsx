"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { PayAdjustment, AdjustmentType } from "@/app/lib/types";
import {
  SubscriptionAccessState,
  loadSubscriptionAccess,
} from "@/app/lib/subscriptionAccess";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(val: number) {
  return val.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const ADJUSTMENT_LABELS: Record<AdjustmentType, string> = {
  mga: "Minimum Guarantee",
  delayed_tip: "Delayed Tip Payout",
  bonus: "Bonus",
  correction: "Correction",
  reimbursement: "Reimbursement",
  promo: "Promo",
  overtime: "Overtime",
};

const ADJUSTMENT_COLORS: Record<AdjustmentType, string> = {
  mga: "text-blue-400",
  delayed_tip: "text-emerald-400",
  bonus: "text-yellow-400",
  correction: "text-orange-400",
  reimbursement: "text-purple-400",
  promo: "text-pink-400",
  overtime: "text-cyan-400",
};

const PLATFORMS = ["GoPuff", "Amazon Flex", "Uber Eats", "DoorDash", "Other"];
const ADJUSTMENT_TYPES: AdjustmentType[] = [
  "mga",
  "delayed_tip",
  "bonus",
  "correction",
  "reimbursement",
  "promo",
  "overtime",
];

// ─── Inner Component (uses useSearchParams) ───────────────────────────────────

function AdjustmentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const weekStart = searchParams.get("week") || "";

  const [adjustments, setAdjustments] = useState<PayAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [accessState, setAccessState] =
    useState<SubscriptionAccessState | null>(null);
  const [startingCheckout, setStartingCheckout] = useState(false);

  const weekEnd = (() => {
    if (!weekStart) return "";
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const [showAddForm, setShowAddForm] = useState(false);
  const [addPlatform, setAddPlatform] = useState("GoPuff");
  const [addType, setAddType] = useState<AdjustmentType>("mga");
  const [addAmount, setAddAmount] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPlatform, setEditPlatform] = useState("");
  const [editType, setEditType] = useState<AdjustmentType>("mga");
  const [editAmount, setEditAmount] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // ─── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const access = await loadSubscriptionAccess({
        userId: user.id,
        userCreatedAt: user.created_at,
      });
      setAccessState(access);

      const { data, error } = await supabase
        .from("pay_adjustments")
        .select("*")
        .eq("user_id", user.id)
        .eq("week_start", weekStart)
        .order("created_at", { ascending: false });

      if (error) { console.error(error); setLoading(false); return; }

      setAdjustments(
        (data || []).map((a) => ({
          id: a.id,
          userId: a.user_id,
          platform: a.platform,
          weekStart: a.week_start,
          weekEnd: a.week_end,
          adjustmentType: a.adjustment_type as AdjustmentType,
          amount: Number(a.amount),
          notes: a.notes,
          createdAt: a.created_at,
        }))
      );

      setLoading(false);
    }

    if (weekStart) load();
  }, [weekStart, router]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  async function handleAddAdjustment() {
    if (trialRequired) return;
    if (!userId || !addAmount || Number(addAmount) <= 0) return;
    setSaving(true);

    const { data, error } = await supabase
      .from("pay_adjustments")
      .insert({
        user_id: userId,
        platform: addPlatform,
        week_start: weekStart,
        week_end: weekEnd,
        adjustment_type: addType,
        amount: Number(addAmount),
        notes: addNotes || null,
      })
      .select()
      .single();

    if (error) { alert(error.message); setSaving(false); return; }

    const newAdj: PayAdjustment = {
      id: data.id,
      userId: data.user_id,
      platform: data.platform,
      weekStart: data.week_start,
      weekEnd: data.week_end,
      adjustmentType: data.adjustment_type as AdjustmentType,
      amount: Number(data.amount),
      notes: data.notes,
      createdAt: data.created_at,
    };

    setAdjustments((prev) => [newAdj, ...prev]);
    setAddAmount("");
    setAddNotes("");
    setAddType("mga");
    setAddPlatform("GoPuff");
    setShowAddForm(false);
    setSaving(false);
  }

  function openEdit(adj: PayAdjustment) {
    setEditingId(adj.id);
    setEditPlatform(adj.platform);
    setEditType(adj.adjustmentType);
    setEditAmount(adj.amount.toString());
    setEditNotes(adj.notes || "");
  }

  async function handleUpdateAdjustment(adj: PayAdjustment) {
    const { error } = await supabase
      .from("pay_adjustments")
      .update({
        platform: editPlatform,
        adjustment_type: editType,
        amount: Number(editAmount),
        notes: editNotes || null,
      })
      .eq("id", adj.id);

    if (error) { alert(error.message); return; }

    setAdjustments((prev) =>
      prev.map((a) =>
        a.id === adj.id
          ? { ...a, platform: editPlatform, adjustmentType: editType, amount: Number(editAmount), notes: editNotes }
          : a
      )
    );
    setEditingId(null);
  }

  async function handleDeleteAdjustment(id: string) {
    const confirmed = confirm("Delete this adjustment?");
    if (!confirmed) return;
    const { error } = await supabase.from("pay_adjustments").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setAdjustments((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleStartTrial() {
    setStartingCheckout(true);
    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok || !data.url) {
        alert(data.error || "Could not start checkout. Please try again.");
        return;
      }

      window.location.href = data.url;
    } catch {
      alert("Could not start checkout. Please try again.");
    } finally {
      setStartingCheckout(false);
    }
  }

  const totalAdjustments = adjustments.reduce((sum, a) => sum + a.amount, 0);
  const trialRequired = accessState?.trialRequired ?? false;

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
            <h1 className="text-2xl font-bold tracking-tight">Adjustments</h1>
            {weekStart && (
              <p className="text-sm text-slate-400">
                {formatDate(weekStart)} – {formatDate(weekEnd)}
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-blue-500" />
            <p className="text-sm">Loading adjustments…</p>
          </div>
        ) : (
          <>
            {/* ── Hero ── */}
            <section className="mt-5 rounded-3xl border border-slate-700/60 bg-slate-900/80 p-5 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/20">
                <span className="text-2xl">⚡</span>
              </div>
              <p className="text-sm text-slate-400">Total Adjustments</p>
              <p className="mt-1 text-4xl font-bold text-white">{formatCurrency(totalAdjustments)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {adjustments.length} adjustment{adjustments.length !== 1 ? "s" : ""} this pay period
              </p>
            </section>

            {trialRequired && (
              <section className="mt-4 rounded-3xl border border-blue-500/30 bg-blue-950/30 p-5">
                <h2 className="text-lg font-bold">Start your free trial to continue</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Your free GigAxios preview has ended.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Start your 7-day free trial to continue adding pay adjustments.
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

            {/* ── Adjustment List ── */}
            <section className="mt-4 space-y-3">
              {adjustments.length === 0 && !showAddForm && (
                <p className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-500">
                  No adjustments for this pay period yet.
                </p>
              )}

              {adjustments.map((adj) => {
                const isEditing = editingId === adj.id;
                const color = ADJUSTMENT_COLORS[adj.adjustmentType] || "text-white";
                const label = ADJUSTMENT_LABELS[adj.adjustmentType] || adj.adjustmentType;

                return (
                  <div key={adj.id} className="rounded-3xl border border-slate-700/60 bg-slate-900/80 p-5">
                    {isEditing ? (
                      <div className="space-y-3">
                        <p className="font-bold text-blue-300">Edit Adjustment</p>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-400">Platform</label>
                          <select
                            value={editPlatform}
                            onChange={(e) => setEditPlatform(e.target.value)}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                          >
                            {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-400">Type</label>
                          <select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value as AdjustmentType)}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                          >
                            {ADJUSTMENT_TYPES.map((t) => (
                              <option key={t} value={t}>{ADJUSTMENT_LABELS[t]}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-400">Amount</label>
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-400">Notes</label>
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Reason or details…"
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white placeholder:text-slate-600"
                          />
                        </div>

                        <button
                          onClick={() => handleUpdateAdjustment(adj)}
                          className="w-full rounded-xl bg-emerald-500 p-3 font-bold text-white active:bg-emerald-600"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="w-full rounded-xl border border-slate-700 p-3 font-bold text-slate-300"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDeleteAdjustment(adj.id)}
                          className="w-full rounded-xl border border-red-500/40 bg-red-950/40 p-3 font-bold text-red-300"
                        >
                          Delete Adjustment
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className={`font-semibold ${color}`}>{label}</p>
                            <p className="text-xs text-slate-500">{adj.platform}</p>
                            {adj.notes && (
                              <p className="mt-1 text-xs text-slate-400">{adj.notes}</p>
                            )}
                            <p className="mt-1 text-xs text-slate-600">
                              Applies to {formatDate(adj.weekStart)} – {formatDate(adj.weekEnd)}
                            </p>
                          </div>
                          <p className={`text-lg font-bold ${color}`}>
                            {formatCurrency(adj.amount)}
                          </p>
                        </div>

                        <button
                          onClick={() => openEdit(adj)}
                          className="mt-4 w-full rounded-xl border border-slate-700 p-2.5 text-sm font-semibold text-slate-300 active:bg-slate-800"
                        >
                          Edit
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </section>

            {/* ── Add Adjustment Form ── */}
            {showAddForm && (
              <section className="mt-4 rounded-3xl border border-blue-500/30 bg-slate-900/80 p-5">
                <p className="mb-4 font-bold text-blue-300">Add Adjustment</p>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">Platform</label>
                    <select
                      value={addPlatform}
                      onChange={(e) => setAddPlatform(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                    >
                      {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">Type</label>
                    <select
                      value={addType}
                      onChange={(e) => setAddType(e.target.value as AdjustmentType)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                    >
                      {ADJUSTMENT_TYPES.map((t) => (
                        <option key={t} value={t}>{ADJUSTMENT_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <input
                        type="number"
                        value={addAmount}
                        onChange={(e) => setAddAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 pl-7 text-white placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">Notes (optional)</label>
                    <input
                      type="text"
                      value={addNotes}
                      onChange={(e) => setAddNotes(e.target.value)}
                      placeholder="Reason or details…"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white placeholder:text-slate-600"
                    />
                  </div>

                  <button
                    onClick={handleAddAdjustment}
                    disabled={saving || !addAmount || Number(addAmount) <= 0}
                    className="w-full rounded-xl bg-blue-500 p-3 font-bold text-white disabled:opacity-40 active:bg-blue-600"
                  >
                    {saving ? "Saving…" : "Save Adjustment"}
                  </button>

                  <button
                    onClick={() => setShowAddForm(false)}
                    className="w-full rounded-xl border border-slate-700 p-3 font-bold text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </section>
            )}

            {/* ── Add Button ── */}
            {!showAddForm && (
              <button
                onClick={() => {
                  if (trialRequired) return;
                  setShowAddForm(true);
                }}
                disabled={trialRequired}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-500/40 bg-blue-500/10 p-4 font-semibold text-blue-300 active:bg-blue-500/20 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900/60 disabled:text-slate-500"
              >
                <span className="text-lg">+</span> {trialRequired ? "Start Trial to Add Adjustment" : "Add Adjustment"}
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// ─── Page Export (Suspense wrapper) ──────────────────────────────────────────

export default function AdjustmentsPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#020814] text-white">
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-blue-500" />
        </div>
      </main>
    }>
      <AdjustmentsContent />
    </Suspense>
  );
}
