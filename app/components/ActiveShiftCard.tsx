import { SavedShift } from "@/app/lib/types";
import { ImportDayImageKind } from "@/app/lib/importDayTypes";

type OcrButtonState = {
    ocrStatus: "idle" | "preparing" | "reading" | "done" | "failed";
    error: string;
    warning: string;
};

type ActiveShiftCardProps = {
    activeShift: SavedShift | undefined;
    startTime?: string;

    endingMileage: string;
    setEndingMileage: (value: string) => void;
    endTime: string;
    setEndTime: (value: string) => void;
    allowEndMileageException: boolean;
    setAllowEndMileageException: (value: boolean) => void;
    endMileageExceptionReason: string;
    setEndMileageExceptionReason: (value: string) => void;
    showEndMileageException: boolean;
    onEndingMileageChange: () => void;

    deliveries: string;
    setDeliveries: (value: string) => void;

    calculatedHoursWorked: string;

    basePay: string;
    setBasePay: (value: string) => void;

    tips: string;
    setTips: (value: string) => void;

    otherPay: string;
    setOtherPay: (value: string) => void;

    grossPay: string;
    setGrossPay: (value: string) => void;

    deductionType: string;
    setDeductionType: (value: string) => void;

    deductionAmount: string;
    setDeductionAmount: (value: string) => void;

    deductionNotes: string;
    setDeductionNotes: (value: string) => void;

    notes: string;
    setNotes: (value: string) => void;

    ocrUploads: Record<ImportDayImageKind, OcrButtonState>;
    onScan: (kind: ImportDayImageKind) => void;
    trialRequired: boolean;

    onEndShift: () => void;
    onCancelOpenShift: () => void;
};

export default function ActiveShiftCard({
    activeShift,
    startTime,
    endingMileage,
    setEndingMileage,
    endTime,
    setEndTime,
    allowEndMileageException,
    setAllowEndMileageException,
    endMileageExceptionReason,
    setEndMileageExceptionReason,
    showEndMileageException,
    onEndingMileageChange,
    deliveries,
    setDeliveries,
    calculatedHoursWorked,
    basePay,
    setBasePay,
    tips,
    setTips,
    otherPay,
    setOtherPay,
    grossPay,
    setGrossPay,
    deductionType,
    setDeductionType,
    deductionAmount,
    setDeductionAmount,
    deductionNotes,
    setDeductionNotes,
    notes,
    setNotes,
    ocrUploads,
    onScan,
    trialRequired,
    onEndShift,
    onCancelOpenShift,
}: ActiveShiftCardProps) {
    if (!activeShift) return null;

    const endingMileageOcr = ocrUploads.end_odometer;
    const earningsOcr = ocrUploads.earnings;
    const endingMileageScanBusy =
        endingMileageOcr.ocrStatus === "preparing" ||
        endingMileageOcr.ocrStatus === "reading";
    const earningsScanBusy =
        earningsOcr.ocrStatus === "preparing" ||
        earningsOcr.ocrStatus === "reading";

    return (
        <section className="mb-5 rounded-3xl border border-emerald-500/20 bg-slate-950/70 p-5">
            <h2 className="text-lg font-bold text-emerald-300">Finish Shift</h2>

            <div className="mt-3 space-y-1 text-sm text-slate-400">
                <p>Platform: {activeShift.platform}</p>
                <p>Date: {activeShift.date}</p>
                {startTime && <p>Start Time: {startTime}</p>}
                <p>Starting Mileage: {activeShift.beginningMileage}</p>
            </div>

            <div className="mt-5 space-y-3">

                <div>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            value={endingMileage}
                            onChange={(event) => {
                                setEndingMileage(event.target.value);
                                onEndingMileageChange();
                            }}
                            placeholder="Ending Mileage"
                            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                        />
                        <button
                            type="button"
                            onClick={() => onScan("end_odometer")}
                            disabled={trialRequired || endingMileageScanBusy}
                            className="shrink-0 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 text-sm font-bold text-blue-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
                        >
                            {endingMileageOcr.ocrStatus === "reading" ? "Reading..." : "Scan"}
                        </button>
                    </div>
                    {(endingMileageOcr.error || endingMileageOcr.warning || endingMileageOcr.ocrStatus === "done") && (
                        <p className={`mt-2 rounded-xl border px-3 py-2 text-xs leading-5 ${
                            endingMileageOcr.error
                                ? "border-red-400/30 bg-red-950/20 text-red-100"
                                : endingMileageOcr.warning
                                    ? "border-amber-400/30 bg-amber-950/20 text-amber-100"
                                    : "border-emerald-400/30 bg-emerald-950/20 text-emerald-100"
                        }`}>
                            {endingMileageOcr.error || endingMileageOcr.warning || "Ending mileage scan applied."}
                        </p>
                    )}
                </div>

                <input
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    aria-label="End Time"
                    className="h-12 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-white [color-scheme:dark]"
                />

                {showEndMileageException && (
                    <div className="rounded-2xl border border-amber-400/30 bg-amber-950/20 p-4">
                        <p className="text-sm leading-6 text-amber-100">
                            This mileage appears to be lower than an existing entry. Only continue if you are backfilling or correcting older data.
                        </p>
                        <label className="mt-3 flex items-center gap-3 text-sm font-semibold text-white">
                            <input
                                type="checkbox"
                                checked={allowEndMileageException}
                                onChange={(event) => setAllowEndMileageException(event.target.checked)}
                                className="h-4 w-4 accent-blue-500"
                            />
                            Allow mileage exception
                        </label>
                        {allowEndMileageException && (
                            <textarea
                                value={endMileageExceptionReason}
                                onChange={(event) => setEndMileageExceptionReason(event.target.value)}
                                placeholder="Reason for exception"
                                className="mt-3 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                            />
                        )}
                    </div>
                )}

                <input
                    type="number"
                    value={deliveries}
                    onChange={(event) => setDeliveries(event.target.value)}
                    placeholder="Deliveries"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                />

                <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                    <p className="text-sm text-slate-400">Hours Worked</p>
                    <p className="mt-1 text-2xl font-bold text-white">
                        {calculatedHoursWorked || "Pending end time"}
                    </p>
                </div>

                <input
                    type="number"
                    value={basePay}
                    onChange={(event) => setBasePay(event.target.value)}
                    placeholder="Base Pay"
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
                    value={otherPay}
                    onChange={(event) => setOtherPay(event.target.value)}
                    placeholder="Other Pay"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                />

                <button
                    type="button"
                    onClick={() => onScan("earnings")}
                    disabled={trialRequired || earningsScanBusy}
                    className="w-full rounded-xl border border-blue-500/40 bg-blue-500/10 p-3 font-bold text-blue-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
                >
                    {earningsOcr.ocrStatus === "reading" ? "Reading Earnings..." : "Scan Daily Earnings"}
                </button>
                {(earningsOcr.error || earningsOcr.warning || earningsOcr.ocrStatus === "done") && (
                    <p className={`rounded-xl border px-3 py-2 text-xs leading-5 ${
                        earningsOcr.error
                            ? "border-red-400/30 bg-red-950/20 text-red-100"
                            : earningsOcr.warning
                                ? "border-amber-400/30 bg-amber-950/20 text-amber-100"
                                : "border-emerald-400/30 bg-emerald-950/20 text-emerald-100"
                    }`}>
                        {earningsOcr.error || earningsOcr.warning || "Earnings scan applied. Review the populated fields before saving."}
                    </p>
                )}

                <input
                    type="number"
                    step="0.01"
                    value={grossPay}
                    onChange={(event) => setGrossPay(event.target.value)}
                    placeholder="Gross Pay"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                />

                <details
                    open={Boolean(deductionType || deductionAmount || deductionNotes)}
                    className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                >
                    <summary className="cursor-pointer text-sm font-bold text-slate-200">
                        Fees & Deductions
                    </summary>
                    <div className="mt-4 space-y-3">
                        <input
                            type="text"
                            value={deductionType}
                            onChange={(event) => setDeductionType(event.target.value)}
                            placeholder="Fee/Deduction Type"
                            className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                        />
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={deductionAmount}
                            onChange={(event) => setDeductionAmount(event.target.value)}
                            placeholder="Amount"
                            className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                        />
                        <input
                            type="text"
                            value={deductionNotes}
                            onChange={(event) => setDeductionNotes(event.target.value)}
                            placeholder="Deduction Notes"
                            className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                        />
                    </div>
                </details>

                <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Notes"
                    className="min-h-24 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                />
                
                <div className="rounded-2xl border border-emerald-500/20 bg-slate-900 p-4">
                    <p className="text-sm text-slate-400">Total Shift Pay</p>

                    <p className="mt-1 text-3xl font-bold text-emerald-300">
                        $
                        {(Number(grossPay || 0) || (
                            Number(basePay || 0) +
                            Number(tips || 0) +
                            Number(otherPay || 0)
                        )).toFixed(2)}
                    </p>
                </div>

                <button
                    onClick={onEndShift}
                    className="w-full rounded-xl bg-blue-500 p-3 font-bold text-white"
                >
                    Save Completed Shift
                </button>
                <button
                    type="button"
                    onClick={onCancelOpenShift}
                    className="w-full rounded-xl border border-red-500/40 bg-red-950/30 p-3 font-bold text-red-100"
                >
                    Cancel Open Shift
                </button>
                <button
                    type="button"
                    onClick={() => window.location.href = "/dashboard"}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 font-bold text-slate-300"
                >
                    Back to Dashboard
                </button>
            </div>
        </section>
    );
}
