import { FuelEntry } from "@/app/lib/fuelStorage";

export type FuelCostResult = {
  workFuelCost: number;
  effectiveCostPerMile: number;
  isEstimated: boolean;
  needsMpg: boolean;
  source: "actual_history" | "vehicle_estimate" | "unavailable";
};

const RECENT_FUEL_HISTORY_LIMIT = 5;

function toNumber(value: string | number | undefined | null) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getFuelSortValue(entry: FuelEntry) {
  const odometer = toNumber(entry.odometer);
  if (odometer > 0) return odometer;

  const dateValue = new Date(`${entry.date}T12:00:00`).getTime();
  return Number.isFinite(dateValue) ? dateValue : 0;
}

export function getAverageFuelPricePerGallon(fuelEntries: FuelEntry[]) {
  const totalFuelSpend = fuelEntries.reduce(
    (total, entry) => total + toNumber(entry.totalCost),
    0
  );
  const totalGallons = fuelEntries.reduce(
    (total, entry) => total + toNumber(entry.gallons),
    0
  );

  return totalGallons > 0 ? totalFuelSpend / totalGallons : 0;
}

export function calculateWorkFuelCost({
  workMiles,
  fuelEntries,
  vehicleEstimatedMpg,
}: {
  workMiles: number;
  fuelEntries: FuelEntry[];
  vehicleEstimatedMpg?: number | null;
}): FuelCostResult {
  const validCostPerMileEntries = fuelEntries
    .filter((entry) => entry.costPerMile && entry.costPerMile > 0)
    .sort((a, b) => getFuelSortValue(b) - getFuelSortValue(a))
    .slice(0, RECENT_FUEL_HISTORY_LIMIT);

  if (validCostPerMileEntries.length > 0) {
    const effectiveCostPerMile =
      validCostPerMileEntries.reduce(
        (total, entry) => total + (entry.costPerMile ?? 0),
        0
      ) / validCostPerMileEntries.length;

    return {
      workFuelCost: Math.max(0, workMiles) * effectiveCostPerMile,
      effectiveCostPerMile,
      isEstimated: false,
      needsMpg: false,
      source: "actual_history",
    };
  }

  const averageFuelPricePerGallon = getAverageFuelPricePerGallon(fuelEntries);
  const mpg = toNumber(vehicleEstimatedMpg);

  if (averageFuelPricePerGallon > 0 && mpg > 0) {
    const effectiveCostPerMile = averageFuelPricePerGallon / mpg;

    return {
      workFuelCost: Math.max(0, workMiles) * effectiveCostPerMile,
      effectiveCostPerMile,
      isEstimated: true,
      needsMpg: false,
      source: "vehicle_estimate",
    };
  }

  return {
    workFuelCost: 0,
    effectiveCostPerMile: 0,
    isEstimated: false,
    needsMpg: true,
    source: "unavailable",
  };
}
