import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
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

function getPrompt(kind: FuelOcrKind) {
  if (kind === "odometer") {
    return [
      "Read only the main vehicle odometer mileage from this image.",
      "Ignore trip mileage, range, MPG, temperature, clock, fuel economy, and warning lights.",
      "Return null if there is no clear odometer mileage. Do not guess.",
    ].join(" ");
  }

  return [
    "Extract fuel receipt details only when clearly visible.",
    "Return the transaction date as YYYY-MM-DD when visible. Do not guess a missing year.",
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

    if (!isFuelOcrKind(kindValue)) {
      return NextResponse.json({ error: "Invalid fuel OCR image kind." }, { status: 400 });
    }

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
                text: getPrompt(kindValue),
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

    const warning =
      parsed.kind === "odometer" && parsed.mileage === null
        ? "No clear odometer mileage was detected."
        : parsed.kind === "receipt" &&
            parsed.date === null &&
            parsed.gallons === null &&
            parsed.pricePerGallon === null &&
            parsed.stationName === null
          ? "No clear fuel receipt values were detected."
          : null;

    return NextResponse.json({
      result: parsed,
      raw: parsed,
      warning,
    });
  } catch (error) {
    console.error("Fuel OCR error:", error);
    return NextResponse.json(
      { error: "Could not process the fuel image." },
      { status: 500 }
    );
  }
}
