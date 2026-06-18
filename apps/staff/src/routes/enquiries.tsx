import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useEnquiries,
  useCreateEnquiry,
  useUpdateEnquiry,
  useDeleteEnquiry,
  type Enquiry,
  type EnquiryCreateInput,
  type EnquiryPriority,
  type EnquiryStatus,
} from '../features/enquiries/useEnquiries';
import { EnquiryForm } from '../features/enquiries/EnquiryForm';
import { useAddFromEnquiry } from '../features/waiting-list/useWaitingList';
import { Modal, Badge, Spinner, EmptyState, StatCard } from '../components/ui';
import { fmtDate } from '../lib/date';

export const Route = createFileRoute('/enquiries')({
  component: EnquiriesPage,
});

// Admissions pipeline stages, in order. Mirrors ENQ_STAGES in the reference app
// (labels adapted to the API enum: Toured/Offered vs Tour Booked/Offer Made).
const STAGES: EnquiryStatus[] = ['New', 'Contacted', 'Toured', 'Offered', 'Enrolled', 'Declined'];

// Stage accent colours, mirroring ENQ_STATUS_COLORS in the reference app.
const STAGE_COLOR: Record<EnquiryStatus, string> = {
  New: '#4f8ef7',
  Contacted: '#ff9f43',
  Toured: '#7367f0',
  Offered: '#a259ff',
  Enrolled: '#28c76f',
  Declined: '#82868b',
};

const PRIORITY_VARIANT: Record<EnquiryPriority, 'muted' | 'info' | 'warning' | 'danger'> = {
  Low: 'muted',
  Normal: 'info',
  High: 'warning',
  Urgent: 'danger',
};

const STATUS_VARIANT: Record<EnquiryStatus, 'info' | 'warning' | 'success' | 'muted'> = {
  New: 'info',
  Contacted: 'info',
  Toured: 'warning',
  Offered: 'warning',
  Enrolled: 'success',
  Declined: 'muted',
};

const CLOSED: EnquiryStatus[] = ['Enrolled', 'Declined'];


function EnquiriesPage() {
  const [view, setView] = useState<'board' | 'table'>('board');
  const [tableStatus, setTableStatus] = useState('');
  const [editing, setEditing] = useState<Enquiry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch the full pipeline; filtering for the table view is done client-side so
  // the board always reflects every stage.
  const { data: enquiries, isLoading } = useEnquiries();
  const createEnquiry = useCreateEnquiry();

  const list = enquiries ?? [];
  const stats = useMemo(() => {
    const enrolled = list.filter((e) => e.status === 'Enrolled').length;
    const declined = list.filter((e) => e.status === 'Declined').length;
    const active = list.filter((e) => !CLOSED.includes(e.status)).length;
    return { total: list.length, active, enrolled, declined };
  }, [list]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (e: Enquiry) => {
    setEditing(e);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Enquiries</h1>
        <div className="flex gap-2">
          <button
            className="btn-outline btn-sm"
            onClick={() => setView((v) => (v === 'board' ? 'table' : 'board'))}
          >
            {view === 'board' ? 'Table view' : 'Pipeline view'}
          </button>
          <button className="btn-primary" onClick={openAdd}>
            New enquiry
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total enquiries" value={stats.total} />
        <StatCard label="In pipeline" value={stats.active} />
        <StatCard label="Enrolled" value={stats.enrolled} />
        <StatCard label="Declined" value={stats.declined} />
      </div>

      {isLoading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState
          title="No enquiries yet"
          description="Add an enquiry to start tracking it through the admissions pipeline."
        />
      ) : view === 'board' ? (
        <PipelineBoard enquiries={list} onEdit={openEdit} />
      ) : (
        <EnquiryTable
          enquiries={list}
          status={tableStatus}
          onStatusChange={setTableStatus}
          onEdit={openEdit}
        />
      )}

      <EnquiryModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createEnquiry.isPending}
        onCreate={(data) => createEnquiry.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

// Kanban-style pipeline grouped by status, mirroring the reference board.
function PipelineBoard({
  enquiries,
  onEdit,
}: {
  enquiries: Enquiry[];
  onEdit: (e: Enquiry) => void;
}) {
  const byStage = useMemo(() => {
    const map = new Map<EnquiryStatus, Enquiry[]>();
    for (const s of STAGES) map.set(s, []);
    for (const e of enquiries) map.get(e.status)?.push(e);
    return map;
  }, [enquiries]);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-[900px] gap-3">
        {STAGES.map((stage) => {
          const cards = byStage.get(stage) ?? [];
          const color = STAGE_COLOR[stage];
          return (
            <div key={stage} className="flex-1 min-w-[150px]">
              <div
                className="rounded-t-lg px-3 py-2"
                style={{ backgroundColor: `${color}22`, borderBottom: `3px solid ${color}` }}
              >
                <div className="text-xs font-bold" style={{ color }}>
                  {stage}
                </div>
                <div className="text-[11px] text-muted">
                  {cards.length} {cards.length === 1 ? 'child' : 'children'}
                </div>
              </div>
              <div className="flex min-h-[120px] flex-col gap-2 rounded-b-lg bg-bg p-2">
                {cards.map((e) => (
                  <PipelineCard key={e.id} enquiry={e} color={color} onEdit={() => onEdit(e)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PipelineCard({
  enquiry: e,
  color,
  onEdit,
}: {
  enquiry: Enquiry;
  color: string;
  onEdit: () => void;
}) {
  const updateEnquiry = useUpdateEnquiry(e.id);
  const deleteEnquiry = useDeleteEnquiry();
  const addToWaitlist = useAddFromEnquiry();

  const idx = STAGES.indexOf(e.status);
  const next = idx >= 0 && idx < STAGES.indexOf('Enrolled') ? STAGES[idx + 1] : undefined;
  const isClosed = CLOSED.includes(e.status);

  const advance = (status: EnquiryStatus) => updateEnquiry.mutate({ status });

  return (
    <div
      className="rounded-lg bg-surface p-3 shadow-sm"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="text-xs font-bold text-gray-900">{e.child_name}</div>
      {e.parent_name && <div className="text-[10px] text-muted">{e.parent_name}</div>}
      {e.room && (
        <span className="badge badge-info mt-1 text-[9px]">{e.room}</span>
      )}
      {e.start_date && (
        <div className="mt-1 text-[10px] text-muted">Start {fmtDate(e.start_date)}</div>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        {next && !isClosed && (
          <button
            className="btn-outline btn-sm text-[9px]"
            style={{ color }}
            onClick={() => advance(next)}
            disabled={updateEnquiry.isPending}
          >
            → {next}
          </button>
        )}
        {e.status === 'Offered' && (
          <button
            className="btn-outline btn-sm text-[9px] text-success"
            onClick={() => advance('Enrolled')}
            disabled={updateEnquiry.isPending}
          >
            Enrol
          </button>
        )}
        <button className="btn-outline btn-sm text-[9px]" onClick={onEdit}>
          Edit
        </button>
        {!isClosed && (
          <button
            className="btn-outline btn-sm text-[9px] text-danger"
            onClick={() => advance('Declined')}
            disabled={updateEnquiry.isPending}
          >
            Decline
          </button>
        )}
        {!isClosed && (
          <button
            className="btn-outline btn-sm text-[9px]"
            onClick={() => {
              if (confirm(`Add ${e.child_name} to the waiting list?`))
                addToWaitlist.mutate(e.id);
            }}
            disabled={addToWaitlist.isPending}
          >
            → Waitlist
          </button>
        )}
      </div>
      {isClosed && (
        <button
          className="mt-2 text-[10px] text-danger"
          onClick={() => {
            if (confirm(`Delete enquiry for ${e.child_name}?`)) deleteEnquiry.mutate(e.id);
          }}
        >
          Delete
        </button>
      )}
    </div>
  );
}

function EnquiryTable({
  enquiries,
  status,
  onStatusChange,
  onEdit,
}: {
  enquiries: Enquiry[];
  status: string;
  onStatusChange: (s: string) => void;
  onEdit: (e: Enquiry) => void;
}) {
  const deleteEnquiry = useDeleteEnquiry();
  const rows = status ? enquiries.filter((e) => e.status === status) : enquiries;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <select
          className="input max-w-[12rem]"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          <option value="">All statuses</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No enquiries" description="Adjust your filters to see more." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Child</th>
                <th className="px-4 py-2 font-medium">Parent</th>
                <th className="px-4 py-2 font-medium">Contact</th>
                <th className="px-4 py-2 font-medium">Room</th>
                <th className="px-4 py-2 font-medium">Start</th>
                <th className="px-4 py-2 font-medium">Priority</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-900">{e.child_name}</div>
                    {e.dob && <div className="text-xs text-muted">{fmtDate(e.dob)}</div>}
                  </td>
                  <td className="px-4 py-2">{e.parent_name || '—'}</td>
                  <td className="px-4 py-2">
                    <div className="text-xs">
                      {e.phone || '—'}
                      {e.email && (
                        <>
                          <br />
                          {e.email}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">{e.room || '—'}</td>
                  <td className="px-4 py-2">{fmtDate(e.start_date)}</td>
                  <td className="px-4 py-2">
                    <Badge variant={PRIORITY_VARIANT[e.priority]}>{e.priority}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={STATUS_VARIANT[e.status]}>{e.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-muted">{e.source || '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-sm text-primary" onClick={() => onEdit(e)}>
                      Edit
                    </button>
                    <button
                      className="ml-3 text-sm text-danger"
                      onClick={() => {
                        if (confirm(`Delete enquiry for ${e.child_name}?`))
                          deleteEnquiry.mutate(e.id);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Add/edit modal. Edit uses a per-enquiry update mutation hook.
function EnquiryModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: Enquiry | null;
  onClose: () => void;
  onCreate: (data: EnquiryCreateInput) => void;
  createSubmitting: boolean;
}) {
  const updateEnquiry = useUpdateEnquiry(editing?.id ?? 0);
  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.child_name}` : 'New enquiry'}>
      <EnquiryForm
        initial={editing ?? undefined}
        submitting={editing ? updateEnquiry.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateEnquiry.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}
