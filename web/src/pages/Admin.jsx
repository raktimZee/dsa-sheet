import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg">
      <div className="flex items-center gap-sm text-on-surface-variant mb-xs">
        <Icon name={icon} className="text-primary" />
        <span className="font-label-caps text-label-caps">{label}</span>
      </div>
      <div className="text-display-lg-mobile text-on-surface">{value}</div>
    </div>
  );
}

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const fmtAgo = (d) => {
  if (!d) return 'Never';
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 3600000) return 'Just now';
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
};

export default function Admin() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [solved, setSolved] = useState({}); // userId -> solved count
  const [content, setContent] = useState({ topics: 0, problems: 0, solvedTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [u, c, sheet] = await Promise.all([
          api.get('/auth/admin/users'),
          api.get('/progress/all-counts'),
          api.get('/content/sheet'),
        ]);
        setData(u);
        const map = {};
        (c.counts || []).forEach((r) => { map[r.userId] = r.count; });
        setSolved(map);
        const topics = sheet.topics || [];
        setContent({
          topics: topics.length,
          problems: topics.reduce((n, t) => n + t.problems.length, 0),
          solvedTotal: c.total || 0,
        });
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Students can't reach the portal even via direct URL.
  if (user && user.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <Layout>
      <div className="flex items-center gap-sm mb-xs">
        <Icon name="shield_person" filled className="text-primary text-3xl" />
        <h1 className="text-display-lg-mobile lg:text-display-lg text-on-surface">Admin Overview</h1>
      </div>
      <p className="text-body-md text-on-surface-variant mb-lg">Platform users and activity at a glance.</p>

      {err && <div className="text-body-sm text-error bg-error-container/40 border border-error/30 rounded-lg px-md py-sm mb-md">{err}</div>}

      {loading ? (
        <p className="text-on-surface-variant">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-md mb-lg">
            <StatCard icon="group" label="Total users" value={data.total} />
            <StatCard icon="school" label="Students" value={data.students} />
            <StatCard icon="shield_person" label="Admins" value={data.admins} />
            <StatCard icon="shield" label="2FA enabled" value={data.twoFactor} />
            <StatCard icon="task_alt" label="Problems solved" value={content.solvedTotal} />
            <StatCard icon="category" label="Topics" value={content.topics} />
            <StatCard icon="list_alt" label="Problems" value={content.problems} />
            <StatCard icon="hub" label="Via Google" value={data.google} />
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
            <div className="px-lg py-md border-b border-outline-variant">
              <h2 className="text-headline-sm text-on-surface">Users ({data.total})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm whitespace-nowrap">
                <thead className="text-on-surface-variant font-label-caps text-label-caps">
                  <tr className="border-b border-outline-variant">
                    <th className="px-lg py-sm">User</th>
                    <th className="px-md py-sm">Role</th>
                    <th className="px-md py-sm">Solved</th>
                    <th className="px-md py-sm">2FA</th>
                    <th className="px-md py-sm">Joined</th>
                    <th className="px-md py-sm">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.id} className="border-b border-outline-variant/40 hover:bg-surface-container-low transition-colors">
                      <td className="px-lg py-sm">
                        <div className="text-on-surface">{u.name || '—'}{u.viaGoogle && <span className="ml-xs text-on-surface-variant">· Google</span>}</div>
                        <div className="text-on-surface-variant">{u.email}</div>
                      </td>
                      <td className="px-md py-sm">
                        <span className={u.role === 'admin' ? 'text-primary font-bold' : 'text-on-surface-variant'}>{u.role}</span>
                      </td>
                      <td className="px-md py-sm text-on-surface">{solved[u.id] ?? 0}</td>
                      <td className="px-md py-sm">
                        {u.twoFactorEnabled ? <Icon name="check_circle" className="text-primary" /> : <span className="text-on-surface-variant">—</span>}
                      </td>
                      <td className="px-md py-sm text-on-surface-variant">{fmtDate(u.createdAt)}</td>
                      <td className="px-md py-sm text-on-surface-variant">{fmtAgo(u.lastLoginAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
