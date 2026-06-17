import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole, requirePlanFeature } from '../middleware/requireRole';
import { draftObservation, analyzePhoto } from '../services/ai';
import type { HonoEnv } from '../types';

// AI assistant (Anthropic claude-haiku-4-5). Grove+ plan gated.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager', 'staff'), requirePlanFeature('ai'));

const draftSchema = z.object({
  notes: z.string().min(1, 'Notes are required'),
  childName: z.string().optional(),
  areas: z.array(z.string()).optional(),
  photoUrl: z.string().url().optional(),
});

// Draft an EYFS observation from rough notes (+ optional photo).
app.post('/observation', zValidator('json', draftSchema), async (c) => {
  const b = c.req.valid('json');
  const text = await draftObservation(b);
  return c.json({ text });
});

const photoSchema = z.object({
  photoUrl: z.string().url(),
  context: z.string().optional(),
});

// Analyse a photo and suggest EYFS areas.
app.post('/photo-analysis', zValidator('json', photoSchema), async (c) => {
  const b = c.req.valid('json');
  const text = await analyzePhoto(b);
  return c.json({ text });
});

export default app;
