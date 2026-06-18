# Sprout — API Gaps Report

## Status (updated)
**✅ Implemented (migrations 018–019 applied to the live DB; API + frontend shipped):**
- Plan in session JWT (`user_metadata.plan`) → nav hides plan-gated items below tier.
- **A. Columns (all):** observations.next_steps, assessments.term, calendar_events.event_type,
  send_flags.status, consent_forms.due_date, consent_templates.requires_signature+category,
  accident_book.riddor_reportable+parent_notified_how, incidents.body_part+riddor_required,
  funding_claims.claim_type/received_date/reference/notes/amount, staff_training.hours/type/notes,
  staff_appraisals.period/overall_rating, rota.sat/sun, relatives.has_portal_access,
  gdpr_settings.ico_registered/ico_number/privacy_notice.
- **B. Endpoints:** monitoring historic `date`, waiting-list `/:id/move` + `/from-enquiry`,
  GDPR `/audit`, billing `/status` (usage), finance `/revenue` by-type+invoiceCount,
  finance `/run-reminders`, payments `/gocardless-settings`, staff-dev `/qualifications` + `/wellbeing`.
- **C.** staff pickers + role gating; CSV **export** (children, relatives).

**⏳ Deferred — need infrastructure, not quick slices:**
- **File storage** — ✅ done: `POST /uploads` (signed) + `GET /uploads/url` (tenant-scoped signed URLs) on the private bucket; wired to nursery **logo** (Settings) and **observation photos** (Journal) via useUpload/SignedImage.
- **PDF/print** — ✅ done (browser print-to-PDF): invoice PDF, revenue report export, Ofsted readiness report. Remaining: a formatted Ofsted **SEF** document + native Excel export (CSV export already covers data).
- **CSV import** — ✅ done: client-side parse (`parseCsv`) + bulk-create via existing endpoints on Children and Relatives, with imported/skipped summary.
- **Auto-invoicing config panel** + job-history/reminder-log + per-invoice payment ledger.
- **Structured rota model** — ✅ done: migration 020 `rota_shifts` (one row per shift, type/start/end/room/notes), rewritten `/api/rota` CRUD + weekly grid UI (staff × Mon–Sun, type-coloured chips, click-to-add/edit).
- **Consent bulk-send**, **settings invoice-config / preferences** toggles, compliance signoff/item aggregate counts, all-children assessment view.
- **Parent invite** — ✅ done: `POST /users/parent` creates a parent login (role parent + child_ids) linked to children, with a Staff Accounts "Invite parent" modal.

---


Features the live app (app.sproutnursery.co.uk) has that the new Sprout backend
doesn't yet expose. Surfaced from the `// TODO: needs …` markers left while
replicating the 38 pages. Each staff page renders its layout and degrades
gracefully where an endpoint/column is missing — nothing is broken; these unlock
the remaining parity.

Legend: **DB** = migration + zod schema + route field · **API** = new route/handler ·
**FE** = frontend-only (endpoint already exists; just wire it up).

---

## A. DB column / field additions (migration + schema + route)

| Table | Add | Unlocks | Page |
|---|---|---|---|
| `observations` | `next_steps` | Next-steps capture/display on observations | Learning Journal |
| `assessments` | `term` | EYFS term on assessments | Assessment |
| `calendar_events` | `event_type` | True typed events (vs colour-as-type) | Calendar |
| `send_flags` | `status` (active/monitoring/resolved) | SEND status badges + status stat cards | SEND |
| `consent_forms` | `due_date` | Overdue consent tracking | Consent Forms |
| `consent_templates` | `requires_signature`, `category` | Template flags/category badges | Consent Forms |
| `accident_book` | `riddor` flag, `body_markers` (JSON), `parent_notified_how` + time | RIDDOR stat, body-diagram, notify method | Accident Book |
| `incidents` | `body_part`, `riddor_required` | Body part + RIDDOR flag | Incidents |
| `funding_claims` | `type` (LA/TFC), `received_date`, `reference`, `notes`, £ amounts | Full reconciliation (hours-only today) | Funding |
| `staff_training` | `hours`, `training_type`, `notes` | Richer CPD records | Staff Development |
| `staff_appraisals` | `period`, `overall_rating` | Appraisal period + rating badge | Staff Development |
| `rota` | structured shift cols (`type`,`start_time`,`end_time`,`room`,`notes`) + `sat`/`sun` | Real shift model, weekends, notes | Staff Rota |
| `relatives` | portal-access field (`has_portal_access`/`portal_user_id`) | Parent-portal badge | Relatives |
| `gdpr_settings` | `ico_registered`, `ico_number`, `privacy_notice` | ICO registration card | GDPR |

## B. New endpoints / handlers

| Endpoint | Purpose | Page |
|---|---|---|
| `POST /monitoring` accept `date` | Log historic daily checks (currently CURRENT_DATE only) | Monitoring |
| `POST /waiting-list/from-enquiry` | Move an enquiry onto the waiting list | Enquiries |
| `PATCH /waiting-list/:id/move` | Re-order the queue (▲▼) | Waiting List |
| `POST /consents/templates/:id/send` | Bulk-issue a consent template to many children | Consent Forms |
| photo upload (e.g. `POST /observations/:id/photo` → storage) | Attach photos (only external `photo_url` today) | Learning Journal |
| `GET /billing/status` | Children used vs plan limit + current cycle | Billing |
| `GET /ofsted/report`, `GET /ofsted/sef` | EYFS coverage table + printable draft SEF | Ofsted Mode |
| `GET /gdpr/audit` | Audit-log card (SAR_EXPORT / ERASURE / access) | GDPR |
| `POST /settings/logo` | Nursery logo upload (stores `logo_url` only today) | Settings |
| `GET/PUT /settings/invoice-config` | Invoice customisation | Settings |
| preferences endpoint | System-preference toggles | Settings |
| `POST /finance/run-reminders` | "Run reminders now" action | Settings |
| `GET/PUT/DELETE /payments/gocardless-settings` (+ `/test`) | GoCardless config UI | Settings |
| `/staff-dev/qualifications`, `/staff-dev/wellbeing` | Qualifications + wellbeing sections | Staff Development |
| aggregate signoff counts on `GET /compliance/policies`; item counts on risk assessments | "X/Y signed", "N items (M complete)" | Compliance Hub |
| `GET /assessments` returning `child_name` (or a join) | All-children assessment view (per-child only today) | Assessment |
| `/finance/revenue` returning `by_type[]`, `invoice_count`; export endpoints (pdf/xlsx) | Revenue by type + exports | Revenue Report |
| funded-hours summary (`by_room`, `by_age_band`, entitlement bands) | Headcount/utilisation cards | Funded Hours |
| auto-invoicing config + job-history/reminder-log; per-invoice payment ledger; "charge DD" | Auto-invoicing panel, ledger | Invoices |
| CSV import/export (children, relatives) | Bulk data in/out | Children, Relatives |

## ✅ C. Frontend follow-ups — DONE (staff pickers + role gating wired; parent invites still pending)

These were marked "needs /staff" or "needs current user", but those already exist
after recent work — they're just not wired into every form yet:

- **Wire `useStaff` into pickers** (it exists; `/staff` is live): "given by / witness"
  (Medications), "recorded/witnessed by" (Incidents), "first aider" (Accident Book),
  author (Reflections), assigned-staff avatars (Rooms).
- **Use `useCurrentUser`** (added in Phase 3) to: gate Staff edit/delete to managers
  (Staff), hide self edit/delete + show "(you)" (Staff Accounts).
- **Parent invites** (Staff Accounts): the API's `POST /users` only invites
  staff/manager. Provisioning parent logins (with `child_id`) is a dedicated flow —
  see how the test parent was seeded; would become `POST /users/parent` or similar.

## Suggested priority

1. **Quick FE wins (no backend):** section C — staff pickers + role gating.
2. **High-value DB columns:** `observations.next_steps`, `send_flags.status`,
   `consent_forms.due_date`, `calendar_events.event_type`, `staff_training`/`appraisals` extras.
3. **Statutory/compliance:** accident-book RIDDOR + body diagram, incidents body part, GDPR ICO + audit.
4. **Finance depth:** funding claim fields, `/finance/revenue` by-type + exports, `/billing/status`.
5. **Settings integrations:** logo upload, GoCardless, preferences, run-reminders.
6. **Nice-to-have:** CSV import/export, Ofsted SEF/report, staff-dev qualifications/wellbeing.

Also: add the nursery **plan** to the session JWT so the sidebar can hide
plan-gated items for lower tiers (today only role is in the token).
