import { z } from 'zod';

// Mirrors the `child_sessions` table (migration 003) — a child's recurring
// weekly booking pattern. Drives fee/funded-hours calculations.
export const dayEnum = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
export const sessionTypeEnum = z.enum(['AM', 'PM', 'Full Day', 'Custom']);

// HH:MM 24-hour time.
const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM');

export const sessionCreateSchema = z
  .object({
    childId: z.number().int().positive(),
    day: dayEnum,
    sessionType: sessionTypeEnum.default('Full Day'),
    startTime: timeString.optional(),
    endTime: timeString.optional(),
    fundedHours: z.number().nonnegative().default(0),
    feeHours: z.number().nonnegative().default(0),
    room: z.string().optional(),
    startDate: z.string().min(1), // ISO date — required
    endDate: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (s) => s.sessionType !== 'Custom' || (!!s.startTime && !!s.endTime),
    { message: 'Custom sessions require start and end times', path: ['startTime'] },
  );

export const sessionUpdateSchema = sessionCreateSchema;

export type SessionCreateInput = z.infer<typeof sessionCreateSchema>;
export type Day = z.infer<typeof dayEnum>;
export type SessionType = z.infer<typeof sessionTypeEnum>;
