import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type OcrResult = {
  mileage: number | null;
  confidence: "high" | "medium" | "low";
  notes: string;
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

async function getCurrentUser() {
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

  return user;
}

function isOcrResult(value: unknown): value is OcrResult {
  if (!value || typeof value !== "object") return false;

  const result = value as Partial<OcrResult>;
  const mileageIsValid =
    result.mileage === null ||
    (typeof result.mileage === "number" && Number.isFinite(result.mileage));

  return (
    mileageIsValid &&
    ["high", "medium", "low"].includes(result.confidence ?? "") &&
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
      .find((content) => content.type === "output_text" && typeof content.text === "string")
      ?.text ?? ""
  );
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Please log in first." }, { status: 401 });
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

    if (!image || typeof image === "string") {
      return NextResponse.json({ error: "Select one odometer image first." }, { status: 400 });
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
                text:
                  "Read the odometer mileage from this image. Ignore trip mileage, range, temperature, clock, MPG, fuel economy, and warning lights. Return null if there is no clear odometer mileage. Do not guess if unsure.",
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
            name: "odometer_ocr_result",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                mileage: {
                  anyOf: [{ type: "number" }, { type: "null" }],
                  description: "The main odometer mileage reading, or null if unclear.",
                },
                confidence: {
                  type: "string",
                  enum: ["high", "medium", "low"],
                },
                notes: {
                  type: "string",
                  description: "Short plain-English explanation of what was read.",
                },
              },
              required: ["mileage", "confidence", "notes"],
            },
          },
        },
        max_output_tokens: 300,
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

    if (!isOcrResult(parsed)) {
      return NextResponse.json(
        { error: "OpenAI returned an unexpected OCR shape.", raw: rawResponse },
        { status: 502 }
      );
    }

    const unreadableMileage = parsed.mileage === null;

    return NextResponse.json({
      result: parsed,
      raw: parsed,
      warning: unreadableMileage ? "No clear odometer mileage was detected." : null,
    });
  } catch (error) {
    console.error("OCR test error:", error);
    return NextResponse.json(
      { error: "Could not process the odometer image." },
      { status: 500 }
    );
  }
}
