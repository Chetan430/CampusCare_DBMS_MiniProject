-- Dashboard views: joins, grouping, aggregates, HAVING, sorting.
CREATE OR REPLACE VIEW technician_workload AS
SELECT u.id AS technician_id, u.name AS technician_name,
       COUNT(t.id)::integer AS open_tickets
FROM users u
LEFT JOIN assignments a ON a.technician_id = u.id AND a.unassigned_at IS NULL
LEFT JOIN tickets t ON t.id = a.ticket_id AND t.status NOT IN ('resolved', 'closed')
WHERE u.role = 'technician'
GROUP BY u.id, u.name;

CREATE OR REPLACE VIEW sla_breach_report AS
SELECT t.id, t.title, c.name AS category, l.building, t.status,
       t.sla_due_at,
       ROUND((EXTRACT(EPOCH FROM (now() - t.sla_due_at)) / 3600)::numeric, 2)::double precision AS overdue_hours
FROM tickets t
JOIN categories c ON c.id = t.category_id
JOIN locations l ON l.id = t.location_id
WHERE t.status NOT IN ('resolved', 'closed') AND t.sla_due_at < now();

CREATE OR REPLACE VIEW recurring_issue_hotspots AS
SELECT l.building, c.name AS category, COUNT(t.id)::integer AS ticket_count
FROM tickets t
JOIN locations l ON l.id = t.location_id
JOIN categories c ON c.id = t.category_id
GROUP BY l.building, c.name
HAVING COUNT(t.id) > 1;
