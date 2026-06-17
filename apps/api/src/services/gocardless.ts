import { createHmac, timingSafeEqual } from 'node:crypto';
import { GoCardlessClient } from 'gocardless-nodejs/client';
import { Environments } from 'gocardless-nodejs/constants';

// One client per access token (cached). Each nursery has its own GoCardless
// account (nurseries.gocardless_access_token); pass that token so mandates and
// payments are created under the nursery's account. Falls back to the platform
// token (GOCARDLESS_ACCESS_TOKEN) when a nursery hasn't connected its own.
// (The package's root types only expose data types; the client class lives at
// the /client subpath, so we instantiate it directly.)
const _clients = new Map<string, GoCardlessClient>();

export function getGoCardless(token?: string): GoCardlessClient {
  const accessToken = token || process.env.GOCARDLESS_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      'No GoCardless access token (nursery has none and GOCARDLESS_ACCESS_TOKEN is unset)',
    );
  }
  const existing = _clients.get(accessToken);
  if (existing) return existing;
  const env = process.env.NODE_ENV === 'production' ? Environments.Live : Environments.Sandbox;
  const client = new GoCardlessClient(accessToken, env);
  _clients.set(accessToken, client);
  return client;
}

// GoCardless signs webhooks with HMAC-SHA256 over the raw body, hex-encoded, in
// the `Webhook-Signature` header. Verify before trusting any event.
export function verifyGoCardlessSignature(rawBody: string, signature: string | undefined): boolean {
  const secret = process.env.GOCARDLESS_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
