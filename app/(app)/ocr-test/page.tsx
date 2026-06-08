"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

type OcrResult = {
  mileage: number | null;
  confidence: "high" | "medium" | "low";
  notes: string;
};

type OcrApiResponse = {
  result?: OcrResult;
  raw?: unknown;
  warning?: string | null;
  error?: string;
};

type ConversionStatus = "pending" | "success" | "failed";

type HeicDetection = {
  isHeic: boolean;
  reason: string;
};

const OCR_TEST_ENABLED = process.env.NODE_ENV === "development";

function formatMileage(mileage: number | null | undefined) {
  if (typeof mileage !== "number") return "Unreadable";
  return mileage.toLocaleString("en-US");
}

function formatBytes(size: number | undefined) {
  if (typeof size !== "number") return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function hasHeicNameOrType(file: File) {
  const extension = getFileExtension(file.name);
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    extension === "heic" ||
    extension === "heif"
  );
}

async function hasHeifSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const text = String.fromCharCode(...bytes);
  const brand = text.slice(8, 12).toLowerCase();
  const compatibleBrands = text.slice(12).toLowerCase();

  return (
    text.slice(4, 8) === "ftyp" &&
    ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].some(
      (candidate) => brand === candidate || compatibleBrands.includes(candidate)
    )
  );
}

async function detectHeic(file: File): Promise<HeicDetection> {
  const extension = getFileExtension(file.name);

  if (file.type === "image/heic" || file.type === "image/heif") {
    return { isHeic: true, reason: `MIME type ${file.type}` };
  }

  if (extension === "heic" || extension === "heif") {
    return {
      isHeic: true,
      reason: file.type
        ? `.${extension} filename extension`
        : `empty MIME type with .${extension} filename extension`,
    };
  }

  if (await hasHeifSignature(file)) {
    return { isHeic: true, reason: "HEIF file signature" };
  }

  return { isHeic: false, reason: "No HEIC/HEIF signal found" };
}

function isAcceptedImage(file: File, heicDetection: HeicDetection) {
  return file.type.startsWith("image/") || heicDetection.isHeic;
}

function getConversionErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown conversion error";
}

async function convertHeicToJpeg(file: File) {
  const { heicTo } = await import("heic-to/next");
  const jpegBlob = await heicTo({
    blob: file,
    type: "image/jpeg",
    quality: 0.92,
  });
  const baseName = file.name.replace(/\.(heic|heif)$/i, "") || "odometer-photo";
  const jpegName = `${baseName}-converted.jpg`;

  return new File([jpegBlob], jpegName || "odometer-photo.jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export default function OcrTestPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedFile, setProcessedFile] = useState<File | null>(null);
  const [sentFile, setSentFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState<OcrResult | null>(null);
  const [rawJson, setRawJson] = useState<unknown>(null);
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [heicDetection, setHeicDetection] = useState<HeicDetection>({
    isHeic: false,
    reason: "No file selected",
  });
  const [conversionStatus, setConversionStatus] = useState<ConversionStatus>("pending");
  const [conversionErrorMessage, setConversionErrorMessage] = useState("");
  const previewUrlRef = useRef("");

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  function replacePreviewUrl(file: File | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }

    if (!file) {
      setPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
  }

  function clearTest() {
    setSelectedFile(null);
    setProcessedFile(null);
    setSentFile(null);
    replacePreviewUrl(null);
    setResult(null);
    setRawJson(null);
    setWarning("");
    setError("");
    setHeicDetection({ isHeic: false, reason: "No file selected" });
    setConversionStatus("pending");
    setConversionErrorMessage("");
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setProcessedFile(null);
    setSentFile(null);
    replacePreviewUrl(null);
    setResult(null);
    setRawJson(null);
    setWarning("");
    setError("");
    setHeicDetection({ isHeic: false, reason: file ? "Checking file" : "No file selected" });
    setConversionStatus("pending");
    setConversionErrorMessage("");

    if (!file) {
      return;
    }

    setIsProcessingImage(true);
    try {
      const detectedHeic = await detectHeic(file);
      setHeicDetection(detectedHeic);

      if (!isAcceptedImage(file, detectedHeic)) {
        setProcessedFile(null);
        setConversionStatus("failed");
        setError("Upload a valid image file.");
        return;
      }

      const readyFile = detectedHeic.isHeic ? await convertHeicToJpeg(file) : file;
      setProcessedFile(readyFile);
      setConversionStatus("success");
      replacePreviewUrl(readyFile);
    } catch (conversionError) {
      const message = getConversionErrorMessage(conversionError);
      setProcessedFile(null);
      replacePreviewUrl(null);
      setConversionStatus("failed");
      setConversionErrorMessage(message);
      setError(
        "This photo format could not be read. Please retake the photo or upload a JPG/PNG."
      );
    } finally {
      setIsProcessingImage(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setWarning("");
    setResult(null);
    setRawJson(null);
    setSentFile(null);

    if (!OCR_TEST_ENABLED) {
      setError("OCR test is only available in development.");
      return;
    }

    if (!selectedFile) {
      setError("Select one odometer image first.");
      return;
    }

    if (!processedFile) {
      setError(
        "This photo is still being prepared or could not be read. Please retake the photo or upload a JPG/PNG."
      );
      return;
    }

    if (!processedFile.type.startsWith("image/")) {
      setError("Upload a valid image file.");
      return;
    }

    const formData = new FormData();
    formData.append("image", processedFile);
    setSentFile(processedFile);

    setIsReading(true);
    try {
      const response = await fetch("/api/ocr-test", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as OcrApiResponse;

      setRawJson(data.raw ?? data);

      if (!response.ok) {
        setError(data.error || "OpenAI could not read the image.");
        return;
      }

      if (!data.result) {
        setError("OpenAI returned no OCR result.");
        return;
      }

      setResult(data.result);
      if (data.warning) {
        setWarning(data.warning);
      }
    } catch {
      setError("OpenAI request failed. Please try again.");
    } finally {
      setIsReading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#020814] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-28 pt-5">
        <header className="mb-5">
          <p className="text-sm font-semibold tracking-wide text-blue-400">
            Private Test
          </p>
          <h1 className="mt-2 text-3xl font-bold">Odometer OCR</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Upload one odometer photo. The image is sent to OpenAI for this request
            only and is not saved.
          </p>
        </header>

        {!OCR_TEST_ENABLED && (
          <section className="mb-5 rounded-3xl border border-amber-400/30 bg-amber-950/20 p-5">
            <p className="text-sm font-semibold text-amber-300">
              Development only
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-100">
              OCR test is only available in development.
            </p>
          </section>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="rounded-3xl border border-blue-500/30 bg-blue-950/30 p-5 shadow-[0_0_40px_rgba(59,130,246,0.15)]">
            <label className="block text-sm font-semibold text-slate-200" htmlFor="odometer-photo">
              Odometer photo
            </label>
            <input
              id="odometer-photo"
              type="file"
              accept="image/*,.heic,.heif"
              capture="environment"
              onChange={handleFileChange}
              className="mt-3 block w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 file:mr-4 file:rounded-full file:border-0 file:bg-blue-500 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
            />

            <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-xs leading-5 text-slate-300">
              <p className="font-semibold text-slate-200">Upload debug</p>
              <dl className="mt-2 grid grid-cols-[120px_1fr] gap-x-3 gap-y-1">
                <dt className="text-slate-500">Selected name</dt>
                <dd className="break-all">{selectedFile?.name ?? "-"}</dd>
                <dt className="text-slate-500">Selected type</dt>
                <dd>{selectedFile?.type || "-"}</dd>
                <dt className="text-slate-500">Selected size</dt>
                <dd>{formatBytes(selectedFile?.size)}</dd>
                <dt className="text-slate-500">HEIC detected</dt>
                <dd>{heicDetection.isHeic ? `Yes (${heicDetection.reason})` : `No (${heicDetection.reason})`}</dd>
                <dt className="text-slate-500">Conversion</dt>
                <dd className="capitalize">{conversionStatus}</dd>
                <dt className="text-slate-500">Conversion error</dt>
                <dd className="break-all">{conversionErrorMessage || "-"}</dd>
                <dt className="text-slate-500">Processed name</dt>
                <dd className="break-all">{processedFile?.name ?? "-"}</dd>
                <dt className="text-slate-500">Processed type</dt>
                <dd>{processedFile?.type || "-"}</dd>
                <dt className="text-slate-500">Processed size</dt>
                <dd>{formatBytes(processedFile?.size)}</dd>
                <dt className="text-slate-500">Sending file</dt>
                <dd className="break-all">
                  {sentFile
                    ? `${sentFile.name} (${sentFile.type || "unknown type"}, ${formatBytes(sentFile.size)})`
                    : processedFile
                      ? `${processedFile.name} will be sent`
                      : "-"}
                </dd>
              </dl>
            </div>

            {previewUrl ? (
              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
                <Image
                  src={previewUrl}
                  alt="Selected odometer preview"
                  width={900}
                  height={700}
                  unoptimized
                  className="max-h-[420px] w-full object-contain"
                />
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 px-4 py-10 text-center text-sm text-slate-400">
                {isProcessingImage ? "Preparing image preview..." : "No image selected yet."}
              </div>
            )}

            <div className="mt-5 grid gap-3">
              <button
                type="submit"
                disabled={!OCR_TEST_ENABLED || isReading || isProcessingImage}
                className="w-full rounded-full bg-blue-500 px-4 py-3 text-base font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {!OCR_TEST_ENABLED
                  ? "Development Only"
                  : isProcessingImage
                  ? "Preparing image..."
                  : isReading
                    ? "Reading mileage..."
                    : "Read Mileage"}
              </button>

              <button
                type="button"
                onClick={clearTest}
                className="w-full rounded-full border border-slate-700 bg-slate-950 px-4 py-3 text-base font-bold text-slate-200"
              >
                Clear / Retake
              </button>
            </div>
          </section>
        </form>

        {(error || warning) && (
          <section className="mt-5 rounded-3xl border border-amber-400/30 bg-amber-950/20 p-5">
            <p className="text-sm font-semibold text-amber-300">
              {error ? "Could not read mileage" : "Review result"}
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-100">
              {error || warning}
            </p>
          </section>
        )}

        <section className="mt-5 rounded-3xl border border-slate-700 bg-slate-950/80 p-5">
          <h2 className="text-xl font-bold">Detected Result</h2>

          <div className="mt-5 grid gap-4">
            <div className="rounded-2xl bg-slate-900 p-4">
              <p className="text-xs font-semibold tracking-wide text-slate-400">
                Detected mileage
              </p>
              <p className="mt-2 text-3xl font-bold">
                {formatMileage(result?.mileage)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-900 p-4">
              <p className="text-xs font-semibold tracking-wide text-slate-400">
                Confidence
              </p>
              <p className="mt-2 text-lg font-semibold capitalize">
                {result?.confidence ?? "Pending"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-900 p-4">
              <p className="text-xs font-semibold tracking-wide text-slate-400">
                Notes
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                {result?.notes ?? "Upload an odometer image to test OCR."}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-slate-700 bg-slate-950/80 p-5">
          <h2 className="text-xl font-bold">Raw JSON</h2>
          <pre className="mt-4 max-h-80 overflow-auto rounded-2xl bg-black/40 p-4 text-xs leading-5 text-slate-300">
            {rawJson ? JSON.stringify(rawJson, null, 2) : "No response yet."}
          </pre>
        </section>
      </div>
    </main>
  );
}
