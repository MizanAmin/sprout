// supabase/functions/notify-guardians/index.ts
//
// Fires when a row is inserted into attendance_events (via a Database Webhook).
// Looks up the child's guardians, finds their device tokens, and sends a push.
//
// Runs with the SERVICE-ROLE key, so it bypasses RLS by design — it must, to
// read every guardian's tokens. Never ship this key to a client.
//
// Decision logic lives in core.ts (unit-tested); FCM I/O in fcm.ts. This file
// only wires the real Supabase + FCM dependencies to the core handler.
//
// Deploy:  supabase functions deploy notify-guardians
// Secrets: supabase secrets set FCM_PROJECT_ID=... FCM_SERVICE_ACCOUNT='{...}' WEBHOOK_SECRET=...
//          (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleAttendanceEvent, secretsMatch, type NotifyDeps, type PushTarget } from "./core.ts";
import { sendPush } from "./fcm.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const deps: NotifyDeps = {
  getChildName: async (childId) => {
    const { data } = await admin.from("children").select("full_name").eq("id", childId).single();
    return data?.full_name ?? null;
  },

  getGuardianTokens: async (childId) => {
    const { data: guardians } = await admin
      .from("guardianships").select("guardian_id").eq("child_id", childId);
    const guardianIds = (guardians ?? []).map((g) => g.guardian_id);
    if (guardianIds.length === 0) return [];

    const { data: tokens } = await admin
      .from("device_tokens").select("profile_id, token").in("profile_id", guardianIds);
    return (tokens ?? []).map((t): PushTarget => ({ profileId: t.profile_id, token: t.token }));
  },

  sendPush,

  deleteTokens: async (tokens) => {
    if (tokens.length === 0) return;
    await admin.from("device_tokens").delete().in("token", tokens);
  },

  formatTime: (iso) =>
    new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
    }),
};

Deno.serve(async (req) => {
  try {
    // Only Supabase (which sets this header on the webhook) may call us.
    if (!secretsMatch(req.headers.get("x-webhook-secret"), Deno.env.get("WEBHOOK_SECRET"))) {
      return new Response("unauthorized", { status: 401 });
    }

    const { record } = await req.json(); // the inserted attendance_events row
    const result = await handleAttendanceEvent(record, deps);
    return new Response(result.body, { status: result.status });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});
