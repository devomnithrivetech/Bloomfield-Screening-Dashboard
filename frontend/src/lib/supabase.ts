import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";

function looksLikeValidUrl(u: string): boolean {
  if (!u) return false;
  if (u.includes("<") || u.includes(">")) return false; // unfilled placeholder
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

export const supabaseConfigured = looksLikeValidUrl(rawUrl) && rawKey.length > 20;

function makeStubClient(): SupabaseClient {
  const reject = () =>
    Promise.reject(
      new Error(
        "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env.local and restart the dev server."
      )
    );
  // Stand-in used only until env vars are set; every call surfaces the same
  // error so the UI can render a friendly setup screen without crashing.
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: reject,
      signUp: reject,
      signOut: async () => ({ error: null }),
      resetPasswordForEmail: reject,
      updateUser: reject,
    },
  } as unknown as SupabaseClient;
}

if (!supabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing or look like placeholders. " +
      "Edit frontend/.env.local with your real project credentials, then restart `npm run dev`."
  );
}

export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(rawUrl, rawKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : makeStubClient();
