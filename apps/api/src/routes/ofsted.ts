import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { withTenant } from '../db';
import type { HonoEnv } from '../types';

// Ofsted Mode (manager only) — read-only RAG compliance summary.
// NOTE: all RAG thresholds below are heuristic, intended as a quick at-a-glance
// indicator only; an inspector / manager should still review the underlying data.
const app = new Hono<HonoEnv>();
app.use('*', requireAuth, requireRole('manager'));

type Status = 'green' | 'amber' | 'red';
interface Section {
  key: string;
  label: string;
  status: Status;
  detail: string;
}

app.get('/', async (c) => {
  const { nurseryId } = c.get('user');

  const counts = await withTenant(nurseryId, async (client) => {
    const { rows } = await client.query(
      `SELECT
         -- Safeguarding: open SEND flags + incidents in last 30 days
         (SELECT COUNT(*) FROM send_flags WHERE nursery_id=$1)                                AS send_flags,
         (SELECT COUNT(*) FROM incidents
            WHERE nursery_id=$1 AND date >= CURRENT_DATE - 30)                                AS recent_incidents,
         -- Attendance: active children vs rows marked today
         (SELECT COUNT(*) FROM children WHERE nursery_id=$1 AND status='Active')              AS active_children,
         (SELECT COUNT(*) FROM attendance
            WHERE nursery_id=$1 AND date=CURRENT_DATE)                                        AS marked_today,
         -- Policies
         (SELECT COUNT(*) FROM policies WHERE nursery_id=$1)                                  AS policies_total,
         (SELECT COUNT(*) FROM policies
            WHERE nursery_id=$1 AND next_review IS NOT NULL AND next_review < CURRENT_DATE)   AS policies_overdue,
         (SELECT COUNT(*) FROM policies
            WHERE nursery_id=$1 AND status<>'active')                                         AS policies_inactive,
         -- Risk assessments
         (SELECT COUNT(*) FROM risk_assessments WHERE nursery_id=$1)                          AS risks_total,
         (SELECT COUNT(*) FROM risk_assessments
            WHERE nursery_id=$1 AND next_review IS NOT NULL AND next_review < CURRENT_DATE)    AS risks_overdue,
         (SELECT COUNT(*) FROM risk_assessments
            WHERE nursery_id=$1 AND status<>'active')                                         AS risks_inactive,
         -- Training
         (SELECT COUNT(*) FROM staff_training
            WHERE nursery_id=$1 AND expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE)   AS training_expired,
         (SELECT COUNT(*) FROM staff_training
            WHERE nursery_id=$1 AND expiry_date IS NOT NULL
              AND expiry_date >= CURRENT_DATE AND expiry_date < CURRENT_DATE + 30)            AS training_expiring`,
      [nurseryId],
    );
    return rows[0];
  });

  const sendFlags = Number(counts.send_flags);
  const recentIncidents = Number(counts.recent_incidents);
  const activeChildren = Number(counts.active_children);
  const markedToday = Number(counts.marked_today);
  const policiesTotal = Number(counts.policies_total);
  const policiesOverdue = Number(counts.policies_overdue);
  const policiesInactive = Number(counts.policies_inactive);
  const risksTotal = Number(counts.risks_total);
  const risksOverdue = Number(counts.risks_overdue);
  const risksInactive = Number(counts.risks_inactive);
  const trainingExpired = Number(counts.training_expired);
  const trainingExpiring = Number(counts.training_expiring);

  const sections: Section[] = [];

  // Safeguarding — heuristic: open SEND flags or recent incidents raise the level.
  {
    let status: Status = 'green';
    if (sendFlags > 0 || recentIncidents > 5) status = 'red';
    else if (recentIncidents > 0) status = 'amber';
    sections.push({
      key: 'safeguarding',
      label: 'Safeguarding',
      status,
      detail: `${sendFlags} open SEND flag(s), ${recentIncidents} incident(s) in last 30 days`,
    });
  }

  // Attendance — heuristic: today's register completeness.
  {
    const notMarked = Math.max(activeChildren - markedToday, 0);
    let status: Status = 'green';
    if (activeChildren > 0 && markedToday === 0) status = 'red';
    else if (notMarked > 0) status = 'amber';
    sections.push({
      key: 'attendance',
      label: 'Attendance',
      status,
      detail:
        activeChildren === 0
          ? 'No active children'
          : `${markedToday}/${activeChildren} marked today, ${notMarked} not yet marked`,
    });
  }

  // Staffing Ratios — placeholder: there is no ratios table, needs manual review.
  sections.push({
    key: 'staffing',
    label: 'Staffing Ratios',
    status: 'green',
    detail: 'No ratios data tracked — requires manual review against EYFS requirements',
  });

  // Policies — red if any overdue review; amber if none exist; else green.
  {
    let status: Status = 'green';
    let detail: string;
    if (policiesTotal === 0) {
      status = 'amber';
      detail = 'No policies recorded';
    } else if (policiesOverdue > 0) {
      status = 'red';
      detail = `${policiesOverdue} policy/policies overdue review`;
    } else if (policiesInactive > 0) {
      status = 'amber';
      detail = `${policiesInactive} policy/policies not active`;
    } else {
      detail = `${policiesTotal} active policy/policies, all in review`;
    }
    sections.push({ key: 'policies', label: 'Policies', status, detail });
  }

  // Risk Assessments — same logic as policies.
  {
    let status: Status = 'green';
    let detail: string;
    if (risksTotal === 0) {
      status = 'amber';
      detail = 'No risk assessments recorded';
    } else if (risksOverdue > 0) {
      status = 'red';
      detail = `${risksOverdue} risk assessment(s) overdue review`;
    } else if (risksInactive > 0) {
      status = 'amber';
      detail = `${risksInactive} risk assessment(s) not active`;
    } else {
      detail = `${risksTotal} active risk assessment(s), all in review`;
    }
    sections.push({ key: 'risk_assessments', label: 'Risk Assessments', status, detail });
  }

  // Training — red if any expired; amber if any expiring within 30 days; else green.
  {
    let status: Status = 'green';
    let detail: string;
    if (trainingExpired > 0) {
      status = 'red';
      detail = `${trainingExpired} training record(s) expired`;
    } else if (trainingExpiring > 0) {
      status = 'amber';
      detail = `${trainingExpiring} training record(s) expiring within 30 days`;
    } else {
      detail = 'No expired or expiring training';
    }
    sections.push({ key: 'training', label: 'Training', status, detail });
  }

  return c.json({ sections });
});

export default app;
