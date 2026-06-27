import { useState } from 'react';
import Layout from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const field =
  'w-full bg-surface-bright border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow';

export default function Security() {
  const { user, refresh } = useAuth();
  // 2FA flow: 'idle' | 'enabling' (code emailed, awaiting input) | 'disabling'
  const [stage, setStage] = useState('idle');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Change-password card state
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  const reset = () => { setStage('idle'); setCode(''); };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwErr(''); setPwMsg(''); setPwBusy(true);
    try {
      await api.post('/auth/change-password', pw);
      setPwMsg('Password updated.');
      setPw({ currentPassword: '', newPassword: '' });
    } catch (err) { setPwErr(err.message); }
    finally { setPwBusy(false); }
  };

  // Step 1 of enabling: ask the server to email a verification code.
  const startEnable = async () => {
    setError(''); setMsg(''); setBusy(true);
    try {
      const res = await api.post('/auth/2fa/setup');
      setMsg(`We emailed a 6-digit code to ${res.email}. Enter it below to turn on 2FA.`);
      setStage('enabling');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  // Step 2 of enabling: verify the emailed code.
  const enable = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await api.post('/auth/2fa/enable', { token: code });
      setMsg('Two-factor authentication is now enabled.');
      reset();
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  // Step 1 of disabling: email a code to confirm it's really the owner.
  const startDisable = async () => {
    setError(''); setMsg(''); setBusy(true);
    try {
      const res = await api.post('/auth/2fa/disable/setup');
      setMsg(`We emailed a 6-digit code to ${res.email}. Enter it below to turn off 2FA.`);
      setStage('disabling');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  // Step 2 of disabling: verify the emailed code.
  const disable = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await api.post('/auth/2fa/disable', { token: code });
      setMsg('Two-factor authentication disabled.');
      reset();
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <Layout>
      <header className="mb-xl">
        <h2 className="text-display-lg-mobile lg:text-display-lg text-on-background">Security</h2>
        <p className="text-body-lg text-on-surface-variant mt-sm">Protect your account with two-factor authentication.</p>
      </header>

      <div className="max-w-xl bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm">
        <div className="flex items-start gap-md">
          <div className="w-10 h-10 rounded-lg bg-secondary-container grid place-items-center text-on-secondary-container">
            <Icon name="mark_email_read" filled />
          </div>
          <div className="flex-1">
            <h3 className="text-headline-sm text-on-surface">Two-Factor Authentication (Email)</h3>
            <p className="text-body-sm text-on-surface-variant mt-xs">
              When enabled, signing in requires a one-time code we email to <span className="font-semibold">{user?.email}</span>.
            </p>
            <p className="text-body-sm mt-sm">
              Status:{' '}
              <span className={`font-bold ${user?.twoFactorEnabled ? 'text-[#56D364]' : 'text-on-surface-variant'}`}>
                {user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </p>
          </div>
        </div>

        {msg && <div className="mt-md text-body-sm text-[#56D364] bg-[#3FB950]/15 border border-[#3FB950]/30 rounded-lg px-md py-sm">{msg}</div>}
        {error && <div className="mt-md text-body-sm text-error bg-error-container/40 border border-error/30 rounded-lg px-md py-sm">{error}</div>}

        <div className="mt-lg">
          {/* Disabled + idle → offer to enable */}
          {!user?.twoFactorEnabled && stage === 'idle' && (
            <button onClick={startEnable} disabled={busy} className="bg-primary text-on-primary text-body-md py-sm px-lg rounded-lg hover:bg-surface-tint transition-all shadow-sm hover:-translate-y-[1px] disabled:opacity-60">
              {busy ? 'Sending code…' : 'Enable 2FA'}
            </button>
          )}

          {/* Code-entry form, shared by enable + disable */}
          {(stage === 'enabling' || stage === 'disabling') && (
            <form onSubmit={stage === 'enabling' ? enable : disable} className="max-w-xs space-y-sm">
              <label className="block text-body-sm text-on-surface-variant">Enter the 6-digit code from your email</label>
              <input inputMode="numeric" placeholder="123456" className={field} value={code} onChange={(e) => setCode(e.target.value)} autoFocus required />
              <div className="flex items-center gap-sm">
                <button disabled={busy} className="bg-primary text-on-primary text-body-md py-sm px-lg rounded-lg hover:bg-surface-tint transition-all shadow-sm disabled:opacity-60">
                  {busy ? 'Verifying…' : stage === 'enabling' ? 'Enable 2FA' : 'Disable 2FA'}
                </button>
                <button type="button" onClick={() => { reset(); setMsg(''); setError(''); }} className="text-body-sm text-on-surface-variant hover:text-primary transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Enabled + idle → offer to disable */}
          {user?.twoFactorEnabled && stage === 'idle' && (
            <button onClick={startDisable} disabled={busy} className="bg-error text-on-error text-body-md py-sm px-lg rounded-lg hover:bg-[#DA3633] transition-all shadow-sm disabled:opacity-60">
              {busy ? 'Sending code…' : 'Disable 2FA'}
            </button>
          )}
        </div>
      </div>

      {/* Change password */}
      <div className="max-w-xl bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm mt-lg">
        <div className="flex items-start gap-md">
          <div className="w-10 h-10 rounded-lg bg-secondary-container grid place-items-center text-on-secondary-container">
            <Icon name="key" filled />
          </div>
          <div className="flex-1">
            <h3 className="text-headline-sm text-on-surface">Change Password</h3>
            <p className="text-body-sm text-on-surface-variant mt-xs">Update the password you use to sign in.</p>
          </div>
        </div>

        {pwMsg && <div className="mt-md text-body-sm text-[#56D364] bg-[#3FB950]/15 border border-[#3FB950]/30 rounded-lg px-md py-sm">{pwMsg}</div>}
        {pwErr && <div className="mt-md text-body-sm text-error bg-error-container/40 border border-error/30 rounded-lg px-md py-sm">{pwErr}</div>}

        <form onSubmit={changePassword} className="mt-md max-w-sm space-y-sm">
          <div>
            <label className="block text-body-sm text-on-surface-variant mb-xs">Current password</label>
            <input type="password" className={field} value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
          </div>
          <div>
            <label className="block text-body-sm text-on-surface-variant mb-xs">New password</label>
            <input type="password" minLength={8} className={field} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required />
            <p className="text-body-sm text-on-surface-variant mt-xs">At least 8 characters.</p>
          </div>
          <button disabled={pwBusy} className="bg-primary text-on-primary text-body-md py-sm px-lg rounded-lg hover:bg-surface-tint transition-all shadow-sm disabled:opacity-60">
            {pwBusy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </Layout>
  );
}
