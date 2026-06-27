import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import VideoThumb from '../components/VideoThumb.jsx';
import { api } from '../lib/api.js';

const DIFFS = ['Easy', 'Medium', 'Hard'];
const tagClass = {
  Easy: 'bg-[#3FB950]/15 text-[#56D364]',
  Medium: 'bg-[#D29922]/15 text-[#E3B341]',
  Hard: 'bg-[#F85149]/15 text-[#FF7B72]',
};

export default function Problems() {
  const [topics, setTopics] = useState([]);
  const [done, setDone] = useState(() => new Set());
  const [open, setOpen] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [diffFilter, setDiffFilter] = useState('All');

  useEffect(() => {
    (async () => {
      try {
        const [sheet, progress] = await Promise.all([api.get('/content/sheet'), api.get('/progress')]);
        setTopics(sheet.topics);
        setDone(new Set(progress.completed));
        if (sheet.topics[0]) setOpen(new Set([sheet.topics[0].id]));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allProblems = useMemo(() => topics.flatMap((t) => t.problems), [topics]);
  const total = allProblems.length;
  const doneCount = useMemo(() => allProblems.filter((p) => done.has(p.id)).length, [allProblems, done]);
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  const toggle = async (problemId, completed) => {
    setDone((prev) => {
      const n = new Set(prev);
      completed ? n.add(problemId) : n.delete(problemId);
      return n;
    });
    try {
      await api.put(`/progress/${problemId}`, { completed });
    } catch {
      setDone((prev) => {
        const n = new Set(prev);
        completed ? n.delete(problemId) : n.add(problemId);
        return n;
      });
    }
  };

  const toggleTopic = (id) =>
    setOpen((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  if (loading)
    return (
      <Layout>
        <div className="text-on-surface-variant">Loading your sheet…</div>
      </Layout>
    );

  return (
    <Layout solvedCount={doneCount}>
      <header className="mb-lg">
        <h2 className="text-display-lg-mobile lg:text-display-lg text-on-background">Problems</h2>
        <p className="text-body-lg text-on-surface-variant mt-xs">
          Work through the sheet topic by topic. Your ticks are saved automatically.
        </p>
      </header>

      {/* Progress summary */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm mb-lg">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-label-caps text-label-caps text-on-surface-variant uppercase">Overall progress</div>
            <div className="text-headline-md text-on-surface">{doneCount} <span className="text-on-surface-variant text-body-md">/ {total} solved</span></div>
          </div>
          <div className="text-headline-md font-bold text-primary">{pct}%</div>
        </div>
        <div className="h-2.5 bg-surface-container-high rounded-full mt-md overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Difficulty filter */}
      <div className="flex items-center gap-sm mb-lg flex-wrap">
        <span className="text-body-sm text-on-surface-variant">Filter</span>
        {['All', ...DIFFS].map((d) => (
          <button
            key={d}
            onClick={() => setDiffFilter(d)}
            className={`px-md py-xs rounded-full text-body-sm border transition-colors ${
              diffFilter === d
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:bg-surface-container'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {error && <div className="text-error mb-md">{error}</div>}

      <div className="space-y-md">
        {topics.map((topic) => {
          const problems = topic.problems.filter((p) => diffFilter === 'All' || p.difficulty === diffFilter);
          if (!problems.length) return null;
          const tDone = topic.problems.filter((p) => done.has(p.id)).length;
          const isOpen = open.has(topic.id);
          return (
            <section key={topic.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <button onClick={() => toggleTopic(topic.id)} className="w-full flex items-center gap-md px-lg py-md hover:bg-surface-container text-left transition-colors">
                <Icon name="chevron_right" className={`text-on-surface-variant transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                <div className="flex-1">
                  <h3 className="text-headline-sm text-on-surface">{topic.title}</h3>
                  <p className="text-body-sm text-on-surface-variant">{topic.description}</p>
                </div>
                <span className="text-body-sm text-on-surface-variant tabular-nums">{tDone}/{topic.problems.length}</span>
              </button>

              {isOpen && (
                <div className="border-t border-outline-variant divide-y divide-outline-variant">
                  {problems.map((p) => {
                    const isDone = done.has(p.id);
                    return (
                      <div key={p.id} className="flex items-center gap-md px-lg py-sm">
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={(e) => toggle(p.id, e.target.checked)}
                          className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary cursor-pointer"
                        />
                        <span className={`flex-1 text-body-md ${isDone ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>
                          {p.title}
                        </span>
                        <span className={`text-label-caps uppercase font-bold px-sm py-0.5 rounded-full ${tagClass[p.difficulty]}`}>
                          {p.difficulty}
                        </span>
                        <div className="hidden sm:flex items-center gap-md">
                          <VideoThumb url={p.youtubeUrl} />
                          <div className="flex flex-col gap-xs text-body-sm">
                            {p.leetcodeUrl && <a href={p.leetcodeUrl} target="_blank" rel="noreferrer" className="text-on-surface-variant hover:text-primary flex items-center gap-xs"><Icon name="bolt" className="text-base" />Practice</a>}
                            {p.articleUrl && <a href={p.articleUrl} target="_blank" rel="noreferrer" className="text-on-surface-variant hover:text-primary flex items-center gap-xs"><Icon name="article" className="text-base" />Article</a>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </Layout>
  );
}
