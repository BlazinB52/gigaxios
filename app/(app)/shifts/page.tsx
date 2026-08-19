"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import ActiveShiftCard from "@/app/components/ActiveShiftCard";
import PlatformField from "@/app/components/PlatformField";
import { SavedShift } from "@/app/lib/types";
import { loadShiftsFromSupabase } from "@/app/lib/storage";
import { supabase } from "@/app/lib/supabaseClient";
import {
    SubscriptionAccessState,
    loadSubscriptionAccess,
} from "@/app/lib/subscriptionAccess";
import {
    loadPreviousShiftMileageReading,
    needsMileageException,
} from "@/app/lib/mileageValidation";
import {
    DUPLICATE_SHIFT_MESSAGE,
    hasDuplicateClosedShift,
} from "@/app/lib/shiftDuplicateValidation";
import { saveShiftDeductionsToSupabase } from "@/app/lib/shiftDeductions";
import {
    convertImportDayHeicToJpeg,
    detectImportDayHeic,
    getImportDayConversionErrorMessage,
    ImportDayConversionStatus,
    ImportDayHeicDetection,
    isImportDayAcceptedImage,
} from "@/app/lib/importDayImage";
import {
    ImportDayImageKind,
    ImportDayOcrResult,
} from "@/app/lib/importDayTypes";

function getLocalDateValue(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
    ).padStart(2, "0")}`;
}

function getLocalTimeValue(date = new Date()) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function calculateHoursBetween({
    startDate,
    startTime,
    endDate,
    endTime,
}: {
    startDate: string;
    startTime?: string;
    endDate: string;
    endTime: string;
}) {
    if (!startDate || !startTime || !endDate || !endTime) return "";

    const start = new Date(`${startDate}T${startTime}:00`);
    let end = new Date(`${endDate}T${endTime}:00`);

    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
        return "";
    }

    if (end < start) {
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }

    return ((end.getTime() - start.getTime()) / (60 * 60 * 1000)).toFixed(2);
}

type ShiftOcrState = {
    selectedFile: File | null;
    processedFile: File | null;
    heicDetection: ImportDayHeicDetection;
    conversionStatus: ImportDayConversionStatus;
    ocrStatus: "idle" | "preparing" | "reading" | "done" | "failed";
    result: ImportDayOcrResult | null;
    error: string;
    warning: string;
};

const shiftOcrKinds: ImportDayImageKind[] = ["start_odometer", "end_odometer", "earnings"];
const OCR_TIMEOUT_MS = 45_000;

function createShiftOcrState(): ShiftOcrState {
    return {
        selectedFile: null,
        processedFile: null,
        heicDetection: { isHeic: false, reason: "No file selected" },
        conversionStatus: "pending",
        ocrStatus: "idle",
        result: null,
        error: "",
        warning: "",
    };
}

function numberToInput(value: number | null | undefined) {
    return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}


export default function ShiftsPage() {
    const [platform, setPlatform] = useState("");
    const [shiftDate, setShiftDate] = useState(() => getLocalDateValue());
    const [startTime, setStartTime] = useState(() => getLocalTimeValue());
    const [beginningMileage, setBeginningMileage] = useState("");
    const [endingMileage, setEndingMileage] = useState("");
    const [endTime, setEndTime] = useState(() => getLocalTimeValue());
    const [allowStartMileageException, setAllowStartMileageException] = useState(false);
    const [startMileageExceptionReason, setStartMileageExceptionReason] = useState("");
    const [showStartMileageException, setShowStartMileageException] = useState(false);
    const [allowEndMileageException, setAllowEndMileageException] = useState(false);
    const [endMileageExceptionReason, setEndMileageExceptionReason] = useState("");
    const [showEndMileageException, setShowEndMileageException] = useState(false);

    const [deliveries, setDeliveries] = useState("");
    const [basePay, setBasePay] = useState("");
    const [tips, setTips] = useState("");
    const [otherPay, setOtherPay] = useState("");
    const [grossPay, setGrossPay] = useState("");
    const [deductionType, setDeductionType] = useState("");
    const [deductionAmount, setDeductionAmount] = useState("");
    const [deductionNotes, setDeductionNotes] = useState("");
    const [notes, setNotes] = useState("");

    const [savedShifts, setSavedShifts] = useState<SavedShift[]>([]);
    const [vehicles, setVehicles] = useState<Array<{
      id: string; year: string; make: string; model: string; is_primary: boolean;
    }>>([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState("");
    const [accessState, setAccessState] =
        useState<SubscriptionAccessState | null>(null);
    const [startingCheckout, setStartingCheckout] = useState(false);
    const router = useRouter();
    const fileInputRefs = useRef<Record<ImportDayImageKind, HTMLInputElement | null>>({
        start_odometer: null,
        end_odometer: null,
        earnings: null,
    });
    const ocrAbortControllersRef = useRef<Partial<Record<ImportDayImageKind, AbortController>>>({});
    const ocrRequestIdsRef = useRef<Record<ImportDayImageKind, number>>({
        start_odometer: 0,
        end_odometer: 0,
        earnings: 0,
    });
    const [ocrUploads, setOcrUploads] = useState<Record<ImportDayImageKind, ShiftOcrState>>({
        start_odometer: createShiftOcrState(),
        end_odometer: createShiftOcrState(),
        earnings: createShiftOcrState(),
    });

    useEffect(() => {  
        async function loadCloudShifts() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }

            const shifts = await loadShiftsFromSupabase(user.id);
            setSavedShifts(shifts);

            const access = await loadSubscriptionAccess({
                userId: user.id,
                userCreatedAt: user.created_at,
            });
            setAccessState(access);

            const { data: vehicleData } = await supabase
              .from("vehicles")
              .select("id, year, make, model, is_primary, status")
              .eq("user_id", user.id)
              .eq("status", "active")
              .order("is_primary", { ascending: false });

            const loadedVehicles = vehicleData || [];
            setVehicles(loadedVehicles);
            const primary = loadedVehicles.find((v) => v.is_primary) || loadedVehicles[0] || null;
            setSelectedVehicleId(primary?.id || "");
        }

        loadCloudShifts();
    }, [router]);

    const activeShift = savedShifts.find((shift) => shift.status === "open");
    const isSubscribed = accessState?.isSubscribed ?? false;
    const trialRequired = accessState?.trialRequired ?? false;
    const activeShiftStartTime = activeShift?.startTime ?? startTime;
    const calculatedHoursWorked = activeShift
        ? calculateHoursBetween({
            startDate: activeShift.date,
            startTime: activeShiftStartTime,
            endDate: activeShift.date,
            endTime,
        })
        : "";

    function resetStartMileageException() {
        setShowStartMileageException(false);
        setAllowStartMileageException(false);
        setStartMileageExceptionReason("");
    }

    function resetEndMileageException() {
        setShowEndMileageException(false);
        setAllowEndMileageException(false);
        setEndMileageExceptionReason("");
    }

    function patchOcrUpload(kind: ImportDayImageKind, patch: Partial<ShiftOcrState>) {
        setOcrUploads((current) => ({
            ...current,
            [kind]: {
                ...current[kind],
                ...patch,
            },
        }));
    }

    function openScanPicker(kind: ImportDayImageKind) {
        if (trialRequired) return;
        fileInputRefs.current[kind]?.click();
    }

    function applyOcrToShiftForm(result: ImportDayOcrResult) {
        if (result.kind === "start_odometer") {
            const mileage = numberToInput(result.mileage);
            if (mileage) {
                setBeginningMileage(mileage);
                resetStartMileageException();
            }
            return;
        }

        if (result.kind === "end_odometer") {
            const mileage = numberToInput(result.mileage);
            if (mileage) {
                setEndingMileage(mileage);
                resetEndMileageException();
            }
            return;
        }

        if (result.kind !== "earnings") return;

        const primaryDeduction = result.deductions[0] ?? null;
        setDeliveries((current) => numberToInput(result.deliveries) || current);
        setBasePay((current) => numberToInput(result.basePay) || current);
        setTips((current) => numberToInput(result.tips) || current);
        setOtherPay((current) => numberToInput(result.otherPay) || current);
        setGrossPay((current) => numberToInput(result.grossPay) || current);
        setDeductionType((current) => primaryDeduction?.deductionType || current);
        setDeductionAmount((current) => numberToInput(primaryDeduction?.amount) || current);
        setDeductionNotes((current) => primaryDeduction?.notes || current);
        setNotes((current) => [current, result.notes].filter(Boolean).join("\n"));
    }

    async function runOcr(kind: ImportDayImageKind, imageFile?: File) {
        const upload = ocrUploads[kind];
        const fileToRead = imageFile ?? upload.processedFile;
        const abortController = new AbortController();
        const requestId = ocrRequestIdsRef.current[kind] + 1;
        ocrRequestIdsRef.current[kind] = requestId;
        ocrAbortControllersRef.current[kind] = abortController;
        const timeoutId = window.setTimeout(() => {
            abortController.abort();
        }, OCR_TIMEOUT_MS);

        if (trialRequired) {
            window.clearTimeout(timeoutId);
            delete ocrAbortControllersRef.current[kind];
            patchOcrUpload(kind, {
                error: "Your free preview has ended. Start your free trial to scan photos.",
            });
            return;
        }

        if (!fileToRead) {
            window.clearTimeout(timeoutId);
            delete ocrAbortControllersRef.current[kind];
            patchOcrUpload(kind, {
                error: "This photo is still being prepared or could not be read. Please retake the photo or upload a JPG/PNG.",
            });
            return;
        }

        const formData = new FormData();
        formData.append("image", fileToRead);
        formData.append("kind", kind);

        patchOcrUpload(kind, {
            ocrStatus: "reading",
            error: "",
            warning: "",
        });

        try {
            const response = await fetch("/api/import-day/ocr", {
                method: "POST",
                body: formData,
                signal: abortController.signal,
            });
            const data = (await response.json()) as {
                result?: ImportDayOcrResult;
                warning?: string | null;
                error?: string;
            };

            if (ocrRequestIdsRef.current[kind] !== requestId) return;

            if (!response.ok || !data.result) {
                patchOcrUpload(kind, {
                    ocrStatus: "failed",
                    error: data.error || "OpenAI could not read this image.",
                });
                return;
            }

            const platformWarning =
                data.result.kind === "earnings" && !data.result.platform
                    ? "Platform not detected. Existing shift platform was kept."
                    : "";

            patchOcrUpload(kind, {
                ocrStatus: "done",
                result: data.result,
                warning: [data.warning, platformWarning].filter(Boolean).join(" "),
            });
            applyOcrToShiftForm(data.result);
        } catch {
            if (ocrRequestIdsRef.current[kind] !== requestId) return;
            patchOcrUpload(kind, {
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

    async function handleOcrFileChange(
        kind: ImportDayImageKind,
        event: ChangeEvent<HTMLInputElement>
    ) {
        const file = event.target.files?.[0] ?? null;
        event.target.value = "";
        patchOcrUpload(kind, {
            selectedFile: file,
            processedFile: null,
            heicDetection: {
                isHeic: false,
                reason: file ? "Checking file" : "No file selected",
            },
            conversionStatus: "pending",
            ocrStatus: file ? "preparing" : "idle",
            result: null,
            error: "",
            warning: "",
        });

        if (!file) return;

        try {
            const detectedHeic = await detectImportDayHeic(file);

            if (!isImportDayAcceptedImage(file, detectedHeic)) {
                patchOcrUpload(kind, {
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
            patchOcrUpload(kind, {
                processedFile: readyFile,
                heicDetection: detectedHeic,
                conversionStatus: "success",
                ocrStatus: "idle",
            });
            await runOcr(kind, readyFile);
        } catch (conversionError) {
            patchOcrUpload(kind, {
                processedFile: null,
                conversionStatus: "failed",
                ocrStatus: "failed",
                error: `This photo format could not be read. ${getImportDayConversionErrorMessage(conversionError)}`,
            });
        }
    }

    async function handleStartTrial() {
        setStartingCheckout(true);
        try {
            const response = await fetch("/api/stripe/create-checkout-session", {
                method: "POST",
            });
            const data = await response.json();

            if (!response.ok || !data.url) {
                return;
            }

            window.location.href = data.url;
        } finally {
            setStartingCheckout(false);
        }
    }

    async function handleStartShift() {
        if (trialRequired) {
            return;
        }

        if (!shiftDate || !beginningMileage || !startTime) {
            alert("Enter a date, start time, and beginning mileage.");
            return;
        }

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            router.push("/login");
            return;
        }

        const existingShifts = await loadShiftsFromSupabase(user.id);

        const openShiftExists = existingShifts.some(
            (shift) => shift.status === "open"
        );




        if (openShiftExists) {
            alert("Finish your current shift first.");
            return;
        }

        const trimmedPlatform = platform.trim();
        if (!trimmedPlatform) {
            alert("Platform is required.");
            return;
        }

        const previousShiftMileage = await loadPreviousShiftMileageReading({
            userId: user.id,
            vehicleId: selectedVehicleId || undefined,
            date: shiftDate,
            mileage: beginningMileage,
        });
        const startMileageIsLower = needsMileageException({
            mileage: beginningMileage,
            highestMileage: previousShiftMileage,
        });

        if (
            startMileageIsLower &&
            (!allowStartMileageException || startMileageExceptionReason.trim().length === 0)
        ) {
            setShowStartMileageException(true);
            return;
        }

        setShowStartMileageException(false);


        // New Shift Block

        const newShift: SavedShift = {
            id: crypto.randomUUID(),
            userId: user.id,
            vehicleId: selectedVehicleId || undefined,
            platform: trimmedPlatform,
            date: shiftDate,
            startTime,
            beginningMileage,
            endingMileage: "",
            startMileageOverride: startMileageIsLower && allowStartMileageException,
            startMileageOverrideReason:
                startMileageIsLower && allowStartMileageException
                    ? startMileageExceptionReason.trim()
                    : null,
            endMileageOverride: false,
            endMileageOverrideReason: null,
            deliveries: "",
            hoursWorked: "",
            basePay: "",
            tips: "",
            otherPay: "",
            grossPay: "",
            status: "open",
        };

        setSavedShifts([...existingShifts, newShift]);
        setShiftDate(getLocalDateValue());
        setStartTime(getLocalTimeValue());
        setBeginningMileage("");
        setAllowStartMileageException(false);
        setStartMileageExceptionReason("");

        await supabase.from("shifts").insert({
            id: newShift.id,
            user_id: user.id,
            vehicle_id: selectedVehicleId || null,
            date: newShift.date,
            start_time: newShift.startTime ?? null,
            platform: newShift.platform ?? null,
            beginning_mileage: newShift.beginningMileage,
            ending_mileage: null,
            start_mileage_override: newShift.startMileageOverride ?? false,
            start_mileage_override_reason: newShift.startMileageOverride
                ? newShift.startMileageOverrideReason || null
                : null,
            end_mileage_override: false,
            end_mileage_override_reason: null,
            deliveries: null,
            hours_worked: null,
            base_pay: null,
            tips: null,
            other_pay: null,
            gross_pay: null,
            status: newShift.status,
            notes: null,
        });
        router.push("/dashboard");
    }

    async function handleEndShift() {
        if (!activeShift) return;

        if (!endingMileage) {
            alert("Ending mileage is required.");
            return;
        }

        if (!endTime) {
            alert("End time is required.");
            return;
        }

        if (!calculatedHoursWorked) {
            alert("Could not calculate hours worked. Check the shift start and end times.");
            return;
        }

        const previousShiftMileage = await loadPreviousShiftMileageReading({
            userId: activeShift.userId,
            vehicleId: activeShift.vehicleId,
            date: activeShift.date,
            mileage: endingMileage,
        });
        const beginningMileage = Number(activeShift.beginningMileage);
        const beginningComparisonMileage = Number.isFinite(beginningMileage)
            ? beginningMileage
            : null;
        const endComparisonMileage =
            previousShiftMileage === null
                ? beginningComparisonMileage
                : beginningComparisonMileage === null
                    ? previousShiftMileage
                    : Math.max(previousShiftMileage, beginningComparisonMileage);
        const endMileageIsLower = needsMileageException({
            mileage: endingMileage,
            highestMileage: endComparisonMileage,
        });

        if (
            endMileageIsLower &&
            (!allowEndMileageException || endMileageExceptionReason.trim().length === 0)
        ) {
            setShowEndMileageException(true);
            return;
        }

        setShowEndMileageException(false);

        const calculatedGrossPay =
            Number(grossPay || 0) || Number(basePay || 0) + Number(tips || 0) + Number(otherPay || 0);
        const parsedDeductionAmount = Number(deductionAmount || 0);

        if (parsedDeductionAmount > 0 && !deductionType.trim()) {
            alert("Fee/Deduction Type is required when a deduction amount is entered.");
            return;
        }

        const duplicateShiftExists = await hasDuplicateClosedShift({
            userId: activeShift.userId,
            vehicleId: activeShift.vehicleId,
            date: activeShift.date,
            beginningMileage: activeShift.beginningMileage,
            endingMileage,
            platform: activeShift.platform,
            excludeShiftId: activeShift.id,
        });

        if (duplicateShiftExists) {
            alert(DUPLICATE_SHIFT_MESSAGE);
            return;
        }

        const updatedShifts = savedShifts.map((shift) => {
            if (shift.id === activeShift.id) {
                return {
                    ...shift,
                    endingMileage,
                    deliveries,
                    endTime,
                    hoursWorked: calculatedHoursWorked,
                    basePay,
                    tips,
                    otherPay,
                    grossPay: calculatedGrossPay.toFixed(2),
                    notes,
                    endMileageOverride: endMileageIsLower && allowEndMileageException,
                    endMileageOverrideReason:
                        endMileageIsLower && allowEndMileageException
                            ? endMileageExceptionReason.trim()
                            : null,
                    status: "closed" as const,
                };
            }

            return shift;
        });


        setSavedShifts(updatedShifts);

        setEndingMileage("");
        setDeliveries("");
        setEndTime(getLocalTimeValue());
        setBasePay("");
        setTips("");
        setOtherPay("");
        setGrossPay("");
        setDeductionType("");
        setDeductionAmount("");
        setDeductionNotes("");
        setNotes("");
        setAllowEndMileageException(false);
        setEndMileageExceptionReason("");

        const { error } = await supabase
            .from("shifts")
            .update({
                ending_mileage: endingMileage,
                start_time: activeShiftStartTime ?? null,
                end_time: endTime,
                end_mileage_override: endMileageIsLower && allowEndMileageException,
                end_mileage_override_reason:
                    endMileageIsLower && allowEndMileageException
                        ? endMileageExceptionReason.trim()
                        : null,
                deliveries,
                hours_worked: calculatedHoursWorked,
                base_pay: basePay,
                tips,
                other_pay: otherPay,
                gross_pay: calculatedGrossPay.toFixed(2),
                status: "closed",
                notes: notes || null,
            })
            .eq("id", activeShift.id);

        if (error) {
            alert(error.message);
            return;
        }

        if (parsedDeductionAmount > 0 && deductionType.trim()) {
            try {
                await saveShiftDeductionsToSupabase([
                    {
                        userId: activeShift.userId,
                        shiftId: activeShift.id,
                        date: activeShift.date,
                        platform: activeShift.platform,
                        deductionType,
                        amount: parsedDeductionAmount,
                        notes: deductionNotes,
                    },
                ]);
            } catch (deductionError) {
                alert(
                    deductionError instanceof Error
                        ? deductionError.message
                        : "Shift saved, but the deduction could not be saved."
                );
                return;
            }
        }

        if (isSubscribed) {
            sessionStorage.removeItem("gigaxios_shift_ended");
        } else {
            sessionStorage.setItem("gigaxios_shift_ended", "1");
        }
        router.push("/dashboard");
    }

    async function handleCancelOpenShift() {
        if (!activeShift) return;

        const confirmed = confirm("Cancel this open shift? It will not create earnings or work mileage.");
        if (!confirmed) return;

        const { error } = await supabase
            .from("shifts")
            .delete()
            .eq("id", activeShift.id);

        if (error) {
            alert(error.message);
            return;
        }

        setSavedShifts((current) => current.filter((shift) => shift.id !== activeShift.id));
        setEndingMileage("");
        setDeliveries("");
        setBasePay("");
        setTips("");
        setOtherPay("");
        setGrossPay("");
        setDeductionType("");
        setDeductionAmount("");
        setDeductionNotes("");
        setNotes("");
        resetEndMileageException();
        router.push("/dashboard");
    }
    return (
        <main className="min-h-screen bg-[#020814] text-white">
            <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-24 pt-8">
                {shiftOcrKinds.map((kind) => (
                    <input
                        key={kind}
                        ref={(input) => {
                            fileInputRefs.current[kind] = input;
                        }}
                        type="file"
                        accept="image/*,.heic,.heif"
                        capture={kind === "earnings" ? undefined : "environment"}
                        className="hidden"
                        onChange={(event) => handleOcrFileChange(kind, event)}
                    />
                ))}

                <div className="mb-6">
                    <h1 className="text-3xl font-bold tracking-tight">Shifts</h1>
                    <p className="mt-1 text-sm text-slate-400">
                        Start and manage work shifts
                    </p>
                </div>

                <ActiveShiftCard
                    activeShift={activeShift}
                    startTime={activeShiftStartTime}
                    endingMileage={endingMileage}
                    setEndingMileage={setEndingMileage}
                    endTime={endTime}
                    setEndTime={setEndTime}
                    deliveries={deliveries}
                    setDeliveries={setDeliveries}
                    calculatedHoursWorked={calculatedHoursWorked}
                    basePay={basePay}
                    setBasePay={setBasePay}
                    tips={tips}
                    setTips={setTips}
                    otherPay={otherPay}
                    setOtherPay={setOtherPay}
                    grossPay={grossPay}
                    setGrossPay={setGrossPay}
                    deductionType={deductionType}
                    setDeductionType={setDeductionType}
                    deductionAmount={deductionAmount}
                    setDeductionAmount={setDeductionAmount}
                    deductionNotes={deductionNotes}
                    setDeductionNotes={setDeductionNotes}
                    notes={notes}
                    setNotes={setNotes}
                    allowEndMileageException={allowEndMileageException}
                    setAllowEndMileageException={setAllowEndMileageException}
                    endMileageExceptionReason={endMileageExceptionReason}
                    setEndMileageExceptionReason={setEndMileageExceptionReason}
                    showEndMileageException={showEndMileageException}
                    onEndingMileageChange={resetEndMileageException}
                    ocrUploads={ocrUploads}
                    onScan={openScanPicker}
                    trialRequired={trialRequired}
                    onEndShift={handleEndShift}
                    onCancelOpenShift={handleCancelOpenShift}
                />

                {trialRequired && !activeShift && (
                    <section className="mb-5 rounded-3xl border border-blue-500/30 bg-blue-950/30 p-5">
                        <h2 className="text-lg font-bold">Start your free trial to continue</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                            Your free GigAxios preview has ended.
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                            Start your 7-day free trial to continue adding shifts and fuel entries.
                        </p>
                        <div className="mt-3 space-y-1 text-sm font-semibold text-slate-200">
                            <p>No charge today.</p>
                            <p>Then $3.99/month for your first year.</p>
                            <p>Cancel anytime.</p>
                        </div>
                        <button
                            onClick={handleStartTrial}
                            disabled={startingCheckout}
                            className="mt-4 w-full rounded-xl bg-blue-500 p-3 font-bold text-white disabled:opacity-60"
                        >
                            {startingCheckout ? "Opening checkout..." : "Start Free Trial"}
                        </button>
                    </section>
                )}

                {!activeShift && (
                    <section className="rounded-3xl border border-slate-700/70 bg-slate-950/70 p-5">
                        <h2 className="text-lg font-bold">Start Shift</h2>
                        <p className="mt-1 text-sm text-slate-400">
                            Enter only what you know before you start working.
                        </p>

                        <div className="mt-5 space-y-3">
                            <div>
                                <label className="text-sm text-slate-400">Vehicle</label>
                                <select
                                    value={selectedVehicleId}
                                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                                >
                                    {vehicles.length === 0 ? (
                                        <option value="">No active vehicles</option>
                                    ) : (
                                        vehicles.map((v) => (
                                            <option key={v.id} value={v.id}>
                                                {v.year} {v.make} {v.model}{v.is_primary ? " (Primary)" : ""}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>
                            <PlatformField
                                value={platform}
                                onChange={setPlatform}
                                label="Platform"
                                placeholder="Select or enter platform"
                            />
                            <div className="relative">
                                <input
                                    aria-label="Shift Date"
                                    type="date"
                                    value={shiftDate}
                                    onChange={(event) => setShiftDate(event.target.value)}
                                    className={`h-12 min-h-12 w-full appearance-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-0 pr-11 text-base leading-none [color-scheme:dark] ${shiftDate ? "text-white" : "text-transparent"} [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0`}
                                    style={{ WebkitAppearance: "none" }}
                                />
                                {!shiftDate && (
                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-500">
                                        Shift Date
                                    </span>
                                )}
                                <Calendar className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white" />
                            </div>

                            <input
                                type="time"
                                value={startTime}
                                onChange={(event) => setStartTime(event.target.value)}
                                aria-label="Start Time"
                                className="h-12 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-white [color-scheme:dark]"
                            />

                            <div>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        value={beginningMileage}
                                        onChange={(event) => {
                                            setBeginningMileage(event.target.value);
                                            resetStartMileageException();
                                        }}
                                        placeholder="Beginning Mileage"
                                        className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => openScanPicker("start_odometer")}
                                        disabled={
                                            trialRequired ||
                                            ocrUploads.start_odometer.ocrStatus === "preparing" ||
                                            ocrUploads.start_odometer.ocrStatus === "reading"
                                        }
                                        className="shrink-0 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 text-sm font-bold text-blue-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
                                    >
                                        {ocrUploads.start_odometer.ocrStatus === "reading" ? "Reading..." : "Scan"}
                                    </button>
                                </div>
                                {(ocrUploads.start_odometer.error ||
                                    ocrUploads.start_odometer.warning ||
                                    ocrUploads.start_odometer.ocrStatus === "done") && (
                                    <p className={`mt-2 rounded-xl border px-3 py-2 text-xs leading-5 ${
                                        ocrUploads.start_odometer.error
                                            ? "border-red-400/30 bg-red-950/20 text-red-100"
                                            : ocrUploads.start_odometer.warning
                                                ? "border-amber-400/30 bg-amber-950/20 text-amber-100"
                                                : "border-emerald-400/30 bg-emerald-950/20 text-emerald-100"
                                    }`}>
                                        {ocrUploads.start_odometer.error ||
                                            ocrUploads.start_odometer.warning ||
                                            "Starting mileage scan applied."}
                                    </p>
                                )}
                            </div>

                            {showStartMileageException && (
                                <div className="rounded-2xl border border-amber-400/30 bg-amber-950/20 p-4">
                                    <p className="text-sm leading-6 text-amber-100">
                                        This mileage appears to be lower than an existing entry. Only continue if you are backfilling or correcting older data.
                                    </p>
                                    <label className="mt-3 flex items-center gap-3 text-sm font-semibold text-white">
                                        <input
                                            type="checkbox"
                                            checked={allowStartMileageException}
                                            onChange={(event) => setAllowStartMileageException(event.target.checked)}
                                            className="h-4 w-4 accent-blue-500"
                                        />
                                        Allow mileage exception
                                    </label>
                                    {allowStartMileageException && (
                                        <textarea
                                            value={startMileageExceptionReason}
                                            onChange={(event) => setStartMileageExceptionReason(event.target.value)}
                                            placeholder="Reason for exception"
                                            className="mt-3 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500"
                                        />
                                    )}
                                </div>
                            )}

                            <button
                                onClick={handleStartShift}
                                disabled={trialRequired}
                                className="w-full rounded-xl bg-emerald-500/90 p-3 font-bold text-white shadow-lg shadow-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
                            >
                                {trialRequired ? "Start Trial to Continue" : "Start Shift"}
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push("/")}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 font-bold text-slate-300"
                            >
                                Cancel
                            </button>
                        </div>
                    </section>
                )}
            </div>


        </main>
    );
}
