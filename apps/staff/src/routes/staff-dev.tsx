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
import { Modal, Field, Spinner, EmptyState, Badge } from '../components/ui';

export const Route = createFileRoute('/staff-dev')({
  component: StaffDevPage,
});

const TRAINING_STATUS: Training['status'][] = ['planned', 'completed', 'expired'];

const STATUS_VARIANT: Record<Training['status'], 'success' | 'info' | 'danger'> = {
  planned: 'info',
  completed: 'success',
  expired: 'danger',
};

function StaffDevPage() {
  const { data: training, isLoading: trainingLoading } = useTraining();
  const { data: appraisals, isLoading: appraisalsLoading } = useAppraisals();
  const deleteTraining = useDeleteTraining();
  const deleteAppraisal = useDeleteAppraisal();

  const [trainingModal, setTrainingModal] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [appraisalModal, setAppraisalModal] = useState(false);
  const [editingAppraisal, setEditingAppraisal] = useState<Appraisal | null>(null);

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Staff Development</h1>

      {/* Training */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Training</h2>
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
        ) : (training ?? []).length === 0 ? (
          <EmptyState title="No training records" description="Add a training record to get started." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Staff</th>
                  <th className="px-4 py-2 font-medium">Course</th>
                  <th className="px-4 py-2 font-medium">Provider</th>
                  <th className="px-4 py-2 font-medium">Expiry</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {(training ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-gray-900">{t.staff_name || '—'}</td>
                    <td className="px-4 py-2 text-gray-900">{t.course_name}</td>
                    <td className="px-4 py-2 text-muted">{t.provider || '—'}</td>
                    <td className="px-4 py-2 text-muted">{t.expiry_date ?? '—'}</td>
                    <td className="px-4 py-2">
                      <Badge variant={STATUS_VARIANT[t.status]}>{t.status}</Badge>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="text-sm text-primary"
                          onClick={() => {
                            setEditingTraining(t);
                            setTrainingModal(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="text-sm text-danger"
                          onClick={() => {
                            if (confirm('Delete this training record?')) deleteTraining.mutate(t.id);
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
        ) : (appraisals ?? []).length === 0 ? (
          <EmptyState title="No appraisals" description="Add an appraisal to get started." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(appraisals ?? []).map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{a.staff_name || '—'}</h3>
                    <p className="text-sm text-muted">{a.date}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="text-sm text-primary"
                      onClick={() => {
                        setEditingAppraisal(a);
                        setAppraisalModal(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="text-sm text-danger"
                      onClick={() => {
                        if (confirm('Delete this appraisal?')) deleteAppraisal.mutate(a.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {a.appraiser && <p className="mt-2 text-sm text-muted">Appraiser: {a.appraiser}</p>}
                {a.next_review && (
                  <p className="mt-1 text-sm text-muted">Next review: {a.next_review}</p>
                )}
                {a.targets && <p className="mt-2 text-sm text-gray-700">{a.targets}</p>}
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
        <Field label="Course name">
          <input
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            className="input"
            required
          />
        </Field>
        <Field label="Provider">
          <input value={provider} onChange={(e) => setProvider(e.target.value)} className="input" />
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
        <div className="flex justify-end">
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
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
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
          <input value={appraiser} onChange={(e) => setAppraiser(e.target.value)} className="input" />
        </Field>
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
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
