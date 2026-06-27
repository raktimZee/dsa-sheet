import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const field =
  'w-full bg-surface-bright border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow';
const DIFFS = ['Easy', 'Medium', 'Hard'];
const diffColor = { Easy: 'text-primary', Medium: 'text-[#E3B341]', Hard: 'text-error' };
const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function ProblemRow({ p, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-between gap-md py-xs border-b border-outline-variant/50 last:border-0">
      <div className="min-w-0">
        <span className="text-body-md text-on-surface">{p.title}</span>
        <span className={`ml-sm font-label-caps text-label-caps font-bold ${diffColor[p.difficulty] || ''}`}>{p.difficulty}</span>
      </div>
      <div className="flex items-center gap-xs shrink-0">
        <button onClick={() => onEdit(p)} className="p-xs rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-colors" aria-label="Edit"><Icon name="edit" /></button>
        <button onClick={() => onDelete(p.id)} className="p-xs rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container transition-colors" aria-label="Delete"><Icon name="delete" /></button>
      </div>
    </div>
  );
}

function TopicCard({ topic, reload, setErr, onDeleteTopic }) {
  const empty = { title: '', difficulty: 'Easy', youtubeUrl: '', leetcodeUrl: '', articleUrl: '' };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [open, setOpen] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const run = async (fn) => { setErr(''); try { await fn(); await reload(); } catch (e) { setErr(e.message); } };

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    run(async () => {
      if (editingId) await api.patch(`/content/problems/${editingId}`, form);
      else await api.post('/content/problems', { topicId: topic.id, ...form });
      setForm(empty); setEditingId(null); setOpen(false);
    });
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setForm({ title: p.title, difficulty: p.difficulty, youtubeUrl: p.youtubeUrl || '', leetcodeUrl: p.leetcodeUrl || '', articleUrl: p.articleUrl || '' });
    setOpen(true);
  };
  const cancel = () => { setForm(empty); setEditingId(null); setOpen(false); };
  const del = (id) => { if (window.confirm('Delete this problem?')) run(() => api.del(`/content/problems/${id}`)); };

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg">
      <div className="flex items-center justify-between gap-md mb-md">
        <div className="min-w-0">
          <h3 className="text-headline-sm text-on-surface">{topic.title}</h3>
          <p className="text-body-sm text-on-surface-variant">{topic.problems.length} problems · <span className="font-mono">{topic.slug}</span></p>
        </div>
        <button onClick={() => onDeleteTopic(topic)} className="flex items-center gap-xs text-body-sm text-error hover:bg-error-container hover:text-on-error-container rounded-lg px-sm py-xs transition-colors shrink-0">
          <Icon name="delete" /> Topic
        </button>
      </div>

      <div className="mb-md">
        {topic.problems.length === 0
          ? <p className="text-body-sm text-on-surface-variant italic">No problems yet.</p>
          : topic.problems.map((p) => <ProblemRow key={p.id} p={p} onEdit={startEdit} onDelete={del} />)}
      </div>

      {open ? (
        <form onSubmit={submit} className="space-y-sm border-t border-outline-variant pt-md">
          <div className="flex gap-sm">
            <input className={field} placeholder="Problem title" value={form.title} onChange={set('title')} autoFocus />
            <select className={`${field} max-w-[140px]`} value={form.difficulty} onChange={set('difficulty')}>
              {DIFFS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <input className={field} placeholder="YouTube URL (optional)" value={form.youtubeUrl} onChange={set('youtubeUrl')} />
          <input className={field} placeholder="LeetCode/Codeforces URL (optional)" value={form.leetcodeUrl} onChange={set('leetcodeUrl')} />
          <input className={field} placeholder="Article URL (optional)" value={form.articleUrl} onChange={set('articleUrl')} />
          <div className="flex items-center gap-sm">
            <button className="bg-primary text-on-primary text-body-md py-sm px-md rounded-lg hover:bg-surface-tint transition-all shadow-sm">{editingId ? 'Save changes' : 'Add problem'}</button>
            <button type="button" onClick={cancel} className="text-body-sm text-on-surface-variant px-md hover:text-primary transition-colors">Cancel</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="flex items-center gap-xs text-body-sm text-primary font-semibold hover:underline">
          <Icon name="add" /> Add problem
        </button>
      )}
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [nt, setNt] = useState({ title: '', description: '' });

  const reload = async () => {
    const { topics } = await api.get('/content/sheet');
    setTopics(topics);
  };
  useEffect(() => {
    (async () => {
      try { await reload(); } catch (e) { setErr(e.message); } finally { setLoading(false); }
    })();
  }, []);

  // Belt-and-braces: students can't reach the portal even via direct URL.
  if (user && user.role !== 'admin') return <Navigate to="/" replace />;

  const run = async (fn) => { setErr(''); try { await fn(); await reload(); } catch (e) { setErr(e.message); } };
  const addTopic = (e) => {
    e.preventDefault();
    if (!nt.title.trim()) return;
    run(async () => {
      await api.post('/content/topics', { title: nt.title, slug: slugify(nt.title), description: nt.description });
      setNt({ title: '', description: '' });
    });
  };
  const delTopic = (t) => {
    if (window.confirm(`Delete "${t.title}" and its ${t.problems.length} problems?`)) run(() => api.del(`/content/topics/${t.id}`));
  };

  const totalProblems = topics.reduce((n, t) => n + t.problems.length, 0);

  return (
    <Layout solvedCount={0}>
      <div className="flex items-center gap-sm mb-xs">
        <Icon name="shield_person" filled className="text-primary text-3xl" />
        <h1 className="text-display-lg-mobile lg:text-display-lg text-on-surface">Admin</h1>
      </div>
      <p className="text-body-md text-on-surface-variant mb-lg">Manage the DSA sheet — {topics.length} topics · {totalProblems} problems.</p>

      {err && <div className="text-body-sm text-error bg-error-container/40 border border-error/30 rounded-lg px-md py-sm mb-md">{err}</div>}

      <form onSubmit={addTopic} className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg mb-lg space-y-sm">
        <h2 className="text-headline-sm text-on-surface">Add topic</h2>
        <input className={field} placeholder="Topic title (e.g. Dynamic Programming)" value={nt.title} onChange={(e) => setNt((s) => ({ ...s, title: e.target.value }))} />
        <input className={field} placeholder="Short description (optional)" value={nt.description} onChange={(e) => setNt((s) => ({ ...s, description: e.target.value }))} />
        <button className="bg-primary text-on-primary text-body-md py-sm px-md rounded-lg hover:bg-surface-tint transition-all shadow-sm">Add topic</button>
      </form>

      {loading ? (
        <p className="text-on-surface-variant">Loading…</p>
      ) : (
        <div className="space-y-md">
          {topics.map((t) => (
            <TopicCard key={t.id} topic={t} reload={reload} setErr={setErr} onDeleteTopic={delTopic} />
          ))}
        </div>
      )}
    </Layout>
  );
}
