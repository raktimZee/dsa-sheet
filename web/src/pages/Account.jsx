import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import { api, getToken } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const field =
  'w-full bg-surface-bright border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow';

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-surface-variant'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

export default function Account() {
  const { user, refresh, logout } = useAuth();
  const fileRef = useRef(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', bio: '' });
  const [prefs, setPrefs] = useState({ dailyReminder: true, weeklySummary: false });
  const [solved, setSolved] = useState(0);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        bio: user.bio || '',
      });
      setPrefs(user.notifPrefs || { dailyReminder: true, weeklySummary: false });
    }
    api.get('/progress/summary').then((r) => setSolved(r.count)).catch(() => {});
  }, [user]);

  const flash = (m) => { setMsg(m); setError(''); setTimeout(() => setMsg(''), 2500); };

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.patch('/auth/profile', form);
      await refresh();
      flash('Profile saved.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const togglePref = async (key, val) => {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    try { await api.put('/auth/notifications', next); } catch { setPrefs(prefs); }
  };

  const onPickAvatar = () => fileRef.current?.click();
  const onAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      await api.upload('/auth/avatar', fd);
      await refresh();
      flash('Avatar updated.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const exportData = async () => {
    try {
      const res = await fetch('/api/auth/export', { headers: { Authorization: `Bearer ${getToken()}` } });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'algosheet-data.json';
      a.click();
      URL.revokeObjectURL(url);
      flash('Data exported.');
    } catch (err) { setError(err.message); }
  };

  const deleteAccount = async () => {
    if (!confirm('Delete your account permanently? This removes your profile and all progress.')) return;
    setBusy(true);
    try {
      await api.del('/auth/account');
      logout();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  const memberYear = user?.memberSince ? new Date(user.memberSince).getFullYear() : '';

  return (
    <Layout solvedCount={solved}>
      <header className="mb-xl">
        <h2 className="text-display-lg-mobile lg:text-display-lg text-on-background">Account Settings</h2>
        <p className="text-body-lg text-on-surface-variant mt-sm">Manage your profile information and preferences.</p>
      </header>

      {msg && <div className="mb-md text-body-sm text-[#56D364] bg-[#3FB950]/15 border border-[#3FB950]/30 rounded-lg px-md py-sm">{msg}</div>}
      {error && <div className="mb-md text-body-sm text-error bg-error-container/40 border border-error/30 rounded-lg px-md py-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
        {/* Left: forms */}
        <section className="lg:col-span-8 space-y-lg">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm">
            <h3 className="text-headline-sm text-on-surface mb-md">Personal Information</h3>
            <form className="space-y-md" onSubmit={saveProfile}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <div>
                  <label className="block text-body-sm text-on-surface-variant mb-xs">First Name</label>
                  <input className={field} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-body-sm text-on-surface-variant mb-xs">Last Name</label>
                  <input className={field} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-body-sm text-on-surface-variant mb-xs">Email Address</label>
                <input type="email" className={field} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-body-sm text-on-surface-variant mb-xs">Bio</label>
                <textarea rows="3" maxLength={280} className={`${field} resize-none`} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </div>
              <div className="flex justify-end">
                <button disabled={busy} className="bg-primary text-on-primary text-body-md py-sm px-lg rounded-lg hover:bg-surface-tint transition-all shadow-sm hover:-translate-y-[1px] disabled:opacity-60">
                  Save Changes
                </button>
              </div>
            </form>
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm">
            <h3 className="text-headline-sm text-on-surface mb-md">Notifications</h3>
            <div className="space-y-md">
              <div className="flex items-center justify-between py-sm border-b border-surface-container">
                <div>
                  <div className="text-body-md text-on-surface">Daily Reminder</div>
                  <div className="text-body-sm text-on-surface-variant">Get notified to keep your daily streak alive.</div>
                </div>
                <Toggle checked={prefs.dailyReminder} onChange={(v) => togglePref('dailyReminder', v)} />
              </div>
              <div className="flex items-center justify-between py-sm">
                <div>
                  <div className="text-body-md text-on-surface">Weekly Summary</div>
                  <div className="text-body-sm text-on-surface-variant">Receive a recap of your problem-solving progress.</div>
                </div>
                <Toggle checked={prefs.weeklySummary} onChange={(v) => togglePref('weeklySummary', v)} />
              </div>
            </div>
          </div>
        </section>

        {/* Right: profile card + danger zone */}
        <section className="lg:col-span-4 space-y-lg">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm flex flex-col items-center text-center">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="avatar" className="w-24 h-24 rounded-full object-cover border-2 border-primary mb-md shadow-sm" />
            ) : (
              <div className="w-24 h-24 rounded-full grid place-items-center bg-secondary-container text-on-secondary-container text-2xl font-bold border-2 border-primary mb-md">
                {((user?.firstName?.[0] || user?.email?.[0] || 'U') + (user?.lastName?.[0] || '')).toUpperCase()}
              </div>
            )}
            <div className="text-headline-sm text-on-surface">{user?.firstName || user?.name || 'You'} {user?.lastName}</div>
            <div className="text-body-sm text-on-surface-variant mb-md">Member since {memberYear}</div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatar} />
            <button onClick={onPickAvatar} disabled={busy} className="w-full bg-surface-container border border-outline-variant text-on-surface text-body-sm py-sm px-md rounded-lg hover:bg-surface-container-high transition-colors">
              Change Avatar
            </button>
          </div>

          <div className="bg-error-container/20 border border-error/30 rounded-xl p-lg">
            <h3 className="text-headline-sm text-on-surface mb-sm flex items-center gap-xs">
              <Icon name="warning" className="text-error" /> Danger Zone
            </h3>
            <p className="text-body-sm text-on-surface-variant mb-md">Actions here cannot be undone. Please proceed with caution.</p>
            <div className="space-y-sm">
              <button onClick={exportData} className="w-full bg-transparent border border-outline-variant text-on-surface text-body-md py-sm px-md rounded-lg hover:bg-surface-container transition-colors">
                Export Data
              </button>
              <button onClick={deleteAccount} disabled={busy} className="w-full bg-error text-on-error text-body-md py-sm px-md rounded-lg hover:bg-[#DA3633] transition-all shadow-sm hover:-translate-y-[1px] disabled:opacity-60">
                Delete Account
              </button>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
