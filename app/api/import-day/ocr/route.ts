import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isImportDayKind, isImportDayOcrResult } from "@/app/lib/importDayParsing";
import { ImportDayEarningsResult, ImportDayImageKind } from "@/app/lib/importDayTypes";
import { calculateSubscriptionAccess } from "@/app/lib/subscriptionAccess";

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

function getPrompt(kind: ImportDayImageKind) {
  if (kind === "earnings") {
    return [
      "Extract only one-day shift earnings if visible.",
      "Identify platform only when the platform name is visible as text or a clearly visible official logo is present.",
      "Do not infer platform from colors, layout, dollar amounts, wording style, or common app patterns.",
      "If platform is not clearly visible, return platform: null and explain that the platform was not visible in notes.",
      "Extract deliveries, hours worked, base pay, tips, bonuses or other pay, and gross pay.",
      "Never treat negative amounts as earnings. Base pay, tips, other pay, and gross pay must be positive amounts or null.",
      "Lines containing insurance, occupational accident, deduction, fee, withholding, tax, adjustment, charge, or a negative amount are fees or deductions, not earnings.",
      "Extract fees and deductions into deductions using positive amounts. For example Occupational Accident Insurance -$0.43 becomes deductionType Occupational Accident Insurance and amount 0.43.",
      "Use gross earnings labels in this preference order: Gross Total, Daily Earnings, Total Earnings, Total Pay, Payout, Available Balance.",
      "Prefer Gross Total or Daily Earnings over Available Balance. Use Available Balance only when no gross earnings label is visible, set grossPaySource to available_balance, use low confidence, and warn in notes.",
      "If gross earnings are not clearly visible, return grossPay: null.",
      "Extract date only when visible. Preserve the visible year; if only a two-digit year is visible, treat it as a modern 2000s year. Do not guess a year.",
      "If the screenshot appears to show weekly totals instead of one-day totals, say so in notes and use low confidence.",
      "Return null for fields that are not clearly visible. Do not guess.",
    ].join(" ");
  }

  return [
    "Read only the odometer mileage from this image.",
    "Ignore trip mileage, range, MPG, temperature, clock, fuel economy, and warning lights.",
    "Return null if there is no clear odometer mileage. Do not guess.",
  ].join(" ");
}

function getSchema(kind: ImportDayImageKind) {
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
  const grossPaySource = {
    anyOf: [
      {
        type: "string",
        enum: [
          "gross_total",
          "daily_earnings",
          "total_earnings",
          "total_pay",
          "payout",
          "available_balance",
        ],
      },
      { type: "null" },
    ],
  };

  if (kind === "earnings") {
    return {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: { type: "string", enum: ["earnings"] },
        platform: nullableString,
        date: nullableString,
        deliveries: nullableNumber,
        hoursWorked: nullableNumber,
        basePay: nullableNumber,
        tips: nullableNumber,
        otherPay: nullableNumber,
        grossPay: nullableNumber,
        grossPaySource,
        deductions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              deductionType: { type: "string" },
              amount: { type: "number" },
              notes: nullableString,
            },
            required: ["deductionType", "amount", "notes"],
          },
        },
        confidence,
        notes: { type: "string" },
      },
      required: [
        "kind",
        "platform",
        "date",
        "deliveries",
        "hoursWorked",
        "basePay",
        "tips",
        "otherPay",
        "grossPay",
        "grossPaySource",
        "deductions",
        "confidence",
        "notes",
      ],
    };
  }

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      kind: { type: "string", enum: [kind] },
      mileage: nullableNumber,
      confidence,
      notes: { type: "string" },
    },
    required: ["kind", "mileage", "confidence", "notes"],
  };
}

function normalizeEarningsResult(result: ImportDayEarningsResult): ImportDayEarningsResult {
  const deductions = result.deductions
    .map((deduction) => ({
      ...deduction,
      deductionType: deduction.deductionType.trim(),
      amount: Math.abs(deduction.amount),
      notes: deduction.notes?.trim() || null,
    }))
    .filter((deduction) => deduction.deductionType && deduction.amount > 0);

  return {
    ...result,
    basePay: result.basePay !== null && result.basePay >= 0 ? result.basePay : null,
    tips: result.tips !== null && result.tips >= 0 ? result.tips : null,
    otherPay: result.otherPay !== null && result.otherPay >= 0 ? result.otherPay : null,
    grossPay: result.grossPay !== null && result.grossPay >= 0 ? result.grossPay : null,
    deductions,
    confidence:
      result.grossPaySource === "available_balance" ? "low" : result.confidence,
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

    if (!isImportDayKind(kindValue)) {
      return NextResponse.json({ error: "Invalid Import Day image kind." }, { status: 400 });
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
            name: `import_day_${kindValue}_ocr_result`,
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

    if (!isImportDayOcrResult(parsed, kindValue)) {
      return NextResponse.json(
        { error: "OpenAI returned an unexpected OCR shape.", raw: rawResponse },
        { status: 502 }
      );
    }

    const result =
      parsed.kind === "earnings" ? normalizeEarningsResult(parsed) : parsed;
    const warning =
      result.kind === "earnings" && result.grossPay === null
        ? "Scan could not confirm gross earnings. Please enter pay manually."
        : result.kind === "earnings" && result.deductions.length > 0
          ? "Deduction found. Review Fees & Deductions before saving."
          : result.kind === "earnings" && result.grossPaySource === "available_balance"
            ? "Partial scan applied. Available Balance was used as a low-confidence payout value."
            : "mileage" in result && result.mileage === null
        ? "No clear odometer mileage was detected."
        : null;

    return NextResponse.json({
      result,
      raw: parsed,
      warning,
    });
  } catch (error) {
    console.error("Import Day OCR error:", error);
    return NextResponse.json(
      { error: "Could not process the Import Day image." },
      { status: 500 }
    );
  }
}
