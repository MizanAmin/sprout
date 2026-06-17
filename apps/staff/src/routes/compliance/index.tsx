import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  usePolicies,
  useRiskAssessments,
  useTraining,
  useCreatePolicy,
  policyCreateSchema,
  isPast,
  type Policy,
  type RiskAssessment,
  type PolicyCreateInput,
} from '../../features/compliance/useCompliance';
import { Modal, Field, Spinner, EmptyState, Badge, StatCard } from '../../components/ui';
import { UpgradeNotice, isPlanError } from '../../components/UpgradeNotice';

export const Route = createFileRoute('/compliance/')({
  component: CompliancePage,
});

// ---------------------------------------------------------------------------
// Review-date status: overdue (past) -> danger, due soon (<= 30 days) ->
// warning, otherwise -> success. Records with no next_review are neutral.
// ---------------------------------------------------------------------------
type ReviewStatus = 'overdue' | 'due-soon' | 'ok' | 'none';

const DUE_SOON_DAYS = 30;

function reviewStatus(nextReview: string | null): ReviewStatus {
  if (!nextReview) return 'none';
  if (isPast(nextReview)) return 'overdue';
  const due = new Date(nextReview);
  const soon = new Date();
  soon.setDate(soon.getDate() + DUE_SOON_DAYS);
  return due <= soon ? 'due-soon' : 'ok';
}

const REVIEW_VARIANT: Record<ReviewStatus, 'danger' | 'warning' | 'success' | 'muted'> = {
  overdue: 'danger',
  'due-soon': 'warning',
  ok: 'success',
  none: 'muted',
};

const REVIEW_LABEL: Record<ReviewStatus, string> = {
  overdue: 'Overdue',
  'due-soon': 'Due soon',
  ok: 'On track',
  none: 'No date',
};

function fmtDate(d: string | null): string {
  if (!d) return 'Not set';
  return new Date(d).toLocaleDateString('en-GB');
}

function countOverdue(rows: { next_review: string | null }[]): number {
  return rows.filter((r) => reviewStatus(r.next_review) === 'overdue').length;
}

function CompliancePage() {
  const { data: policies, isLoading: policiesLoading, error: policiesError } = usePolicies();
  const { data: riskAssessments, isLoading: rasLoading, error: rasError } = useRiskAssessments();
  const { data: training, isLoading: trainingLoading } = useTraining();
  const [addPolicyOpen, setAddPolicyOpen] = useState(false);

  // After all hooks (rules of hooks) — show the upgrade notice on plan errors.
  if (isPlanError(policiesError) || isPlanError(rasError)) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold text-gray-900">Compliance Hub</h1>
        <UpgradeNotice feature="Compliance Hub" />
      </div>
    );
  }

  const isLoading = policiesLoading || rasLoading || trainingLoading;

  const polList = policies ?? [];
  const raList = riskAssessments ?? [];
  const trainList = training ?? [];

  const trainingExpired = trainList.filter((t) => t.status === 'expired').length;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Compliance Hub</h1>
        <button className="btn-primary" onClick={() => setAddPolicyOpen(true)}>
          + New Policy
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          {/* Overview stat cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="Policies" value={polList.length} />
            <StatCard
              label="Policies overdue"
              value={countOverdue(polList)}
              hint="Past review date"
            />
            <StatCard label="Risk assessments" value={raList.length} />
            <StatCard
              label="Risk assessments overdue"
              value={countOverdue(raList)}
              hint="Past review date"
            />
            <StatCard
              label="Training expired"
              value={trainingExpired}
              hint={`${trainList.length} record(s)`}
            />
          </div>

          {/* Two-panel lists */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PolicyPanel policies={polList} />
            <RiskAssessmentPanel riskAssessments={raList} />
          </div>

          {/* Sub-page links */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <HubLink to="/compliance/policies" label="Manage policies" count={polList.length} />
            <HubLink
              to="/compliance/risk-assessments"
              label="Manage risk assessments"
              count={raList.length}
            />
            <HubLink
              to="/compliance/training"
              label="Staff training"
              count={trainList.length}
            />
          </div>
        </>
      )}

      <AddPolicyModal open={addPolicyOpen} onClose={() => setAddPolicyOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Policy library panel
// ---------------------------------------------------------------------------
function PolicyPanel({ policies }: { policies: Policy[] }) {
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Policy library</h2>
        <Link to="/compliance/policies" className="text-sm text-primary">
          View all
        </Link>
      </div>
      {policies.length === 0 ? (
        <EmptyState title="No policies yet" description="Add a policy to get started." />
      ) : (
        <ul className="divide-y divide-border">
          {policies.map((p) => {
            const status = reviewStatus(p.next_review);
            return (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-gray-900">{p.title}</div>
                  <div className="text-xs text-muted">
                    v{p.version} · {p.category || 'General'} · Review: {fmtDate(p.next_review)}
                    {/* TODO: needs signoff counts — GET /compliance/policy-signoffs?policyId=
                        returns rows but the list endpoint has no aggregate count, and there is
                        no staff-total endpoint to compute "X/Y signed". */}
                  </div>
                </div>
                <Badge variant={REVIEW_VARIANT[status]}>{REVIEW_LABEL[status]}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk assessment panel
// ---------------------------------------------------------------------------
function RiskAssessmentPanel({ riskAssessments }: { riskAssessments: RiskAssessment[] }) {
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Risk assessments</h2>
        <Link to="/compliance/risk-assessments" className="text-sm text-primary">
          View all
        </Link>
      </div>
      {riskAssessments.length === 0 ? (
        <EmptyState title="No risk assessments yet" description="Add one to get started." />
      ) : (
        <ul className="divide-y divide-border">
          {riskAssessments.map((r) => {
            const status = reviewStatus(r.next_review);
            return (
              <li key={r.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-gray-900">{r.title}</div>
                  <div className="text-xs text-muted">
                    {r.location || '—'} · Review: {fmtDate(r.next_review)}
                    {/* TODO: needs item counts — GET /compliance/risk-assessment-items?riskAssessmentId=
                        returns items but the list endpoint exposes no completed/total aggregate. */}
                  </div>
                </div>
                <Badge variant={REVIEW_VARIANT[status]}>{REVIEW_LABEL[status]}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-page hub link
// ---------------------------------------------------------------------------
function HubLink({ to, label, count }: { to: string; label: string; count?: number }) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-border bg-surface p-4 hover:border-primary"
    >
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{count ?? '—'}</div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Add policy modal (mirrors openPolicyModal in the reference app)
// ---------------------------------------------------------------------------
function AddPolicyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createPolicy = useCreatePolicy();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PolicyCreateInput>({
    resolver: zodResolver(policyCreateSchema),
    defaultValues: { status: 'active', version: '1.0' },
  });

  const close = () => {
    reset({ status: 'active', version: '1.0' });
    onClose();
  };

  const onSubmit = (data: PolicyCreateInput) =>
    createPolicy.mutate(data, { onSuccess: close });

  return (
    <Modal open={open} onClose={close} title="New policy">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Title" error={errors.title?.message}>
          <input
            {...register('title')}
            className="input"
            placeholder="e.g. Safeguarding & Child Protection Policy"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category" error={errors.category?.message}>
            <select {...register('category')} className="input">
              {[
                'Safeguarding',
                'Health & Safety',
                'SEND',
                'Behaviour',
                'Staffing',
                'Finance',
                'General',
              ].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Version" error={errors.version?.message}>
            <input {...register('version')} className="input" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Status" error={errors.status?.message}>
            <select {...register('status')} className="input">
              <option value="active">active</option>
              <option value="draft">draft</option>
              <option value="archived">archived</option>
            </select>
          </Field>
          <Field label="Next review" error={errors.nextReview?.message}>
            <input type="date" {...register('nextReview')} className="input" />
          </Field>
        </div>
        <Field label="Policy content" error={errors.content?.message}>
          <textarea
            {...register('content')}
            className="input"
            rows={5}
            placeholder="Paste or type the full policy text…"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={createPolicy.isPending}>
            {createPolicy.isPending ? 'Saving…' : 'Save policy'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
