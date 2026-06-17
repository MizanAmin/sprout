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
import { Modal, Field, Spinner, EmptyState, Badge } from '../components/ui';

export const Route = createFileRoute('/funding')({
  component: FundingPage,
});

function FundingPage() {
  const { data: periods, isLoading: periodsLoading } = usePeriods();
  const { data: claims, isLoading: claimsLoading } = useClaims();
  const deletePeriod = useDeletePeriod();
  const deleteClaim = useDeleteClaim();

  const [periodModal, setPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<FundingPeriod | null>(null);
  const [claimModal, setClaimModal] = useState(false);
  const [editingClaim, setEditingClaim] = useState<FundingClaim | null>(null);

  const periodLabel = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of periods ?? []) map.set(p.id, p.label);
    return map;
  }, [periods]);

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Funding Reconciliation</h1>

      {/* Periods */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Funding periods</h2>
          <button
            className="btn-primary"
            onClick={() => {
              setEditingPeriod(null);
              setPeriodModal(true);
            }}
          >
            Add period
          </button>
        </div>

        {periodsLoading ? (
          <Spinner />
        ) : (periods ?? []).length === 0 ? (
          <EmptyState title="No funding periods" description="Add a funding period to get started." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(periods ?? []).map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900">{p.label}</h3>
                  <div className="flex gap-2">
                    <button
                      className="text-sm text-primary"
                      onClick={() => {
                        setEditingPeriod(p);
                        setPeriodModal(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="text-sm text-danger"
                      onClick={() => {
                        if (confirm(`Delete ${p.label}?`)) deletePeriod.mutate(p.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {p.start_date} → {p.end_date}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Claims */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Claims</h2>
          <button
            className="btn-primary"
            onClick={() => {
              setEditingClaim(null);
              setClaimModal(true);
            }}
          >
            Add claim
          </button>
        </div>

        {claimsLoading ? (
          <Spinner />
        ) : (claims ?? []).length === 0 ? (
          <EmptyState title="No claims" description="Add a claim to get started." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Child</th>
                  <th className="px-4 py-2 font-medium">Period</th>
                  <th className="px-4 py-2 font-medium">Claimed</th>
                  <th className="px-4 py-2 font-medium">Expected</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {(claims ?? []).map((cl) => (
                  <tr key={cl.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-gray-900">{cl.child_name || '—'}</td>
                    <td className="px-4 py-2 text-muted">
                      {periodLabel.get(cl.funding_period_id) ?? `#${cl.funding_period_id}`}
                    </td>
                    <td className="px-4 py-2 text-muted">{cl.claimed_hours}</td>
                    <td className="px-4 py-2 text-muted">{cl.expected_hours}</td>
                    <td className="px-4 py-2">
                      <Badge variant={cl.status === 'submitted' ? 'success' : 'muted'}>
                        {cl.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="text-sm text-primary"
                          onClick={() => {
                            setEditingClaim(cl);
                            setClaimModal(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="text-sm text-danger"
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

      <PeriodModal
        open={periodModal}
        editing={editingPeriod}
        onClose={() => setPeriodModal(false)}
      />
      <ClaimModal
        open={claimModal}
        editing={editingClaim}
        periods={periods ?? []}
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
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.label}` : 'Add period'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Label">
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="input" required />
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
  periods,
  onClose,
}: {
  open: boolean;
  editing: FundingClaim | null;
  periods: FundingPeriod[];
  onClose: () => void;
}) {
  const { data: children } = useChildren();
  const createClaim = useCreateClaim();
  const updateClaim = useUpdateClaim(editing?.id ?? 0);

  const [fundingPeriodId, setFundingPeriodId] = useState<number | ''>('');
  const [childId, setChildId] = useState<number | ''>('');
  const [claimedHours, setClaimedHours] = useState('0');
  const [expectedHours, setExpectedHours] = useState('0');
  const [status, setStatus] = useState('draft');

  const [seedKey, setSeedKey] = useState<string>('');
  const key = `${open}-${editing?.id ?? 'new'}`;
  if (key !== seedKey) {
    setSeedKey(key);
    setFundingPeriodId(editing?.funding_period_id ?? '');
    setChildId(editing?.child_id ?? '');
    setClaimedHours(String(editing?.claimed_hours ?? 0));
    setExpectedHours(String(editing?.expected_hours ?? 0));
    setStatus(editing?.status ?? 'draft');
  }

  const submitting = editing ? updateClaim.isPending : createClaim.isPending;

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
    };
    if (editing) updateClaim.mutate(data, { onSuccess: onClose });
    else createClaim.mutate(data, { onSuccess: onClose });
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit claim' : 'Add claim'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Funding period">
          <select
            value={fundingPeriodId}
            onChange={(e) => setFundingPeriodId(e.target.value ? Number(e.target.value) : '')}
            className="input"
            required
          >
            <option value="">Select a period…</option>
            {periods.map((p) => (
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
            {(children ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
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
