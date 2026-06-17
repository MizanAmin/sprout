import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  usePeriods,
  useCreatePeriod,
  useUpdatePeriod,
  useDeletePeriod,
  useClaims,
  useCreateClaim,
  useUpdateClaim,
  useDeleteClaim,
  type FundingPeriod,
  type PeriodInput,
  type FundingClaim,
  type ClaimInput,
} from '../features/funding/useFunding';
import { useChildren } from '../features/children/useChildren';
import { Modal, Field, Spinner, EmptyState, Badge, StatCard, gbp } from '../components/ui';

export const Route = createFileRoute('/funding')({
  component: FundingPage,
});

// Maps a claim status to a Badge variant. The reference app uses
// short/over/matched; here we map the hours-based statuses the API exposes
// (draft/submitted/reconciled) plus those reference values for forward-compat.
function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'muted' {
  switch (status) {
    case 'reconciled':
    case 'matched':
      return 'success';
    case 'submitted':
      return 'info';
    case 'over':
      return 'warning';
    case 'short':
      return 'danger';
    default:
      return 'muted';
  }
}

function FundingPage() {
  const { data: periods, isLoading: periodsLoading } = usePeriods();
  const { data: allClaims, isLoading: claimsLoading } = useClaims();
  const { data: children } = useChildren();
  const deletePeriod = useDeletePeriod();
  const deleteClaim = useDeleteClaim();

  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [periodModal, setPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<FundingPeriod | null>(null);
  const [claimModal, setClaimModal] = useState(false);
  const [editingClaim, setEditingClaim] = useState<FundingClaim | null>(null);

  // Default the selector to the first (most recent) period once loaded.
  const activePeriodId =
    selectedPeriodId ?? (periods && periods.length > 0 ? periods[0].id : null);
  const activePeriod = useMemo(
    () => (periods ?? []).find((p) => p.id === activePeriodId) ?? null,
    [periods, activePeriodId],
  );

  // Claims scoped to the selected period (the API can filter by ?periodId, but
  // useClaims() fetches all; filter client-side to avoid a new hook).
  const claims = useMemo(
    () => (allClaims ?? []).filter((c) => c.funding_period_id === activePeriodId),
    [allClaims, activePeriodId],
  );

  const totalClaimed = claims.reduce((s, c) => s + (Number(c.claimed_hours) || 0), 0);
  const totalExpected = claims.reduce((s, c) => s + (Number(c.expected_hours) || 0), 0);
  const variance = totalClaimed - totalExpected;
  // A claim is a discrepancy when claimed != expected hours.
  const discrepancies = claims.filter(
    (c) => (Number(c.claimed_hours) || 0) !== (Number(c.expected_hours) || 0),
  );

  const childName = (cl: FundingClaim) =>
    cl.child_name || children?.find((ch) => ch.id === cl.child_id)?.name || '—';

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Funding Reconciliation</h1>

      {/* Period selector + actions */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="text-xs font-bold text-muted">Period</label>
            <select
              className="input w-auto"
              value={activePeriodId ?? ''}
              onChange={(e) => setSelectedPeriodId(e.target.value ? Number(e.target.value) : null)}
              disabled={periodsLoading || (periods ?? []).length === 0}
            >
              <option value="">— Select period —</option>
              {(periods ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.start_date} – {p.end_date})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-outline btn-sm"
              onClick={() => {
                setEditingPeriod(null);
                setPeriodModal(true);
              }}
            >
              + New period
            </button>
            {activePeriod && (
              <button
                className="btn-outline btn-sm"
                onClick={() => {
                  setEditingPeriod(activePeriod);
                  setPeriodModal(true);
                }}
              >
                Edit period
              </button>
            )}
            {activePeriod && (
              <button
                className="btn-outline btn-sm text-danger"
                onClick={() => {
                  if (confirm(`Delete ${activePeriod.label}?`)) {
                    deletePeriod.mutate(activePeriod.id);
                    setSelectedPeriodId(null);
                  }
                }}
              >
                Delete period
              </button>
            )}
            {activePeriod && (
              <button
                className="btn-primary btn-sm"
                onClick={() => {
                  setEditingClaim(null);
                  setClaimModal(true);
                }}
              >
                + Add claim
              </button>
            )}
          </div>
        </div>
      </div>

      {periodsLoading ? (
        <Spinner />
      ) : (periods ?? []).length === 0 ? (
        <EmptyState
          title="No funding periods yet"
          description='Click "+ New period" to create one (e.g. "Autumn Term 2026").'
        />
      ) : !activePeriod ? (
        <EmptyState title="Select a period" description="Choose a funding period to view claims." />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Claimed hours" value={totalClaimed} />
            <StatCard label="Expected hours" value={totalExpected} />
            <StatCard
              label="Variance"
              value={`${variance > 0 ? '+' : ''}${variance}`}
              hint={variance === 0 ? 'Balanced' : variance < 0 ? 'Under-claimed' : 'Over-claimed'}
            />
            <StatCard label="Discrepancies" value={discrepancies.length} />
          </div>

          {/* Discrepancies callout */}
          {discrepancies.length > 0 && (
            <div className="card border-l-[3px] border-l-danger">
              <h2 className="mb-2 text-base font-semibold text-gray-900">⚠️ Discrepancies</h2>
              <div className="space-y-1">
                {discrepancies.map((c) => {
                  const diff = (Number(c.claimed_hours) || 0) - (Number(c.expected_hours) || 0);
                  return (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-1.5 text-sm last:border-0"
                    >
                      <span className="font-medium text-gray-900">{childName(c)}</span>
                      <span className="text-muted">
                        Claimed {c.claimed_hours}h, expected {c.expected_hours}h (
                        {diff < 0 ? 'short by' : 'over by'} {Math.abs(diff)}h)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Claims table */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Claims — {activePeriod.label}</h2>
            {claimsLoading ? (
              <Spinner />
            ) : claims.length === 0 ? (
              <EmptyState
                title="No claims for this period yet"
                description='Use "+ Add claim" to record a child’s claimed vs expected hours.'
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-surface">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-left text-muted">
                    <tr>
                      <th className="px-4 py-2 font-medium">Child</th>
                      <th className="px-4 py-2 font-medium">Type</th>
                      <th className="px-4 py-2 font-medium">Claimed</th>
                      <th className="px-4 py-2 font-medium">Expected</th>
                      <th className="px-4 py-2 font-medium">Amount</th>
                      <th className="px-4 py-2 font-medium">Received</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map((cl) => (
                      <tr key={cl.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 font-medium text-gray-900">{childName(cl)}</td>
                        <td className="px-4 py-2">
                          {cl.claim_type ? (
                            <Badge variant="info">{cl.claim_type}</Badge>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-muted">{cl.claimed_hours}</td>
                        <td className="px-4 py-2 text-muted">{cl.expected_hours}</td>
                        <td className="px-4 py-2 text-muted">
                          {cl.amount != null ? gbp(Number(cl.amount)) : '—'}
                        </td>
                        <td className="px-4 py-2 text-muted">{cl.received_date || '—'}</td>
                        <td className="px-4 py-2">
                          <Badge variant={statusVariant(cl.status)}>{cl.status}</Badge>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              className="btn-outline btn-sm"
                              onClick={() => {
                                setEditingClaim(cl);
                                setClaimModal(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-outline btn-sm text-danger"
                              onClick={() => {
                                if (confirm('Delete this claim?')) deleteClaim.mutate(cl.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <PeriodModal open={periodModal} editing={editingPeriod} onClose={() => setPeriodModal(false)} />
      <ClaimModal
        open={claimModal}
        editing={editingClaim}
        defaultPeriodId={activePeriodId}
        onClose={() => setClaimModal(false)}
      />
    </div>
  );
}

function PeriodModal({
  open,
  editing,
  onClose,
}: {
  open: boolean;
  editing: FundingPeriod | null;
  onClose: () => void;
}) {
  const createPeriod = useCreatePeriod();
  const updatePeriod = useUpdatePeriod(editing?.id ?? 0);

  const [label, setLabel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Re-seed form when the modal opens for a different record.
  const [seedKey, setSeedKey] = useState<string>('');
  const key = `${open}-${editing?.id ?? 'new'}`;
  if (key !== seedKey) {
    setSeedKey(key);
    setLabel(editing?.label ?? '');
    setStartDate(editing?.start_date ?? '');
    setEndDate(editing?.end_date ?? '');
  }

  const submitting = editing ? updatePeriod.isPending : createPeriod.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: PeriodInput = { label, startDate, endDate };
    if (editing) updatePeriod.mutate(data, { onSuccess: onClose });
    else createPeriod.mutate(data, { onSuccess: onClose });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.label}` : 'New funding period'}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="input"
            placeholder="e.g. Autumn Term 2026"
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start date">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
              required
            />
          </Field>
          <Field label="End date">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input"
              required
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ClaimModal({
  open,
  editing,
  defaultPeriodId,
  onClose,
}: {
  open: boolean;
  editing: FundingClaim | null;
  defaultPeriodId: number | null;
  onClose: () => void;
}) {
  const { data: periods } = usePeriods();
  const { data: children } = useChildren();
  const createClaim = useCreateClaim();
  const updateClaim = useUpdateClaim(editing?.id ?? 0);

  const [fundingPeriodId, setFundingPeriodId] = useState<number | ''>('');
  const [childId, setChildId] = useState<number | ''>('');
  const [claimedHours, setClaimedHours] = useState('0');
  const [expectedHours, setExpectedHours] = useState('0');
  const [status, setStatus] = useState('draft');
  const [claimType, setClaimType] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const [seedKey, setSeedKey] = useState<string>('');
  const key = `${open}-${editing?.id ?? 'new'}`;
  if (key !== seedKey) {
    setSeedKey(key);
    setFundingPeriodId(editing?.funding_period_id ?? defaultPeriodId ?? '');
    setChildId(editing?.child_id ?? '');
    setClaimedHours(String(editing?.claimed_hours ?? 0));
    setExpectedHours(String(editing?.expected_hours ?? 0));
    setStatus(editing?.status ?? 'draft');
    setClaimType(editing?.claim_type ?? '');
    setReceivedDate(editing?.received_date ?? '');
    setReference(editing?.reference ?? '');
    setAmount(editing?.amount != null ? String(editing.amount) : '');
    setNotes(editing?.notes ?? '');
  }

  const submitting = editing ? updateClaim.isPending : createClaim.isPending;
  const activeChildren = (children ?? []).filter((c) => c.status === 'Active');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fundingPeriodId === '') return;
    const childName =
      childId !== '' ? children?.find((c) => c.id === childId)?.name : undefined;
    const data: ClaimInput = {
      fundingPeriodId,
      childId: childId === '' ? undefined : childId,
      childName,
      claimedHours: Number(claimedHours) || 0,
      expectedHours: Number(expectedHours) || 0,
      status,
      claimType: claimType || undefined,
      receivedDate: receivedDate || undefined,
      reference: reference || undefined,
      notes: notes || undefined,
      amount: amount === '' ? undefined : Number(amount),
    };
    if (editing) updateClaim.mutate(data, { onSuccess: onClose });
    else createClaim.mutate(data, { onSuccess: onClose });
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit claim' : 'Add funding claim'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Funding period">
          <select
            value={fundingPeriodId}
            onChange={(e) => setFundingPeriodId(e.target.value ? Number(e.target.value) : '')}
            className="input"
            required
          >
            <option value="">Select a period…</option>
            {(periods ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Child">
          <select
            value={childId}
            onChange={(e) => setChildId(e.target.value ? Number(e.target.value) : '')}
            className="input"
          >
            <option value="">No child</option>
            {activeChildren.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Claim type">
          <select
            value={claimType}
            onChange={(e) => setClaimType(e.target.value)}
            className="input"
          >
            <option value="">— Select type —</option>
            <option value="LA">LA</option>
            <option value="Tax-Free Childcare">Tax-Free Childcare</option>
            <option value="Other">Other</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Claimed hours">
            <input
              type="number"
              min="0"
              step="0.5"
              value={claimedHours}
              onChange={(e) => setClaimedHours(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Expected hours">
            <input
              type="number"
              min="0"
              step="0.5"
              value={expectedHours}
              onChange={(e) => setExpectedHours(e.target.value)}
              className="input"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Received date">
            <input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Amount (£)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input"
              placeholder="0.00"
            />
          </Field>
        </div>
        <Field label="Reference">
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="input"
            placeholder="e.g. claim reference"
          />
        </Field>
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input"
            rows={2}
          />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            <option value="draft">draft</option>
            <option value="submitted">submitted</option>
            <option value="reconciled">reconciled</option>
          </select>
        </Field>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
