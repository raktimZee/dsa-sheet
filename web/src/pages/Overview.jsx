import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import { Donut, AreaChart, DifficultyBars } from '../components/Charts.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const DIFF_COLORS = { Easy: '#3FB950', Medium: '#D29922', Hard: '#F85149' };

function StatCard({ icon, label, value, sub, accent = 'text-primary' }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg">
      <div className="flex items-center gap-sm text-on-surface-variant mb-sm">
        <Icon name={icon} className={accent} />
        <span className="font-label-caps text-label-caps uppercase">{label}</span>
      </div>
      <div className="text-headline-md font-bold text-on-surface font-mono">{value}</div>
      {sub && <div className="text-body-sm text-on-surface-variant mt-xs">{sub}</div>}
    </div>
  );
}

function Card({ title, action, children, className = '' }) {
  return (
    <div className={`bg-surface-container-lowest rounded-xl border border-outline-variant p-lg ${className}`}>
      <div className="flex items-center justify-between mb-md">
        <h3 className="text-headline-sm text-on-surface">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function Overview() {
  const { user } = useAuth();
  const [topics, setTopics] = useState([]);
  const [done, setDone] = useState(new Set());
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sheet, progress, act] = await Promise.all([
          api.get('/content/sheet'),
          api.get('/progress'),
          api.get('/progress/activity?days=14').catch(() => ({ series: [] })),
        ]);
        setTopics(sheet.topics);
        setDone(new Set(progress.completed));
        setActivity(act.series || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const all = topics.flatMap((t) => t.problems);
  const total = all.length;
  const solved = all.filter((p) => done.has(p.id)).length;
  const diffData = ['Easy', 'Medium', 'Hard'].map((key) => {
    const list = all.filter((p) => p.difficulty === key);
    return { label: key, done: list.filter((p) => done.has(p.id)).length, total: list.length, color: DIFF_COLORS[key] };
  });

  // Insights from the daily activity series.
  const thisWeek = activity.slice(-7).reduce((s, d) => s + d.count, 0);
  let streak = 0;
  for (let i = activity.length - 1; i >= 0; i--) {
    if (activity[i].count > 0) streak++;
    else break;
  }

  // Topic insights.
  const topicPct = topics.map((t) => ({
    title: t.title,
    done: t.problems.filter((p) => done.has(p.id)).length,
    total: t.problems.length,
    pct: t.problems.length ? t.problems.filter((p) => done.has(p.id)).length / t.problems.length : 0,
  }));
  const strongest = [...topicPct].sort((a, b) => b.pct - a.pct)[0];
  const focusNext = [...topicPct].filter((t) => t.done < t.total).sort((a, b) => a.pct - b.pct)[0];

  return (
    <Layout solvedCount={solved}>
      <header className="mb-xl">
        <h2 className="text-display-lg-mobile lg:text-display-lg text-on-background">
          Welcome back, {user?.firstName || user?.name || 'there'}.
        </h2>
        <p className="text-body-lg text-on-surface-variant mt-sm">Your DSA progress at a glance.</p>
      </header>

      {loading ? (
        <div className="text-on-surface-variant font-mono">{'>'} loading metrics…</div>
      ) : (
        <div className="space-y-lg">
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-md">
            <StatCard icon="task_alt" label="Solved" value={`${solved}/${total}`} sub={`${total - solved} remaining`} />
            <StatCard icon="trending_up" label="Completion" value={`${total ? Math.round((solved / total) * 100) : 0}%`} />
            <StatCard icon="calendar_month" label="This week" value={thisWeek} sub="problems solved" accent="text-[#58A6FF]" />
            <StatCard icon="local_fire_department" label="Day streak" value={streak} sub={streak === 1 ? 'day' : 'days'} accent="text-[#E3B341]" />
          </div>

          {/* Completion donut + activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
            <Card title="Completion">
              <div className="flex items-center gap-lg">
                <Donut value={solved} total={total} />
                <div className="space-y-sm">
                  {diffData.map((d) => (
                    <div key={d.label} className="flex items-center gap-sm text-body-sm">
                      <span className="w-3 h-3 rounded-sm" style={{ background: d.color }} />
                      <span className="text-on-surface-variant w-16">{d.label}</span>
                      <span className="font-mono text-on-surface">{d.done}/{d.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card
              title="Activity — last 14 days"
              className="lg:col-span-2"
              action={<span className="font-label-caps text-label-caps uppercase text-on-surface-variant">{thisWeek} this week</span>}
            >
              <AreaChart series={activity} />
            </Card>
          </div>

          {/* Difficulty + topic progress */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
            <Card title="By difficulty">
              <DifficultyBars data={diffData} />
            </Card>

            <Card
              title="Progress by topic"
              className="lg:col-span-2"
              action={<Link to="/problems" className="text-body-sm text-primary font-semibold flex items-center gap-xs">Open sheet <Icon name="arrow_forward" className="text-base" /></Link>}
            >
              {/* Insight chips */}
              {strongest && (
                <div className="flex flex-wrap gap-sm mb-md">
                  <span className="text-body-sm bg-surface-container rounded-full px-md py-xs">
                    <span className="text-on-surface-variant">Strongest:</span>{' '}
                    <span className="text-primary font-semibold">{strongest.title}</span> ({Math.round(strongest.pct * 100)}%)
                  </span>
                  {focusNext && (
                    <span className="text-body-sm bg-surface-container rounded-full px-md py-xs">
                      <span className="text-on-surface-variant">Focus next:</span>{' '}
                      <span className="text-[#E3B341] font-semibold">{focusNext.title}</span> ({focusNext.done}/{focusNext.total})
                    </span>
                  )}
                </div>
              )}
              <div className="space-y-md max-h-72 overflow-y-auto pr-sm">
                {topicPct.map((t) => (
                  <div key={t.title}>
                    <div className="flex justify-between text-body-sm mb-xs">
                      <span className="text-on-surface">{t.title}</span>
                      <span className="text-on-surface-variant tabular-nums font-mono">{t.done}/{t.total}</span>
                    </div>
                    <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${Math.round(t.pct * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </Layout>
  );
}
