import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import { api } from '../lib/api.js';

const medal = ['🥇', '🥈', '🥉'];

export default function Rankings() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/auth/leaderboard')
      .then((r) => setRows(r.leaderboard || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const mySolved = rows.find((r) => r.isMe)?.solved || 0;

  return (
    <Layout solvedCount={mySolved}>
      <header className="mb-xl">
        <h2 className="text-display-lg-mobile lg:text-display-lg text-on-background">Rankings</h2>
        <p className="text-body-lg text-on-surface-variant mt-sm">Top problem-solvers, ranked by problems completed.</p>
      </header>

      {loading ? (
        <div className="text-on-surface-variant">Loading…</div>
      ) : error ? (
        <div className="text-error">{error}</div>
      ) : rows.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg text-on-surface-variant">
          No rankings yet — solve a problem to get on the board.
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          {rows.map((r) => (
            <div
              key={r.rank}
              className={`flex items-center gap-md px-lg py-md border-b border-outline-variant last:border-0 ${
                r.isMe ? 'bg-secondary-container/40' : ''
              }`}
            >
              <span className="w-8 text-center text-headline-sm font-bold text-on-surface-variant">
                {medal[r.rank - 1] || r.rank}
              </span>
              {r.avatarUrl ? (
                <img src={r.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover border border-outline-variant" />
              ) : (
                <div className="w-9 h-9 rounded-full grid place-items-center bg-secondary-container text-on-secondary-container text-body-sm font-bold">
                  {(r.name?.[0] || 'A').toUpperCase()}
                </div>
              )}
              <span className="flex-1 text-body-md text-on-surface">
                {r.name} {r.isMe && <span className="text-body-sm text-primary font-semibold">(you)</span>}
              </span>
              <span className="text-body-md font-bold text-primary flex items-center gap-xs">
                <Icon name="task_alt" className="text-base" /> {r.solved}
              </span>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
