-- ============================================================
-- 040_lead_calling
--
-- "Lead Calling" layer: leads the owner phones personally, a call
-- queue with scheduled dates, and one log row per call.
--
--   1. call_leads     — businesses to call (found by search, imported
--                       from CSV/Excel or added by hand). Keeps the
--                       CURRENT temperature / last outcome / attempts /
--                       next_call_date denormalised for fast lists.
--   2. call_logs      — one row per call made (outcome, tags, remarks,
--                       temperature after the call, next date chosen).
--   3. call_settings  — one row per account: calling days + hours,
--                       daily / weekly targets, the editable outcome
--                       list with its rescheduling rules, and extra tag
--                       suggestions. Seeded with defaults below.
--
-- Additive only: no existing table is altered. Account-scoped RLS,
-- same tenancy model as quick_replies (035): any member reads,
-- agent+ writes. Dates in next_call_date are Africa/Kampala local
-- dates (the app computes them).
-- ============================================================

-- 1. Leads ----------------------------------------------------
CREATE TABLE IF NOT EXISTS call_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Author / audit only.
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Optional link to a CRM contact (e.g. once the lead is on WhatsApp).
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  business_name TEXT NOT NULL,
  contact_person TEXT,
  -- Stored normalised (+256… for Ugandan numbers) by the app.
  phone TEXT,
  phone_normalized TEXT GENERATED ALWAYS AS (regexp_replace(coalesce(phone, ''), '\D', '', 'g')) STORED,
  email TEXT,
  website TEXT,
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  industry TEXT,
  town TEXT,
  address TEXT,
  maps_url TEXT,
  -- 'google_places' | 'ai_web' | 'csv' | 'manual'
  source TEXT NOT NULL DEFAULT 'manual',
  -- Short "why this is a lead" note.
  lead_note TEXT,
  -- 0–100, higher is called first.
  priority INTEGER NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  tags TEXT[] NOT NULL DEFAULT '{}',

  -- NULL = never called ("New").
  temperature TEXT CHECK (temperature IN ('cold', 'warm', 'hot', 'won', 'lost', 'dnc')),
  last_outcome TEXT,
  last_remark TEXT,
  last_called_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  -- Consecutive unanswered calls; drives the "park after N" rule.
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  -- NULL = not in the call queue.
  next_call_date DATE,
  phone_invalid BOOLEAN NOT NULL DEFAULT FALSE,
  do_not_call BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_leads_account_next
  ON call_leads(account_id, next_call_date);
CREATE INDEX IF NOT EXISTS idx_call_leads_account_name_town
  ON call_leads(account_id, lower(business_name), lower(coalesce(town, '')));
-- Authoritative phone de-dupe (the app also checks name + town).
CREATE UNIQUE INDEX IF NOT EXISTS uq_call_leads_account_phone
  ON call_leads(account_id, phone_normalized)
  WHERE phone_normalized <> '';

ALTER TABLE call_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS call_leads_select ON call_leads;
DROP POLICY IF EXISTS call_leads_insert ON call_leads;
DROP POLICY IF EXISTS call_leads_update ON call_leads;
DROP POLICY IF EXISTS call_leads_delete ON call_leads;
CREATE POLICY call_leads_select ON call_leads FOR SELECT
  USING (is_account_member(account_id));
CREATE POLICY call_leads_insert ON call_leads FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY call_leads_update ON call_leads FOR UPDATE
  USING (is_account_member(account_id, 'agent'));
CREATE POLICY call_leads_delete ON call_leads FOR DELETE
  USING (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON call_leads;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON call_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Call logs ------------------------------------------------
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES call_leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  called_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcome TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  remarks TEXT,
  temperature_after TEXT NOT NULL
    CHECK (temperature_after IN ('cold', 'warm', 'hot', 'won', 'lost', 'dnc')),
  next_call_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_lead ON call_logs(lead_id, called_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_account_called ON call_logs(account_id, called_at DESC);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS call_logs_select ON call_logs;
DROP POLICY IF EXISTS call_logs_insert ON call_logs;
DROP POLICY IF EXISTS call_logs_update ON call_logs;
DROP POLICY IF EXISTS call_logs_delete ON call_logs;
CREATE POLICY call_logs_select ON call_logs FOR SELECT
  USING (is_account_member(account_id));
CREATE POLICY call_logs_insert ON call_logs FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY call_logs_update ON call_logs FOR UPDATE
  USING (is_account_member(account_id, 'agent'));
CREATE POLICY call_logs_delete ON call_logs FOR DELETE
  USING (is_account_member(account_id, 'agent'));

-- 3. Calling settings -----------------------------------------
CREATE TABLE IF NOT EXISTS call_settings (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  -- ISO weekdays: 1 = Monday … 7 = Sunday.
  call_days SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5}',
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '17:00',
  daily_target INTEGER NOT NULL DEFAULT 20 CHECK (daily_target > 0),
  weekly_target INTEGER NOT NULL DEFAULT 100 CHECK (weekly_target > 0),
  failed_attempt_limit INTEGER NOT NULL DEFAULT 4 CHECK (failed_attempt_limit > 0),
  park_days INTEGER NOT NULL DEFAULT 30 CHECK (park_days > 0),
  -- Editable outcome list + rescheduling rule per outcome. Shape:
  -- [{ key, label, action: retry|pick_date|meeting|invalid|lost,
  --    days, temperature|null, failed, pickup }]
  outcomes JSONB NOT NULL,
  extra_tags TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE call_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS call_settings_select ON call_settings;
DROP POLICY IF EXISTS call_settings_insert ON call_settings;
DROP POLICY IF EXISTS call_settings_update ON call_settings;
CREATE POLICY call_settings_select ON call_settings FOR SELECT
  USING (is_account_member(account_id));
CREATE POLICY call_settings_insert ON call_settings FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY call_settings_update ON call_settings FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON call_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON call_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default settings + outcome tags for every existing account.
-- Mirrors DEFAULT_CALL_SETTINGS in src/lib/calling/defaults.ts (the
-- app also falls back to those when an account has no row yet).
INSERT INTO call_settings (account_id, outcomes, extra_tags)
SELECT a.id,
  '[
    {"key":"no_answer","label":"Did not pick up","action":"retry","days":2,"temperature":null,"failed":true,"pickup":false},
    {"key":"picked_no_talk","label":"Picked up – didn''t talk","action":"pick_date","days":1,"temperature":null,"failed":false,"pickup":true},
    {"key":"phone_off","label":"Phone didn''t go through / off","action":"retry","days":2,"temperature":null,"failed":true,"pickup":false},
    {"key":"wrong_number","label":"Wrong number","action":"invalid","days":0,"temperature":null,"failed":false,"pickup":false},
    {"key":"rude","label":"Very harsh / rude","action":"lost","days":0,"temperature":"lost","failed":false,"pickup":true},
    {"key":"call_back","label":"Call back later","action":"pick_date","days":1,"temperature":null,"failed":false,"pickup":true},
    {"key":"interested","label":"Interested – send info","action":"retry","days":3,"temperature":"warm","failed":false,"pickup":true},
    {"key":"meeting","label":"Meeting booked","action":"meeting","days":1,"temperature":"hot","failed":false,"pickup":true},
    {"key":"not_interested","label":"Not interested","action":"lost","days":0,"temperature":"lost","failed":false,"pickup":true},
    {"key":"has_solution","label":"Already has a solution","action":"retry","days":90,"temperature":"cold","failed":false,"pickup":true}
  ]'::jsonb,
  '{"Decision maker","Gatekeeper","Send WhatsApp","Price sensitive","Follow up by email"}'
FROM accounts a
ON CONFLICT (account_id) DO NOTHING;
