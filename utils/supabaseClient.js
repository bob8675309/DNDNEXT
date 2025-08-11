// /utils/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

export const supabase =
  globalThis.__sb ||
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

if (!globalThis.__sb) {
  globalThis.__sb = supabase;
  // DEBUG GUARD: catch accidental supabase.from(undefined)
  const _from = supabase.from.bind(supabase);
  supabase.from = (table) => {
    if (!table || typeof table !== "string") {
      console.error("[supabase.from] empty table passed!", table);
      throw new Error("Empty table passed to supabase.from()");
    }
    return _from(table);
  };
}
