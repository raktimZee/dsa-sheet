import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import { api } from '../lib/api.js';

const DIFFS = [
  { key: 'Easy', color: '#3FB950' },
  { key: 'Medium', color: '#D29922' },
  { key: 'Hard', color: '#F85149' },
];

export default function Analytics() {
  const [topics, setTopics] = useState([]);
  const [done, setDone] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sheet, progress] = await Promise.all([api.get('/content/sheet'), api.get('/progress')]);
        setTopics(sheet.topics);
        setDone(new Set(progress.completed));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const all = topics.flatMap((t) => t.problems);
  const solved = all.filter((p) => done.has(p.id)).length;

  return (
    <Layout solvedCount={solved}>
      <header className="mb-xl">
        <h2 className="text-display-lg-mobile lg:text-display-lg text-on-background">Analytics</h2>
        <p className="text-body-lg text-on-surface-variant mt-sm">A breakdown of what you've solved.</p>
      </header>

      {loading ? (
        <div className="text-on-surface-variant">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
          {/* By difficulty */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm">
            <h3 className="text-headline-sm text-on-surface mb-md">Solved by difficulty</h3>
            <div className="space-y-md">
              {DIFFS.map((d) => {
                const list = all.filter((p) => p.difficulty === d.key);
                const dn = list.filter((p) => done.has(p.id)).length;
                const pct = list.length ? Math.round((dn / list.length) * 100) : 0;
                return (
                  <div key={d.key}>
                    <div className="flex justify-between text-body-sm mb-xs">
                      <span className="text-on-surface">{d.key}</span>
                      <span className="text-on-surface-variant tabular-nums">{dn}/{list.length} · {pct}%</span>
                    </div>
                    <div className="h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: d.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By topic */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm">
            <h3 className="text-headline-sm text-on-surface mb-md">Solved by topic</h3>
            <div className="space-y-md max-h-80 overflow-y-auto pr-sm">
              {topics.map((t) => {
                const dn = t.problems.filter((p) => done.has(p.id)).length;
                const pct = t.problems.length ? Math.round((dn / t.problems.length) * 100) : 0;
                return (
                  <div key={t.id}>
                    <div className="flex justify-between text-body-sm mb-xs">
                      <span className="text-on-surface">{t.title}</span>
                      <span className="text-on-surface-variant tabular-nums">{dn}/{t.problems.length}</span>
                    </div>
                    <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
