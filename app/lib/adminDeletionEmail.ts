type AccountDeletedEmailPayload = {
  userId: string;
  email: string;
  reason: string;
  deletedAt: string;
  stripeCancellationAttempted: boolean;
  appRecordsDeleted: boolean;
  authUserDeleted: boolean;
};

export async function sendAccountDeletedAdminEmail(
  payload: AccountDeletedEmailPayload
) {
  const subject = "GigAxios account deleted";
  const body = [
    `user_id: ${payload.userId}`,
    `email: ${payload.email}`,
    `reason selected: ${payload.reason || "Not provided"}`,
    `deleted_at: ${payload.deletedAt}`,
    `Stripe cancellation attempted: ${
      payload.stripeCancellationAttempted ? "Yes" : "No"
    }`,
    `GigAxios app records deleted: ${payload.appRecordsDeleted ? "Yes" : "No"}`,
    `Supabase auth user deleted: ${payload.authUserDeleted ? "Yes" : "No"}`,
  ].join("\n");

  // TODO: Wire this to the production email provider once configured.
  // Expected future config: provider API key, sender address, and any required
  // template/domain settings. Until then, log the intended internal email
  // payload server-side without blocking account deletion.
  console.warn("Admin account deletion email provider is not configured yet.");
  console.info("Intended admin email:", {
    to: "admin@gigaxios.com",
    subject,
    body,
  });
}
