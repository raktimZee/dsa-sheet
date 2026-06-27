import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Overview from './pages/Overview.jsx';
import Problems from './pages/Problems.jsx';
import Rankings from './pages/Rankings.jsx';
import Analytics from './pages/Analytics.jsx';
import Account from './pages/Account.jsx';
import Security from './pages/Security.jsx';
import Admin from './pages/Admin.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function Splash() {
  return (
    <div className="min-h-screen grid place-items-center text-on-surface-variant">Loading…</div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/" element={<Protected><Overview /></Protected>} />
      <Route path="/problems" element={<Protected><Problems /></Protected>} />
      <Route path="/rankings" element={<Protected><Rankings /></Protected>} />
      <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
      <Route path="/account" element={<Protected><Account /></Protected>} />
      <Route path="/security" element={<Protected><Security /></Protected>} />
      <Route path="/admin" element={<Protected><Admin /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
