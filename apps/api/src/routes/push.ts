import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// Expo push-token registration for any authenticated user (staff/manager/parent).
// push_subscriptions (migration 008): id, nursery_id, user_id UUID,
// expo_push_token UNIQUE, platform CHECK('ios','android'), created_at.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth);

app.post(
  '/',
  zValidator(
    'json',
    z.object({ expoPushToken: z.string().min(1), platform: z.enum(['ios', 'android']) }),
  ),
  async (c) => {
    const { nurseryId, id } = c.get('user');
    const b = c.req.valid('json');
    const { rows } = await withTenant(nurseryId, (client) =>
      client.query(
        `INSERT INTO push_subscriptions (nursery_id, user_id, expo_push_token, platform)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (expo_push_token)
         DO UPDATE SET user_id = EXCLUDED.user_id,
                       nursery_id = EXCLUDED.nursery_id,
                       platform = EXCLUDED.platform
         RETURNING *`,
        [nurseryId, id, b.expoPushToken, b.platform],
      ),
    );
    return c.json(rows[0], 201);
  },
);

app.get('/', async (c) => {
  const { nurseryId, id } = c.get('user');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      'SELECT * FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at DESC',
      [id],
    ),
  );
  return c.json(rows);
});

app.delete('/:token', async (c) => {
  const { nurseryId, id } = c.get('user');
  const token = c.req.param('token');
  const { rows } = await withTenant(nurseryId, (client) =>
    client.query(
      'DELETE FROM push_subscriptions WHERE expo_push_token = $1 AND user_id = $2 RETURNING id',
      [token, id],
    ),
  );
  if (!rows[0]) return c.json({ error: 'Push token not found', code: 'NOT_FOUND' }, 404);
  return c.json({ ok: true });
});

export default app;
