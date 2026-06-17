import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  userCreateSchema,
  userUpdateSchema,
  type UserCreateInput,
  type UserUpdateInput,
} from '@sprout/schemas';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  type User,
} from '../features/users/useUsers';
import { Field, Modal, Badge, Spinner, EmptyState } from '../components/ui';

export const Route = createFileRoute('/users')({
  component: UsersPage,
});

// ── Role presentation (mirrors reference `roleBadge`) ───────────────────
const ROLE_META: Record<
  User['role'],
  { label: string; variant: 'success' | 'info' | 'muted' }
> = {
  manager: { label: '👑 Manager', variant: 'success' },
  staff: { label: '👤 Staff', variant: 'info' },
  parent: { label: '👨‍👩‍👧 Parent', variant: 'muted' },
};

// ── Avatar helpers (mirrors children/index.tsx `avatarGradient` / `initials`) ──
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#4f46e5,#818cf8)',
  'linear-gradient(135deg,#059669,#34d399)',
  'linear-gradient(135deg,#d97706,#fbbf24)',
  'linear-gradient(135deg,#dc2626,#f87171)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)',
  'linear-gradient(135deg,#0891b2,#22d3ee)',
  'linear-gradient(135deg,#ea580c,#fb923c)',
  'linear-gradient(135deg,#db2777,#f472b6)',
];

function avatarGradient(name: string): string {
  const a = name.charCodeAt(0) || 0;
  const b = name.charCodeAt(1) || 0;
  return AVATAR_GRADIENTS[(a + b) % AVATAR_GRADIENTS.length];
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function UserAvatar({ name }: { name: string }) {
  return (
    <div
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl text-xs font-bold text-white"
      style={{ backgroundImage: avatarGradient(name) }}
    >
      {initials(name)}
    </div>
  );
}

function UsersPage() {
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  // Reference splits the page into staff/manager logins and parent logins.
  const staff = useMemo(() => (users ?? []).filter((u) => u.role !== 'parent'), [users]);
  const parents = useMemo(() => (users ?? []).filter((u) => u.role === 'parent'), [users]);

  const onDelete = (u: User) => {
    if (confirm(`Delete the account for ${u.name}? This cannot be undone.`)) {
      deleteUser.mutate(u.id);
    }
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Staff Accounts</h1>
        <button className="btn-primary" onClick={() => setInviteOpen(true)}>
          + Add account
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !users?.length ? (
        <EmptyState
          title="No accounts yet"
          description="Invite a team member so they can log in and access the app."
        />
      ) : (
        <div className="space-y-6">
          <AccountsCard
            title="Staff & Manager Accounts"
            blurb="Managers have full access. Staff can access daily operations but not finance, settings or reports."
            users={staff}
            emptyTitle="No staff accounts yet"
            emptyDescription="Invite team members so they can access the app."
            onEdit={setEditing}
            onDelete={onDelete}
          />
          <AccountsCard
            title="Parent Accounts"
            blurb="Parents can log in to view their child's daily logs, learning journal, invoices and send messages."
            users={parents}
            emptyTitle="No parent accounts yet"
            emptyDescription="Parent logins are provisioned separately and linked to a child."
            onEdit={setEditing}
            onDelete={onDelete}
          />
        </div>
      )}

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite account">
        <InviteUserForm
          submitting={createUser.isPending}
          onSubmit={(d) => createUser.mutate(d, { onSuccess: () => setInviteOpen(false) })}
        />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.name}` : 'Edit account'}
      >
        {editing && <EditUserForm user={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

// ── Reusable card with the accounts table ───────────────────────────────
function AccountsCard({
  title,
  blurb,
  users,
  emptyTitle,
  emptyDescription,
  onEdit,
  onDelete,
}: {
  title: string;
  blurb: string;
  users: User[];
  emptyTitle: string;
  emptyDescription: string;
  onEdit: (u: User) => void;
  onDelete: (u: User) => void;
}) {
  return (
    <div className="card space-y-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-muted">{blurb}</p>
      </div>

      {users.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={u.name} />
                      <span className="font-semibold text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-muted">{u.email}</td>
                  <td className="px-4 py-2">
                    <Badge variant={ROLE_META[u.role].variant}>{ROLE_META[u.role].label}</Badge>
                  </td>
                  <td className="px-4 py-2 text-muted">{u.created_at?.slice(0, 10) ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    {/* TODO: hide edit/delete for the current user — needs a
                        current-user/session hook (e.g. GET /auth/me) so we can
                        compare against u.id; the server already blocks self-delete. */}
                    <button className="btn-outline btn-sm" onClick={() => onEdit(u)}>
                      ✏️ Edit
                    </button>
                    <button
                      className="btn-outline btn-sm ml-2 text-danger"
                      onClick={() => onDelete(u)}
                    >
                      🗑️ Delete
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

// ── Invite (create) form — name, email, role ────────────────────────────
function InviteUserForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (d: UserCreateInput) => void;
  submitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserCreateInput>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { role: 'staff' },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p className="text-sm text-muted">
        An invite email is sent to the address below. The new member sets their own password from
        that email.
      </p>
      <Field label="Full name" error={errors.name?.message}>
        <input {...register('name')} className="input" autoFocus />
      </Field>
      <Field label="Email" error={errors.email?.message}>
        <input {...register('email')} type="email" className="input" />
      </Field>
      <Field label="Role" error={errors.role?.message}>
        <select {...register('role')} className="input">
          <option value="staff">👤 Staff — operational access</option>
          <option value="manager">👑 Manager — full access</option>
        </select>
        {/* TODO: parent invites — the reference also creates parent logins
            linked to a child, but userCreateSchema/POST /users only supports
            staff/manager invites (no child_id). Needs a parent-invite endpoint. */}
      </Field>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Sending invite…' : 'Send invite'}
        </button>
      </div>
    </form>
  );
}

// ── Edit form — name + role (matches userUpdateSchema) ──────────────────
function EditUserForm({ user, onDone }: { user: User; onDone: () => void }) {
  const update = useUpdateUser(user.id);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserUpdateInput>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: { name: user.name, role: user.role },
  });
  return (
    <form
      onSubmit={handleSubmit((d) => update.mutate(d, { onSuccess: onDone }))}
      className="space-y-4"
    >
      <Field label="Full name" error={errors.name?.message}>
        <input {...register('name')} className="input" autoFocus />
      </Field>
      <Field label="Email">
        {/* Email is the auth identity and is not editable via PATCH /users. */}
        <input value={user.email} className="input" disabled />
      </Field>
      <Field label="Role" error={errors.role?.message}>
        <select {...register('role')} className="input">
          <option value="staff">👤 Staff — operational access</option>
          <option value="manager">👑 Manager — full access</option>
          {user.role === 'parent' && <option value="parent">👨‍👩‍👧 Parent — portal access</option>}
        </select>
      </Field>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
