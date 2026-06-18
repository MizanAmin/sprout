import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { api, type ApiError, type Nursery, type NurseryUser, type Plan } from './api';

const PLANS: Plan[] = ['seedling', 'blossom', 'grove', 'forest', 'cancelled'];

function fmtDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toDateInput(s: string | null): string {
  if (!s) return '';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="gate muted">Loading…</div>;
  if (!session) return <LoginGate />;
  return <Dashboard email={session.user.email ?? ''} />;
}

// --- Login (Supabase OTP email code) ------------------------------------------
function LoginGate() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setStep('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    if (error) setErr(error.message);
    // success → onAuthStateChange sets the session and re-renders.
  }

  return (
    <div className="gate">
      <form className="gate-card" onSubmit={step === 'email' ? sendCode : verify}>
        <div className="brand">🌱 Sprout — Platform Admin</div>
        {step === 'email' ? (
          <>
            <p className="muted">Sign in with your admin email. We'll send a one-time code.</p>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
            />
            {err && <div className="error">{err}</div>}
            <button className="btn-primary" disabled={busy || !email.trim()}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              Enter the 6-digit code sent to <strong>{email}</strong>.
            </p>
            <input
              className="input"
              placeholder="123456"
              value={code}
              autoFocus
              inputMode="numeric"
              onChange={(e) => setCode(e.target.value)}
            />
            {err && <div className="error">{err}</div>}
            <button className="btn-primary" disabled={busy || !code.trim()}>
              {busy ? 'Verifying…' : 'Verify & sign in'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setStep('email')}>
              Use a different email
            </button>
          </>
        )}
      </form>
    </div>
  );
}

// --- Dashboard ----------------------------------------------------------------
function Dashboard({ email }: { email: string }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['nurseries'],
    queryFn: () => api.get<{ nurseries: Nursery[] }>('/admin/nurseries'),
  });
  const [editing, setEditing] = useState<Nursery | null>(null);
  const [managing, setManaging] = useState<Nursery | null>(null);
  const [creating, setCreating] = useState(false);

  const suspend = useMutation({
    mutationFn: (n: Nursery) =>
      api.patch(`/admin/nurseries/${n.id}`, {
        status: n.status === 'suspended' ? 'active' : 'suspended',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nurseries'] }),
  });

  const signOut = () => supabase.auth.signOut();

  // Not on the allowlist → clear, helpful screen rather than a broken table.
  if ((error as ApiError | null)?.status === 403) {
    return (
      <div className="gate">
        <div className="gate-card">
          <div className="brand">Access denied</div>
          <p className="muted">
            <strong>{email}</strong> is not on the platform-admin allowlist. Ask for your email to
            be added to <code>ADMIN_EMAILS</code>.
          </p>
          <button className="btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const list = data?.nurseries ?? [];

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">🌱 Sprout — Platform Admin</div>
        <div className="row">
          <span className="muted sm">{email}</span>
          <button className="btn-primary" onClick={() => setCreating(true)}>
            + New nursery
          </button>
          <button className="btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="content">
        <div className="stats">
          <Stat label="Nurseries" value={list.length} />
          <Stat label="Active" value={list.filter((n) => n.status !== 'suspended').length} />
          <Stat label="Suspended" value={list.filter((n) => n.status === 'suspended').length} />
          <Stat label="Subscribed" value={list.filter((n) => n.stripe_subscription_id).length} />
        </div>

        {isLoading ? (
          <div className="muted pad">Loading…</div>
        ) : error ? (
          <div className="error pad">{(error as ApiError).message}</div>
        ) : list.length === 0 ? (
          <div className="muted pad">No nurseries yet.</div>
        ) : (
          <div className="card">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nursery</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Trial ends</th>
                  <th>Users</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((n) => (
                  <tr key={n.id}>
                    <td className="muted">{n.id}</td>
                    <td>
                      <button className="linklike" onClick={() => setManaging(n)}>
                        {n.name}
                      </button>
                      <div className="muted sm">{n.email || '—'}</div>
                    </td>
                    <td>
                      <span className={`badge plan-${n.plan}`}>{n.plan}</span>
                    </td>
                    <td>
                      <span className={`badge ${n.status === 'suspended' ? 'bad' : 'ok'}`}>
                        {n.status}
                      </span>
                    </td>
                    <td>{fmtDate(n.trial_ends_at)}</td>
                    <td>
                      <button className="linklike" onClick={() => setManaging(n)}>
                        {n.user_count}
                      </button>
                    </td>
                    <td>{fmtDate(n.created_at)}</td>
                    <td className="right nowrap">
                      <button className="btn-ghost sm" onClick={() => setManaging(n)}>
                        Users
                      </button>
                      <button className="btn-ghost sm" onClick={() => setEditing(n)}>
                        Edit
                      </button>
                      <button
                        className="btn-ghost sm"
                        disabled={suspend.isPending}
                        onClick={() => suspend.mutate(n)}
                      >
                        {n.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {editing && <EditModal nursery={editing} onClose={() => setEditing(null)} />}
      {managing && <UsersModal nursery={managing} onClose={() => setManaging(null)} />}
      {creating && <CreateModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="muted sm">{label}</div>
    </div>
  );
}

// --- Edit modal (plan / status / trial) ---------------------------------------
function EditModal({ nursery, onClose }: { nursery: Nursery; onClose: () => void }) {
  const qc = useQueryClient();
  const [plan, setPlan] = useState<Plan>(nursery.plan);
  const [status, setStatus] = useState<Nursery['status']>(nursery.status);
  const [trial, setTrial] = useState(toDateInput(nursery.trial_ends_at));

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/admin/nurseries/${nursery.id}`, {
        plan,
        status,
        trialEndsAt: trial ? new Date(`${trial}T00:00:00Z`).toISOString() : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nurseries'] });
      onClose();
    },
  });

  return (
    <Modal title={`Edit — ${nursery.name}`} onClose={onClose}>
      <label className="field">
        <span>Plan</span>
        <select className="input" value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Status</span>
        <select
          className="input"
          value={status}
          onChange={(e) => setStatus(e.target.value as Nursery['status'])}
        >
          <option value="active">active</option>
          <option value="suspended">suspended</option>
        </select>
      </label>
      <label className="field">
        <span>Trial ends</span>
        <input type="date" className="input" value={trial} onChange={(e) => setTrial(e.target.value)} />
      </label>
      {save.error && <div className="error">{(save.error as ApiError).message}</div>}
      <div className="actions">
        <button className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}

// --- Users drill-down modal ---------------------------------------------------
function UsersModal({ nursery, onClose }: { nursery: Nursery; onClose: () => void }) {
  const qc = useQueryClient();
  const key = ['nursery-users', nursery.id];
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => api.get<{ users: NurseryUser[] }>(`/admin/nurseries/${nursery.id}/users`),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['nurseries'] });
  };

  const setRole = useMutation({
    mutationFn: (v: { userId: string; role: 'manager' | 'staff' }) =>
      api.patch(`/admin/nurseries/${nursery.id}/users/${v.userId}`, { role: v.role }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api.delete(`/admin/nurseries/${nursery.id}/users/${userId}`),
    onSuccess: refresh,
  });

  // Invite form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setInviteRole] = useState<'manager' | 'staff'>('staff');
  const invite = useMutation({
    mutationFn: () =>
      api.post(`/admin/nurseries/${nursery.id}/users`, { name, email, role }),
    onSuccess: () => {
      setName('');
      setEmail('');
      refresh();
    },
  });
  const inviteValid = name.trim() && /\S+@\S+\.\S+/.test(email);

  const users = data?.users ?? [];

  return (
    <Modal title={`Users — ${nursery.name}`} onClose={onClose} wide>
      {isLoading ? (
        <div className="muted">Loading…</div>
      ) : error ? (
        <div className="error">{(error as ApiError).message}</div>
      ) : (
        <table className="tbl tight">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No users.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id}>
                <td className="strong">{u.name || '—'}</td>
                <td className="muted sm">{u.email}</td>
                <td>
                  {u.role === 'parent' ? (
                    <span className="badge plan-seedling">
                      parent{u.child_count ? ` · ${u.child_count}` : ''}
                    </span>
                  ) : (
                    <select
                      className="input narrow"
                      value={u.role}
                      disabled={setRole.isPending}
                      onChange={(e) =>
                        setRole.mutate({ userId: u.id, role: e.target.value as 'manager' | 'staff' })
                      }
                    >
                      <option value="manager">manager</option>
                      <option value="staff">staff</option>
                    </select>
                  )}
                </td>
                <td className="right">
                  <button
                    className="btn-ghost sm danger"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (confirm(`Remove ${u.email}? This deletes their login.`))
                        remove.mutate(u.id);
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="invite">
        <div className="strong sm">Invite a user</div>
        <div className="invite-row">
          <input
            className="input"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            className="input narrow"
            value={role}
            onChange={(e) => setInviteRole(e.target.value as 'manager' | 'staff')}
          >
            <option value="staff">staff</option>
            <option value="manager">manager</option>
          </select>
          <button
            className="btn-primary"
            disabled={invite.isPending || !inviteValid}
            onClick={() => invite.mutate()}
          >
            {invite.isPending ? 'Inviting…' : 'Invite'}
          </button>
        </div>
        {invite.error && <div className="error">{(invite.error as ApiError).message}</div>}
      </div>

      <div className="actions">
        <button className="btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

// --- Create modal (new nursery + manager invite) ------------------------------
function CreateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [nurseryName, setNurseryName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState<Plan>('seedling');
  const [trialDays, setTrialDays] = useState(14);

  const create = useMutation({
    mutationFn: () =>
      api.post('/admin/nurseries', { nurseryName, managerName, email, plan, trialDays }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nurseries'] });
      onClose();
    },
  });

  const valid = nurseryName.trim() && managerName.trim() && /\S+@\S+\.\S+/.test(email);

  return (
    <Modal title="New nursery" onClose={onClose}>
      <p className="muted sm">An email invite with a sign-in link is sent to the manager.</p>
      <label className="field">
        <span>Nursery name</span>
        <input className="input" value={nurseryName} onChange={(e) => setNurseryName(e.target.value)} />
      </label>
      <label className="field">
        <span>Manager name</span>
        <input className="input" value={managerName} onChange={(e) => setManagerName(e.target.value)} />
      </label>
      <label className="field">
        <span>Manager email</span>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <div className="grid2">
        <label className="field">
          <span>Plan</span>
          <select className="input" value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Trial days</span>
          <input
            className="input"
            type="number"
            min={0}
            max={365}
            value={trialDays}
            onChange={(e) => setTrialDays(Number(e.target.value))}
          />
        </label>
      </div>
      {create.error && <div className="error">{(create.error as ApiError).message}</div>}
      <div className="actions">
        <button className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn-primary"
          disabled={create.isPending || !valid}
          onClick={() => create.mutate()}
        >
          {create.isPending ? 'Creating…' : 'Create & invite'}
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className={`modal${wide ? ' wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="x" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
