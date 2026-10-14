-- ============================================================
-- 042: Calls ↔ pipeline link
--
-- A call lead can point at the deal it became (call_leads.deal_id).
--   Calls → pipeline: the log-call API creates the deal when I mark a
--     lead Hot and tick "Add to pipeline", and moves the deal to
--     won / lost / open when a call changes the lead's temperature.
--   Pipeline → calls: the triggers below keep the lead in step when a
--     deal is created for the lead's contact, won, lost, reopened, or
--     dragged to a "Won…" / "Lost…" stage. Deleting the deal just
--     unlinks the lead (ON DELETE SET NULL).
--
-- Triggers run as the caller, so RLS still applies (agent+ on both
-- tables). Additive only.
-- ============================================================

ALTER TABLE call_leads
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_call_leads_deal ON call_leads(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_leads_contact ON call_leads(contact_id) WHERE contact_id IS NOT NULL;

-- 1. Deal won / lost / reopened / moved → lead temperature + queue.
CREATE OR REPLACE FUNCTION public.sync_call_lead_from_deal()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_stage TEXT;
  v_temp TEXT;
BEGIN
  -- Only react to direct edits, never to writes made by other triggers.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;

  SELECT lower(name) INTO v_stage FROM pipeline_stages WHERE id = NEW.stage_id;

  IF NEW.status = 'won' OR (NEW.status = 'open' AND v_stage LIKE 'won%') THEN
    v_temp := 'won';
  ELSIF NEW.status = 'lost' OR (NEW.status = 'open' AND v_stage LIKE 'lost%') THEN
    v_temp := 'lost';
  ELSE
    v_temp := 'hot';
  END IF;

  IF v_temp IN ('won', 'lost') THEN
    -- Closed: out of the call queue, record kept.
    UPDATE call_leads
       SET temperature = v_temp, next_call_date = NULL
     WHERE deal_id = NEW.id
       AND account_id = NEW.account_id
       AND NOT do_not_call
       AND (temperature IS DISTINCT FROM v_temp OR next_call_date IS NOT NULL);
  ELSE
    -- Reopened / moved back to an active stage: Hot again, back in
    -- the queue today unless a call is already scheduled.
    UPDATE call_leads
       SET temperature = 'hot',
           next_call_date = coalesce(next_call_date, (now() AT TIME ZONE 'Africa/Kampala')::date)
     WHERE deal_id = NEW.id
       AND account_id = NEW.account_id
       AND NOT do_not_call
       AND temperature IN ('won', 'lost');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_sync_call_lead ON deals;
CREATE TRIGGER deals_sync_call_lead
  AFTER UPDATE OF status, stage_id ON deals
  FOR EACH ROW EXECUTE FUNCTION public.sync_call_lead_from_deal();

-- 2. Deal added on the pipeline for a contact that is also a call
--    lead → link them, so the lead shows the deal and vice versa.
CREATE OR REPLACE FUNCTION public.link_call_lead_to_new_deal()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    UPDATE call_leads
       SET deal_id = NEW.id
     WHERE account_id = NEW.account_id
       AND contact_id = NEW.contact_id
       AND deal_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_link_call_lead ON deals;
CREATE TRIGGER deals_link_call_lead
  AFTER INSERT ON deals
  FOR EACH ROW EXECUTE FUNCTION public.link_call_lead_to_new_deal();
