import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { invoiceCreateSchema, type InvoiceCreateInput, type LineItem } from '@sprout/schemas';
import { Field, Modal, gbp } from '../../components/ui';
import { useChildren } from '../children/useChildren';
import type { Invoice, InvoiceUpdateInput } from './useInvoices';

// Empty string → undefined so optional numeric fields don't become NaN.
const numberOpt = { setValueAs: (v: unknown) => (v === '' || v == null ? undefined : Number(v)) };

export function InvoiceModal({
  open,
  onClose,
  onSubmit,
  onUpdate,
  editing,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: InvoiceCreateInput) => void;
  onUpdate?: (data: InvoiceUpdateInput) => void;
  editing?: Invoice | null;
  submitting?: boolean;
}) {
  const isEdit = !!editing;
  const { data: children } = useChildren();
  const {
    register,
    control,
    handleSubmit,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<InvoiceCreateInput>({
    resolver: zodResolver(invoiceCreateSchema),
    // Re-key the form per invoice so defaults reset between add/edit. See `key` in parent.
    defaultValues: editing
      ? {
          childId: editing.child_id ?? undefined,
          period: editing.period,
          lineItems:
            editing.line_items?.length > 0
              ? (editing.line_items as LineItem[])
              : [{ description: '', amount: 0 }],
          dueDate: editing.due_date ?? undefined,
          notes: editing.notes || undefined,
        }
      : { period: '', lineItems: [{ description: '', amount: 0 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });

  // Auto-fill amount = hours × rate when both are present on a row.
  const recalc = (i: number) => {
    const row = getValues(`lineItems.${i}`);
    if (row?.hours != null && row?.rate != null && !Number.isNaN(row.hours) && !Number.isNaN(row.rate)) {
      setValue(`lineItems.${i}.amount`, Number((row.hours * row.rate).toFixed(2)));
    }
  };

  const lineItems = watch('lineItems');
  const total = (lineItems ?? []).reduce((s, l) => s + (Number(l?.amount) || 0), 0);

  // Edit only touches the API-mutable fields; create sends the full payload.
  const submit = handleSubmit((data) => {
    if (isEdit && onUpdate) {
      onUpdate({ dueDate: data.dueDate, notes: data.notes, lineItems: data.lineItems });
    } else {
      onSubmit(data);
    }
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Edit ${editing!.invoice_ref}` : 'New invoice'}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Child" error={errors.childId?.message}>
            <select
              {...register('childId', { valueAsNumber: true })}
              className="input"
              defaultValue={editing?.child_id ?? ''}
              disabled={isEdit}
            >
              <option value="" disabled>
                Select…
              </option>
              {children?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Period" error={errors.period?.message}>
            <input {...register('period')} placeholder="2026-06" className="input" readOnly={isEdit} />
          </Field>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Line items</span>
            <button
              type="button"
              className="text-sm text-primary"
              onClick={() => append({ description: '', amount: 0 })}
            >
              + Add line
            </button>
          </div>
          {errors.lineItems?.message && (
            <p className="text-xs text-danger">{errors.lineItems.message}</p>
          )}
          {fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-12 gap-2">
              <input
                {...register(`lineItems.${i}.description`)}
                placeholder="Description"
                className="input col-span-5"
              />
              <input
                {...register(`lineItems.${i}.hours`, { ...numberOpt, onChange: () => recalc(i) })}
                placeholder="Hrs"
                type="number"
                step="0.5"
                className="input col-span-2"
              />
              <input
                {...register(`lineItems.${i}.rate`, { ...numberOpt, onChange: () => recalc(i) })}
                placeholder="Rate"
                type="number"
                step="0.01"
                className="input col-span-2"
              />
              <input
                {...register(`lineItems.${i}.amount`, numberOpt)}
                placeholder="Amount"
                type="number"
                step="0.01"
                className="input col-span-2"
              />
              <button
                type="button"
                className="col-span-1 text-muted hover:text-danger"
                onClick={() => remove(i)}
                disabled={fields.length === 1}
                aria-label="Remove line"
              >
                ✕
              </button>
            </div>
          ))}
          <div className="text-right text-sm font-medium text-gray-900">Total: {gbp(total)}</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Due date" error={errors.dueDate?.message}>
            <input type="date" {...register('dueDate')} className="input" />
          </Field>
          <Field label="Notes" error={errors.notes?.message}>
            <input {...register('notes')} className="input" />
          </Field>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting
              ? isEdit
                ? 'Saving…'
                : 'Creating…'
              : isEdit
                ? 'Save changes'
                : 'Create invoice'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
