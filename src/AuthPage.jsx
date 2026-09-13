import React, { useState } from 'react';
import { BarChart3, BookOpen, ShieldCheck, ClipboardCheck, ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { signUp, signIn, signInWithGoogle, requestPasswordReset } from './auth';

export default function AuthPage({ onAuthed, initialMode = 'login', onModeChange, onBack, brand = 'AAICOREFX' }) {
  const [mode, setMode] = useState(initialMode);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const switchMode = (next) => { setMode(next); setPassword(''); setShowPassword(false); setError(''); setInfo(''); if (next !== 'forgot') onModeChange?.(next); };
  const submit = async (event) => {
    event.preventDefault(); if (busy) return;
    setError(''); setInfo(''); setBusy(true);
    try {
      const result = mode === 'forgot' ? await requestPasswordReset(email) : mode === 'signup' ? await signUp({ name: [firstName.trim(), lastName.trim()].join(' ').trim(), email, password }) : await signIn({ email, password });
      if (result.error) setError(result.error);
      else if (mode === 'forgot') setInfo('If an account exists for that email, a reset link is on its way. Check your inbox.');
      else if (result.needsEmailConfirmation) setInfo('Check your email to confirm your account, then sign in.');
      else if (result.user) onAuthed(result.user);
    } catch { setError('Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  };
  const google = async () => { setBusy(true); setError(''); setInfo(''); try { const result = await signInWithGoogle(); if (result.error) { setError(result.error); setBusy(false); } } catch { setError('Unable to connect to Google. Please try again.'); setBusy(false); } };
  return <main className="auth-root">
    <button className="auth-home" onClick={onBack}><ArrowLeft size={16}/> Back to home</button>
    <div className="auth-box">
      <section className="auth-story"><div className="pub-brand"><span className="pub-brand-mark"><BarChart3 size={22}/></span>{brand}</div><h1>{mode === 'signup' ? <>Start your<br/><span>trading journal.</span></> : mode === 'forgot' ? <>A fresh start.<br/><span>Back to your journal.</span></> : <>Welcome back,<br/><span>trader.</span></>}</h1><p>{mode === 'signup' ? "Log every trade, understand your results, and keep the lessons behind each setup." : 'Pick up where you left off. Your trades, journal, and performance are all here.'}</p><div className="auth-benefits">{[[BarChart3, 'Performance Analytics', 'See your P&L, win rate, and equity curve'], [ClipboardCheck, 'Trade Reviews', 'Reflect on your executions and decisions'], [BookOpen, 'Trading Journal', 'Keep your plans, charts, and lessons together'], [ShieldCheck, 'Risk Management', 'Set your goals and follow your guardrails']].map(([Icon, title, text]) => <div key={title}><span><Icon size={18}/></span><div><strong>{title}</strong><small>{text}</small></div></div>)}</div><div className="auth-story-foot">One workspace for your trading process.<small>Plan. Execute. Review. Refine.</small></div></section>
      <section className="auth-form-panel" aria-labelledby="auth-title"><h2 id="auth-title">{mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Sign in'}</h2><p>{mode === 'signup' ? 'Your trading process starts here.' : mode === 'forgot' ? 'We’ll email you a link to reset your password.' : 'Use the email you signed up with.'}</p>
        <form onSubmit={submit}>
          {mode === 'signup' && <div className="auth-name-row"><label>First name<input required autoComplete="given-name" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John"/></label><label>Last name<input required autoComplete="family-name" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe"/></label></div>}
          <label>Email<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label>
          {mode !== 'forgot' && <label>Password<span className="auth-password"><input required minLength={mode === 'signup' ? 6 : undefined} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'Create a strong password' : 'Enter your password'}/><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>}
          {mode === 'login' && <button type="button" className="auth-forgot" onClick={() => switchMode('forgot')}>Forgot password?</button>}
          {error && <div className="auth-message auth-error" role="alert">{error}</div>}{info && <div className="auth-message" role="status">{info}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}<ArrowRight size={17}/></button>
        </form>
        {mode !== 'forgot' && <><div className="auth-divider">OR CONTINUE WITH</div><button className="auth-google" disabled={busy} onClick={google}><strong aria-hidden="true">G</strong>Continue with Google</button></>}
        <div className="auth-switch">{mode === 'login' ? <>Don’t have an account? <button onClick={() => switchMode('signup')}>Sign up</button></> : <>{mode === 'signup' ? 'Already have an account? ' : ''}<button onClick={() => switchMode('login')}>Sign in</button></>}</div>
      </section>
    </div>
  </main>;
}
