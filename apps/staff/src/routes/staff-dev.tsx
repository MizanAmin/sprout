import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useTraining,
  useCreateTraining,
  useUpdateTraining,
  useDeleteTraining,
  useAppraisals,
  useCreateAppraisal,
  useUpdateAppraisal,
  useDeleteAppraisal,
  type Training,
  type TrainingInput,
  type Appraisal,
  type AppraisalInput,
} from '../features/staff-dev/useStaffDev';
import { useStaff } from '../features/staff/useStaff';
import { Modal, Field, Spinner, EmptyState, Badge, StatCard } from '../components/ui';
import { UpgradeNotice, isPlanError } from '../components/UpgradeNotice';

export const Route = createFileRoute('/staff-dev')({
  component: StaffDevPage,
});

const TRAINING_STATUS: Training['status'][] = ['planned', 'completed', 'expired'];

// Derived expiry status for the badge. Mirrors the reference app: expired if the
// expiry date is in the past, expiring-soon within the next 60 days, otherwise
// valid. Records without an expiry date are treated as valid.
type ExpiryStatus = 'expired' | 'expiring-soon' | 'valid' | 'none';

function expiryStatus(expiry: string | null): ExpiryStatus {
  if (!expiry) return 'none';
  const today = new Date().toISOString().slice(0, 10);
  const in60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  if (expiry < today) return 'expired';
  if (expiry <= in60) return 'expiring-soon';
  return 'valid';
}

const EXPIRY_VARIANT: Record<ExpiryStatus, 'success' | 'warning' | 'danger' | 'muted'> = {
  valid: 'success',
  'expiring-soon': 'warning',
  expired: 'danger',
  none: 'muted',
};

const EXPIRY_LABEL: Record<ExpiryStatus, string> = {
  valid: 'Valid',
  'expiring-soon': 'Expiring soon',
  expired: 'Expired',
  none: 'No expiry',
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StaffDevPage() {
  const { data: training, isLoading: trainingLoading, error: trainingError } = useTraining();
  const { data: appraisals, isLoading: appraisalsLoading, error: appraisalsError } = useAppraisals();

  if (isPlanError(trainingError) || isPlanError(appraisalsError)) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold text-gray-900">Staff Development</h1>
        <UpgradeNotice feature="Staff Development" />
      </div>
    );
  }
  const deleteTraining = useDeleteTraining();
  const deleteAppraisal = useDeleteAppraisal();

  const [trainingModal, setTrainingModal] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [appraisalModal, setAppraisalModal] = useState(false);
  const [editingAppraisal, setEditingAppraisal] = useState<Appraisal | null>(null);

  const trainingList = training ?? [];
  const appraisalList = appraisals ?? [];

  const expiredCount = trainingList.filter((t) => expiryStatus(t.expiry_date) === 'expired').length;
  const expiringCount = trainingList.filter(
    (t) => expiryStatus(t.expiry_date) === 'expiring-soon',
  ).length;

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Staff Development</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Training records" value={trainingList.length} />
        <StatCard label="Expired" value={expiredCount} hint="Past expiry date" />
        <StatCard label="Expiring soon" value={expiringCount} hint="Within 60 days" />
        <StatCard label="Appraisals" value={appraisalList.length} />
      </div>

      {/* TODO: needs /staff-dev/qualifications hook in useStaffDev for a Qualifications section. */}
      {/* TODO: needs /staff-dev/wellbeing hook in useStaffDev for a Wellbeing section. */}

      {/* Training / CPD */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Training &amp; CPD</h2>
          <button
            className="btn-primary"
            onClick={() => {
              setEditingTraining(null);
              setTrainingModal(true);
            }}
          >
            Add training
          </button>
        </div>

        {trainingLoading ? (
          <Spinner />
        ) : trainingList.length === 0 ? (
          <EmptyState
            title="No training records"
            description="Add a training or CPD record to get started."
          />
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Staff</th>
                  <th className="px-4 py-2 font-medium">Course</th>
                  <th className="px-4 py-2 font-medium">Provider</th>
                  <th className="px-4 py-2 font-medium">Completed</th>
                  <th className="px-4 py-2 font-medium">Expiry</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {trainingList.map((t) => {
                  const status = expiryStatus(t.expiry_date);
                  return (
                    <tr key={t.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 text-gray-900">{t.staff_name || '—'}</td>
                      <td className="px-4 py-2 text-gray-900">{t.course_name}</td>
                      <td className="px-4 py-2 text-muted">{t.provider || '—'}</td>
                      <td className="px-4 py-2 text-muted">{fmtDate(t.completed_date)}</td>
                      <td className="px-4 py-2 text-muted">{fmtDate(t.expiry_date)}</td>
                      <td className="px-4 py-2">
                        <Badge variant={EXPIRY_VARIANT[status]}>{EXPIRY_LABEL[status]}</Badge>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            className="btn-outline btn-sm"
                            onClick={() => {
                              setEditingTraining(t);
                              setTrainingModal(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-outline btn-sm text-danger"
                            onClick={() => {
                              if (confirm('Delete this training record?'))
                                deleteTraining.mutate(t.id);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Appraisals */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Appraisals</h2>
          <button
            className="btn-primary"
            onClick={() => {
              setEditingAppraisal(null);
              setAppraisalModal(true);
            }}
          >
            Add appraisal
          </button>
        </div>

        {appraisalsLoading ? (
          <Spinner />
        ) : appraisalList.length === 0 ? (
          <EmptyState title="No appraisals" description="Add an appraisal to get started." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {appraisalList.map((a) => (
              <div key={a.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{a.staff_name || '—'}</h3>
                    <p className="text-sm text-muted">{fmtDate(a.date)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn-outline btn-sm"
                      onClick={() => {
                        setEditingAppraisal(a);
                        setAppraisalModal(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-outline btn-sm text-danger"
                      onClick={() => {
                        if (confirm('Delete this appraisal?')) deleteAppraisal.mutate(a.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {a.appraiser && (
                  <p className="text-sm text-muted">Appraiser: {a.appraiser}</p>
                )}

                {a.strengths && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      Strengths
                    </p>
                    <p className="text-sm text-gray-700">{a.strengths}</p>
                  </div>
                )}

                {a.areas_for_dev && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      Areas for development
                    </p>
                    <p className="text-sm text-gray-700">{a.areas_for_dev}</p>
                  </div>
                )}

                {a.targets && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Targets</p>
                    <p className="text-sm text-gray-700">{a.targets}</p>
                  </div>
                )}

                {a.next_review && (
                  <p className="text-sm text-muted">Next review: {fmtDate(a.next_review)}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <TrainingModal
        open={trainingModal}
        editing={editingTraining}
        onClose={() => setTrainingModal(false)}
      />
      <AppraisalModal
        open={appraisalModal}
        editing={editingAppraisal}
        onClose={() => setAppraisalModal(false)}
      />
    </div>
  );
}

function TrainingModal({
  open,
  editing,
  onClose,
}: {
  open: boolean;
  editing: Training | null;
  onClose: () => void;
}) {
  const { data: staff } = useStaff();
  const createTraining = useCreateTraining();
  const updateTraining = useUpdateTraining(editing?.id ?? 0);

  const [staffId, setStaffId] = useState<number | ''>('');
  const [courseName, setCourseName] = useState('');
  const [provider, setProvider] = useState('');
  const [completedDate, setCompletedDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [status, setStatus] = useState<Training['status']>('completed');

  const [seedKey, setSeedKey] = useState('');
  const key = `${open}-${editing?.id ?? 'new'}`;
  if (key !== seedKey) {
    setSeedKey(key);
    setStaffId(editing?.staff_id ?? '');
    setCourseName(editing?.course_name ?? '');
    setProvider(editing?.provider ?? '');
    setCompletedDate(editing?.completed_date ?? '');
    setExpiryDate(editing?.expiry_date ?? '');
    setStatus(editing?.status ?? 'completed');
  }

  const submitting = editing ? updateTraining.isPending : createTraining.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const staffName = staffId !== '' ? staff?.find((s) => s.id === staffId)?.name : undefined;
    const data: TrainingInput = {
      staffId: staffId === '' ? undefined : staffId,
      staffName,
      courseName,
      provider: provider || undefined,
      completedDate: completedDate || undefined,
      expiryDate: expiryDate || undefined,
      status,
    };
    if (editing) updateTraining.mutate(data, { onSuccess: onClose });
    else createTraining.mutate(data, { onSuccess: onClose });
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit training' : 'Add training'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Staff">
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value ? Number(e.target.value) : '')}
            className="input"
          >
            <option value="">No staff member</option>
            {(staff ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Course / training title">
          <input
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            className="input"
            placeholder="e.g. Level 3 Safeguarding Refresher"
            required
          />
        </Field>
        <Field label="Provider">
          <input
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="input"
            placeholder="e.g. NSPCC, Local Authority"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Completed date">
            <input
              type="date"
              value={completedDate}
              onChange={(e) => setCompletedDate(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Expiry date">
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="input"
            />
          </Field>
        </div>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Training['status'])}
            className="input"
          >
            {TRAINING_STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        {/* TODO: needs `hours`, `trainingType` and `notes` fields on TrainingInput / staff_training schema to match the reference modal. */}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AppraisalModal({
  open,
  editing,
  onClose,
}: {
  open: boolean;
  editing: Appraisal | null;
  onClose: () => void;
}) {
  const { data: staff } = useStaff();
  const createAppraisal = useCreateAppraisal();
  const updateAppraisal = useUpdateAppraisal(editing?.id ?? 0);

  const [staffId, setStaffId] = useState<number | ''>('');
  const [date, setDate] = useState('');
  const [appraiser, setAppraiser] = useState('');
  const [strengths, setStrengths] = useState('');
  const [areasForDev, setAreasForDev] = useState('');
  const [targets, setTargets] = useState('');
  const [nextReview, setNextReview] = useState('');

  const [seedKey, setSeedKey] = useState('');
  const key = `${open}-${editing?.id ?? 'new'}`;
  if (key !== seedKey) {
    setSeedKey(key);
    setStaffId(editing?.staff_id ?? '');
    setDate(editing?.date ?? '');
    setAppraiser(editing?.appraiser ?? '');
    setStrengths(editing?.strengths ?? '');
    setAreasForDev(editing?.areas_for_dev ?? '');
    setTargets(editing?.targets ?? '');
    setNextReview(editing?.next_review ?? '');
  }

  const submitting = editing ? updateAppraisal.isPending : createAppraisal.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const staffName = staffId !== '' ? staff?.find((s) => s.id === staffId)?.name : undefined;
    const data: AppraisalInput = {
      staffId: staffId === '' ? undefined : staffId,
      staffName,
      date: date || undefined,
      appraiser: appraiser || undefined,
      strengths: strengths || undefined,
      areasForDev: areasForDev || undefined,
      targets: targets || undefined,
      nextReview: nextReview || undefined,
    };
    if (editing) updateAppraisal.mutate(data, { onSuccess: onClose });
    else createAppraisal.mutate(data, { onSuccess: onClose });
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit appraisal' : 'Add appraisal'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Staff">
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value ? Number(e.target.value) : '')}
            className="input"
          >
            <option value="">No staff member</option>
            {(staff ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Next review">
            <input
              type="date"
              value={nextReview}
              onChange={(e) => setNextReview(e.target.value)}
              className="input"
            />
          </Field>
        </div>
        <Field label="Appraiser">
          <input
            value={appraiser}
            onChange={(e) => setAppraiser(e.target.value)}
            className="input"
          />
        </Field>
        {/* TODO: needs `period` and `overallRating` fields on AppraisalInput / staff_appraisals schema to match the reference modal. */}
        <Field label="Strengths">
          <textarea
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            className="input"
            rows={2}
          />
        </Field>
        <Field label="Areas for development">
          <textarea
            value={areasForDev}
            onChange={(e) => setAreasForDev(e.target.value)}
            className="input"
            rows={2}
          />
        </Field>
        <Field label="Targets">
          <textarea
            value={targets}
            onChange={(e) => setTargets(e.target.value)}
            className="input"
            rows={2}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
