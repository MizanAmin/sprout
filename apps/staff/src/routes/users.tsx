import { useState } from 'react';
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

const ROLE_VARIANT: Record<User['role'], 'success' | 'info' | 'muted'> = {
  manager: 'success',
  staff: 'info',
  parent: 'muted',
};

function UsersPage() {
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Staff Accounts</h1>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          Add account
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !users?.length ? (
        <EmptyState title="No accounts" description="Add a staff or parent account to get started." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{u.name}</td>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">
                    <Badge variant={ROLE_VARIANT[u.role]}>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-2">{u.created_at?.slice(0, 10) ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-sm text-primary" onClick={() => setEditing(u)}>
                      Edit
                    </button>
                    <button
                      className="ml-3 text-sm text-danger"
                      onClick={() => {
                        if (confirm(`Delete ${u.name}?`)) deleteUser.mutate(u.id);
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

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add account">
        <AddUserForm
          submitting={createUser.isPending}
          onSubmit={(d) => createUser.mutate(d, { onSuccess: () => setAddOpen(false) })}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : 'Edit'}>
        {editing && <EditUserForm user={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function AddUserForm({
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
      <Field label="Name" error={errors.name?.message}>
        <input {...register('name')} className="input" />
      </Field>
      <Field label="Email" error={errors.email?.message}>
        <input {...register('email')} className="input" />
      </Field>
      <Field label="Role" error={errors.role?.message}>
        <select {...register('role')} className="input">
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
          <option value="parent">Parent</option>
        </select>
      </Field>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add account'}
        </button>
      </div>
    </form>
  );
}

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
      <Field label="Name" error={errors.name?.message}>
        <input {...register('name')} className="input" />
      </Field>
      <Field label="Role" error={errors.role?.message}>
        <select {...register('role')} className="input">
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
          <option value="parent">Parent</option>
        </select>
      </Field>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
