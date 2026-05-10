import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseAuthConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseAuth = isSupabaseAuthConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        persistSession: true,
      },
    })
  : null;

export function getPasswordResetRedirectUrl() {
  return (
    import.meta.env.VITE_SUPABASE_PASSWORD_RESET_REDIRECT_URL ||
    `${window.location.origin}/auth/reset-password`
  );
}

function getAuthUrlParams() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return { query, hash };
}

export function getAuthCallbackError() {
  const { query, hash } = getAuthUrlParams();

  return (
    query.get("error_description") ||
    query.get("error") ||
    hash.get("error_description") ||
    hash.get("error") ||
    ""
  );
}

export async function sendPasswordResetEmail(email) {
  if (!supabaseAuth) {
    throw new Error("supabase_not_configured");
  }

  const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordResetRedirectUrl(),
  });

  if (error) {
    throw error;
  }
}

export async function establishPasswordResetSession() {
  if (!supabaseAuth) {
    throw new Error("supabase_not_configured");
  }

  const { query, hash } = getAuthUrlParams();
  const callbackError = getAuthCallbackError();

  if (callbackError) {
    throw new Error("invalid_or_expired_reset_link");
  }

  const code = query.get("code");

  if (code) {
    const { data, error } = await supabaseAuth.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    return data.session;
  }

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");

  if (accessToken && refreshToken) {
    const { data, error } = await supabaseAuth.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      throw error;
    }

    window.history.replaceState({}, document.title, window.location.pathname);
    return data.session;
  }

  const { data, error } = await supabaseAuth.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export async function updateRecoveredPassword(password) {
  if (!supabaseAuth) {
    throw new Error("supabase_not_configured");
  }

  const { error } = await supabaseAuth.auth.updateUser({ password });

  if (error) {
    throw error;
  }
}
