import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from '@sprout/db';
import { api, setMfaToken } from '../api';
import { Field } from '../components/ui';

export const Route = createFileRoute('/mfa')({ component: MfaPage });

function MfaPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState('Sending a code to your email…');
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const sentOnce = useRef(false);

  async function sendCode() {
    setSending(true);
    setError(null);
    try {
      await api.post('/auth/mfa/send', {});
      setInfo('We emailed you a 6-digit code. It expires in 10 minutes.');
    } catch (e) {
      setError((e as Error).message || 'Could not send a code.');
      setInfo('');
    } finally {
      setSending(false);
    }
  }

  // Send a code once on arrival (guard against StrictMode double-invoke).
  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    void sendCode();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setError(null);
    try {
      const { mfaToken } = await api.post<{ mfaToken: string }>('/auth/mfa/verify', {
        code: code.trim(),
      });
      setMfaToken(mfaToken);
      navigate({ to: '/dashboard' });
    } catch (e) {
      setError((e as Error).message || 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: '/login' });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm"
      >
        <div className="text-center">
          <img src="/sprout-logo.png" alt="Sprout" className="mx-auto h-11" />
          <p className="mt-1 text-sm text-muted">Two-step verification</p>
        </div>
        {info && <p className="text-sm text-muted">{info}</p>}
        <Field label="6-digit code">
          <input
            className="input w-full tracking-[0.3em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            required
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn-primary w-full" type="submit" disabled={verifying || !code.trim()}>
          {verifying ? 'Verifying…' : 'Verify'}
        </button>
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            className="text-primary disabled:opacity-50"
            onClick={sendCode}
            disabled={sending}
          >
            {sending ? 'Sending…' : 'Resend code'}
          </button>
          <button type="button" className="text-muted hover:text-gray-900" onClick={signOut}>
            Sign out
          </button>
        </div>
      </form>
    </div>
  );
}
