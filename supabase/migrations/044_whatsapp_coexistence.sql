-- ============================================================
-- 044: WhatsApp Business app coexistence
--
-- A number connected through Embedded Signup's Business-app flow keeps
-- working in the WhatsApp Business app on the phone while Argon CRM uses
-- it through the Cloud API. These columns record how the number was
-- connected and the one-time contacts / history sync. Additive only;
-- existing (manually configured) rows keep NULL connection_type.
-- ============================================================

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS connection_type TEXT,
  ADD COLUMN IF NOT EXISTS meta_business_id TEXT,
  ADD COLUMN IF NOT EXISTS contacts_sync_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS history_sync_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS history_sync_progress INT,
  ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_config_connection_type_check'
      AND conrelid = 'whatsapp_config'::regclass
  ) THEN
    ALTER TABLE whatsapp_config
      ADD CONSTRAINT whatsapp_config_connection_type_check
      CHECK (connection_type IS NULL OR connection_type IN ('manual', 'coexistence'));
  END IF;
END $$;
