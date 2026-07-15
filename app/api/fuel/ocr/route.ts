import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { extractOdometerMileageFromText } from "@/app/lib/fuelOdometerOcr";
import { calculateSubscriptionAccess } from "@/app/lib/subscriptionAccess";

type FuelOcrKind = "odometer" | "receipt";
type FuelOcrConfidence = "high" | "medium" | "low";

type FuelOdometerOcrResult = {
  kind: "odometer";
  mileage: number | null;
  confidence: FuelOcrConfidence;
  notes: string;
};

type FuelReceiptOcrResult = {
  kind: "receipt";
  date: string | null;
  gallons: number | null;
  pricePerGallon: number | null;
  stationName: string | null;
  confidence: FuelOcrConfidence;
  notes: string;
};

type FuelOcrResult = FuelOdometerOcrResult | FuelReceiptOcrResult;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

async function getCurrentUserContext() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return { supabase, user };
}

function isFuelOcrKind(value: unknown): value is FuelOcrKind {
  return value === "odometer" || value === "receipt";
}

function isConfidence(value: unknown): value is FuelOcrConfidence {
  return value === "high" || value === "medium" || value === "low";
}

function isNullableNumber(value: unknown) {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isNullableString(value: unknown) {
  return value === null || typeof value === "string";
}

function isFuelOcrResult(
  value: unknown,
  kind: FuelOcrKind
): value is FuelOcrResult {
  if (!value || typeof value !== "object") return false;

  if (kind === "odometer") {
    const result = value as Partial<FuelOdometerOcrResult>;
    return (
      result.kind === "odometer" &&
      isNullableNumber(result.mileage) &&
      isConfidence(result.confidence) &&
      typeof result.notes === "string"
    );
  }

  const result = value as Partial<FuelReceiptOcrResult>;
  return (
    result.kind === "receipt" &&
    isNullableString(result.date) &&
    isNullableNumber(result.gallons) &&
    isNullableNumber(result.pricePerGallon) &&
    isNullableString(result.stationName) &&
    isConfidence(result.confidence) &&
    typeof result.notes === "string"
  );
}

function getOutputText(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object") return "";

  const body = responseBody as {
    output_text?: unknown;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  if (typeof body.output_text === "string") {
    return body.output_text;
  }

  return (
    body.output
      ?.flatMap((item) => item.content ?? [])
      .find(
        (content) =>
          content.type === "output_text" && typeof content.text === "string"
      )?.text ?? ""
  );
}

function isValidDateParts(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isValidFuelDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [yearText, monthText, dayText] = value.split("-");
  return isValidDateParts(Number(yearText), Number(monthText), Number(dayText));
}

function normalizeYear(yearText: string) {
  if (yearText.length === 2) {
    return 2000 + Number(yearText);
  }

  return Number(yearText);
}

function getReferenceYear(referenceDate: string | null | undefined) {
  if (isValidFuelDate(referenceDate)) {
    return Number(referenceDate.slice(0, 4));
  }

  return new Date().getFullYear();
}

function toIsoFuelDate(year: number, month: number, day: number) {
  if (!isValidDateParts(year, month, day)) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeFuelReceiptDate(
  value: string | null | undefined,
  referenceDate?: string
) {
  if (!value) return null;

  const trimmedValue = value
    .trim()
    .replace(
      /^(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday),?\s+/i,
      ""
    );
  const monthNames: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };

  const isoMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return isValidFuelDate(trimmedValue) ? trimmedValue : null;
  }

  const numericMatch = trimmedValue.match(
    /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?/
  );
  if (numericMatch) {
    const [, monthText, dayText, yearText] = numericMatch;
    const year = yearText ? normalizeYear(yearText) : getReferenceYear(referenceDate);

    return toIsoFuelDate(year, Number(monthText), Number(dayText));
  }

  const monthNameMatch = trimmedValue.match(
    /^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{2}|\d{4}))?(?:\s+(?:at\s+)?.*)?$/i
  );
  if (monthNameMatch) {
    const [, monthName, dayText, yearText] = monthNameMatch;
    const month = monthNames[monthName.toLowerCase()];
    if (!month) return null;

    const year = yearText ? normalizeYear(yearText) : getReferenceYear(referenceDate);
    return toIsoFuelDate(year, month, Number(dayText));
  }

  return null;
}

function getPrompt(kind: FuelOcrKind, referenceDate?: string) {
  if (kind === "odometer") {
    return [
      "Read only the main vehicle odometer mileage from this image.",
      "Prefer numbers near labels like ODO, odometer, mileage, mile, mi, or miles.",
      "Ignore trip mileage, range, MPG, temperature, clock, fuel economy, and warning lights.",
      "If the display says ODO 86034 mi, return 86034.",
      "Return null if there is no clear odometer mileage. Do not guess.",
    ].join(" ");
  }

  return [
    "Extract fuel receipt details only when clearly visible.",
    referenceDate
      ? `Use ${referenceDate} as the reference form date for year context.`
      : "Use the current year as the reference year when needed.",
    "Return the transaction date as YYYY-MM-DD when visible.",
    "If the receipt shows a month and day but no year, infer the year from the reference date year.",
    "Do not default to today's date when the receipt shows a different month or day.",
    "Extract gallons and price per gallon. Ignore total cost unless it helps identify price per gallon.",
    "Extract station name when visible.",
    "Return null for fields that are not clearly visible. Do not guess.",
  ].join(" ");
}

function getSchema(kind: FuelOcrKind) {
  const confidence = {
    type: "string",
    enum: ["high", "medium", "low"],
  };
  const nullableNumber = {
    anyOf: [{ type: "number" }, { type: "null" }],
  };
  const nullableString = {
    anyOf: [{ type: "string" }, { type: "null" }],
  };

  if (kind === "odometer") {
    return {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: { type: "string", enum: ["odometer"] },
        mileage: nullableNumber,
        confidence,
        notes: { type: "string" },
      },
      required: ["kind", "mileage", "confidence", "notes"],
    };
  }

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      kind: { type: "string", enum: ["receipt"] },
      date: nullableString,
      gallons: nullableNumber,
      pricePerGallon: nullableNumber,
      stationName: nullableString,
      confidence,
      notes: { type: "string" },
    },
    required: [
      "kind",
      "date",
      "gallons",
      "pricePerGallon",
      "stationName",
      "confidence",
      "notes",
    ],
  };
}

export async function POST(request: Request) {
  let requestedKind: FuelOcrKind | null = null;

  try {
    const context = await getCurrentUserContext();

    if (!context) {
      return NextResponse.json({ error: "Please log in first." }, { status: 401 });
    }

    const { data: subscriptionData } = await context.supabase
      .from("subscriptions")
      .select("status, trial_end")
      .eq("user_id", context.user.id)
      .maybeSingle();
    const access = calculateSubscriptionAccess({
      subscription: subscriptionData ?? null,
      userCreatedAt: context.user.created_at,
    });

    if (access.trialRequired) {
      return NextResponse.json(
        { error: "Your free preview has ended. Start your free trial to use OCR." },
        { status: 402 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");
    const kindValue = formData.get("kind");
    const referenceDateValue = formData.get("referenceDate");
    const referenceDate =
      typeof referenceDateValue === "string" && isValidFuelDate(referenceDateValue)
        ? referenceDateValue
        : undefined;

    if (!isFuelOcrKind(kindValue)) {
      return NextResponse.json({ error: "Invalid fuel OCR image kind." }, { status: 400 });
    }
    requestedKind = kindValue;

    if (!image || typeof image === "string") {
      return NextResponse.json({ error: "Select one image first." }, { status: 400 });
    }

    if (!image.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Upload a valid image file." },
        { status: 400 }
      );
    }

    if (image.size <= 0) {
      return NextResponse.json({ error: "The selected image is empty." }, { status: 400 });
    }

    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image is too large. Try a photo under 10 MB." },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const base64Image = imageBuffer.toString("base64");

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: getPrompt(kindValue, referenceDate),
              },
              {
                type: "input_image",
                image_url: `data:${image.type};base64,${base64Image}`,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: `fuel_${kindValue}_ocr_result`,
            strict: true,
            schema: getSchema(kindValue),
          },
        },
        max_output_tokens: 500,
      }),
    });

    const rawResponse = await openAiResponse.json().catch(() => null);

    if (!openAiResponse.ok) {
      const message =
        rawResponse && typeof rawResponse === "object" && "error" in rawResponse
          ? (rawResponse as { error?: { message?: string } }).error?.message
          : null;

      return NextResponse.json(
        { error: message || "OpenAI could not read the image.", raw: rawResponse },
        { status: 502 }
      );
    }

    const outputText = getOutputText(rawResponse);
    if (!outputText) {
      return NextResponse.json(
        { error: "OpenAI returned an empty OCR response.", raw: rawResponse },
        { status: 502 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return NextResponse.json(
        { error: "OpenAI returned unreadable JSON.", raw: rawResponse },
        { status: 502 }
      );
    }

    if (!isFuelOcrResult(parsed, kindValue)) {
      return NextResponse.json(
        { error: "OpenAI returned an unexpected OCR shape.", raw: rawResponse },
        { status: 502 }
      );
    }

    const result =
      parsed.kind === "odometer"
        ? {
            ...parsed,
            mileage:
              parsed.mileage ??
              extractOdometerMileageFromText(parsed.notes),
          }
        : {
            ...parsed,
            date: normalizeFuelReceiptDate(parsed.date, referenceDate),
          };

    const warning =
      result.kind === "odometer" && result.mileage === null
        ? "No clear odometer mileage was detected."
        : result.kind === "receipt" &&
            result.date === null &&
            result.gallons === null &&
            result.pricePerGallon === null &&
            result.stationName === null
          ? "No clear fuel receipt values were detected."
          : null;

    return NextResponse.json({
      result,
      raw: parsed,
      warning,
    });
  } catch (error) {
    console.error("Fuel OCR error:", error);
    return NextResponse.json(
      {
        error:
          requestedKind === "odometer"
            ? "Could not read the odometer image. Please enter the mileage manually or try another photo."
            : "Could not process the fuel receipt. Please enter the fuel details manually or try another photo.",
      },
      { status: 500 }
    );
  }
}
