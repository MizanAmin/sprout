import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { childCreateSchema, type ChildCreateInput } from '@sprout/schemas';
import { Field } from '../../components/ui';
import type { Child } from './useChildren';

// Map an API child row (snake_case) to form defaults (camelCase schema keys).
function toFormValues(c?: Child): Partial<ChildCreateInput> {
  if (!c) return { status: 'Active', allergy: 'None' };
  return {
    name: c.name,
    dob: c.dob ?? undefined,
    gender: c.gender || undefined,
    room: c.room || undefined,
    status: c.status,
    allergy: c.allergy || 'None',
    medicalInfo: c.medical_info || undefined,
    emergencyContact: c.emergency_contact || undefined,
    contactPhone: c.contact_phone || undefined,
    notes: c.notes || undefined,
  };
}

export function ChildForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: Child;
  onSubmit: (data: ChildCreateInput) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChildCreateInput>({
    resolver: zodResolver(childCreateSchema),
    defaultValues: toFormValues(initial),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Name" error={errors.name?.message}>
        <input {...register('name')} className="input" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Date of Birth" error={errors.dob?.message}>
          <input type="date" {...register('dob')} className="input" />
        </Field>
        <Field label="Room" error={errors.room?.message}>
          <input {...register('room')} className="input" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Gender" error={errors.gender?.message}>
          <input {...register('gender')} className="input" />
        </Field>
        <Field label="Status" error={errors.status?.message}>
          <select {...register('status')} className="input">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </Field>
      </div>
      <Field label="Allergy" error={errors.allergy?.message}>
        <input {...register('allergy')} className="input" />
      </Field>
      <Field label="Medical info" error={errors.medicalInfo?.message}>
        <textarea {...register('medicalInfo')} className="input" rows={2} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Emergency contact" error={errors.emergencyContact?.message}>
          <input {...register('emergencyContact')} className="input" />
        </Field>
        <Field label="Contact phone" error={errors.contactPhone?.message}>
          <input {...register('contactPhone')} className="input" />
        </Field>
      </div>
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
