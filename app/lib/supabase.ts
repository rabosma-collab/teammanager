import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

const supabaseUrl: string =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://hyjewtsmytpfojdvdsta.supabase.co';
const supabaseAnonKey: string =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_7RPcZtEDjt9YVrP_Ohn1lA_B2FjFKzQ';

/** Browser client with cookie-based auth session handling. */
export function createClientComponentClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/** Simple Supabase client for server components (read-only, no cookie writes). */
export function createServerComponentClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Backwards-compatible default client.
 * All existing hooks and components import this.
 */
export const supabase = createClientComponentClient();
