import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import Icon from '../components/Icon.jsx';
import GoogleButton from '../components/GoogleButton.jsx';

const field =
  'w-full bg-surface-bright border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow';

export default function Login() {
  const { onAuthed } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = { email, password };
      if (needs2fa) body.otp = otp;
      const res = await api.post('/auth/login', body);
      if (res.twoFactorRequired) {
        setNeeds2fa(true);
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

  return (
    <div className="min-h-screen grid place-items-center bg-background px-md">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-sm mb-lg">
          <Icon name="terminal" className="text-primary text-3xl" filled />
          <h1 className="text-headline-md font-black text-primary">AlgoSheet</h1>
        </div>
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm">
          <h2 className="text-headline-sm text-on-surface">Welcome back</h2>
          <p className="text-body-sm text-on-surface-variant mt-xs mb-md">
            Sign in to track your DSA progress.
          </p>
          <form onSubmit={submit} className="space-y-md">
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-xs">Email</label>
              <input type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-xs">Password</label>
              <input type="password" className={field} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {needs2fa && (
              <div>
                <label className="block text-body-sm text-on-surface-variant mb-xs">Email verification code</label>
                <input inputMode="numeric" placeholder="6-digit code" className={field} value={otp} onChange={(e) => setOtp(e.target.value)} autoFocus required />
                <p className="text-body-sm text-on-surface-variant mt-xs">2FA is on — we emailed a 6-digit code to <span className="font-semibold">{email}</span>. It expires in 10 minutes.</p>
              </div>
            )}
            {error && <div className="text-body-sm text-error bg-error-container/40 border border-error/30 rounded-lg px-md py-sm">{error}</div>}
            <button disabled={busy} className="w-full bg-primary text-on-primary text-body-md py-sm rounded-lg hover:bg-surface-tint transition-all shadow-sm hover:-translate-y-[1px] disabled:opacity-60">
              {busy ? 'Signing in…' : needs2fa ? 'Verify & sign in' : 'Sign in'}
            </button>
          </form>
          <GoogleButton />
        </div>
        <p className="text-center text-body-sm text-on-surface-variant mt-md">
          New here? <Link to="/register" className="text-primary font-semibold">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
