import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import Icon from '../components/Icon.jsx';
import GoogleButton from '../components/GoogleButton.jsx';

const field =
  'w-full bg-surface-bright border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow';

export default function Register() {
  const { onAuthed } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [needsOtp, setNeedsOtp] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [secsLeft, setSecsLeft] = useState(0); // 20s same-code window countdown
  const [resendBusy, setResendBusy] = useState(false);
  const [resendNote, setResendNote] = useState('');

  // Tick the same-code countdown down to 0.
  useEffect(() => {
    if (secsLeft <= 0) return;
    const t = setTimeout(() => setSecsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secsLeft]);

  // Step 1: submit details → server emails a code, no account yet.
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/auth/register', { name, email, password });
      if (res.otpRequired) {
        setNeedsOtp(true);
        setSecsLeft(20);
        setBusy(false);
        return;
      }
      onAuthed(res);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  // Resend the code. Within 20s the server re-sends the SAME code; after that, a new one.
  const resend = async () => {
    setError('');
    setResendNote('');
    setResendBusy(true);
    try {
      const res = await api.post('/auth/register/resend', { email });
      setResendNote(res.reused ? 'Same code re-sent — check inbox & spam.' : 'A new code has been sent.');
      setSecsLeft(20);
    } catch (err) {
      setError(err.message);
    } finally {
      setResendBusy(false);
    }
  };

  // Step 2: confirm the emailed code → account is created + auto-login.
  const verify = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/auth/register/verify', { email, otp });
      onAuthed(res);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background px-md">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-sm mb-lg">
          <Icon name="terminal" className="text-primary text-3xl" filled />
          <h1 className="text-headline-md font-black text-primary">AlgoSheet</h1>
        </div>
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm">
          <h2 className="text-headline-sm text-on-surface">{needsOtp ? 'Verify your email' : 'Create your account'}</h2>
          <p className="text-body-sm text-on-surface-variant mt-xs mb-md">
            {needsOtp
              ? <>We emailed a 6-digit code to <span className="font-semibold">{email}</span>. Enter it to finish.</>
              : 'Start your structured DSA journey.'}
          </p>
          {needsOtp ? (
            <form onSubmit={verify} className="space-y-md">
              <div>
                <label className="block text-body-sm text-on-surface-variant mb-xs">Verification code</label>
                <input inputMode="numeric" placeholder="6-digit code" className={field} value={otp} onChange={(e) => setOtp(e.target.value)} autoFocus required />
                <p className="text-body-sm text-on-surface-variant mt-xs">The code expires in 10 minutes.</p>
                <div className="flex items-center justify-between mt-sm">
                  <button type="button" onClick={resend} disabled={resendBusy}
                    className="text-body-sm text-primary font-semibold hover:underline disabled:opacity-50">
                    {resendBusy ? 'Resending…' : "Didn't get it? Resend code"}
                  </button>
                  <span className="text-body-sm text-on-surface-variant">
                    {secsLeft > 0 ? `Same code for ${secsLeft}s` : 'Resend sends a new code'}
                  </span>
                </div>
                {resendNote && <p className="text-body-sm text-primary mt-xs">{resendNote}</p>}
              </div>
              {error && <div className="text-body-sm text-error bg-error-container/40 border border-error/30 rounded-lg px-md py-sm">{error}</div>}
              <button disabled={busy} className="w-full bg-primary text-on-primary text-body-md py-sm rounded-lg hover:bg-surface-tint transition-all shadow-sm hover:-translate-y-[1px] disabled:opacity-60">
                {busy ? 'Verifying…' : 'Verify & create account'}
              </button>
              <button type="button" onClick={() => { setNeedsOtp(false); setOtp(''); setError(''); }} className="w-full text-body-sm text-on-surface-variant hover:text-primary transition-colors">
                ← Back to edit details
              </button>
            </form>
          ) : (
          <>
          <form onSubmit={submit} className="space-y-md">
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-xs">Name</label>
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-xs">Email</label>
              <input type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-xs">Password</label>
              <input type="password" className={field} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              <p className="text-body-sm text-on-surface-variant mt-xs">At least 8 characters.</p>
            </div>
            {error && <div className="text-body-sm text-error bg-error-container/40 border border-error/30 rounded-lg px-md py-sm">{error}</div>}
            <button disabled={busy} className="w-full bg-primary text-on-primary text-body-md py-sm rounded-lg hover:bg-surface-tint transition-all shadow-sm hover:-translate-y-[1px] disabled:opacity-60">
              {busy ? 'Sending code…' : 'Create account'}
            </button>
          </form>
          <GoogleButton />
          </>
          )}
        </div>
        <p className="text-center text-body-sm text-on-surface-variant mt-md">
          Already have an account? <Link to="/login" className="text-primary font-semibold">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
