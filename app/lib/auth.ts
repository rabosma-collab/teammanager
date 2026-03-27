import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

const REMEMBER_KEY = 'tm_remember_me';
const SESSION_KEY = 'tm_session_alive';

/** Get the currently authenticated user, or null if not signed in. */
export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Sign out the current user. */
export async function signOut(): Promise<void> {
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Sign in with email and password. Returns the authenticated user. */
export async function signInWithEmail(
  email: string,
  password: string,
  rememberMe = true,
): Promise<User> {
  localStorage.setItem(REMEMBER_KEY, rememberMe ? 'true' : 'false');
  sessionStorage.setItem(SESSION_KEY, '1');
  const { data, error } = await supabase.auth.signInWithPassword({
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
  localStorage.setItem(REMEMBER_KEY, 'true');
  sessionStorage.setItem(SESSION_KEY, '1');
  const { data, error } = await supabase.auth.signUp({
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

/** Send a password reset email to the given address. */
export async function resetPasswordForEmail(email: string): Promise<void> {
  const redirectTo = new URL('/reset-password', window.location.origin).toString();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

/** Update the password for the currently authenticated user. */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Start Google OAuth flow. Redirects the browser to Google sign-in. */
export async function signInWithGoogle(inviteToken?: string): Promise<void> {
  // Default to remember_me=true for OAuth (sessionStorage doesn't survive the redirect)
  localStorage.setItem(REMEMBER_KEY, 'true');
  const callbackUrl = new URL('/auth/callback', window.location.origin);
  if (inviteToken) {
    callbackUrl.searchParams.set('inviteToken', inviteToken);
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });
  if (error) throw error;
}
