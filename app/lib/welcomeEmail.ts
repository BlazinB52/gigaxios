type WelcomeEmailPayload = {
  userId: string;
  email: string;
};

export const WELCOME_EMAIL_SENT_METADATA_KEY = "gigaxios_welcome_email_sent_at";

export async function sendWelcomeEmail(payload: WelcomeEmailPayload) {
  const subject = "Welcome to GigAxios — Know what you actually make";
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

  // TODO: Wire this to the production email provider once configured.
  // Expected future config: provider API key, verified sender domain for
  // hello@gigaxios.com, and any required template/domain settings. Until then,
  // log the intended welcome email server-side without blocking signup.
  console.warn("Welcome email provider is not configured yet.");
  console.info("Intended welcome email:", {
    from: "hello@gigaxios.com",
    to: payload.email,
    subject,
    body,
    user_id: payload.userId,
  });
}
