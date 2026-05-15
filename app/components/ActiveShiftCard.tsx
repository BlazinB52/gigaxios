import { SavedShift } from "@/app/lib/types";

type ActiveShiftCardProps = {
    activeShift: SavedShift | undefined;

    endingMileage: string;
    setEndingMileage: (value: string) => void;

    deliveries: string;
    setDeliveries: (value: string) => void;

    hoursWorked: string;
    setHoursWorked: (value: string) => void;

    basePay: string;
    setBasePay: (value: string) => void;

    tips: string;
    setTips: (value: string) => void;

    otherPay: string;
    setOtherPay: (value: string) => void;

    onEndShift: () => void;
};

export default function ActiveShiftCard({
    activeShift,
    endingMileage,
    setEndingMileage,
    deliveries,
    setDeliveries,
    hoursWorked,
    setHoursWorked,
    basePay,
    setBasePay,
    tips,
    setTips,
    otherPay,
    setOtherPay,
    onEndShift,
}: ActiveShiftCardProps) {
    if (!activeShift) return null;

    return (
        <section className="mb-5 rounded-3xl border border-emerald-500/20 bg-slate-950/70 p-5">
            <h2 className="text-lg font-bold text-emerald-300">Active Shift</h2>

            <div className="mt-3 space-y-1 text-sm text-slate-400">
                <p>Date: {activeShift.date}</p>
                <p>Starting Mileage: {activeShift.beginningMileage}</p>
            </div>

            <div className="mt-5 space-y-3">

                <input
                    type="number"
                    value={endingMileage}
                    onChange={(event) => setEndingMileage(event.target.value)}
                    placeholder="Ending Mileage"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                />

                <input
                    type="number"
                    value={deliveries}
                    onChange={(event) => setDeliveries(event.target.value)}
                    placeholder="Deliveries"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                />

                <input
                    type="number"
                    value={hoursWorked}
                    onChange={(event) => setHoursWorked(event.target.value)}
                    placeholder="Hours Worked"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                />

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
                
                <div className="rounded-2xl border border-emerald-500/20 bg-slate-900 p-4">
                    <p className="text-sm text-slate-400">Total Shift Pay</p>

                    <p className="mt-1 text-3xl font-bold text-emerald-300">
                        $
                        {(
                            Number(basePay || 0) +
                            Number(tips || 0) +
                            Number(otherPay || 0)
                        ).toFixed(2)}
                    </p>
                </div>

                <button
                    onClick={onEndShift}
                    className="w-full rounded-xl bg-blue-500 p-3 font-bold text-white"
                >
                    End Shift
                </button>
                <button
                    type="button"
                    onClick={() => window.location.href = "/"}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 font-bold text-slate-300"
                >
                    Cancel
                </button>
            </div>
        </section>
    );
}