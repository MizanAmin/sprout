// FCM HTTP v1 delivery + OAuth token minting (Deno runtime).
//
// FCM HTTP v1 reaches Android directly and iOS via APNs once the iOS app
// registers with Firebase and the APNs key is uploaded in the Firebase console.
// That's why we store one FCM token per device for both platforms.

import type { SendResult } from "./core.ts";

// ---- Access-token cache (gap #5: don't mint a JWT per push) ----
let cached: { token: string; expiresAt: number } | null = null;

export async function getFcmAccessToken(): Promise<string> {
  // Reuse until ~5 min before expiry.
  if (cached && cached.expiresAt - 5 * 60_000 > Date.now()) return cached.token;

  const sa = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT")!);
  const now = Math.floor(Date.now() / 1000);
  const b64url = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signingInput =
    `${b64url({ alg: "RS256", typ: "JWT" })}.` +
    b64url({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    });

  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${
    btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
  }`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json();
  cached = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cached.token;
}

// Send one push. Reports `dead: true` when FCM says the token is gone
// (gap #4) so the caller can prune it from device_tokens.
export async function sendPush(token: string, title: string, body: string): Promise<SendResult> {
  const projectId = Deno.env.get("FCM_PROJECT_ID")!;
  const accessToken = await getFcmAccessToken();
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { token, notification: { title, body } } }),
    },
  );

  if (res.ok) return { ok: true, dead: false };

  const text = await res.text();
  let dead = res.status === 404; // UNREGISTERED is surfaced as 404
  try {
    const err = JSON.parse(text);
    const code =
      err?.error?.details?.find?.((d: { errorCode?: string }) => d?.errorCode)?.errorCode ??
      err?.error?.status;
    if (code === "UNREGISTERED" || code === "INVALID_ARGUMENT") dead = true;
  } catch { /* non-JSON body; rely on status */ }

  console.error("FCM error", token.slice(0, 8), res.status, text);
  return { ok: false, dead };
}
