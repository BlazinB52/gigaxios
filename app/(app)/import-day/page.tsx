"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import {
  loadPreviousShiftMileageReading,
  needsMileageException,
} from "@/app/lib/mileageValidation";
import {
  convertImportDayHeicToJpeg,
  detectImportDayHeic,
  formatImportDayBytes,
  getImportDayConversionErrorMessage,
  ImportDayConversionStatus,
  ImportDayHeicDetection,
  isImportDayAcceptedImage,
} from "@/app/lib/importDayImage";
import {
  ImportDayImageKind,
  ImportDayOcrResult,
} from "@/app/lib/importDayTypes";
import { loadSubscriptionAccess } from "@/app/lib/subscriptionAccess";

type UploadState = {
  selectedFile: File | null;
  processedFile: File | null;
  sentFile: File | null;
  previewUrl: string;
  heicDetection: ImportDayHeicDetection;
  conversionStatus: ImportDayConversionStatus;
  conversionErrorMessage: string;
  ocrStatus: "idle" | "preparing" | "reading" | "done" | "failed";
  result: ImportDayOcrResult | null;
  rawJson: unknown;
  error: string;
  warning: string;
};

type VehicleOption = {
  id: string;
  year: string;
  make: string;
  model: string;
  is_primary: boolean;
};

type ReviewForm = {
  vehicleId: string;
  platform: string;
  date: string;
  startMileage: string;
  endMileage: string;
  deliveries: string;
  hoursWorked: string;
  basePay: string;
  tips: string;
  otherPay: string;
  grossPay: string;
  notes: string;
};

type ImportValidationState = {
  hardBlocks: string[];
  warnings: string[];
  cautions: string[];
};

type ExistingShift = {
  id: string;
  platform: string | null;
  gross_pay: number | string | null;
  beginning_mileage: number | string | null;
  ending_mileage: number | string | null;
  hours_worked: number | string | null;
  deliveries: number | string | null;
};

const uploadLabels: Record<ImportDayImageKind, string> = {
  start_odometer: "Start Odometer Photo",
  end_odometer: "End Odometer Photo",
  earnings: "Earnings Screenshot",
};

const uploadKinds: ImportDayImageKind[] = [
  "start_odometer",
  "end_odometer",
  "earnings",
];

const OCR_TIMEOUT_MS = 45_000;
const showImportDayDebugDetails = process.env.NODE_ENV !== "production";

function createUploadState(): UploadState {
  return {
    selectedFile: null,
    processedFile: null,
    sentFile: null,
    previewUrl: "",
    heicDetection: { isHeic: false, reason: "No file selected" },
    conversionStatus: "pending",
    conversionErrorMessage: "",
    ocrStatus: "idle",
    result: null,
    rawJson: null,
    error: "",
    warning: "",
  };
}

function todayIsoDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultPlatform() {
  if (typeof window === "undefined") return "GoPuff";
  return localStorage.getItem("gigaxios-default-platform") || "GoPuff";
}

function numberToInput(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function isValidDateParts(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isDateInAllowedImportRange(dateString: string) {
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const currentYear = new Date().getFullYear();

  return (
    year >= currentYear - 1 &&
    year <= currentYear + 1 &&
    isValidDateParts(year, month, day)
  );
}

function normalizeYear(yearText: string) {
  if (yearText.length === 2) {
    return 2000 + Number(yearText);
  }

  return Number(yearText);
}

function normalizeOcrDateInput(value: string | null | undefined) {
  if (!value) return { date: "", warning: "" };

  const trimmedValue = value
    .trim()
    .replace(
      /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+/i,
      ""
    );
  const monthNames: Record<string, string> = {
    jan: "01",
    january: "01",
    feb: "02",
    february: "02",
    mar: "03",
    march: "03",
    apr: "04",
    april: "04",
    may: "05",
    jun: "06",
    june: "06",
    jul: "07",
    july: "07",
    aug: "08",
    august: "08",
    sep: "09",
    sept: "09",
    september: "09",
    oct: "10",
    october: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12",
  };
  const isoMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return isDateInAllowedImportRange(trimmedValue)
      ? { date: trimmedValue, warning: "" }
      : { date: "", warning: "OCR date appears invalid and was ignored." };
  }

  const slashMatch = trimmedValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slashMatch) {
    const [, monthText, dayText, yearText] = slashMatch;
    const year = normalizeYear(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const normalizedDate = `${year}-${monthText.padStart(2, "0")}-${dayText.padStart(2, "0")}`;

    return isDateInAllowedImportRange(normalizedDate) &&
      isValidDateParts(year, month, day)
      ? { date: normalizedDate, warning: "" }
      : { date: "", warning: "OCR date appears invalid and was ignored." };
  }

  const dashedMatch = trimmedValue.match(/^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/);
  if (dashedMatch) {
    const [, monthText, dayText, yearText] = dashedMatch;
    const year = normalizeYear(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const normalizedDate = `${year}-${monthText.padStart(2, "0")}-${dayText.padStart(2, "0")}`;

    return isDateInAllowedImportRange(normalizedDate) &&
      isValidDateParts(year, month, day)
      ? { date: normalizedDate, warning: "" }
      : { date: "", warning: "OCR date appears invalid and was ignored." };
  }

  const monthNameMatch = trimmedValue.match(
    /^([A-Za-z]+)\s+(\d{1,2})(?:,)?\s+(\d{2}|\d{4})$/
  );
  if (monthNameMatch) {
    const [, monthName, dayText, yearText] = monthNameMatch;
    const monthText = monthNames[monthName.toLowerCase()];
    if (monthText) {
      const year = normalizeYear(yearText);
      const month = Number(monthText);
      const day = Number(dayText);
      const normalizedDate = `${year}-${monthText}-${dayText.padStart(2, "0")}`;

      return isDateInAllowedImportRange(normalizedDate) &&
        isValidDateParts(year, month, day)
        ? { date: normalizedDate, warning: "" }
        : { date: "", warning: "OCR date appears invalid and was ignored." };
    }
  }

  const monthDayMatch = trimmedValue.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  if (monthDayMatch) {
    const [, monthName, dayText] = monthDayMatch;
    const monthText = monthNames[monthName.toLowerCase()];
    if (monthText) {
      const year = new Date().getFullYear();
      const month = Number(monthText);
      const day = Number(dayText);
      const normalizedDate = `${year}-${monthText}-${dayText.padStart(2, "0")}`;

      return isDateInAllowedImportRange(normalizedDate) &&
        isValidDateParts(year, month, day)
        ? { date: normalizedDate, warning: "" }
        : { date: "", warning: "OCR date appears invalid and was ignored." };
    }
  }

  return { date: "", warning: "OCR date appears invalid and was ignored." };
}

function toNumber(value: string) {
  if (value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPayNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateGrossPay({
  basePay,
  tips,
  otherPay,
}: {
  basePay: string;
  tips: string;
  otherPay: string;
}) {
  return toPayNumber(basePay) + toPayNumber(tips) + toPayNumber(otherPay);
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatShiftHours(value: number | string | null | undefined): string {
  const hours = toNumber(String(value ?? ""));
  if (hours === null || hours <= 0) return "";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return "";
}

function formatShiftMiles(
  beginning: number | string | null | undefined,
  ending: number | string | null | undefined
): string {
  const start = toNumber(String(beginning ?? ""));
  const end = toNumber(String(ending ?? ""));
  if (start === null || end === null) return "";
  const miles = end - start;
  if (miles < 0) return "";
  return `${miles.toLocaleString("en-US")} mi`;
}

function formatShiftDeliveries(value: number | string | null | undefined): string {
  const count = toNumber(String(value ?? ""));
  if (count === null || count <= 0) return "";
  return `${count} ${count === 1 ? "delivery" : "deliveries"}`;
}

function mileageValuesMatch(firstValue: string | number | null, secondValue: string) {
  const firstNumber = toNumber(String(firstValue ?? ""));
  const secondNumber = toNumber(secondValue);

  return (
    firstNumber !== null &&
    secondNumber !== null &&
    firstNumber === secondNumber
  );
}

function hasMessage(messages: string[], message: string) {
  return messages.includes(message);
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number") return "Pending";
  return value.toLocaleString("en-US");
}

function Summary({ result }: { result: ImportDayOcrResult | null }) {
  if (!result) {
    return <p className="text-sm text-slate-400">No extracted values yet.</p>;
  }

  if (result.kind === "earnings") {
    return (
      <div className="space-y-1 text-sm text-slate-300">
        <p>Platform: {result.platform || "Pending"}</p>
        <p>Date: {result.date || "Pending"}</p>
        <p>Gross: {formatNumber(result.grossPay)}</p>
        <p className="capitalize">Confidence: {result.confidence}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 text-sm text-slate-300">
      <p>Mileage: {formatNumber(result.mileage)}</p>
      <p className="capitalize">Confidence: {result.confidence}</p>
    </div>
  );
}

export default function ImportDayPage() {
  const router = useRouter();
  const initialFormRef = useRef<ReviewForm | null>(null);
  const fileInputRefs = useRef<Record<ImportDayImageKind, HTMLInputElement | null>>({
    start_odometer: null,
    end_odometer: null,
    earnings: null,
  });
  const ocrAbortControllersRef = useRef<
    Partial<Record<ImportDayImageKind, AbortController>>
  >({});
  const ocrRequestIdsRef = useRef<Record<ImportDayImageKind, number>>({
    start_odometer: 0,
    end_odometer: 0,
    earnings: 0,
  });
  const previewUrlsRef = useRef<Record<ImportDayImageKind, string>>({
    start_odometer: "",
    end_odometer: "",
    earnings: "",
  });
  const [fileInputKeys, setFileInputKeys] = useState<Record<ImportDayImageKind, number>>({
    start_odometer: 0,
    end_odometer: 0,
    earnings: 0,
  });
  const [userId, setUserId] = useState("");
  const [trialRequired, setTrialRequired] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [uploads, setUploads] = useState<Record<ImportDayImageKind, UploadState>>({
    start_odometer: createUploadState(),
    end_odometer: createUploadState(),
    earnings: createUploadState(),
  });
  const [form, setForm] = useState<ReviewForm>({
    vehicleId: "",
    platform: getDefaultPlatform(),
    date: todayIsoDate(),
    startMileage: "",
    endMileage: "",
    deliveries: "",
    hoursWorked: "",
    basePay: "",
    tips: "",
    otherPay: "",
    grossPay: "",
    notes: "",
  });
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [mileageWarning, setMileageWarning] = useState("");
  const [validationState, setValidationState] = useState<ImportValidationState>({
    hardBlocks: [],
    warnings: [],
    cautions: [],
  });
  const [isCheckingValidation, setIsCheckingValidation] = useState(false);
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);
  const [earningsCautionAcknowledged, setEarningsCautionAcknowledged] =
    useState(false);
  const [payChangeAcknowledged, setPayChangeAcknowledged] = useState(false);
  const [existingShiftsForDate, setExistingShiftsForDate] = useState<ExistingShift[]>([]);
  const [isLoadingShiftsForDate, setIsLoadingShiftsForDate] = useState(false);
  const [ocrReportedGrossPay, setOcrReportedGrossPay] = useState<number | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const isAnyOcrReading = Object.values(uploads).some(
    (upload) => upload.ocrStatus === "reading"
  );
  const calculatedGrossPay = useMemo(
    () =>
      calculateGrossPay({
        basePay: form.basePay,
        tips: form.tips,
        otherPay: form.otherPay,
      }),
    [form.basePay, form.otherPay, form.tips]
  );
  const calculatedGrossPayInput = calculatedGrossPay.toFixed(2);
  const payChangeCaution =
    ocrReportedGrossPay !== null &&
    Math.abs(calculatedGrossPay - ocrReportedGrossPay) > 0.01
      ? `Pay values changed from the scanned result. Platform-reported gross was ${formatCurrency(ocrReportedGrossPay)}. Current calculated gross is ${formatCurrency(calculatedGrossPay)}.`
      : "";

  async function getImportValidationState(): Promise<ImportValidationState> {
    const hardBlocks: string[] = [];
    const warnings: string[] = [];
    const cautions: string[] = [];
    const startMileage = toNumber(form.startMileage);
    const endMileage = toNumber(form.endMileage);

    if (startMileage !== null && endMileage !== null) {
      const miles = endMileage - startMileage;
      if (miles < 0) {
        hardBlocks.push("End mileage must be greater than or equal to start mileage.");
      }
    }

    if (!userId || !form.startMileage || !form.endMileage) {
      return { hardBlocks, warnings, cautions };
    }

    const { data, error } = await supabase
      .from("shifts")
      .select("beginning_mileage, ending_mileage, date, platform, gross_pay")
      .eq("user_id", userId);

    if (error) {
      console.error("Import Day validation check error:", error.message);
      return { hardBlocks, warnings, cautions };
    }

    const existingShifts = data || [];
    const startMatchesExistingStart = existingShifts.some((shift) =>
      mileageValuesMatch(shift.beginning_mileage, form.startMileage)
    );
    const endMatchesExistingEnd = existingShifts.some((shift) =>
      mileageValuesMatch(shift.ending_mileage, form.endMileage)
    );
    const startMatchesExistingEnd = existingShifts.some((shift) =>
      mileageValuesMatch(shift.ending_mileage, form.startMileage)
    );
    const endMatchesExistingStart = existingShifts.some((shift) =>
      mileageValuesMatch(shift.beginning_mileage, form.endMileage)
    );

    if (startMatchesExistingStart) {
      hardBlocks.push("This start mileage already exists on another shift.");
    }

    if (endMatchesExistingEnd) {
      hardBlocks.push("This end mileage already exists on another shift.");
    }

    if (startMatchesExistingEnd) {
      warnings.push(
        "This start mileage matches a previous shift ending mileage. This may be correct if the new shift started where the last one ended."
      );
    }

    if (endMatchesExistingStart) {
      warnings.push("This end mileage matches another shift start mileage. Review before saving.");
    }

    const grossPay = calculatedGrossPay;
    const platform = form.platform.trim();
    const hasEarningsCaution =
      form.date &&
      platform &&
      existingShifts.some(
        (shift) =>
          shift.date === form.date &&
          shift.platform === platform &&
          mileageValuesMatch(shift.gross_pay, grossPay.toFixed(2))
      );

    if (hasEarningsCaution) {
      cautions.push(
        "A shift with the same date, platform, and gross pay already exists. Are you sure this is a separate shift?"
      );
    }

    return { hardBlocks, warnings, cautions };
  }

  useEffect(() => {
    setForm((current) => {
      const nextForm = {
        ...current,
        platform: getDefaultPlatform(),
        date: current.date || todayIsoDate(),
      };
      initialFormRef.current = nextForm;
      return nextForm;
    });

    async function loadUserContext() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      const access = await loadSubscriptionAccess({
        userId: user.id,
        userCreatedAt: user.created_at,
      });
      setTrialRequired(access.trialRequired);

      const { data: vehicleData } = await supabase
        .from("vehicles")
        .select("id, year, make, model, is_primary, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("is_primary", { ascending: false });

      const loadedVehicles = vehicleData || [];
      setVehicles(loadedVehicles);
      const primary = loadedVehicles.find((vehicle) => vehicle.is_primary) || loadedVehicles[0];
      if (primary) {
        setForm((current) => {
          const nextForm = { ...current, vehicleId: primary.id };
          if (initialFormRef.current) {
            initialFormRef.current = {
              ...initialFormRef.current,
              vehicleId: primary.id,
            };
          }
          return nextForm;
        });
      }
    }

    loadUserContext();

    return () => {
      Object.values(previewUrlsRef.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [router]);

  useEffect(() => {
    async function checkMileageHistory() {
      if (!userId) return;

      const previousStartShiftMileage = await loadPreviousShiftMileageReading({
        userId,
        vehicleId: form.vehicleId || undefined,
        date: form.date,
        mileage: form.startMileage,
      });
      const previousEndShiftMileage = await loadPreviousShiftMileageReading({
        userId,
        vehicleId: form.vehicleId || undefined,
        date: form.date,
        mileage: form.endMileage,
      });
      const startLooksLower = needsMileageException({
        mileage: form.startMileage,
        highestMileage: previousStartShiftMileage,
      });
      const startMileage = toNumber(form.startMileage);
      const endComparisonMileage =
        previousEndShiftMileage === null
          ? startMileage
          : startMileage === null
            ? previousEndShiftMileage
            : Math.max(previousEndShiftMileage, startMileage);
      const endLooksLower = needsMileageException({
        mileage: form.endMileage,
        highestMileage: endComparisonMileage,
      });

      setMileageWarning(
        startLooksLower || endLooksLower
          ? "This mileage is lower than the previous applicable shift record. Continue only if you are correcting older data."
          : ""
      );
    }

    checkMileageHistory();
  }, [form.date, form.endMileage, form.startMileage, form.vehicleId, userId]);

  useEffect(() => {
    let isCurrent = true;

    async function checkImportValidation() {
      if (!userId || !form.startMileage || !form.endMileage) {
        setValidationState({ hardBlocks: [], warnings: [], cautions: [] });
        setIsCheckingValidation(false);
        return;
      }

      setIsCheckingValidation(true);
      const nextValidationState = await getImportValidationState();

      if (!isCurrent) return;
      setValidationState(nextValidationState);
      setIsCheckingValidation(false);
    }

    checkImportValidation();

    return () => {
      isCurrent = false;
    };
  }, [calculatedGrossPayInput, form.date, form.endMileage, form.platform, form.startMileage, userId]);

  useEffect(() => {
    let isCurrent = true;

    async function loadShiftsForDate() {
      if (!userId || !form.date) {
        setExistingShiftsForDate([]);
        return;
      }

      setIsLoadingShiftsForDate(true);
      const { data } = await supabase
        .from("shifts")
        .select("id, platform, gross_pay, beginning_mileage, ending_mileage, hours_worked, deliveries")
        .eq("user_id", userId)
        .eq("date", form.date)
        .order("beginning_mileage", { ascending: true });

      if (!isCurrent) return;
      setExistingShiftsForDate(data || []);
      setIsLoadingShiftsForDate(false);
    }

    loadShiftsForDate();

    return () => {
      isCurrent = false;
    };
  }, [form.date, userId]);

  function getWarningMessages(validation = validationState) {
    const warnings: string[] = [];
    const startMileage = toNumber(form.startMileage);
    const endMileage = toNumber(form.endMileage);

    if (startMileage !== null && endMileage !== null) {
      const miles = endMileage - startMileage;
      if (!mileageWarning && miles >= 0 && miles > 300) {
        warnings.push("Mileage difference looks unusually high. Review before saving.");
      }
    }

    if (mileageWarning) {
      warnings.push(mileageWarning);
    }

    validation.warnings.forEach((warning) => {
      if (!hasMessage(warnings, warning)) warnings.push(warning);
    });

    return warnings;
  }

  const validationWarnings = useMemo(
    () => getWarningMessages(),
    [form, mileageWarning, validationState]
  );

  const hardBlocks = validationState.hardBlocks;
  const cautions = validationState.cautions;
  const importDisabled =
    isSaving ||
    isCheckingValidation ||
    trialRequired ||
    hardBlocks.length > 0 ||
    (validationWarnings.length > 0 && !warningsAcknowledged) ||
    (cautions.length > 0 && !earningsCautionAcknowledged) ||
    (Boolean(payChangeCaution) && !payChangeAcknowledged);

  const hasImportDraft = useMemo(() => {
    const hasImageWork = Object.values(uploads).some(
      (upload) => upload.selectedFile || upload.processedFile || upload.result
    );
    const initialForm = initialFormRef.current;
    const hasEditedValues = initialForm
      ? (Object.keys(form) as Array<keyof ReviewForm>).some(
          (field) => form[field] !== initialForm[field]
        )
      : false;

    return hasImageWork || hasEditedValues;
  }, [form, uploads]);

  function updateForm(field: keyof ReviewForm, value: string) {
    if (
      field === "date" ||
      field === "platform" ||
      field === "startMileage" ||
      field === "endMileage" ||
      field === "grossPay"
    ) {
      setWarningsAcknowledged(false);
      setEarningsCautionAcknowledged(false);
      setSaveError("");
    }

    if (field === "basePay" || field === "tips" || field === "otherPay") {
      setPayChangeAcknowledged(false);
      setEarningsCautionAcknowledged(false);
      setSaveError("");
    }

    setForm((current) => ({ ...current, [field]: value }));
  }

  function replacePreviewUrl(kind: ImportDayImageKind, file: File | null) {
    const existingUrl = previewUrlsRef.current[kind];
    if (existingUrl) {
      URL.revokeObjectURL(existingUrl);
      previewUrlsRef.current[kind] = "";
    }

    if (!file) return "";

    const objectUrl = URL.createObjectURL(file);
    previewUrlsRef.current[kind] = objectUrl;
    return objectUrl;
  }

  function patchUpload(kind: ImportDayImageKind, patch: Partial<UploadState>) {
    setUploads((current) => ({
      ...current,
      [kind]: {
        ...current[kind],
        ...patch,
      },
    }));
  }

  function openScanPicker(kind: ImportDayImageKind) {
    setSaveError("");
    fileInputRefs.current[kind]?.click();
  }

  function clearUpload(kind: ImportDayImageKind) {
    ocrAbortControllersRef.current[kind]?.abort();
    delete ocrAbortControllersRef.current[kind];
    ocrRequestIdsRef.current[kind] += 1;
    if (kind === "earnings") {
      setOcrReportedGrossPay(null);
      setPayChangeAcknowledged(false);
    }
    const previewUrl = replacePreviewUrl(kind, null);
    patchUpload(kind, { ...createUploadState(), previewUrl });
    if (fileInputRefs.current[kind]) {
      fileInputRefs.current[kind]!.value = "";
    }
    setFileInputKeys((current) => ({
      ...current,
      [kind]: current[kind] + 1,
    }));
  }

  function handleCancel() {
    if (!hasImportDraft) {
      router.push("/dashboard");
      return;
    }

    setShowDiscardConfirm(true);
  }

  async function handleFileChange(
    kind: ImportDayImageKind,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    patchUpload(kind, {
      selectedFile: file,
      processedFile: null,
      sentFile: null,
      previewUrl: replacePreviewUrl(kind, null),
      heicDetection: {
        isHeic: false,
        reason: file ? "Checking file" : "No file selected",
      },
      conversionStatus: "pending",
      conversionErrorMessage: "",
      ocrStatus: file ? "preparing" : "idle",
      result: null,
      rawJson: null,
      error: "",
      warning: "",
    });

    if (!file) return;

    try {
      const detectedHeic = await detectImportDayHeic(file);

      if (!isImportDayAcceptedImage(file, detectedHeic)) {
        patchUpload(kind, {
          heicDetection: detectedHeic,
          conversionStatus: "failed",
          ocrStatus: "failed",
          error: "Upload a valid image file.",
        });
        return;
      }

      const readyFile = detectedHeic.isHeic
        ? await convertImportDayHeicToJpeg(file)
        : file;
      const previewUrl = replacePreviewUrl(kind, readyFile);
      patchUpload(kind, {
        processedFile: readyFile,
        previewUrl,
        heicDetection: detectedHeic,
        conversionStatus: "success",
        ocrStatus: "idle",
      });
      await runOcr(kind, readyFile);
    } catch (conversionError) {
      patchUpload(kind, {
        processedFile: null,
        previewUrl: replacePreviewUrl(kind, null),
        conversionStatus: "failed",
        conversionErrorMessage:
          getImportDayConversionErrorMessage(conversionError),
        ocrStatus: "failed",
        error:
          "This photo format could not be read. Please retake the photo or upload a JPG/PNG.",
      });
    }
  }

  function applyOcrToForm(result: ImportDayOcrResult) {
    if (result.kind === "earnings") {
      setOcrReportedGrossPay(
        typeof result.grossPay === "number" && Number.isFinite(result.grossPay)
          ? result.grossPay
          : null
      );
      setPayChangeAcknowledged(false);
    }

    setForm((current) => {
      if (result.kind === "start_odometer") {
        return {
          ...current,
          startMileage: numberToInput(result.mileage) || current.startMileage,
        };
      }

      if (result.kind === "end_odometer") {
        return {
          ...current,
          endMileage: numberToInput(result.mileage) || current.endMileage,
        };
      }

      if (result.kind === "earnings") {
        return {
          ...current,
          deliveries: numberToInput(result.deliveries) || current.deliveries,
          hoursWorked: numberToInput(result.hoursWorked) || current.hoursWorked,
          basePay: numberToInput(result.basePay) || current.basePay,
          tips: numberToInput(result.tips) || current.tips,
          otherPay: numberToInput(result.otherPay) || current.otherPay,
          notes: [current.notes, result.notes].filter(Boolean).join("\n"),
        };
      }

      return current;
    });
  }

  async function runOcr(kind: ImportDayImageKind, imageFile?: File) {
    const upload = uploads[kind];
    const fileToRead = imageFile ?? upload.processedFile;
    const abortController = new AbortController();
    const requestId = ocrRequestIdsRef.current[kind] + 1;
    ocrRequestIdsRef.current[kind] = requestId;
    ocrAbortControllersRef.current[kind] = abortController;
    const timeoutId = window.setTimeout(() => {
      abortController.abort();
    }, OCR_TIMEOUT_MS);
    setSaveError("");

    if (trialRequired) {
      window.clearTimeout(timeoutId);
      delete ocrAbortControllersRef.current[kind];
      patchUpload(kind, {
        error: "Your free preview has ended. Start your free trial to scan photos.",
      });
      return;
    }

    if (!fileToRead) {
      window.clearTimeout(timeoutId);
      delete ocrAbortControllersRef.current[kind];
      patchUpload(kind, {
        error:
          "This photo is still being prepared or could not be read. Please retake the photo or upload a JPG/PNG.",
      });
      return;
    }

    const formData = new FormData();
    formData.append("image", fileToRead);
    formData.append("kind", kind);

    patchUpload(kind, {
      sentFile: fileToRead,
      ocrStatus: "reading",
      error: "",
      warning: "",
      rawJson: null,
    });

    try {
      const response = await fetch("/api/import-day/ocr", {
        method: "POST",
        body: formData,
        signal: abortController.signal,
      });
      const data = (await response.json()) as {
        result?: ImportDayOcrResult;
        raw?: unknown;
        warning?: string | null;
        error?: string;
      };

      if (!response.ok || !data.result) {
        if (ocrRequestIdsRef.current[kind] !== requestId) return;
        patchUpload(kind, {
          ocrStatus: "failed",
          error: data.error || "OpenAI could not read this image.",
          rawJson: data.raw ?? data,
        });
        return;
      }

      const ocrDateWarning =
        data.result.kind === "earnings"
          ? normalizeOcrDateInput(data.result.date).warning
          : "";

      if (ocrRequestIdsRef.current[kind] !== requestId) return;
      patchUpload(kind, {
        ocrStatus: "done",
        result: data.result,
        rawJson: data.raw ?? data,
        warning: [data.warning, ocrDateWarning].filter(Boolean).join(" "),
      });
      applyOcrToForm(data.result);
    } catch {
      if (ocrRequestIdsRef.current[kind] !== requestId) return;
      patchUpload(kind, {
        ocrStatus: "failed",
        error: abortController.signal.aborted
          ? "Scan took too long. Please try again."
          : "OpenAI request failed. Please try again.",
      });
    } finally {
      window.clearTimeout(timeoutId);
      if (ocrRequestIdsRef.current[kind] === requestId) {
        delete ocrAbortControllersRef.current[kind];
      }
    }
  }

  async function handleImport() {
    setSaveError("");
    setSaveSuccess("");

    if (trialRequired) {
      setSaveError("Your free preview has ended. Start your free trial to save a shift.");
      return;
    }

    const startMileage = toNumber(form.startMileage);
    const endMileage = toNumber(form.endMileage);

    if (startMileage === null) {
      setSaveError("Start mileage is required.");
      return;
    }

    if (endMileage === null) {
      setSaveError("End mileage is required.");
      return;
    }

    if (endMileage < startMileage) {
      setSaveError("End mileage must be greater than or equal to start mileage.");
      return;
    }

    if (!form.date) {
      setSaveError("Date is required.");
      return;
    }

    if (!userId) {
      router.push("/login");
      return;
    }

    setIsSaving(true);
    try {
      const latestValidationState = await getImportValidationState();
      const latestWarnings = getWarningMessages(latestValidationState);
      setValidationState(latestValidationState);

      if (latestValidationState.hardBlocks.length > 0) {
        setSaveError(latestValidationState.hardBlocks[0]);
        return;
      }

      if (latestWarnings.length > 0 && !warningsAcknowledged) {
        setSaveError("Review and acknowledge the warnings before saving.");
        return;
      }

      if (
        latestValidationState.cautions.length > 0 &&
        !earningsCautionAcknowledged
      ) {
        setSaveError("Confirm this is a separate shift before saving.");
        return;
      }

      if (payChangeCaution && !payChangeAcknowledged) {
        setSaveError("Review and acknowledge the pay changes before saving.");
        return;
      }

      const previousStartShiftMileage = await loadPreviousShiftMileageReading({
        userId,
        vehicleId: form.vehicleId || undefined,
        date: form.date,
        mileage: form.startMileage,
      });
      const previousEndShiftMileage = await loadPreviousShiftMileageReading({
        userId,
        vehicleId: form.vehicleId || undefined,
        date: form.date,
        mileage: form.endMileage,
      });
      const endComparisonMileage =
        previousEndShiftMileage === null
          ? startMileage
          : Math.max(previousEndShiftMileage, startMileage);
      const startMileageOverride = needsMileageException({
        mileage: form.startMileage,
        highestMileage: previousStartShiftMileage,
      });
      const endMileageOverride = needsMileageException({
        mileage: form.endMileage,
        highestMileage: endComparisonMileage,
      });
      const overrideReason =
        startMileageOverride || endMileageOverride
          ? "Record Shift reviewed mileage exception."
          : null;

      const { error } = await supabase.from("shifts").insert({
        id: crypto.randomUUID(),
        user_id: userId,
        vehicle_id: form.vehicleId || null,
        date: form.date,
        platform: form.platform || null,
        beginning_mileage: form.startMileage,
        ending_mileage: form.endMileage,
        start_mileage_override: startMileageOverride,
        start_mileage_override_reason: startMileageOverride ? overrideReason : null,
        end_mileage_override: endMileageOverride,
        end_mileage_override_reason: endMileageOverride ? overrideReason : null,
        deliveries: form.deliveries || null,
        hours_worked: form.hoursWorked || null,
        base_pay: form.basePay || null,
        tips: form.tips || null,
        other_pay: form.otherPay || null,
        gross_pay: calculatedGrossPayInput,
        status: "closed",
        notes: form.notes || null,
      });

      if (error) {
        setSaveError(error.message || "Could not save the shift.");
        return;
      }

      setSaveSuccess("Saved one closed shift into GigAxios.");
      router.push("/dashboard");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#020814] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-28 pt-5">
        <header className="mb-5">
          <h1 className="text-3xl font-bold">Record Shift</h1>
          <p className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100">
            For your safety, only capture photos when parked and legally stopped.
            Never use GigAxios while driving.
          </p>
        </header>

        {trialRequired && (
          <section className="mb-5 rounded-3xl border border-blue-500/30 bg-blue-950/30 p-5">
            <h2 className="text-lg font-bold">Start your free trial to continue</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Your free preview has ended. Start your free trial to scan photos or save shifts.
            </p>
          </section>
        )}

        {uploadKinds.map((kind) => (
          <input
            key={`inline-${kind}-${fileInputKeys[kind]}`}
            ref={(element) => {
              fileInputRefs.current[kind] = element;
            }}
            type="file"
            accept="image/*,.heic,.heif"
            onChange={(event) => handleFileChange(kind, event)}
            className="hidden"
          />
        ))}

        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm shadow-black/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Shift Details</h2>
              <p className="mt-1 text-xs text-slate-500">
                Scan photos or enter values manually.
              </p>
            </div>
            {isAnyOcrReading && (
              <span className="flex shrink-0 items-center gap-2 rounded-full border border-blue-400/30 bg-blue-950/30 px-3 py-1.5 text-xs font-bold text-blue-100">
                <span className="h-3 w-3 rounded-full border-2 border-blue-200/30 border-t-blue-300 animate-spin" />
                Reading
              </span>
            )}
          </div>

          <div className="mt-5 space-y-3">
            {vehicles.length > 0 && (
              <label className="block">
                <span className="text-sm text-slate-400">Vehicle</span>
                <select
                  value={form.vehicleId}
                  onChange={(event) => updateForm("vehicleId", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                >
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.year} {vehicle.make} {vehicle.model}
                      {vehicle.is_primary ? " (Primary)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block">
              <span className="text-sm text-slate-400">Platform</span>
              <select
                value={form.platform}
                onChange={(event) => updateForm("platform", event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
              >
                <option value="GoPuff">GoPuff</option>
                <option value="Amazon Flex">Amazon Flex</option>
                <option value="Uber Eats">Uber Eats</option>
                <option value="DoorDash">DoorDash</option>
                <option value="Shipt">Shipt</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-slate-400">Date</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) => updateForm("date", event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white [color-scheme:dark]"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm text-slate-400">Start mileage</span>
                <div className="mt-1 flex overflow-hidden rounded-xl border border-slate-700 bg-slate-950 focus-within:border-blue-400/70">
                  <input
                    type="number"
                    value={form.startMileage}
                    onChange={(event) => updateForm("startMileage", event.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-3 py-3 text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => openScanPicker("start_odometer")}
                    disabled={trialRequired || uploads.start_odometer.ocrStatus === "preparing" || uploads.start_odometer.ocrStatus === "reading"}
                    className="shrink-0 border-l border-slate-700 bg-slate-800/80 px-3 py-2 text-sm font-bold text-blue-100 disabled:cursor-not-allowed disabled:text-slate-500"
                  >
                    {uploads.start_odometer.ocrStatus === "reading" ? "Reading..." : "Scan"}
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="text-sm text-slate-400">End mileage</span>
                <div className="mt-1 flex overflow-hidden rounded-xl border border-slate-700 bg-slate-950 focus-within:border-blue-400/70">
                  <input
                    type="number"
                    value={form.endMileage}
                    onChange={(event) => updateForm("endMileage", event.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-3 py-3 text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => openScanPicker("end_odometer")}
                    disabled={trialRequired || uploads.end_odometer.ocrStatus === "preparing" || uploads.end_odometer.ocrStatus === "reading"}
                    className="shrink-0 border-l border-slate-700 bg-slate-800/80 px-3 py-2 text-sm font-bold text-blue-100 disabled:cursor-not-allowed disabled:text-slate-500"
                  >
                    {uploads.end_odometer.ocrStatus === "reading" ? "Reading..." : "Scan"}
                  </button>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <h3 className="text-sm font-bold text-slate-200">Earnings</h3>
              <button
                type="button"
                onClick={() => openScanPicker("earnings")}
                disabled={trialRequired || uploads.earnings.ocrStatus === "preparing" || uploads.earnings.ocrStatus === "reading"}
                className="rounded-full border border-blue-400/40 bg-blue-500/10 px-3.5 py-2 text-sm font-bold text-blue-100 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500"
              >
                {uploads.earnings.ocrStatus === "reading" ? "Reading..." : "Scan Earnings"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm text-slate-400">Deliveries</span>
                <input
                  type="number"
                  value={form.deliveries}
                  onChange={(event) => updateForm("deliveries", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                />
              </label>
              <label className="block">
                <span className="text-sm text-slate-400">Hours Worked</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.hoursWorked}
                  onChange={(event) => updateForm("hoursWorked", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(["basePay", "tips", "otherPay"] as const).map((field) => (
                <label key={field} className="block">
                  <span className="text-sm capitalize text-slate-400">
                    {field.replace(/([A-Z])/g, " $1")}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={form[field]}
                    onChange={(event) => updateForm(field, event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                  />
                </label>
              ))}
              <div className="block">
                <span className="text-sm text-slate-400">Gross Pay (calculated)</span>
                <div className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white">
                  {formatCurrency(calculatedGrossPay)}
                </div>
              </div>
            </div>

            <label className="block">
              <span className="text-sm text-slate-400">Notes</span>
              <textarea
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                className="mt-1 min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
              />
            </label>
          </div>

          {uploadKinds.some(
            (kind) => uploads[kind].error || uploads[kind].warning || uploads[kind].ocrStatus === "done"
          ) && (
            <div className="mt-5 space-y-2">
              {uploadKinds.map((kind) => {
                const upload = uploads[kind];
                const message = upload.error || upload.warning;
                if (!message && upload.ocrStatus !== "done") return null;

                return (
                  <p
                    key={kind}
                    className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
                      message
                        ? "border-amber-400/30 bg-amber-950/20 text-amber-100"
                        : "border-emerald-400/30 bg-emerald-950/20 text-emerald-100"
                    }`}
                  >
                    <span className="font-bold">{uploadLabels[kind]}: </span>
                    {message || "Scan applied. Review the filled values before saving."}
                  </p>
                );
              })}
            </div>
          )}

          {hardBlocks.length > 0 && (
            <div className="mt-5 rounded-2xl border border-red-400/40 bg-red-950/30 p-4 text-sm leading-6 text-red-100">
              <p className="font-bold text-red-200">Hard blocks</p>
              <div className="mt-2 space-y-1">
                {hardBlocks.map((block) => (
                  <p key={block}>{block}</p>
                ))}
              </div>
            </div>
          )}

          {validationWarnings.length > 0 && (
            <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100">
              <p className="font-bold text-amber-200">Warnings</p>
              <div className="mt-2 space-y-1">
                {validationWarnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
              <label className="mt-4 flex items-start gap-3 font-semibold text-white">
                <input
                  type="checkbox"
                  checked={warningsAcknowledged}
                  onChange={(event) => setWarningsAcknowledged(event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-blue-500"
                />
                <span>I reviewed these warnings and want to save anyway.</span>
              </label>
            </div>
          )}

          {(cautions.length > 0 || payChangeCaution) && (
            <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100">
              <p className="font-bold text-amber-200">Cautions</p>
              <div className="mt-2 space-y-1">
                {cautions.map((caution) => (
                  <p key={caution}>{caution}</p>
                ))}
                {payChangeCaution && <p>{payChangeCaution}</p>}
              </div>
              {cautions.length > 0 && (
                <label className="mt-4 flex items-start gap-3 font-semibold text-white">
                  <input
                    type="checkbox"
                    checked={earningsCautionAcknowledged}
                    onChange={(event) =>
                      setEarningsCautionAcknowledged(event.target.checked)
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-blue-500"
                  />
                  <span>Yes, this is a separate shift</span>
                </label>
              )}
              {payChangeCaution && (
                <label className="mt-4 flex items-start gap-3 font-semibold text-white">
                  <input
                    type="checkbox"
                    checked={payChangeAcknowledged}
                    onChange={(event) =>
                      setPayChangeAcknowledged(event.target.checked)
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-blue-500"
                  />
                  <span>I reviewed the pay changes and want to save.</span>
                </label>
              )}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-3xl border border-emerald-400/20 bg-emerald-950/20 p-5">
          <p className="text-sm font-semibold text-emerald-300">Save</p>
          <h2 className="mt-1 text-xl font-bold">Save shift</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Review the details, then save this shift.
          </p>

          {(saveError || saveSuccess) && (
            <p className="mt-4 rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm leading-6 text-slate-200">
              {saveError || saveSuccess}
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="rounded-full border border-slate-700 bg-slate-950 px-4 py-3 text-base font-bold text-slate-200 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importDisabled}
              className="rounded-full bg-emerald-500 px-4 py-3 text-base font-bold text-white shadow-lg shadow-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
            >
              {isSaving
                ? "Saving..."
                : isCheckingValidation
                  ? "Checking..."
                  : "Save Shift"}
            </button>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm shadow-black/20">
          <h2 className="text-base font-bold text-slate-200">Shifts recorded for this date</h2>
          {isLoadingShiftsForDate ? (
            <p className="mt-3 text-sm text-slate-400">Loading...</p>
          ) : existingShiftsForDate.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No shifts recorded for this date yet.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {existingShiftsForDate.map((shift) => {
                const line1Parts: string[] = [];
                if (shift.platform) line1Parts.push(shift.platform);
                const gross = toNumber(String(shift.gross_pay ?? ""));
                if (gross !== null && gross > 0) line1Parts.push(formatCurrency(gross));
                const miles = formatShiftMiles(shift.beginning_mileage, shift.ending_mileage);
                if (miles) line1Parts.push(miles);

                const line2Parts: string[] = [];
                const hours = formatShiftHours(shift.hours_worked);
                if (hours) line2Parts.push(hours);
                const deliveries = formatShiftDeliveries(shift.deliveries);
                if (deliveries) line2Parts.push(deliveries);

                return (
                  <div key={shift.id} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5">
                    <p className="text-sm font-semibold text-slate-100">
                      {line1Parts.join(" • ") || "Shift"}
                    </p>
                    {line2Parts.length > 0 && (
                      <p className="mt-0.5 text-xs text-slate-400">{line2Parts.join(" • ")}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {showDiscardConfirm && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 px-5 pb-8 pt-8 sm:items-center">
          <section className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-950 p-5 text-white shadow-2xl shadow-black/40">
            <h2 className="text-xl font-bold">Discard this shift?</h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="rounded-full border border-slate-700 bg-slate-900 px-4 py-3 text-base font-bold text-slate-200"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="rounded-full bg-blue-500 px-4 py-3 text-base font-bold text-white"
              >
                Discard
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
