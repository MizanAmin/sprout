import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { relativeCreateSchema, type RelativeCreateInput } from '@sprout/schemas';
import { Field } from '../../components/ui';
import type { Relative } from './useRelatives';
import type { Child } from '../children/useChildren';

// Map an API relative row (snake_case) to form defaults (camelCase schema keys).
function toFormValues(r?: Relative): Partial<RelativeCreateInput> {
  if (!r) return { isPrimaryContact: false, isEmergencyContact: true };
  return {
    childId: r.child_id ?? undefined,
    name: r.name,
    relation: r.relation || undefined,
    phone: r.phone || undefined,
    email: r.email || undefined,
    address: r.address || undefined,
    isPrimaryContact: r.is_primary_contact,
    isEmergencyContact: r.is_emergency_contact,
  };
}

export function RelativeForm({
  initial,
  children,
  onSubmit,
  submitting,
}: {
  initial?: Relative;
  children: Child[];
  onSubmit: (data: RelativeCreateInput) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RelativeCreateInput>({
    resolver: zodResolver(relativeCreateSchema),
    defaultValues: toFormValues(initial),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Child" error={errors.childId?.message}>
        <select {...register('childId', { valueAsNumber: true })} className="input">
          <option value="">Unassigned</option>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Name" error={errors.name?.message}>
        <input {...register('name')} className="input" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Relation" error={errors.relation?.message}>
          <input {...register('relation')} className="input" />
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          <input {...register('phone')} className="input" />
        </Field>
      </div>
      <Field label="Email" error={errors.email?.message}>
        <input type="email" {...register('email')} className="input" />
      </Field>
      <Field label="Address" error={errors.address?.message}>
        <textarea {...register('address')} className="input" rows={2} />
      </Field>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input type="checkbox" {...register('isPrimaryContact')} />
          Primary contact
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input type="checkbox" {...register('isEmergencyContact')} />
          Emergency contact
        </label>
      </div>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
