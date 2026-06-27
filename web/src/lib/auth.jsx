import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On boot, if we have a token, resolve the current user (resume the session).
  useEffect(() => {
    (async () => {
      if (!getToken()) return setLoading(false);
      try {
        const { user } = await api.get('/auth/me');
        setUser(user);
      } catch {
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onAuthed = ({ token, user }) => {
    setToken(token);
    setUser(user);
    // Fresh sign-in → let the "enable 2FA" banner show again this session.
    sessionStorage.removeItem('dsa_2fa_banner_dismissed');
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  // Re-fetch the user (e.g. after enabling 2FA) to refresh flags.
  const refresh = async () => {
    const { user } = await api.get('/auth/me');
    setUser(user);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, onAuthed, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}
