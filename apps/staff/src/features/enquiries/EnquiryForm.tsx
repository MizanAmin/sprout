import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Field } from '../../components/ui';
import { enquiryCreateSchema, type EnquiryCreateInput, type Enquiry } from './useEnquiries';

// Map an API enquiry row (snake_case) to form defaults (camelCase schema keys).
function toFormValues(e?: Enquiry): Partial<EnquiryCreateInput> {
  if (!e) return { priority: 'Normal', status: 'New' };
  return {
    childName: e.child_name,
    parentName: e.parent_name || undefined,
    email: e.email || undefined,
    phone: e.phone || undefined,
    dob: e.dob ?? undefined,
    room: e.room || undefined,
    startDate: e.start_date ?? undefined,
    priority: e.priority,
    status: e.status,
    notes: e.notes || undefined,
    source: e.source || undefined,
  };
}

export function EnquiryForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: Enquiry;
  onSubmit: (data: EnquiryCreateInput) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EnquiryCreateInput>({
    resolver: zodResolver(enquiryCreateSchema),
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
        <Field label="Start date" error={errors.startDate?.message}>
          <input type="date" {...register('startDate')} className="input" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Priority" error={errors.priority?.message}>
          <select {...register('priority')} className="input">
            <option value="Low">Low</option>
            <option value="Normal">Normal</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </Field>
        <Field label="Status" error={errors.status?.message}>
          <select {...register('status')} className="input">
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Toured">Toured</option>
            <option value="Offered">Offered</option>
            <option value="Enrolled">Enrolled</option>
            <option value="Declined">Declined</option>
          </select>
        </Field>
      </div>
      <Field label="Source" error={errors.source?.message}>
        <input {...register('source')} className="input" />
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
