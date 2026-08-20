import React, { useState } from "react";
import { LogIn, UserPlus, Mail, ArrowLeft } from "lucide-react";
import { signUp, signIn, signInWithGoogle, requestPasswordReset } from "./auth";

export default function AuthPage({ onAuthed, brand = "AAICOREFX" }) {
  const [mode, setMode] = useState("login"); // 'login' | 'signup' | 'forgot'
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => { setError(""); setInfo(""); };

  const submit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    reset();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const result = await requestPasswordReset(email);
        if (result.error) setError(result.error);
        else setInfo("If an account exists for that email, a reset link is on its way — check your inbox.");
      } else if (mode === "signup") {
        const result = await signUp({ name, email, password });
        if (result.error) setError(result.error);
        else if (result.needsEmailConfirmation) setInfo("Almost there — check your email to confirm your account, then log in.");
        else if (result.user) onAuthed(result.user);
      } else {
        const result = await signIn({ email, password });
        if (result.error) setError(result.error);
        else if (result.user) onAuthed(result.user);
      }
    } catch (e) {
      setError("Something went wrong: " + (e && e.message ? e.message : "unknown error"));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    reset();
    setBusy(true);
    const result = await signInWithGoogle();
    if (result.error) { setError(result.error); setBusy(false); }
    // On success the browser is redirected to Google, so nothing else runs here.
  };

  return (
    <div className="auth-root">
      <style>{AUTH_CSS}</style>
      <div className="auth-box">
        <div className="auth-logo">{brand}</div>

        {mode !== "forgot" && (
          <div className="auth-tabs">
            <button className={`auth-tab ${mode === "login" ? "auth-tab-active" : ""}`} onClick={() => { setMode("login"); reset(); }}>Log In</button>
            <button className={`auth-tab ${mode === "signup" ? "auth-tab-active" : ""}`} onClick={() => { setMode("signup"); reset(); }}>Sign Up</button>
          </div>
        )}

        {mode === "forgot" && (
          <button className="auth-back" onClick={() => { setMode("login"); reset(); }}><ArrowLeft size={14} /> Back to log in</button>
        )}

        {mode !== "forgot" && (
          <>
            <button className="auth-google-btn" disabled={busy} onClick={handleGoogle}>
              <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z" /><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" /><path fill="#FBBC05" d="M3.96 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z" /><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" /></svg>
              Continue with Google
            </button>
            <div className="auth-divider"><span>or use email</span></div>
          </>
        )}

        <form onSubmit={submit} noValidate>
          {mode === "signup" && (
            <div className="auth-field">
              <label>Name</label>
              <input className="auth-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
            </div>
          )}
          <div className="auth-field">
            <label>Email</label>
            <input type="email" className="auth-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </div>
          {mode !== "forgot" && (
            <div className="auth-field">
              <label>Password</label>
              <input type="password" className="auth-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            </div>
          )}
          {mode === "login" && (
            <button type="button" className="auth-forgot-link" onClick={() => { setMode("forgot"); reset(); }}>Forgot password?</button>
          )}
          {error && <div className="auth-error">{error}</div>}
          {info && <div className="auth-info"><Mail size={14} /> {info}</div>}
          <button className="auth-submit" disabled={busy} type="submit">
            {mode === "signup" ? <UserPlus size={16} /> : mode === "forgot" ? <Mail size={16} /> : <LogIn size={16} />}
            {busy ? "Please wait…" : mode === "signup" ? "Create Account" : mode === "forgot" ? "Send Reset Link" : "Log In"}
          </button>
        </form>

        {mode !== "forgot" && (
          <div className="auth-switch">
            {mode === "login" ? (
              <>Don't have an account? <button onClick={() => { setMode("signup"); reset(); }}>Sign up</button></>
            ) : (
              <>Already have an account? <button onClick={() => { setMode("login"); reset(); }}>Log in</button></>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const AUTH_CSS = `
.auth-root { height: 100vh; width: 100%; display: flex; align-items: center; justify-content: center; background: #0A0B0D; font-family: 'Inter', system-ui, -apple-system, sans-serif; padding: 16px; box-sizing: border-box; }
.auth-box { width: 360px; max-width: 100%; background: #131519; border: 1px solid #262A31; border-radius: 14px; padding: 28px; }
.auth-logo { font-family: 'Space Grotesk', sans-serif; font-weight: 800; font-size: 20px; letter-spacing: 1.5px; text-align: center; color: #F4F5F7; margin-bottom: 20px; }
.auth-tabs { display: flex; gap: 4px; background: #1B1E24; border-radius: 8px; padding: 3px; margin-bottom: 18px; }
.auth-tab { flex: 1; background: none; border: none; color: #8B8F98; padding: 8px; border-radius: 6px; font-size: 13px; cursor: pointer; font-family: inherit; font-weight: 600; }
.auth-tab-active { background: #131519; color: #F4F5F7; }
.auth-back { display: flex; align-items: center; gap: 6px; background: none; border: none; color: #8B8F98; font-size: 12.5px; cursor: pointer; font-family: inherit; margin-bottom: 16px; padding: 0; }
.auth-back:hover { color: #F4F5F7; }
.auth-google-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; background: #1B1E24; border: 1px solid #2A2F38; color: #F4F5F7; border-radius: 8px; padding: 10px; font-size: 13.5px; font-weight: 600; cursor: pointer; font-family: inherit; margin-bottom: 14px; transition: border-color 0.15s ease, transform 0.15s ease; }
.auth-google-btn:hover { border-color: #3A4150; transform: translateY(-1px); }
.auth-google-btn:disabled { opacity: 0.6; cursor: default; }
.auth-field { margin-bottom: 14px; }
.auth-field label { display: block; font-size: 10.5px; letter-spacing: 0.5px; color: #8B8F98; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; }
.auth-input { width: 100%; background: #1B1E24; border: 1px solid #262A31; color: #F4F5F7; border-radius: 8px; padding: 10px 12px; font-size: 13.5px; font-family: inherit; box-sizing: border-box; }
.auth-input:focus { outline: none; border-color: #8B7CF6; }
.auth-forgot-link { display: block; margin: -6px 0 14px auto; background: none; border: none; color: #8B7CF6; font-size: 12px; cursor: pointer; font-family: inherit; padding: 0; }
.auth-error { background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.35); color: #F87171; font-size: 12.5px; padding: 8px 10px; border-radius: 8px; margin-bottom: 12px; }
.auth-info { display: flex; align-items: center; gap: 8px; background: rgba(77,255,102,0.1); border: 1px solid rgba(77,255,102,0.3); color: #4DFF66; font-size: 12.5px; padding: 8px 10px; border-radius: 8px; margin-bottom: 12px; }
.auth-submit { width: 100%; background: #4DFF66; color: #052E1B; border: none; border-radius: 8px; padding: 11px; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: inherit; }
.auth-submit:disabled { opacity: 0.6; cursor: default; }
.auth-switch { text-align: center; font-size: 12.5px; color: #8B8F98; margin-top: 16px; }
.auth-switch button { background: none; border: none; color: #8B7CF6; cursor: pointer; font-size: 12.5px; font-family: inherit; font-weight: 600; padding: 0; margin-left: 2px; }
`;
