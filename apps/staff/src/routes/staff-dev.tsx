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
  useQualifications,
  useCreateQualification,
  useUpdateQualification,
  useDeleteQualification,
  useWellbeing,
  useCreateWellbeing,
  useUpdateWellbeing,
  useDeleteWellbeing,
  type Training,
  type TrainingInput,
  type Appraisal,
  type AppraisalInput,
  type Qualification,
  type QualificationInput,
  type Wellbeing,
  type WellbeingInput,
} from '../features/staff-dev/useStaffDev';
import { useStaff } from '../features/staff/useStaff';
import { Modal, Field, Spinner, EmptyState, Badge, StatCard } from '../components/ui';
import { UpgradeNotice, isPlanError } from '../components/UpgradeNotice';
import { fmtDate } from '../lib/date';

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

// Overall appraisal rating → badge variant. Falls back to muted for any
// free-text value that isn't a recognised rating.
const RATING_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
  outstanding: 'success',
  exceeds: 'success',
  'exceeds expectations': 'success',
  good: 'success',
  meets: 'info',
  'meets expectations': 'info',
  satisfactory: 'info',
  'needs improvement': 'warning',
  'requires improvement': 'warning',
  developing: 'warning',
  unsatisfactory: 'danger',
  'below expectations': 'danger',
};

function ratingVariant(rating: string): 'success' | 'warning' | 'danger' | 'info' | 'muted' {
  return RATING_VARIANT[rating.trim().toLowerCase()] ?? 'info';
}

function StaffDevPage() {
  const { data: training, isLoading: trainingLoading, error: trainingError } = useTraining();
  const { data: appraisals, isLoading: appraisalsLoading, error: appraisalsError } = useAppraisals();
  const {
    data: qualifications,
    isLoading: qualificationsLoading,
    error: qualificationsError,
  } = useQualifications();
  const { data: wellbeing, isLoading: wellbeingLoading, error: wellbeingError } = useWellbeing();

  const deleteTraining = useDeleteTraining();
  const deleteAppraisal = useDeleteAppraisal();
  const deleteQualification = useDeleteQualification();
  const deleteWellbeing = useDeleteWellbeing();

  const [trainingModal, setTrainingModal] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [appraisalModal, setAppraisalModal] = useState(false);
  const [editingAppraisal, setEditingAppraisal] = useState<Appraisal | null>(null);
  const [qualificationModal, setQualificationModal] = useState(false);
  const [editingQualification, setEditingQualification] = useState<Qualification | null>(null);
  const [wellbeingModal, setWellbeingModal] = useState(false);
  const [editingWellbeing, setEditingWellbeing] = useState<Wellbeing | null>(null);

  // After all hooks (rules of hooks) — show the upgrade notice on plan errors.
  if (
    isPlanError(trainingError) ||
    isPlanError(appraisalsError) ||
    isPlanError(qualificationsError) ||
    isPlanError(wellbeingError)
  ) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold text-gray-900">Staff Development</h1>
        <UpgradeNotice feature="Staff Development" />
      </div>
    );
  }

  const trainingList = training ?? [];
  const appraisalList = appraisals ?? [];
  const qualificationList = qualifications ?? [];
  const wellbeingList = wellbeing ?? [];

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
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Provider</th>
                  <th className="px-4 py-2 font-medium">Hours</th>
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
                      <td className="px-4 py-2 text-muted">{t.training_type || '—'}</td>
                      <td className="px-4 py-2 text-muted">{t.provider || '—'}</td>
                      <td className="px-4 py-2 text-muted">{t.hours ?? '—'}</td>
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
                    <p className="text-sm text-muted">
                      {fmtDate(a.date)}
                      {a.period ? ` · ${a.period}` : ''}
                    </p>
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

                {a.overall_rating && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted">
                      Overall rating
                    </span>
                    <Badge variant={ratingVariant(a.overall_rating)}>{a.overall_rating}</Badge>
                  </div>
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

      {/* Qualifications */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Qualifications</h2>
          <button
            className="btn-primary"
            onClick={() => {
              setEditingQualification(null);
              setQualificationModal(true);
            }}
          >
            Add qualification
          </button>
        </div>

        {qualificationsLoading ? (
          <Spinner />
        ) : qualificationList.length === 0 ? (
          <EmptyState
            title="No qualifications"
            description="Record a staff qualification to get started."
          />
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Staff</th>
                  <th className="px-4 py-2 font-medium">Qualification</th>
                  <th className="px-4 py-2 font-medium">Level</th>
                  <th className="px-4 py-2 font-medium">Awarding body</th>
                  <th className="px-4 py-2 font-medium">Achieved</th>
                  <th className="px-4 py-2 font-medium">Expiry</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {qualificationList.map((q) => {
                  const status = expiryStatus(q.expiry_date);
                  return (
                    <tr key={q.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 text-gray-900">{q.staff_name || '—'}</td>
                      <td className="px-4 py-2 text-gray-900">{q.qualification}</td>
                      <td className="px-4 py-2 text-muted">{q.level || '—'}</td>
                      <td className="px-4 py-2 text-muted">{q.awarding_body || '—'}</td>
                      <td className="px-4 py-2 text-muted">{fmtDate(q.date_achieved)}</td>
                      <td className="px-4 py-2">
                        {q.expiry_date ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted">{fmtDate(q.expiry_date)}</span>
                            <Badge variant={EXPIRY_VARIANT[status]}>{EXPIRY_LABEL[status]}</Badge>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            className="btn-outline btn-sm"
                            onClick={() => {
                              setEditingQualification(q);
                              setQualificationModal(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-outline btn-sm text-danger"
                            onClick={() => {
                              if (confirm('Delete this qualification?'))
                                deleteQualification.mutate(q.id);
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

      {/* Wellbeing check-ins */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Wellbeing check-ins</h2>
          <button
            className="btn-primary"
            onClick={() => {
              setEditingWellbeing(null);
              setWellbeingModal(true);
            }}
          >
            Add check-in
          </button>
        </div>

        {wellbeingLoading ? (
          <Spinner />
        ) : wellbeingList.length === 0 ? (
          <EmptyState
            title="No wellbeing check-ins"
            description="Log a wellbeing check-in to get started."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {wellbeingList.map((w) => (
              <div key={w.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{w.staff_name || '—'}</h3>
                    <p className="text-sm text-muted">{fmtDate(w.date)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn-outline btn-sm"
                      onClick={() => {
                        setEditingWellbeing(w);
                        setWellbeingModal(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-outline btn-sm text-danger"
                      onClick={() => {
                        if (confirm('Delete this check-in?')) deleteWellbeing.mutate(w.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Mood</p>
                    <p className="text-lg font-semibold text-gray-900">{w.mood}/5</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      Workload
                    </p>
                    <p className="text-lg font-semibold text-gray-900">{w.workload}/5</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Support</p>
                    <p className="text-lg font-semibold text-gray-900">{w.support}/5</p>
                  </div>
                </div>

                {w.notes && <p className="text-sm text-gray-700">{w.notes}</p>}
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
      <QualificationModal
        open={qualificationModal}
        editing={editingQualification}
        onClose={() => setQualificationModal(false)}
      />
      <WellbeingModal
        open={wellbeingModal}
        editing={editingWellbeing}
        onClose={() => setWellbeingModal(false)}
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
  const [trainingType, setTrainingType] = useState('');
  const [hours, setHours] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

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
    setTrainingType(editing?.training_type ?? '');
    setHours(editing?.hours ?? '');
    setNotes(editing?.notes ?? '');
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
      trainingType: trainingType || undefined,
      hours: hours === '' ? undefined : hours,
      notes: notes || undefined,
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
        <div className="grid grid-cols-2 gap-4">
          <Field label="Training type">
            <input
              value={trainingType}
              onChange={(e) => setTrainingType(e.target.value)}
              className="input"
              placeholder="e.g. Mandatory, CPD"
            />
          </Field>
          <Field label="Hours">
            <input
              type="number"
              step="0.5"
              min="0"
              value={hours}
              onChange={(e) => setHours(e.target.value === '' ? '' : Number(e.target.value))}
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
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
  const [period, setPeriod] = useState('');
  const [overallRating, setOverallRating] = useState('');

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
    setPeriod(editing?.period ?? '');
    setOverallRating(editing?.overall_rating ?? '');
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
      period: period || undefined,
      overallRating: overallRating || undefined,
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
        <div className="grid grid-cols-2 gap-4">
          <Field label="Period">
            <input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="input"
              placeholder="e.g. 2025 H1"
            />
          </Field>
          <Field label="Overall rating">
            <input
              value={overallRating}
              onChange={(e) => setOverallRating(e.target.value)}
              className="input"
              placeholder="e.g. Meets expectations"
            />
          </Field>
        </div>
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

function QualificationModal({
  open,
  editing,
  onClose,
}: {
  open: boolean;
  editing: Qualification | null;
  onClose: () => void;
}) {
  const { data: staff } = useStaff();
  const createQualification = useCreateQualification();
  const updateQualification = useUpdateQualification(editing?.id ?? 0);

  const [staffId, setStaffId] = useState<number | ''>('');
  const [qualification, setQualification] = useState('');
  const [awardingBody, setAwardingBody] = useState('');
  const [dateAchieved, setDateAchieved] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [level, setLevel] = useState('');
  const [certificateUrl, setCertificateUrl] = useState('');

  const [seedKey, setSeedKey] = useState('');
  const key = `${open}-${editing?.id ?? 'new'}`;
  if (key !== seedKey) {
    setSeedKey(key);
    setStaffId(editing?.staff_id ?? '');
    setQualification(editing?.qualification ?? '');
    setAwardingBody(editing?.awarding_body ?? '');
    setDateAchieved(editing?.date_achieved ?? '');
    setExpiryDate(editing?.expiry_date ?? '');
    setLevel(editing?.level ?? '');
    setCertificateUrl(editing?.certificate_url ?? '');
  }

  const submitting = editing ? updateQualification.isPending : createQualification.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const staffName = staffId !== '' ? staff?.find((s) => s.id === staffId)?.name : undefined;
    const data: QualificationInput = {
      staffId: staffId === '' ? undefined : staffId,
      staffName,
      qualification,
      awardingBody: awardingBody || undefined,
      dateAchieved: dateAchieved || undefined,
      expiryDate: expiryDate || undefined,
      level: level || undefined,
      certificateUrl: certificateUrl || undefined,
    };
    if (editing) updateQualification.mutate(data, { onSuccess: onClose });
    else createQualification.mutate(data, { onSuccess: onClose });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit qualification' : 'Add qualification'}
    >
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
        <Field label="Qualification">
          <input
            value={qualification}
            onChange={(e) => setQualification(e.target.value)}
            className="input"
            placeholder="e.g. Paediatric First Aid"
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Level">
            <input
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="input"
              placeholder="e.g. Level 3"
            />
          </Field>
          <Field label="Awarding body">
            <input
              value={awardingBody}
              onChange={(e) => setAwardingBody(e.target.value)}
              className="input"
              placeholder="e.g. NCFE CACHE"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date achieved">
            <input
              type="date"
              value={dateAchieved}
              onChange={(e) => setDateAchieved(e.target.value)}
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
        <Field label="Certificate URL">
          <input
            value={certificateUrl}
            onChange={(e) => setCertificateUrl(e.target.value)}
            className="input"
            placeholder="https://…"
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

const WELLBEING_SCALE = [1, 2, 3, 4, 5];

function WellbeingModal({
  open,
  editing,
  onClose,
}: {
  open: boolean;
  editing: Wellbeing | null;
  onClose: () => void;
}) {
  const { data: staff } = useStaff();
  const createWellbeing = useCreateWellbeing();
  const updateWellbeing = useUpdateWellbeing(editing?.id ?? 0);

  const [staffId, setStaffId] = useState<number | ''>('');
  const [date, setDate] = useState('');
  const [mood, setMood] = useState(3);
  const [workload, setWorkload] = useState(3);
  const [support, setSupport] = useState(3);
  const [notes, setNotes] = useState('');

  const [seedKey, setSeedKey] = useState('');
  const key = `${open}-${editing?.id ?? 'new'}`;
  if (key !== seedKey) {
    setSeedKey(key);
    setStaffId(editing?.staff_id ?? '');
    setDate(editing?.date ?? '');
    setMood(editing?.mood ?? 3);
    setWorkload(editing?.workload ?? 3);
    setSupport(editing?.support ?? 3);
    setNotes(editing?.notes ?? '');
  }

  const submitting = editing ? updateWellbeing.isPending : createWellbeing.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const staffName = staffId !== '' ? staff?.find((s) => s.id === staffId)?.name : undefined;
    const data: WellbeingInput = {
      staffId: staffId === '' ? undefined : staffId,
      staffName,
      date: date || undefined,
      mood,
      workload,
      support,
      notes: notes || undefined,
    };
    if (editing) updateWellbeing.mutate(data, { onSuccess: onClose });
    else createWellbeing.mutate(data, { onSuccess: onClose });
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit check-in' : 'Add check-in'}>
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
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Mood (1–5)">
            <select
              value={mood}
              onChange={(e) => setMood(Number(e.target.value))}
              className="input"
            >
              {WELLBEING_SCALE.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Workload (1–5)">
            <select
              value={workload}
              onChange={(e) => setWorkload(Number(e.target.value))}
              className="input"
            >
              {WELLBEING_SCALE.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Support (1–5)">
            <select
              value={support}
              onChange={(e) => setSupport(Number(e.target.value))}
              className="input"
            >
              {WELLBEING_SCALE.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input"
            rows={3}
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
