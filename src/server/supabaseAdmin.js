// Node-only Supabase client using the service-role key. This can bypass RLS
// and must never be imported from browser-rendered code — only from
// src/api/* handlers, which run inside the Vite dev middleware's Node
// process (see vite.config.js). The service-role key is intentionally read
// from non-VITE_-prefixed env vars so Vite never inlines it into client
// bundles.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cached = null;

export const getSupabaseAdmin = () => {
  if (cached) return cached;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Server-side auth checks cannot run without them.",
    );
  }
  cached = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
};
