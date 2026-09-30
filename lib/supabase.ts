import { createClient } from "@supabase/supabase-js";

// Usa solo la clave PÚBLICA. Nunca pongas aquí la clave secreta (service role).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(url, key);