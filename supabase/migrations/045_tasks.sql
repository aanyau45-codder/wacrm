-- ============================================================
-- 045_tasks
--
-- Tasks with phone reminders.
--
--   1. tasks                — things to do by a date + time (call a lead
--                             back, send a quote…). Optionally linked to
--                             a call lead / deal / contact. Logging a call
--                             with a call-back time creates one.
--   2. push_subscriptions   — this user's phones/browsers that accept
--                             reminder notifications (Web Push).
--   3. reminder_settings    — per user: morning summary on/off + time.
--
-- A scheduler (pg_cron → GET /api/tasks/cron, see the setup SQL in the
-- release notes) sends due reminders and the morning summary.
--
-- Additive only: no existing table is altered. Tasks follow the
-- call_leads tenancy model (any member reads, agent+ writes); push
-- subscriptions and reminder settings are private to their user.
-- ============================================================

-- 1. Tasks ----------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Whose task it is; reminders go to this user's phones.
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,

  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  notes TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  -- Minutes before due_at to remind; NULL = no reminder.
  remind_minutes INTEGER CHECK (remind_minutes BETWEEN 0 AND 10080),
  -- due_at - remind_minutes (the app keeps it in step; snoozing moves it).
  remind_at TIMESTAMPTZ,
  -- Set when the reminder went out, so it's sent once.
  reminded_at TIMESTAMPTZ,
  done_at TIMESTAMPTZ,

  lead_id UUID REFERENCES call_leads(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  -- 'manual' | 'call' (made by logging a call with a call-back time)
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'call')),
  call_log_id UUID REFERENCES call_logs(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_account_user_due
  ON tasks(account_id, user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_lead ON tasks(lead_id) WHERE lead_id IS NOT NULL;
-- The scheduler's "what's due" scan.
CREATE INDEX IF NOT EXISTS idx_tasks_pending_reminders
  ON tasks(remind_at)
  WHERE done_at IS NULL AND reminded_at IS NULL AND remind_at IS NOT NULL;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tasks_select ON tasks;
DROP POLICY IF EXISTS tasks_insert ON tasks;
DROP POLICY IF EXISTS tasks_update ON tasks;
DROP POLICY IF EXISTS tasks_delete ON tasks;
CREATE POLICY tasks_select ON tasks FOR SELECT
  USING (is_account_member(account_id));
CREATE POLICY tasks_insert ON tasks FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY tasks_update ON tasks FOR UPDATE
  USING (is_account_member(account_id, 'agent'));
CREATE POLICY tasks_delete ON tasks FOR DELETE
  USING (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON tasks;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Push subscriptions ---------------------------------------
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscriptions_own ON push_subscriptions;
CREATE POLICY push_subscriptions_own ON push_subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND is_account_member(account_id));

-- 3. Reminder settings ----------------------------------------
CREATE TABLE IF NOT EXISTS reminder_settings (
  user_id UUID PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  morning_summary BOOLEAN NOT NULL DEFAULT TRUE,
  -- Africa/Kampala local time.
  summary_time TIME NOT NULL DEFAULT '08:00',
  -- Kampala date the last summary went out (sent once a day).
  last_summary_on DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reminder_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reminder_settings_own ON reminder_settings;
CREATE POLICY reminder_settings_own ON reminder_settings FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND is_account_member(account_id));

DROP TRIGGER IF EXISTS set_updated_at ON reminder_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON reminder_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Live task badges in the app.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  END IF;
END $$;
