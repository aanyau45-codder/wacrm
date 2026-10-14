-- ============================================================
-- 041: Lead search keys per account
--
-- Stores the Google Places API key used by Calls → Find leads.
-- The key is AES-256-GCM encrypted by the server (same as the AI and
-- WhatsApp keys) and never returned to the browser; the API only
-- reports whether one is set. Additive only.
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_source_keys (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  google_places_api_key TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lead_source_keys ENABLE ROW LEVEL SECURITY;

-- Members read (the search route runs as the calling agent); only
-- admins can set or remove the key.
DROP POLICY IF EXISTS lead_source_keys_select ON lead_source_keys;
CREATE POLICY lead_source_keys_select ON lead_source_keys FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS lead_source_keys_insert ON lead_source_keys;
CREATE POLICY lead_source_keys_insert ON lead_source_keys FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS lead_source_keys_update ON lead_source_keys;
CREATE POLICY lead_source_keys_update ON lead_source_keys FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS lead_source_keys_delete ON lead_source_keys;
CREATE POLICY lead_source_keys_delete ON lead_source_keys FOR DELETE
  USING (is_account_member(account_id, 'admin'));
