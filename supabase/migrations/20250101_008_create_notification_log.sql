-- Migration: notification_log with RLS

CREATE TABLE IF NOT EXISTS notification_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  type        text NOT NULL,
  payload     jsonb NOT NULL,
  telegram_ok boolean,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_user_id ON notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log(type);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_log_select_own" ON notification_log;
CREATE POLICY "notification_log_select_own" ON notification_log FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_log_all_admin" ON notification_log;
CREATE POLICY "notification_log_all_admin" ON notification_log FOR ALL
  USING (auth.jwt() ->> 'role' IN ('city_admin','superadmin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('city_admin','superadmin'));
