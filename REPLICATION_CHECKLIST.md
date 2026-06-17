# Sprout — Replication Checklist (match app.sproutnursery.co.uk)

Goal: make the new Sprout staff app match the existing live app's style, appearance, and features.
Reference source: `…/Nursery management/backend/backend/public/app.html` (single-file app, indigo theme).

## ✅ Phase 1 — Design system (DONE)
- [x] Inspected reference app: extracted design tokens + full 38-page inventory
- [x] **Primary → indigo `#4f46e5`** (light `#eef2ff`, dark `#4338ca`) — shared preset
- [x] Canvas/surface/text/muted/border → slate (`#f8fafc` / `#fff` / `#0f172a` / `#64748b` / `#e2e8f0`)
- [x] Semantic colors: success `#10b981`, warning `#f59e0b`, danger `#ef4444`, info `#06b6d4`, purple `#8b5cf6`
- [x] **Inter** font loaded; base size 14px
- [x] Gradient `.btn-primary` + `.btn-outline / .btn-success / .btn-danger / .btn-sm`
- [x] `.card`, `.stat-card`, pill `.badge` (+ success/warning/danger/info/muted variants)
- [x] Dark **slate sidebar** with **indigo active accent** (`text-indigo-300`)

## ⏳ Phase 2 — Per-page appearance + feature match
All routes already exist (built earlier); each needs exact look/feature parity with the reference.
Legend: ✅ matches · 🟡 exists, needs re-skin/feature pass · ⬜ not started

| # | Page | Route | Status |
|---|------|-------|--------|
| 1 | Dashboard | `/dashboard` | ✅ |
| 2 | Children | `/children` | ✅ |
| 3 | Relatives | `/relatives` | 🟡 |
| 4 | Staff | `/staff` | 🟡 |
| 5 | Enquiries | `/enquiries` | 🟡 |
| 6 | Waiting List | `/waiting-list` | 🟡 |
| 7 | Consent Forms | `/consents` | 🟡 |
| 8 | Messages | `/messages` | 🟡 |
| 9 | Rooms | `/rooms` | 🟡 |
| 10 | Staff Rota | `/rota` | 🟡 |
| 11 | Sessions & Funding | `/sessions` | 🟡 |
| 12 | Planning | `/planning` | 🟡 |
| 13 | Monitoring | `/monitoring` | 🟡 |
| 14 | Live Register | `/register` | ✅ |
| 15 | Fire Register | `/fire-register` | 🟡 |
| 16 | Calendar | `/calendar` | 🟡 |
| 17 | Assessment | `/assessment` | 🟡 |
| 18 | Daily Logs | `/daily-logs` | ✅ |
| 19 | Learning Journal | `/journal` | 🟡 |
| 20 | Reflections | `/reflections` | 🟡 |
| 21 | SEND | `/send` | 🟡 |
| 22 | Newsfeed | `/newsfeed` | 🟡 |
| 23 | Medications | `/medications` | 🟡 |
| 24 | Incidents | `/incidents` | 🟡 |
| 25 | Accident Book | `/accident-book` | 🟡 |
| 26 | Ofsted Mode | `/ofsted` | 🟡 |
| 27 | Compliance Hub | `/compliance` | 🟡 |
| 28 | GDPR | `/gdpr` | 🟡 |
| 29 | Staff Development | `/staff-dev` | 🟡 |
| 30 | Invoices | `/invoices` | 🟡 |
| 31 | Finance | `/finance` | ✅ |
| 32 | Revenue Report | `/revenue-report` | 🟡 |
| 33 | Funded Hours Report | `/funded-hours` | 🟡 |
| 34 | Funding Reconciliation | `/funding` | 🟡 |
| 35 | Reports | `/reports` | 🟡 |
| 36 | Settings | `/settings` | 🟡 |
| 37 | Staff Accounts | `/users` | 🟡 |
| 38 | Subscription & Billing | `/billing` | 🟡 |

## ⏳ Phase 3 — Cross-cutting features (from reference)
- [ ] Light/Dark theme toggle (reference has `[data-theme="dark"]`)
- [ ] Sticky translucent topbar (title + actions, 58px, blur)
- [ ] Quick Jump command palette (Cmd/Ctrl-K) over all pages
- [ ] Breadcrumbs on detail pages
- [ ] Plan/role gating in nav (mgr-only + plan:'blossom' items)
- [ ] EYFS 7-area tagging, mood map, daily-log summary tiles
- [ ] Staff:child ratio indicators (1:3 / 1:5 / 1:8)
