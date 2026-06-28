export type ShiftRecord = {
  id: string;
  date: string;
  platform: "GoPuff" | "Amazon Flex" | "Uber Eats" | "DoorDash" | "Shipt" | "Veho" | "Other";
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
  platform: "GoPuff" | "Amazon Flex" | "Uber Eats" | "DoorDash" | "Shipt" | "Veho" | "Other";
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
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function nowString() {
  return new Date().toISOString();
}
