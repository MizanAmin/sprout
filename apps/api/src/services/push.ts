import { pool } from '../db';

// Expo Push API — APNs + FCM are handled by Expo's service. The open endpoint is
// free; EXPO_ACCESS_TOKEN is optional. No VAPID (that's web-push, not used here).
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendExpoPush(
  tokens: string[],
  message: PushMessage,
): Promise<{ sent: number }> {
  const valid = tokens.filter((t) => t && t.startsWith('ExponentPushToken'));
  if (valid.length === 0) return { sent: 0 };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  // Expo accepts up to 100 messages per request — chunk to be safe.
  for (let i = 0; i < valid.length; i += 100) {
    const batch = valid.slice(i, i + 100).map((to) => ({
      to,
      sound: 'default',
      title: message.title,
      body: message.body,
      data: message.data ?? {},
    }));
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`Expo push failed: ${res.status} ${await res.text()}`);
  }
  return { sent: valid.length };
}

// Push to one user's registered devices. Uses the pool (system role) — these are
// cross-tenant sends from jobs/routes, matched by user_id.
export async function notifyUser(userId: string, message: PushMessage): Promise<{ sent: number }> {
  const { rows } = await pool.query(
    'SELECT expo_push_token FROM push_subscriptions WHERE user_id=$1',
    [userId],
  );
  return sendExpoPush(
    rows.map((r) => r.expo_push_token as string),
    message,
  );
}

// Push to every guardian of a child (parents linked via user_children).
export async function notifyChildGuardians(
  childId: number,
  message: PushMessage,
): Promise<{ sent: number }> {
  const { rows } = await pool.query(
    `SELECT ps.expo_push_token
     FROM push_subscriptions ps
     JOIN user_children uc ON uc.user_id = ps.user_id
     WHERE uc.child_id = $1`,
    [childId],
  );
  return sendExpoPush(
    rows.map((r) => r.expo_push_token as string),
    message,
  );
}
