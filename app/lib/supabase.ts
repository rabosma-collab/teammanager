import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

export const supabaseUrl: string =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hyjewtsmytpfojdvdsta.supabase.co';
export const supabaseAnonKey: string =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_7RPcZtEDjt9YVrP_Ohn1lA_B2FjFKzQ';

/** Browser client with cookie-based auth session handling. */
export function createClientComponentClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/** Simple Supabase client for server components (read-only, no cookie writes). */
export function createServerComponentClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Backwards-compatible default client used by all hooks.
 * Lazy singleton — not instantiated at module level so the module
 * can safely be evaluated on the server during the build step.
 */
let _supabase: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabase() {
  if (!_supabase) {
    _supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

/**
 * Proxy-based lazy export: delegates every property access to the
 * singleton returned by getSupabase().  This allows existing code
 * (`import { supabase }`) to keep working without any changes.
 */
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, prop, receiver) {
    const client = getSupabase();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
