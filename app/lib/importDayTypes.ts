export type ImportDayImageKind =
  | "start_odometer"
  | "end_odometer"
  | "earnings";

export type ImportDayConfidence = "high" | "medium" | "low";
export type ImportDayGrossPaySource =
  | "gross_total"
  | "daily_earnings"
  | "total_earnings"
  | "total_pay"
  | "payout"
  | "available_balance";

export type ImportDayDeductionResult = {
  deductionType: string;
  amount: number;
  notes: string | null;
};

export type ImportDayOdometerResult = {
  kind: "start_odometer" | "end_odometer";
  mileage: number | null;
  confidence: ImportDayConfidence;
  notes: string;
};

export type ImportDayEarningsResult = {
  kind: "earnings";
  platform: string | null;
  date: string | null;
  deliveries: number | null;
  hoursWorked: number | null;
  basePay: number | null;
  tips: number | null;
  otherPay: number | null;
  grossPay: number | null;
  grossPaySource: ImportDayGrossPaySource | null;
  deductions: ImportDayDeductionResult[];
  confidence: ImportDayConfidence;
  notes: string;
};

export type ImportDayOcrResult =
  | ImportDayOdometerResult
  | ImportDayEarningsResult;
