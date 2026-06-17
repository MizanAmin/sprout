DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'children','relatives','rooms','staff','attendance','daily_logs',
    'medications','incidents','accident_book','calendar_events','nursery_events',
    'observations','assessments','reflections','planning','send_flags',
    'child_sessions','rota','booking_requests','holiday_credit_requests',
    'invoices','payments','payment_mandates','invoice_jobs','reminder_log',
    'funding_periods','funding_claims','enquiries','waiting_list',
    'messages','push_subscriptions','notification_log',
    'consent_templates','consent_forms','child_documents',
    'risk_assessments','risk_assessment_items','policies','policy_signoffs',
    'staff_training','staff_appraisals','qualifications','wellbeing_checkins',
    'gdpr_settings','sar_requests','erasure_requests','retention_policies',
    'privacy_notice_ack','audit_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'DROP POLICY IF EXISTS %I_tenant_isolation ON %I',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY %I_tenant_isolation ON %I
       USING (nursery_id = public.current_nursery_id())',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- Parent-child scoping on every child-scoped table.
-- Declared AS RESTRICTIVE so it AND-combines with the permissive
-- _tenant_isolation policy above (permissive policies OR together — a plain
-- permissive parent policy would be bypassed by _tenant_isolation).
-- Net effect: nursery match AND (staff/manager OR row's child is mine).
-- Helpers resolve identity from the API GUC or the JWT (see 000_auth_helpers).
-- COALESCE(jwt_role(),'') treats an unset role as non-parent: the trusted API
-- path opts INTO parent scoping by setting app.current_role; the JWT path always
-- carries role. Either way the tenant check above still confines to the nursery.
-- Uses @> to_jsonb() — NOT ::int[] cast, which fails on JSONB arrays.
-- NULL child_id rows (broadcasts, unassigned invoices) are hidden from parents.
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'observations','assessments','consent_forms','invoices','attendance',
    'medications','incidents','child_sessions','booking_requests',
    'holiday_credit_requests','daily_logs','messages','child_documents'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_parent_child ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I_parent_child ON %I
         AS RESTRICTIVE
         USING (
           COALESCE(public.jwt_role(), '''') <> ''parent''
           OR public.jwt_child_ids() @> to_jsonb(child_id)
         )',
      tbl, tbl
    );
  END LOOP;
END;
$$;
