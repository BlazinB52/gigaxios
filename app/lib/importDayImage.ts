export type ImportDayConversionStatus = "pending" | "success" | "failed";

export type ImportDayHeicDetection = {
  isHeic: boolean;
  reason: string;
};

export function formatImportDayBytes(size: number | undefined) {
  if (typeof size !== "number") return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
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

export async function detectImportDayHeic(
  file: File
): Promise<ImportDayHeicDetection> {
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

export function isImportDayAcceptedImage(
  file: File,
  heicDetection: ImportDayHeicDetection
) {
  return file.type.startsWith("image/") || heicDetection.isHeic;
}

export function getImportDayConversionErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown conversion error";
}

export async function convertImportDayHeicToJpeg(file: File) {
  const { heicTo } = await import("heic-to/next");
  const jpegBlob = await heicTo({
    blob: file,
    type: "image/jpeg",
    quality: 0.92,
  });
  const baseName = file.name.replace(/\.(heic|heif)$/i, "") || "import-day";

  return new File([jpegBlob], `${baseName}-converted.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

