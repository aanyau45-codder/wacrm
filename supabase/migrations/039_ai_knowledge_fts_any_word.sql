-- ============================================================
-- 039_ai_knowledge_fts_any_word.sql — make lexical knowledge
--                                     retrieval actually match
--                                     conversational questions
--
-- The problem
--
--   `match_ai_knowledge_fts` (030 / 032) used
--   `plainto_tsquery('simple', p_query)`, which ANDs every word of
--   the customer's message and does no stemming or stop-word removal.
--   A chunk only matched if it contained *every* word verbatim, so a
--   real message like
--
--     "Oh really? Bakewise can't market?"
--
--   required 'oh' & 'really' & 'bakewise' & 'can' & 't' & 'market' —
--   and 'market' never matched a document that says 'marketing'. For
--   accounts without an embeddings key (lexical is their only path),
--   the knowledge base was effectively never retrieved for anything
--   but keyword-style questions, so the bot answered from its prompt
--   alone and could contradict the uploaded documents.
--
-- The fix
--
--   - Parse the query with the 'english' config (drops stop words,
--     stems: market / marketing / markets → 'market').
--   - OR the remaining terms instead of AND-ing them, so any shared
--     term is a candidate; ts_rank still orders chunks that share
--     more (and rarer-in-chunk) terms first.
--   - Compare against an 'english' tsvector of the chunk, backed by a
--     new expression GIN index. The stored 'simple' `fts` column is
--     left as is (other code may read it; dropping a generated column
--     is not worth the churn).
--
--   SECURITY INVOKER is kept from 032 (RLS governs `authenticated`
--   callers; the service-role bot bypasses it).
--
--   An all-stop-word query ("is it?") yields an empty tsquery, which
--   matches nothing — same as before.
-- ============================================================

CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_fts_english_idx
  ON ai_knowledge_chunks
  USING gin (to_tsvector('english', content));

CREATE OR REPLACE FUNCTION public.match_ai_knowledge_fts(
  p_account_id  uuid,
  p_query       text,
  p_match_count integer
)
RETURNS TABLE (id uuid, content text, rank real) AS $$
  WITH q AS (
    -- plainto_tsquery only emits '&' between terms; swapping to '|'
    -- turns "all words" into "any word".
    SELECT replace(plainto_tsquery('english', p_query)::text, '&', '|')::tsquery AS tsq
  )
  SELECT c.id,
         c.content,
         ts_rank(to_tsvector('english', c.content), q.tsq) AS rank
  FROM ai_knowledge_chunks c, q
  WHERE c.account_id = p_account_id
    AND to_tsvector('english', c.content) @@ q.tsq
  ORDER BY rank DESC
  LIMIT GREATEST(p_match_count, 0);
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public;

REVOKE ALL ON FUNCTION public.match_ai_knowledge_fts(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_ai_knowledge_fts(uuid, text, integer) TO authenticated, service_role;
