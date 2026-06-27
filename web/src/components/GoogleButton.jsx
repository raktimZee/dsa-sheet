import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

// Renders the official Google Identity Services button — ONLY when a client id is configured
// at build time (VITE_GOOGLE_CLIENT_ID). Without it, this renders nothing, so the app works
// fully on email/password + email 2FA with no Google setup.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function GoogleButton() {
  const { onAuthed } = useAuth();
  const navigate = useNavigate();
  const ref = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!CLIENT_ID) return;
    const handleCredential = async (response) => {
      try {
        const res = await api.post('/auth/google', { credential: response.credential });
        onAuthed(res);
        navigate('/');
      } catch (err) {
        setError(err.message);
      }
    };

    const init = () => {
      if (!window.google?.accounts?.id || !ref.current) return;
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleCredential });
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
      });
    };

    if (window.google?.accounts?.id) {
      init();
    } else {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = init;
      document.head.appendChild(s);
    }
  }, []);

  if (!CLIENT_ID) return null;

  return (
    <div className="mt-md">
      <div className="flex items-center gap-sm my-md">
        <div className="flex-1 h-px bg-outline-variant" />
        <span className="text-body-sm text-on-surface-variant">or</span>
        <div className="flex-1 h-px bg-outline-variant" />
      </div>
      <div ref={ref} className="flex justify-center" />
      {error && <div className="mt-sm text-body-sm text-error">{error}</div>}
    </div>
  );
}
