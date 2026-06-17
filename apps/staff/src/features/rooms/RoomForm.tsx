import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { roomCreateSchema, type RoomCreateInput } from '@sprout/schemas';
import { Field } from '../../components/ui';
import type { Room } from './useRooms';

// Map an API room row (snake_case) to form defaults (camelCase schema keys).
function toFormValues(r?: Room): Partial<RoomCreateInput> {
  if (!r) return { capacity: 10, color: '#4f8ef7' };
  return {
    name: r.name,
    capacity: r.capacity,
    ageGroup: r.age_group || undefined,
    staffLead: r.staff_lead || undefined,
    color: r.color || '#4f8ef7',
  };
}

export function RoomForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: Room;
  onSubmit: (data: RoomCreateInput) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RoomCreateInput>({
    resolver: zodResolver(roomCreateSchema),
    defaultValues: toFormValues(initial),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Name" error={errors.name?.message}>
        <input {...register('name')} className="input" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Capacity" error={errors.capacity?.message}>
          <input type="number" {...register('capacity', { valueAsNumber: true })} className="input" />
        </Field>
        <Field label="Age group" error={errors.ageGroup?.message}>
          <input {...register('ageGroup')} className="input" />
        </Field>
      </div>
      <Field label="Staff lead" error={errors.staffLead?.message}>
        <input {...register('staffLead')} className="input" />
      </Field>
      <Field label="Colour" error={errors.color?.message}>
        <input type="color" {...register('color')} className="input h-10 w-20 p-1" />
      </Field>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
