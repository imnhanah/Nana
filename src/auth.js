import { supabase } from "./supabaseClient";

// Maps Supabase's raw error messages/status to something a person should
// actually see. Supabase's own messages are reasonable but inconsistent in
// tone, and some (like the generic "Invalid login credentials") are worth
// rephrasing so people don't think their account was deleted.
function friendlyAuthError(error) {
  if (!error) return "Something went wrong. Please try again.";
  const msg = (error.message || "").toLowerCase();

  if (msg.includes("already registered") || msg.includes("already exists")) {
    return "An account with that email already exists. Try logging in instead.";
  }
  if (msg.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }
  if (msg.includes("email not confirmed")) {
    return "Please confirm your email address first — check your inbox for a confirmation link.";
  }
  if (msg.includes("password should be at least") || msg.includes("password is too short")) {
    return "Password must be at least 6 characters.";
  }
  if (msg.includes("unable to validate email") || msg.includes("invalid email")) {
    return "Please enter a valid email address.";
  }
  if (msg.includes("rate limit")) {
    return "Too many attempts — please wait a moment and try again.";
  }
  if (msg.includes("failed to fetch") || msg.includes("network")) {
    return "Network error — check your connection and try again.";
  }
  if (msg.includes("jwt") || msg.includes("session") || msg.includes("expired")) {
    return "Your session has expired. Please log in again.";
  }
  return error.message || "Something went wrong. Please try again.";
}

export async function signUp({ name, email, password }) {
  const cleanEmail = email.trim().toLowerCase();
  if (!name || !name.trim()) return { error: "Please enter your name." };
  if (!cleanEmail || !cleanEmail.includes("@")) return { error: "Please enter a valid email address." };
  if (!password || password.length < 6) return { error: "Password must be at least 6 characters." };

  try {
    // Supabase enforces email uniqueness itself (auth.users.email is unique) —
    // signUp on an existing address returns an error rather than silently
    // creating a second account or overwriting the first.
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { display_name: name.trim() } },
    });
    if (error) return { error: friendlyAuthError(error) };

    // Supabase's identities array is empty (not an error) when the email
    // already exists but email confirmation is required — this is the one
    // duplicate-signup case that doesn't come back as a thrown error.
    if (data?.user && data.user.identities && data.user.identities.length === 0) {
      return { error: "An account with that email already exists. Try logging in instead." };
    }

    // Also persist the display name to our own profile row (the trigger
    // already created it from the email; this fills in the real name).
    if (data?.user) {
      await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", data.user.id);
    }

    if (data?.user && !data.session) {
      return { needsEmailConfirmation: true };
    }
    return { user: data.user, session: data.session };
  } catch (e) {
    return { error: friendlyAuthError(e) };
  }
}

export async function signIn({ email, password }) {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail) return { error: "Please enter your email." };
  if (!password) return { error: "Please enter your password." };
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) return { error: friendlyAuthError(error) };
    return { user: data.user, session: data.session };
  } catch (e) {
    return { error: friendlyAuthError(e) };
  }
}

export async function signInWithGoogle() {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) return { error: friendlyAuthError(error) };
    return {}; // browser is redirected away; nothing more to do here
  } catch (e) {
    return { error: friendlyAuthError(e) };
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) return { error: friendlyAuthError(error) };
    return {};
  } catch (e) {
    return { error: friendlyAuthError(e) };
  }
}

export async function requestPasswordReset(email) {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) return { error: "Please enter a valid email address." };
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: window.location.origin + "?reset=1",
    });
    if (error) return { error: friendlyAuthError(error) };
    // Supabase intentionally doesn't reveal whether the email exists (to
    // avoid leaking which emails are registered) — the UI should show the
    // same success message either way.
    return { sent: true };
  } catch (e) {
    return { error: friendlyAuthError(e) };
  }
}

export async function updatePassword(newPassword) {
  if (!newPassword || newPassword.length < 6) return { error: "Password must be at least 6 characters." };
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: friendlyAuthError(error) };
    return {};
  } catch (e) {
    return { error: friendlyAuthError(e) };
  }
}

export async function getSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session;
  } catch (e) {
    return null;
  }
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session));
  return () => data.subscription.unsubscribe();
}

export async function getProfile(userId) {
  try {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export { friendlyAuthError };
