import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, clearKey, getKey, setKey, type ApiError, type Nursery, type Plan } from './api';

const PLANS: Plan[] = ['seedling', 'blossom', 'grove', 'forest', 'cancelled'];

function fmtDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// type="date" value (YYYY-MM-DD) from an ISO timestamp.
function toDateInput(s: string | null): string {
  if (!s) return '';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export default function App() {
  const [unlocked, setUnlocked] = useState(!!getKey());
  if (!unlocked) return <KeyGate onUnlock={() => setUnlocked(true)} />;
  return (
    <Dashboard
      onLock={() => {
        clearKey();
        setUnlocked(false);
      }}
    />
  );
}

// --- Key gate -----------------------------------------------------------------
function KeyGate({ onUnlock }: { onUnlock: () => void }) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setKey(val.trim());
    try {
      await api.get('/admin/nurseries');
      onUnlock();
    } catch (e) {
      clearKey();
      const ae = e as ApiError;
      setErr(ae.status === 401 ? 'Invalid admin key.' : ae.message || 'Could not reach the API.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <form className="gate-card" onSubmit={submit}>
        <div className="brand">🌱 Sprout — Platform Admin</div>
        <p className="muted">Enter the admin key to manage tenants.</p>
        <input
          type="password"
          className="input"
          placeholder="Admin key"
          value={val}
          autoFocus
          onChange={(e) => setVal(e.target.value)}
        />
        {err && <div className="error">{err}</div>}
        <button className="btn-primary" disabled={busy || !val.trim()}>
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}

// --- Dashboard ----------------------------------------------------------------
function Dashboard({ onLock }: { onLock: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['nurseries'],
    queryFn: () => api.get<{ nurseries: Nursery[] }>('/admin/nurseries'),
  });
  const [editing, setEditing] = useState<Nursery | null>(null);
  const [creating, setCreating] = useState(false);

  // A 401 mid-session (rotated/cleared key) → drop back to the gate.
  useEffect(() => {
    if ((error as ApiError | null)?.status === 401) onLock();
  }, [error, onLock]);

  const suspend = useMutation({
    mutationFn: (n: Nursery) =>
      api.patch(`/admin/nurseries/${n.id}`, {
        status: n.status === 'suspended' ? 'active' : 'suspended',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nurseries'] }),
  });

  const list = data?.nurseries ?? [];

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">🌱 Sprout — Platform Admin</div>
        <div className="row">
          <button className="btn-primary" onClick={() => setCreating(true)}>
            + New nursery
          </button>
          <button className="btn-ghost" onClick={onLock}>
            Lock
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
                      <div className="strong">{n.name}</div>
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
                    <td>{n.user_count}</td>
                    <td>{fmtDate(n.created_at)}</td>
                    <td className="right nowrap">
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
        <input
          type="date"
          className="input"
          value={trial}
          onChange={(e) => setTrial(e.target.value)}
        />
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
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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
