import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { api } from '../lib/api.js';

const typeIcon = { milestone: 'emoji_events', progress: 'task_alt' };

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = async () => {
    try {
      const r = await api.get('/notifications');
      setItems(r.notifications || []);
      setUnread(r.unread || 0);
    } catch {
      /* ignore — notifications are non-critical */
    }
  };

  // Poll periodically + on mount so the badge stays fresh.
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      try { await api.post('/notifications/read-all'); } catch { /* */ }
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative w-10 h-10 grid place-items-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
      >
        <Icon name="notifications" filled={unread > 0} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-on-error text-[11px] font-bold grid place-items-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-sm w-80 max-w-[90vw] bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-md py-sm border-b border-outline-variant font-label-caps text-label-caps uppercase text-on-surface-variant">
            Notifications
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-md py-lg text-center text-body-sm text-on-surface-variant">
                No notifications yet. Solve a problem to get started.
              </div>
            ) : (
              items.map((n) => (
                <div key={n.id} className="flex items-start gap-sm px-md py-sm border-b border-surface-container last:border-0">
                  <Icon
                    name={typeIcon[n.type] || 'notifications'}
                    className={n.type === 'milestone' ? 'text-[#E3B341]' : 'text-primary'}
                  />
                  <div className="flex-1">
                    <div className="text-body-sm text-on-surface">{n.message}</div>
                    <div className="text-[12px] text-on-surface-variant mt-0.5">{timeAgo(n.createdAt)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
