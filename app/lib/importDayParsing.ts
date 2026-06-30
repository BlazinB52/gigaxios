import {
  ImportDayDeductionResult,
  ImportDayEarningsResult,
  ImportDayGrossPaySource,
  ImportDayImageKind,
  ImportDayOcrResult,
  ImportDayOdometerResult,
} from "@/app/lib/importDayTypes";

export function isImportDayKind(value: unknown): value is ImportDayImageKind {
  return (
    value === "start_odometer" ||
    value === "end_odometer" ||
    value === "earnings"
  );
}

function isConfidence(value: unknown) {
  return value === "high" || value === "medium" || value === "low";
}

function isNullableNumber(value: unknown) {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isNullableString(value: unknown) {
  return value === null || typeof value === "string";
}

function isGrossPaySource(value: unknown): value is ImportDayGrossPaySource | null {
  return (
    value === null ||
    value === "gross_total" ||
    value === "daily_earnings" ||
    value === "total_earnings" ||
    value === "total_pay" ||
    value === "payout" ||
    value === "available_balance"
  );
}

function isDeductionResult(value: unknown): value is ImportDayDeductionResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<ImportDayDeductionResult>;

  return (
    typeof result.deductionType === "string" &&
    typeof result.amount === "number" &&
    Number.isFinite(result.amount) &&
    result.amount >= 0 &&
    isNullableString(result.notes)
  );
}

export function isImportDayOdometerResult(
  value: unknown,
  kind?: "start_odometer" | "end_odometer"
): value is ImportDayOdometerResult {
  if (!value || typeof value !== "object") return false;

  const result = value as Partial<ImportDayOdometerResult>;
  const kindMatches = kind
    ? result.kind === kind
    : result.kind === "start_odometer" || result.kind === "end_odometer";

  return (
    kindMatches &&
    isNullableNumber(result.mileage) &&
    isConfidence(result.confidence) &&
    typeof result.notes === "string"
  );
}

export function isImportDayEarningsResult(
  value: unknown
): value is ImportDayEarningsResult {
  if (!value || typeof value !== "object") return false;

  const result = value as Partial<ImportDayEarningsResult>;

  return (
    result.kind === "earnings" &&
    isNullableString(result.platform) &&
    isNullableString(result.date) &&
    isNullableNumber(result.deliveries) &&
    isNullableNumber(result.hoursWorked) &&
    isNullableNumber(result.basePay) &&
    isNullableNumber(result.tips) &&
    isNullableNumber(result.otherPay) &&
    isNullableNumber(result.grossPay) &&
    isGrossPaySource(result.grossPaySource) &&
    Array.isArray(result.deductions) &&
    result.deductions.every(isDeductionResult) &&
    isConfidence(result.confidence) &&
    typeof result.notes === "string"
  );
}

export function isImportDayOcrResult(
  value: unknown,
  kind: ImportDayImageKind
): value is ImportDayOcrResult {
  if (kind === "earnings") return isImportDayEarningsResult(value);
  return isImportDayOdometerResult(value, kind);
}
