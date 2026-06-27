import { useState } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import NotificationBell from './NotificationBell.jsx';
import { useAuth } from '../lib/auth.jsx';

// Top banner nudging users without 2FA to turn it on. Dismissible for the session
// (reappears on the next sign-in), and hidden once 2FA is enabled.
function TwoFactorBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('dsa_2fa_banner_dismissed') === '1'
  );
  if (!user || user.twoFactorEnabled || dismissed) return null;
  const close = () => {
    sessionStorage.setItem('dsa_2fa_banner_dismissed', '1');
    setDismissed(true);
  };
  return (
    <div className="bg-primary-container text-on-primary-container border-b border-outline-variant">
      <div className="max-w-container-max mx-auto px-md lg:px-lg py-sm flex items-center gap-sm">
        <Icon name="shield" filled className="text-on-primary-container shrink-0" />
        <p className="text-body-sm flex-1">
          <span className="font-semibold">Secure your account.</span>{' '}
          Turn on two-factor authentication — we'll email a code each time you sign in.{' '}
          <Link to="/security" className="font-semibold underline underline-offset-2">
            Go to Settings → Enable 2FA
          </Link>
        </p>
        <button onClick={close} aria-label="Dismiss" className="p-xs rounded-lg hover:bg-black/10 transition-colors shrink-0">
          <Icon name="close" />
        </button>
      </div>
    </div>
  );
}

const NAV = [
  { to: '/', icon: 'dashboard', label: 'Overview', end: true },
  { to: '/problems', icon: 'list_alt', label: 'Problems' },
  { to: '/rankings', icon: 'leaderboard', label: 'Rankings' },
  { to: '/analytics', icon: 'insights', label: 'Analytics' },
  { to: '/account', icon: 'person', label: 'Account' },
];

function Avatar({ user, className }) {
  const initials =
    ((user?.firstName?.[0] || user?.name?.[0] || user?.email?.[0] || 'U') +
      (user?.lastName?.[0] || '')).toUpperCase();
  if (user?.avatarUrl) {
    return <img alt="avatar" src={user.avatarUrl} className={`${className} object-cover`} />;
  }
  return (
    <div
      className={`${className} grid place-items-center bg-secondary-container text-on-secondary-container font-bold`}
    >
      {initials}
    </div>
  );
}

function NavItems({ onNavigate }) {
  const base =
    'flex items-center gap-md rounded-lg px-md py-sm transition-colors font-label-caps text-label-caps group';
  return (
    <ul className="flex flex-col gap-xs flex-1">
      {NAV.map((n) => (
        <li key={n.to}>
          <NavLink
            to={n.to}
            end={n.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              isActive
                ? `${base} bg-primary-container text-on-primary-container`
                : `${base} text-on-surface-variant hover:bg-surface-container-highest`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  name={n.icon}
                  filled={isActive}
                  className={isActive ? '' : 'text-secondary group-hover:text-primary transition-colors'}
                />
                {n.label}
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export default function Layout({ children, solvedCount = 0 }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarBody = ({ onNavigate }) => (
    <>
      <div className="mb-xl">
        <h1 className="text-headline-sm font-black text-primary">AlgoSheet</h1>
      </div>
      <div className="flex items-center gap-md mb-xl">
        <Avatar user={user} className="w-12 h-12 rounded-full border border-outline-variant shadow-sm" />
        <div>
          <div className="text-headline-sm text-on-surface leading-tight">
            {user?.firstName || user?.name || 'You'}
          </div>
          <div className="font-label-caps text-label-caps text-on-surface-variant">
            {solvedCount} solved
          </div>
        </div>
      </div>
      <button
        onClick={() => {
          navigate('/problems');
          onNavigate?.();
        }}
        className="bg-primary text-on-primary text-body-md py-sm px-md rounded-lg mb-xl hover:bg-surface-tint transition-all shadow-sm hover:-translate-y-[1px] active:translate-y-0"
      >
        Solve Daily
      </button>
      <NavItems onNavigate={onNavigate} />
      <div className="mt-auto border-t border-outline-variant pt-md flex flex-col gap-xs">
        <NavLink
          to="/security"
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-md rounded-lg px-md py-sm transition-colors font-label-caps text-label-caps group ${
              isActive
                ? 'bg-primary-container text-on-primary-container'
                : 'text-on-surface-variant hover:bg-surface-container-highest'
            }`
          }
        >
          <Icon name="settings" className="text-secondary group-hover:text-primary transition-colors" />
          Settings
        </NavLink>
        <button
          onClick={logout}
          className="flex items-center gap-md text-error hover:bg-error-container hover:text-on-error-container rounded-lg px-md py-sm transition-colors font-label-caps text-label-caps"
        >
          <Icon name="logout" />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <nav className="hidden lg:flex flex-col h-screen fixed left-0 top-0 p-md w-64 bg-surface-container-low border-r border-outline-variant z-40">
        <SidebarBody />
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <nav className="flex flex-col h-full p-md w-64 bg-surface-container-low border-r border-outline-variant">
            <SidebarBody onNavigate={() => setMobileOpen(false)} />
          </nav>
          <div className="flex-1 bg-black/30" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <main className="flex-1 lg:ml-64 w-full">
        <TwoFactorBanner />
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 bg-surface border-b border-outline-variant px-md h-16 flex items-center justify-between">
          <button className="p-sm text-on-surface-variant" onClick={() => setMobileOpen(true)}>
            <Icon name="menu" />
          </button>
          <h1 className="text-headline-sm font-black text-primary">AlgoSheet</h1>
          <NotificationBell />
        </header>

        {/* Desktop utility bar (notification bell) */}
        <div className="hidden lg:flex justify-end items-center h-14 px-lg border-b border-outline-variant bg-surface/60 backdrop-blur sticky top-0 z-30">
          <NotificationBell />
        </div>

        <div className="max-w-container-max mx-auto px-md lg:px-lg py-lg lg:py-xl">{children}</div>
      </main>
    </div>
  );
}
