export type ShiftStatus = "open" | "closed";


// ======================================================
// SavedShift
// Master record for one completed or open work shift
// One saved shift = mileage + work totals + pay totals
// ======================================================

export type SavedShift = {
  id: string;
  userId: string;
  platform: string;
  date: string;

  beginningMileage: string;
  endingMileage: string;

  deliveries: string;
  hoursWorked: string;

  basePay: string;
  tips: string;
  otherPay: string;
  grossPay: string;

  status: "open" | "closed";
};

// ======================================================
// AdjustmentType
// All possible adjustment categories
// Displayed as "Adjustments" in UI
// ======================================================

export type AdjustmentType =
  | "mga"
  | "delayed_tip"
  | "bonus"
  | "correction"
  | "reimbursement"
  | "promo"
  | "overtime";


// ======================================================
// PayAdjustment
// A single adjustment attached to a pay period (week)
// NOT attached to individual days
// ======================================================

export type PayAdjustment = {
  id: string;
  userId: string;
  platform: string;
  weekStart: string;
  weekEnd: string;
  adjustmentType: AdjustmentType;
  amount: number;
  notes?: string;
  createdAt?: string;
};


// ======================================================
// PayPeriod
// The settlement layer for a work week
// Replaces pay_entries entirely
// ======================================================

export type PayPeriod = {
  id: string;
  userId: string;
  platform: string;
  weekStart: string;
  weekEnd: string;
  basePay: number;
  tips: number;
  adjustments: number;
  bonuses: number;
  reimbursements: number;
  grossPay: number;
  notes?: string;
  createdAt?: string;
};