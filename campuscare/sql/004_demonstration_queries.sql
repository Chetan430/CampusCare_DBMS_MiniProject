-- Run in psql AFTER setup and seed. Use real UUIDs where indicated.
-- Section 7.1: simple query, join, GROUP BY, HAVING and ORDER BY.
SELECT c.name, COUNT(t.id)::int AS ticket_count
FROM categories c LEFT JOIN tickets t ON t.category_id = c.id
GROUP BY c.id, c.name ORDER BY ticket_count DESC;
SELECT l.building, COUNT(*)::int AS issue_count
FROM tickets t JOIN locations l ON l.id = t.location_id
GROUP BY l.building HAVING COUNT(*) >= 2 ORDER BY issue_count DESC;
-- Section 7.4: correlated query: tickets exceeding their category's volume average.
SELECT t.id, t.title, c.name AS category
FROM tickets t JOIN categories c ON c.id = t.category_id
WHERE (SELECT COUNT(*) FROM tickets x WHERE x.category_id = t.category_id) >
      (SELECT AVG(issue_count) FROM (SELECT COUNT(*) AS issue_count FROM tickets GROUP BY category_id) z);
-- Section 7.5: nested query: requesters with at least one unresolved ticket.
SELECT name, email FROM users WHERE id IN (
  SELECT requester_id FROM tickets WHERE status NOT IN ('resolved', 'closed')
);
-- Advanced features / vector retrieval; populate ticket embeddings first:
SELECT id, title FROM tickets WHERE description_embedding IS NOT NULL
ORDER BY description_embedding <=> (SELECT description_embedding FROM tickets
  WHERE description_embedding IS NOT NULL ORDER BY created_at LIMIT 1)
LIMIT 5;
-- Section 7.2 UPDATE and 7.3 DELETE performed safely in an always-rolled-back demo.
BEGIN;
UPDATE categories SET default_sla_hours = default_sla_hours + 1 WHERE name = 'Electrical';
SELECT name, default_sla_hours FROM categories WHERE name = 'Electrical';
-- DELETE a temporary database row only, never a real user ticket.
INSERT INTO locations (id, building, floor) VALUES (gen_random_uuid(), 'DEMO_DELETE_ONLY', 'G');
DELETE FROM locations WHERE building = 'DEMO_DELETE_ONLY';
-- Demonstrate DDL: CREATE, ALTER, DROP without permanently altering project schema.
CREATE TABLE level3_ddl_demo (id INT PRIMARY KEY);
ALTER TABLE level3_ddl_demo ADD COLUMN example TEXT;
DROP TABLE level3_ddl_demo;
ROLLBACK;
-- Show actual stored function and triggers in pgAdmin or psql:
SELECT tgname FROM pg_trigger WHERE tgrelid = 'tickets'::regclass AND NOT tgisinternal;
SELECT * FROM technician_workload;
SELECT * FROM sla_breach_report;
SELECT * FROM recurring_issue_hotspots;
