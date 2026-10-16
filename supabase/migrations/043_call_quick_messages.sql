-- ============================================================
-- 043: Quick WhatsApp messages for Calls
--
-- Saved message texts the lead sheet offers as one-tap WhatsApp links
-- ({name} and {business} are filled in per lead). NULL means "use the
-- built-in defaults". Additive only.
-- ============================================================

ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS quick_messages TEXT[];
