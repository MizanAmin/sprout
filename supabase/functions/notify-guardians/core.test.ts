// Unit tests for the notify-guardians core logic.
// Run with:  node --test            (from this directory)
// No Deno, no network, no secrets — every dependency is a fake.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  handleAttendanceEvent,
  secretsMatch,
  type AttendanceRecord,
  type NotifyDeps,
  type PushTarget,
  type SendResult,
} from "./core.ts";

const signIn: AttendanceRecord = {
  id: "ea000000-0000-0000-0000-0000000000a1",
  nursery_id: "0a000000-0000-0000-0000-000000000001",
  child_id: "c1000000-0000-0000-0000-000000000001",
  kind: "sign_in",
  occurred_at: "2026-06-16T08:30:00Z",
};

// Build deps with overridable pieces and a record of what was sent/deleted.
function makeDeps(over: Partial<NotifyDeps> = {}) {
  const sent: Array<{ token: string; title: string; body: string }> = [];
  const deleted: string[][] = [];
  const deps: NotifyDeps = {
    getChildName: async () => "Ada",
    getGuardianTokens: async (): Promise<PushTarget[]> => [
      { profileId: "p1", token: "tok-1" },
      { profileId: "p1", token: "tok-2" },
    ],
    sendPush: async (token, title, body): Promise<SendResult> => {
      sent.push({ token, title, body });
      return { ok: true, dead: false };
    },
    deleteTokens: async (tokens) => { deleted.push(tokens); },
    formatTime: () => "08:30",
    ...over,
  };
  return { deps, sent, deleted };
}

test("ignores non sign_in events", async () => {
  const { deps, sent } = makeDeps();
  const r = await handleAttendanceEvent({ ...signIn, kind: "sign_out" }, deps);
  assert.equal(r.body, "ignored");
  assert.equal(r.sent, 0);
  assert.equal(sent.length, 0);
});

test("ignores a missing record (defensive)", async () => {
  const { deps } = makeDeps();
  const r = await handleAttendanceEvent(null, deps);
  assert.equal(r.body, "ignored");
});

test("returns 'no devices' when the child has no guardian tokens", async () => {
  const { deps, sent } = makeDeps({ getGuardianTokens: async () => [] });
  const r = await handleAttendanceEvent(signIn, deps);
  assert.equal(r.body, "no devices");
  assert.equal(sent.length, 0);
});

test("sends to every guardian token with the composed message", async () => {
  const { deps, sent } = makeDeps();
  const r = await handleAttendanceEvent(signIn, deps);
  assert.equal(r.sent, 2);
  assert.deepEqual(sent.map((s) => s.token), ["tok-1", "tok-2"]);
  assert.equal(sent[0].title, "Signed in");
  assert.equal(sent[0].body, "Ada arrived at 08:30");
});

test("falls back to 'Your child' when the name lookup is null", async () => {
  const { deps, sent } = makeDeps({ getChildName: async () => null });
  await handleAttendanceEvent(signIn, deps);
  assert.equal(sent[0].body, "Your child arrived at 08:30");
});

test("prunes only the tokens FCM reports dead, keeps live ones", async () => {
  const { deps, deleted } = makeDeps({
    sendPush: async (token): Promise<SendResult> =>
      token === "tok-2" ? { ok: false, dead: true } : { ok: true, dead: false },
  });
  const r = await handleAttendanceEvent(signIn, deps);
  assert.equal(r.sent, 1);
  assert.deepEqual(r.deleted, ["tok-2"]);
  assert.deepEqual(deleted, [["tok-2"]]); // exactly one delete call, only the dead token
});

test("a failing-but-not-dead token does not get pruned", async () => {
  const { deps, deleted } = makeDeps({
    sendPush: async (token): Promise<SendResult> =>
      token === "tok-2" ? { ok: false, dead: false } : { ok: true, dead: false },
  });
  const r = await handleAttendanceEvent(signIn, deps);
  assert.equal(r.sent, 1);
  assert.deepEqual(r.deleted, []);
  assert.equal(deleted.length, 0); // no delete call at all
});

test("one rejected sendPush does not sink the others", async () => {
  const { deps } = makeDeps({
    sendPush: async (token): Promise<SendResult> => {
      if (token === "tok-1") throw new Error("network blip");
      return { ok: true, dead: false };
    },
  });
  const r = await handleAttendanceEvent(signIn, deps);
  assert.equal(r.status, 200);
  assert.equal(r.sent, 1); // tok-2 still delivered
});

test("secretsMatch: equal, unequal, length-mismatch, and missing", () => {
  assert.equal(secretsMatch("abc123", "abc123"), true);
  assert.equal(secretsMatch("abc123", "abc124"), false);
  assert.equal(secretsMatch("abc", "abcd"), false);
  assert.equal(secretsMatch(null, "abc"), false);
  assert.equal(secretsMatch("abc", undefined), false);
  assert.equal(secretsMatch("", ""), false); // empty secret is never a match
});
