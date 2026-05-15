export type ShiftRecord = {
  id: string;
  date: string;
  platform: "GoPuff" | "Amazon Flex" | "Other";
  beginningMileage: number;
  endingMileage: number | null;
  status: "open" | "closed";
  createdAt: string;
  updatedAt: string;
};

export type FuelRecord = {
  id: string;
  date: string;
  odometer: number;
  gallons: number;
  pricePerGallon: number;
  totalCost: number;
  createdAt: string;
  updatedAt: string;
};

export type WeeklyPayRecord = {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  platform: "GoPuff" | "Amazon Flex" | "Other";
  basePay: number;
  tips: number;
  adjustments: number;
  totalPay: number;
  createdAt: string;
  updatedAt: string;
};

export type VehicleExpenseRecord = {
  id: string;
  date: string;
  category:
    | "Maintenance"
    | "Repair"
    | "Oil Change"
    | "Tires"
    | "Insurance"
    | "Car Payment"
    | "Registration"
    | "Other";
  description: string;
  odometer: number | null;
  amount: number;
  createdAt: string;
  updatedAt: string;
};

export const STORAGE_KEYS = {
  shifts: "gigaxios-shifts",
  fuel: "gigaxios-fuel-records",
  weeklyPay: "gigaxios-weekly-pay",
  vehicleExpenses: "gigaxios-vehicle-expenses",
} as const;

export function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export function nowString() {
  return new Date().toISOString();
}