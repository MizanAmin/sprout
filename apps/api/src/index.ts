import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { except } from 'hono/combine';
import { rateLimiter } from 'hono-rate-limiter';
import { logger } from 'hono/logger';

import { requireAuth } from './middleware/auth';
import { requireActiveSubscription } from './middleware/trial';
import type { HonoEnv } from './types';
import auth from './routes/auth';
import parent from './routes/parent';
import push from './routes/push';
import enquiries from './routes/enquiries';
import waitingList from './routes/waiting-list';
import rota from './routes/rota';
import calendar from './routes/calendar';
import planning from './routes/planning';
import monitoring from './routes/monitoring';
import send from './routes/send';
import newsfeed from './routes/newsfeed';
import requests from './routes/requests';
import ai from './routes/ai';
import gdpr from './routes/gdpr';
import compliance from './routes/compliance';
import staffDev from './routes/staff-dev';
import settings from './routes/settings';
import reports from './routes/reports';
import ofsted from './routes/ofsted';
import childDocuments from './routes/child-documents';
import reflections from './routes/reflections';
import childSessions from './routes/child-sessions';
import fireRegister from './routes/fire-register';
import children from './routes/children';
import relatives from './routes/relatives';
import rooms from './routes/rooms';
import staff from './routes/staff';
import users from './routes/users';
import dailyLogs from './routes/daily-logs';
import attendance from './routes/attendance';
import messages from './routes/messages';
import observations from './routes/observations';
import assessments from './routes/assessments';
import medications from './routes/medications';
import incidents from './routes/incidents';
import accidentBook from './routes/accident-book';
import consents from './routes/consents';
import invoices from './routes/invoices';
import finance from './routes/finance';
import payments from './routes/payments';
import gocardlessWebhook from './routes/gocardless-webhook';
import billing from './routes/billing';
import billingWebhook from './routes/billing-webhook';
import fundedHours from './routes/funded-hours';
import funding from './routes/funding';

const app = new Hono<HonoEnv>();

// CORS: staff web app only. React Native does not send Origin headers,
// so the parent mobile app does not need to be listed here.
app.use('*', cors({ origin: [process.env.STAFF_APP_URL ?? 'http://localhost:5173'] }));
app.use('*', logger());
app.use(
  '/api/*',
  rateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    keyGenerator: (c) =>
      c.req.header('x-forwarded-for') ?? c.req.header('cf-connecting-ip') ?? 'global',
  }),
);

// Trial / subscription gate (runs after auth on authenticated routes). Once the
// 14-day trial ends with no active Stripe subscription, these return 402.
// Exempt: auth (pre-session), the public webhooks (no JWT), billing (managers
// must still reach it to upgrade), and parent routes (end-users aren't the
// customer and shouldn't be locked out by the nursery's billing status).
// Routers re-run requireAuth themselves; this gate runs it first so the trial
// check can read the user — a cheap re-verify, not a behaviour change.
app.use(
  '/api/*',
  except(
    // Skip the gate for: auth (pre-session), billing (upgrade path), parent
    // (end-users), and the public GoCardless webhook (no JWT).
    ['/api/auth/*', '/api/billing/*', '/api/parent/*', '/api/payments/gocardless-webhook'],
    requireAuth,
    requireActiveSubscription,
  ),
);

app.get('/health', (c) => c.json({ ok: true }));

// Standard error response shape — the frontend catches by `code`, not status.
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
});

app.route('/api/auth', auth);
app.route('/api/children', children);
app.route('/api/relatives', relatives);
app.route('/api/rooms', rooms);
app.route('/api/staff', staff);
app.route('/api/users', users);
app.route('/api/daily-logs', dailyLogs);
app.route('/api/attendance', attendance);
app.route('/api/messages', messages);
app.route('/api/observations', observations);
app.route('/api/assessments', assessments);
app.route('/api/medications', medications);
app.route('/api/incidents', incidents);
app.route('/api/accident-book', accidentBook);
app.route('/api/consents', consents);
// Webhooks first — public, must not be shadowed by the auth-gated parent routers.
app.route('/api/payments/gocardless-webhook', gocardlessWebhook);
app.route('/api/billing/webhook', billingWebhook);
app.route('/api/invoices', invoices);
app.route('/api/finance', finance);
app.route('/api/payments', payments);
app.route('/api/billing', billing);
app.route('/api/funded-hours', fundedHours);
app.route('/api/funding', funding);
app.route('/api/parent', parent);
app.route('/api/push', push);
app.route('/api/enquiries', enquiries);
app.route('/api/waiting-list', waitingList);
app.route('/api/rota', rota);
app.route('/api/calendar', calendar);
app.route('/api/planning', planning);
app.route('/api/monitoring', monitoring);
app.route('/api/send', send);
app.route('/api/newsfeed', newsfeed);
app.route('/api/requests', requests);
app.route('/api/ai', ai);
app.route('/api/gdpr', gdpr);
app.route('/api/compliance', compliance);
app.route('/api/staff-dev', staffDev);
app.route('/api/settings', settings);
app.route('/api/reports', reports);
app.route('/api/ofsted', ofsted);
app.route('/api/child-documents', childDocuments);
app.route('/api/reflections', reflections);
app.route('/api/child-sessions', childSessions);
app.route('/api/fire-register', fireRegister);

export default { port: process.env.PORT || 3000, fetch: app.fetch };
