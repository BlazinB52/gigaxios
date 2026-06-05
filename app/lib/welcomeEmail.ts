type WelcomeEmailPayload = {
  userId: string;
  email: string;
};

export const WELCOME_EMAIL_SENT_METADATA_KEY = "gigaxios_welcome_email_sent_at";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const WELCOME_EMAIL_FROM = "hello@gigaxios.com";
const WELCOME_EMAIL_SUBJECT =
  "Welcome to GigAxios \u2014 Know what you actually make";

type ResendEmailResponse = {
  id?: string;
  name?: string;
  message?: string;
  statusCode?: number;
};

export async function sendWelcomeEmail(payload: WelcomeEmailPayload) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY for welcome email.");
  }

  const body = [
    "Hi,",
    "",
    "Welcome to GigAxios.",
    "",
    "GigAxios was built to help gig workers understand what they actually earn after fuel expenses, not just what the gig platform reports.",
    "",
    "A few tips to help you get started:",
    "",
    "• For the best experience on iPhone, use Safari and add GigAxios to your Home Screen.",
    "",
    "• Visit Settings first and configure your vehicle information, service intervals, and work preferences.",
    "  Settings: https://gigaxios.com/settings",
    "",
    "• Record your first fuel purchase as soon as possible. Fuel tracking is a key part of GigAxios.",
    "",
    "• Some fuel-related metrics require at least two fuel entries before accurate calculations can be made. This is normal and expected.",
    "",
    "• Start each workday by using the Start Shift button and end your day with End Shift so GigAxios can accurately track your earnings and mileage.",
    "",
    "• Keep fuel, maintenance, and shift records up to date for the most accurate results.",
    "",
    "User Guide: https://gigaxios.com/guide",
    "",
    "Need help?",
    "",
    "Contact us anytime at support@gigaxios.com.",
    "",
    "Thank you for choosing GigAxios.",
    "",
    "Know what you actually make.",
    "",
    "— The GigAxios Team",
  ].join("\n");

  const response = await fetch(RESEND_EMAILS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: WELCOME_EMAIL_FROM,
      to: payload.email,
      subject: WELCOME_EMAIL_SUBJECT,
      text: body,
    }),
  });

  const result = (await response.json().catch(() => ({}))) as ResendEmailResponse;

  if (!response.ok) {
    throw new Error(
      `Resend welcome email failed with status ${response.status}: ${
        result.message || result.name || "Unknown error"
      }`
    );
  }

  console.info("Welcome email sent through Resend.", {
    user_id: payload.userId,
    to: payload.email,
    resend_email_id: result.id ?? null,
  });

  return result;
}
