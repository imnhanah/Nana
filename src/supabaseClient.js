import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fails loudly and early rather than silently breaking auth later —
  // this is almost always a missing/misnamed .env file.
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
    "Copy .env.example to .env and fill in your Supabase project's URL and anon key."
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true, // keeps the session in localStorage's Supabase-managed slot across browser restarts
    autoRefreshToken: true, // silently refreshes the JWT before it expires
    detectSessionInUrl: true, // required for the password-reset email link flow
  },
});
