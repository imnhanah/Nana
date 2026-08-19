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
.auth-root { height: 100vh; width: 100%; display: flex; align-items: center; justify-content: center; background: #0A0B0D; font-family: 'Inter', system-ui, -apple-system, sans-serif; padding: 16px; box-sizing: border-box; }
.auth-box { width: 360px; max-width: 100%; background: #131519; border: 1px solid #262A31; border-radius: 14px; padding: 28px; }
.auth-logo { font-family: 'Space Grotesk', sans-serif; font-weight: 800; font-size: 20px; letter-spacing: 1.5px; text-align: center; color: #F4F5F7; margin-bottom: 20px; }
.reset-title { display: flex; align-items: center; gap: 8px; justify-content: center; color: #F4F5F7; font-weight: 700; font-size: 15px; margin-bottom: 18px; }
.auth-field { margin-bottom: 14px; }
.auth-field label { display: block; font-size: 10.5px; letter-spacing: 0.5px; color: #8B8F98; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; }
.auth-input { width: 100%; background: #1B1E24; border: 1px solid #262A31; color: #F4F5F7; border-radius: 8px; padding: 10px 12px; font-size: 13.5px; font-family: inherit; box-sizing: border-box; }
.auth-input:focus { outline: none; border-color: #8B7CF6; }
.auth-error { background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.35); color: #F87171; font-size: 12.5px; padding: 8px 10px; border-radius: 8px; margin-bottom: 12px; }
.auth-info { background: rgba(77,255,102,0.1); border: 1px solid rgba(77,255,102,0.3); color: #4DFF66; font-size: 12.5px; padding: 8px 10px; border-radius: 8px; margin-bottom: 14px; }
.auth-submit { width: 100%; background: #4DFF66; color: #052E1B; border: none; border-radius: 8px; padding: 11px; font-weight: 700; font-size: 14px; cursor: pointer; font-family: inherit; }
.auth-submit:disabled { opacity: 0.6; cursor: default; }
`;
