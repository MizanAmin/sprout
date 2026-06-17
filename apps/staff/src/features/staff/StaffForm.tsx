import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { staffCreateSchema, type StaffCreateInput } from '@sprout/schemas';
import { Field } from '../../components/ui';
import type { Staff } from './useStaff';

// Map an API staff row (snake_case) to form defaults (camelCase schema keys).
function toFormValues(s?: Staff): Partial<StaffCreateInput> {
  if (!s) return { status: 'Active' };
  return {
    name: s.name,
    role: s.role || undefined,
    room: s.room || undefined,
    qualification: s.qualification || undefined,
    phone: s.phone || undefined,
    startDate: s.start_date ?? undefined,
    status: s.status,
  };
}

export function StaffForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: Staff;
  onSubmit: (data: StaffCreateInput) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StaffCreateInput>({
    resolver: zodResolver(staffCreateSchema),
    defaultValues: toFormValues(initial),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Name" error={errors.name?.message}>
        <input {...register('name')} className="input" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Role" error={errors.role?.message}>
          <input {...register('role')} className="input" />
        </Field>
        <Field label="Room" error={errors.room?.message}>
          <input {...register('room')} className="input" />
        </Field>
      </div>
      <Field label="Qualification" error={errors.qualification?.message}>
        <input {...register('qualification')} className="input" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone" error={errors.phone?.message}>
          <input {...register('phone')} className="input" />
        </Field>
        <Field label="Start date" error={errors.startDate?.message}>
          <input type="date" {...register('startDate')} className="input" />
        </Field>
      </div>
      <Field label="Status" error={errors.status?.message}>
        <select {...register('status')} className="input">
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </Field>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
