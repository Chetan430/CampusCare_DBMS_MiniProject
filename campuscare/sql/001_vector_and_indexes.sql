-- 001: PostgreSQL relational schema is created first by Prisma migrations.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS description_embedding vector(384);
CREATE INDEX IF NOT EXISTS tickets_embedding_hnsw_idx
  ON tickets USING hnsw (description_embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_tickets_status_category ON tickets (status, category_id);
CREATE INDEX IF NOT EXISTS idx_assignments_technician ON assignments (technician_id);
CREATE INDEX IF NOT EXISTS idx_tickets_requester ON tickets (requester_id);
-- A ticket may have reassignment history, but only ONE current assignment.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_assignment
  ON assignments (ticket_id) WHERE unassigned_at IS NULL;
-- Constraints demonstrate DB-side validation beyond API Zod validation.
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS chk_feedback_rating;
ALTER TABLE feedback ADD CONSTRAINT chk_feedback_rating CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE categories DROP CONSTRAINT IF EXISTS chk_sla_positive;
ALTER TABLE categories ADD CONSTRAINT chk_sla_positive CHECK (default_sla_hours > 0);
ALTER TABLE duplicate_links DROP CONSTRAINT IF EXISTS chk_distinct_duplicate;
ALTER TABLE duplicate_links ADD CONSTRAINT chk_distinct_duplicate CHECK (ticket_id <> similar_ticket_id);
ALTER TABLE duplicate_links DROP CONSTRAINT IF EXISTS chk_similarity_range;
ALTER TABLE duplicate_links ADD CONSTRAINT chk_similarity_range CHECK (similarity_score >= 0 AND similarity_score <= 1);
