import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

function resolveUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v;
  throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_URL must be set in .env.local');
}

function resolveKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (typeof v === 'string' && v.length > 0) return v;
  throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in .env.local');
}

export const supabaseUrl: string = resolveUrl();
export const supabaseAnonKey: string = resolveKey();

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
