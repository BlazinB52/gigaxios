import { SavedShift } from "@/app/lib/types";

type Props = {
  shifts: SavedShift[];
};

export default function RecentShiftsList({ shifts }: Props) {
  const recentClosedShifts = shifts
    .filter((shift) => shift.status === "closed")
    .slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 5);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold text-zinc-900">Recent shifts</h2>

      {recentClosedShifts.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">
          No completed shifts yet.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {recentClosedShifts.map((shift) => {
            const beginning = Number(shift.beginningMileage);
            const ending = Number(shift.endingMileage);
            const miles = ending - beginning;

            return (
              <div
                key={shift.id}
                className="rounded-xl border border-zinc-100 bg-zinc-50 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-900">
                      {shift.date || "No date"}
                    </p>
                    <p className="text-sm text-zinc-500">
                   {"Shift"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-zinc-900">{miles} mi</p>
                    <p className="text-xs text-zinc-500">work miles</p>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-zinc-600">
                  <p>Start: {shift.beginningMileage}</p>
                  <p>End: {shift.endingMileage}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}