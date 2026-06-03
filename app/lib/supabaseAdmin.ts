import { SupabaseClient, createClient } from "@supabase/supabase-js";

let supabaseAdminClient: SupabaseClient<any> | null = null;

export function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  supabaseAdminClient ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  return supabaseAdminClient;
}
