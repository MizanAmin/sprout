import { z } from 'zod';

// Mirrors the `users` table role constraint (migration 001).
export const roleEnum = z.enum(['manager', 'staff', 'parent']);

// Staff/manager account creation (invite flow). Parents are provisioned
// separately and linked to children via `user_children`.
export const userCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email(),
  role: roleEnum.default('staff'),
});

export const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  role: roleEnum.optional(),
});

// Email/password sign-in shared by both apps.
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type Role = z.infer<typeof roleEnum>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
