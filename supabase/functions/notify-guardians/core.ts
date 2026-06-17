// Runtime-agnostic core logic for the notify-guardians Edge Function.
//
// Deliberately imports NOTHING Deno- or Supabase-specific: all I/O is injected
// via NotifyDeps. That keeps the decision logic — which events notify, what the
// message says, which dead tokens to prune — unit-testable under plain Node
// (see core.test.ts), while index.ts wires the real Supabase + FCM deps.

export type AttendanceRecord = {
  id: string;
  nursery_id: string;
  child_id: string;
  kind: string; // 'sign_in' | 'sign_out' | (future kinds)
  occurred_at: string;
};

export type PushTarget = { profileId: string; token: string };

export type SendResult = { ok: boolean; dead: boolean };

export type NotifyDeps = {
  getChildName: (childId: string) => Promise<string | null>;
  getGuardianTokens: (childId: string) => Promise<PushTarget[]>;
  sendPush: (token: string, title: string, body: string) => Promise<SendResult>;
  deleteTokens: (tokens: string[]) => Promise<void>;
  formatTime: (iso: string) => string;
};

export type NotifyResult = {
  status: number;
  body: string;
  sent: number;
  deleted: string[];
};

// Decide + dispatch. Pure orchestration; every side effect goes through deps.
export async function handleAttendanceEvent(
  record: AttendanceRecord | null | undefined,
  deps: NotifyDeps,
): Promise<NotifyResult> {
  // Only a sign-in notifies in slice 1. Other kinds are accepted and ignored,
  // so the webhook can fire on every attendance_events insert without harm.
  if (!record || record.kind !== "sign_in") {
    return { status: 200, body: "ignored", sent: 0, deleted: [] };
  }

  const [childName, targets] = await Promise.all([
    deps.getChildName(record.child_id),
    deps.getGuardianTokens(record.child_id),
  ]);

  if (targets.length === 0) {
    return { status: 200, body: "no devices", sent: 0, deleted: [] };
  }

  const title = "Signed in";
  const body = `${childName ?? "Your child"} arrived at ${deps.formatTime(record.occurred_at)}`;

  // allSettled so one bad token never sinks the rest.
  const results = await Promise.allSettled(
    targets.map(async (t) => ({ token: t.token, res: await deps.sendPush(t.token, title, body) })),
  );

  const dead: string[] = [];
  let sent = 0;
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    if (r.value.res.ok) sent++;
    if (r.value.res.dead) dead.push(r.value.token);
  }

  // Prune tokens FCM reported as gone, so the table doesn't accumulate corpses.
  if (dead.length > 0) await deps.deleteTokens(dead);

  return { status: 200, body: "ok", sent, deleted: dead };
}

// Constant-time-ish comparison for the webhook shared secret, so the 401 gate
// doesn't leak length/prefix via timing. Returns false on any missing value.
export function secretsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
