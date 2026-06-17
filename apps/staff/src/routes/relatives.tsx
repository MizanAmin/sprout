import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import type { RelativeCreateInput } from '@sprout/schemas';
import {
  useRelatives,
  useCreateRelative,
  useUpdateRelative,
  useDeleteRelative,
  type Relative,
} from '../features/relatives/useRelatives';
import { RelativeForm } from '../features/relatives/RelativeForm';
import { useChildren, type Child } from '../features/children/useChildren';
import { Modal, Badge, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/relatives')({
  component: RelativesPage,
});

interface Group {
  key: string;
  label: string;
  relatives: Relative[];
}

function RelativesPage() {
  const { data: relatives, isLoading } = useRelatives();
  const { data: children } = useChildren();
  const createRelative = useCreateRelative();
  const deleteRelative = useDeleteRelative();

  const [editing, setEditing] = useState<Relative | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const childName = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of children ?? []) map.set(c.id, c.name);
    return map;
  }, [children]);

  // Group relatives by their child; unassigned relatives go in their own group.
  const groups = useMemo<Group[]>(() => {
    const byChild = new Map<string, Relative[]>();
    for (const r of relatives ?? []) {
      const key = r.child_id == null ? 'unassigned' : String(r.child_id);
      const list = byChild.get(key) ?? [];
      list.push(r);
      byChild.set(key, list);
    }
    return Array.from(byChild.entries())
      .map(([key, list]) => ({
        key,
        label:
          key === 'unassigned' ? 'Unassigned' : childName.get(Number(key)) ?? `Child #${key}`,
        relatives: list,
      }))
      .sort((a, b) => {
        if (a.key === 'unassigned') return 1;
        if (b.key === 'unassigned') return -1;
        return a.label.localeCompare(b.label);
      });
  }, [relatives, childName]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (r: Relative) => {
    setEditing(r);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Relatives</h1>
        <button className="btn-primary" onClick={openAdd}>
          Add relative
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : groups.length === 0 ? (
        <EmptyState title="No relatives found" description="Add a relative to get started." />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.key} className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                {g.label}
              </h2>
              <div className="overflow-hidden rounded-xl border border-border bg-surface">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-muted">
                    <tr>
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Relation</th>
                      <th className="px-4 py-2 font-medium">Phone</th>
                      <th className="px-4 py-2 font-medium">Email</th>
                      <th className="px-4 py-2 font-medium">Flags</th>
                      <th className="px-4 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {g.relatives.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900">{r.name}</td>
                        <td className="px-4 py-2">{r.relation || '—'}</td>
                        <td className="px-4 py-2">{r.phone || '—'}</td>
                        <td className="px-4 py-2">{r.email || '—'}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {r.is_primary_contact && <Badge variant="info">Primary</Badge>}
                            {r.is_emergency_contact && <Badge variant="warning">Emergency</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button className="text-sm text-primary" onClick={() => openEdit(r)}>
                            Edit
                          </button>
                          <button
                            className="ml-3 text-sm text-danger"
                            onClick={() => {
                              if (confirm(`Delete ${r.name}?`)) deleteRelative.mutate(r.id);
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
            </div>
          ))}
        </div>
      )}

      <RelativeModal
        open={modalOpen}
        editing={editing}
        children={children ?? []}
        onClose={() => setModalOpen(false)}
        createSubmitting={createRelative.isPending}
        onCreate={(data) => createRelative.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

// Add/edit modal. Edit uses a per-relative update mutation hook.
function RelativeModal({
  open,
  editing,
  children,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: Relative | null;
  children: Child[];
  onClose: () => void;
  onCreate: (data: RelativeCreateInput) => void;
  createSubmitting: boolean;
}) {
  const updateRelative = useUpdateRelative(editing?.id ?? 0);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.name}` : 'Add relative'}
    >
      <RelativeForm
        initial={editing ?? undefined}
        children={children}
        submitting={editing ? updateRelative.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updateRelative.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}
