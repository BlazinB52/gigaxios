import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";
import {
  WELCOME_EMAIL_SENT_METADATA_KEY,
  sendWelcomeEmail,
} from "@/app/lib/welcomeEmail";

const NEW_ACCOUNT_EMAIL_WINDOW_MS = 10 * 60 * 1000;

function isNewAccount(createdAt: string | undefined) {
  if (!createdAt) return false;

  const createdTime = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTime)) return false;

  return Date.now() - createdTime <= NEW_ACCOUNT_EMAIL_WINDOW_MS;
}

export async function sendWelcomeEmailForNewUser(userId: string) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (error || !data.user) {
      console.warn("Could not load user for welcome email:", error);
      return;
    }

    const user = data.user;
    const appMetadata = user.app_metadata ?? {};

    if (appMetadata[WELCOME_EMAIL_SENT_METADATA_KEY]) {
      return;
    }

    if (!isNewAccount(user.created_at)) {
      return;
    }

    if (!user.email) {
      console.warn("Skipping welcome email because the new user has no email.", {
        userId,
      });
      return;
    }

    const sentAt = new Date().toISOString();

    try {
      await sendWelcomeEmail({
        userId,
        email: user.email,
      });
    } catch (emailError) {
      console.warn("Failed to send welcome email:", emailError);
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        app_metadata: {
          ...appMetadata,
          [WELCOME_EMAIL_SENT_METADATA_KEY]: sentAt,
        },
      }
    );

    if (updateError) {
      console.warn("Could not mark welcome email as sent:", updateError);
    }
  } catch (error) {
    console.warn("Welcome email handling failed:", error);
  }
}
