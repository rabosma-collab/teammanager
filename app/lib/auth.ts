import { User } from '@supabase/supabase-js';
import { createClientComponentClient } from './supabase';

/**
 * Lazy singleton — avoids calling createBrowserClient() at module level
 * which would crash during server-side pre-rendering.
 */
let _supabase: ReturnType<typeof createClientComponentClient> | null = null;

function getAuthClient() {
  if (!_supabase) {
    _supabase = createClientComponentClient();
  }
  return _supabase;
}

/** Get the currently authenticated user, or null if not signed in. */
export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await getAuthClient().auth.getUser();
  return user;
}

/** Sign out the current user. */
export async function signOut(): Promise<void> {
  const { error } = await getAuthClient().auth.signOut();
  if (error) throw error;
}

/** Sign in with email and password. Returns the authenticated user. */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<User> {
  const { data, error } = await getAuthClient().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data.user;
}

/** Create a new account with email, password and full name. Returns the new user. */
export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string,
): Promise<User> {
  const { data, error } = await getAuthClient().auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Registratie mislukt: geen gebruiker ontvangen');
  return data.user;
}

/** Start Google OAuth flow. Redirects the browser to Google sign-in. */
export async function signInWithGoogle(inviteToken?: string): Promise<void> {
  const callbackUrl = new URL('/auth/callback', window.location.origin);
  if (inviteToken) {
    callbackUrl.searchParams.set('inviteToken', inviteToken);
  }
  const { error } = await getAuthClient().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });
  if (error) throw error;
}
