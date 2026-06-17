import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Field } from '../../components/ui';
import {
  waitingListCreateSchema,
  type WaitingListCreateInput,
  type WaitingListEntry,
} from './useWaitingList';

// Map an API waiting list row (snake_case) to form defaults (camelCase schema keys).
function toFormValues(e?: WaitingListEntry): Partial<WaitingListCreateInput> {
  if (!e) return { status: 'waiting' };
  return {
    childName: e.child_name,
    parentName: e.parent_name || undefined,
    email: e.email || undefined,
    phone: e.phone || undefined,
    dob: e.dob ?? undefined,
    desiredStart: e.desired_start ?? undefined,
    room: e.room || undefined,
    daysRequired: e.days_required || undefined,
    notes: e.notes || undefined,
    position: e.position,
    status: e.status,
  };
}

export function WaitingListForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: WaitingListEntry;
  onSubmit: (data: WaitingListCreateInput) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WaitingListCreateInput>({
    resolver: zodResolver(waitingListCreateSchema),
    defaultValues: toFormValues(initial),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Child name" error={errors.childName?.message}>
        <input {...register('childName')} className="input" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Parent name" error={errors.parentName?.message}>
          <input {...register('parentName')} className="input" />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input {...register('email')} className="input" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone" error={errors.phone?.message}>
          <input {...register('phone')} className="input" />
        </Field>
        <Field label="Date of birth" error={errors.dob?.message}>
          <input type="date" {...register('dob')} className="input" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Room" error={errors.room?.message}>
          <input {...register('room')} className="input" />
        </Field>
        <Field label="Desired start" error={errors.desiredStart?.message}>
          <input type="date" {...register('desiredStart')} className="input" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Days required" error={errors.daysRequired?.message}>
          <input {...register('daysRequired')} placeholder="Mon, Tue, Wed" className="input" />
        </Field>
        <Field label="Position" error={errors.position?.message}>
          <input type="number" {...register('position')} className="input" />
        </Field>
      </div>
      <Field label="Status" error={errors.status?.message}>
        <select {...register('status')} className="input">
          <option value="waiting">Waiting</option>
          <option value="offered">Offered</option>
          <option value="enrolled">Enrolled</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
      </Field>
      <Field label="Notes" error={errors.notes?.message}>
        <textarea {...register('notes')} className="input" rows={2} />
      </Field>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
