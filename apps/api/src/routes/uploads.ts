import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { uploadFile, getSignedUrl, storagePaths } from '../services/storage';
import type { HonoEnv } from '../types';

// Authenticated upload + signed-download for the private `sprout-files` bucket.
// Frontend uploads a file here (service-role write), stores the returned PATH in
// a *_url column, and fetches a short-lived signed URL to display it. All paths
// are namespaced under `nursery-<id>/` so tenants can't read each other's files.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth);

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);

// POST / — multipart { file, kind }. kind: 'logo' | 'observation' | 'generic'.
app.post('/', async (c) => {
  const { nurseryId } = c.get('user');
  const body = await c.req.parseBody();
  const file = body['file'];
  const kind = String(body['kind'] ?? 'generic');
  if (!(file instanceof File)) {
    return c.json({ error: 'No file provided', code: 'VALIDATION_ERROR' }, 422);
  }
  if (file.size > MAX_BYTES) {
    return c.json({ error: 'File exceeds 5 MB', code: 'VALIDATION_ERROR' }, 422);
  }
  const contentType = file.type || 'application/octet-stream';
  if ((kind === 'logo' || kind === 'observation') && !IMAGE_TYPES.has(contentType)) {
    return c.json({ error: 'Only image files are allowed', code: 'VALIDATION_ERROR' }, 422);
  }

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  let path: string;
  if (kind === 'logo') {
    path = storagePaths.nurseryLogo(nurseryId, ext || 'png');
  } else if (kind === 'observation') {
    path = `nursery-${nurseryId}/observations/${crypto.randomUUID()}-${safe(file.name)}`;
  } else {
    path = `nursery-${nurseryId}/uploads/${crypto.randomUUID()}-${safe(file.name)}`;
  }

  const buf = await file.arrayBuffer();
  await uploadFile(path, buf, contentType);
  return c.json({ path }, 201);
});

// GET /url?path=… — short-lived signed URL, scoped to the caller's nursery.
app.get('/url', async (c) => {
  const { nurseryId } = c.get('user');
  const path = c.req.query('path');
  if (!path) return c.json({ error: 'path required', code: 'VALIDATION_ERROR' }, 422);
  if (!path.startsWith(`nursery-${nurseryId}/`)) {
    return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403);
  }
  const { url, expiresAt } = await getSignedUrl(path, 3600);
  return c.json({ url, expiresAt });
});

export default app;
