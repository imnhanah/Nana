import React, { useState } from "react";
import { KeyRound } from "lucide-react";
import { updatePassword } from "./auth";

export default function ResetPasswordForm({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (result.error) setError(result.error);
    else setDone(true);
  };

  return (
    <div className="auth-root">
      <style>{RESET_CSS}</style>
      <div className="auth-box">
        <div className="auth-logo">AAICOREFX</div>
        <div className="reset-title"><KeyRound size={18} /> Set a new password</div>
        {done ? (
          <>
            <div className="auth-info">Your password has been updated.</div>
            <button className="auth-submit" onClick={onDone}>Continue to your journal</button>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="auth-field">
              <label>New password</label>
              <input type="password" className="auth-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
            </div>
            <div className="auth-field">
              <label>Confirm new password</label>
              <input type="password" className="auth-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-submit" disabled={busy} type="submit">{busy ? "Please wait…" : "Update Password"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

const RESET_CSS = `
.auth-root { height: 100vh; width: 100%; display: flex; align-items: center; justify-content: center; background: #0B1016; font-family: 'Inter', system-ui, -apple-system, sans-serif; padding: 16px; box-sizing: border-box; }
.auth-box { width: 360px; max-width: 100%; background: #17202B; border: 1px solid #4A525C; border-radius: 14px; padding: 28px; }
.auth-logo { font-family: 'Space Grotesk', sans-serif; font-weight: 800; font-size: 1.35rem; letter-spacing: 1.5px; text-align: center; color: #F4F7FA; margin-bottom: 20px; }
.reset-title { display: flex; align-items: center; gap: 8px; justify-content: center; color: #F4F7FA; font-weight: 700; font-size: 1.0125rem; margin-bottom: 18px; }
.auth-field { margin-bottom: 14px; }
.auth-field label { display: block; font-size: 0.78125rem; letter-spacing: 0.5px; color: #95A1B1; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; }
.auth-input { width: 100%; background: #141B26; border: 1px solid #4A525C; color: #F4F7FA; border-radius: 8px; padding: 10px 12px; font-size: 0.96875rem; font-family: inherit; box-sizing: border-box; }
.auth-input:focus { outline: none; border-color: #8B7CF6; }
.auth-error { background: rgba(188,89,103,0.12); border: 1px solid rgba(188,89,103,0.35); color: #BC5967; font-size: 0.90625rem; padding: 8px 10px; border-radius: 8px; margin-bottom: 12px; }
.auth-info { background: rgba(80,198,160,0.1); border: 1px solid rgba(80,198,160,0.3); color: #50C6A0; font-size: 0.90625rem; padding: 8px 10px; border-radius: 8px; margin-bottom: 14px; }
.auth-submit { width: 100%; background: #50C6A0; color: #0B241E; border: none; border-radius: 8px; padding: 11px; font-weight: 700; font-size: 1rem; cursor: pointer; font-family: inherit; }
.auth-submit:disabled { opacity: 0.6; cursor: default; }
`;
