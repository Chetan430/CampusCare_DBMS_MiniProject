-- 002: audit and SLA triggers, skill/workload aware auto-assignment.
-- Run after Prisma migration and 001_vector_and_indexes.sql.

-- The application sets these values transaction-locally (not globally) before
-- updates so the database audit identifies the true operator and optional note.
CREATE OR REPLACE FUNCTION fn_log_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  actor UUID;
  audit_note TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    actor := COALESCE(
      NULLIF(current_setting('app.actor_id', TRUE), '')::uuid,
      NEW.requester_id
    );
    audit_note := NULLIF(current_setting('app.status_note', TRUE), '');

    IF NEW.status = 'resolved' AND NEW.resolved_at IS NULL THEN
      NEW.resolved_at := now();
    ELSIF NEW.status IN ('open', 'assigned', 'in_progress', 'reopened') THEN
      NEW.resolved_at := NULL;
    END IF;

    INSERT INTO status_history
      (id, ticket_id, changed_by, old_status, new_status, changed_at, note)
    VALUES
      (gen_random_uuid(), NEW.id, actor, OLD.status, NEW.status, now(), audit_note);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_status_change ON tickets;
CREATE TRIGGER trg_log_status_change
  BEFORE UPDATE OF status ON tickets
  FOR EACH ROW EXECUTE FUNCTION fn_log_status_change();

CREATE OR REPLACE FUNCTION fn_set_sla_due()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  hrs INTEGER;
BEGIN
  SELECT default_sla_hours INTO hrs
  FROM categories WHERE id = NEW.category_id;
  hrs := COALESCE(hrs, 48);
  NEW.sla_due_at := COALESCE(NEW.created_at, now()) + make_interval(hours => hrs);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_sla_due ON tickets;
CREATE TRIGGER trg_set_sla_due
  BEFORE INSERT ON tickets
  FOR EACH ROW EXECUTE FUNCTION fn_set_sla_due();

-- PostgreSQL function (not a CREATE PROCEDURE): one call executes assignment
-- and ticket status update in a single database transaction.
CREATE OR REPLACE FUNCTION auto_assign_technician(p_ticket_id UUID, p_assigned_by UUID)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_category_name TEXT;
  v_status "TicketStatus";
  v_technician_id UUID;
  v_assignment_id UUID;
BEGIN
  SELECT c.name, t.status INTO v_category_name, v_status
  FROM tickets t JOIN categories c ON c.id = t.category_id
  WHERE t.id = p_ticket_id FOR UPDATE OF t;

  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found'; END IF;
  IF v_status NOT IN ('open', 'reopened') THEN
    RAISE EXCEPTION 'Only open or reopened tickets can be assigned';
  END IF;
  IF EXISTS (SELECT 1 FROM assignments WHERE ticket_id = p_ticket_id AND unassigned_at IS NULL) THEN
    RAISE EXCEPTION 'Ticket already has an active assignment';
  END IF;

  SELECT u.id INTO v_technician_id
  FROM users u
  LEFT JOIN assignments a ON a.technician_id = u.id AND a.unassigned_at IS NULL
  LEFT JOIN tickets t ON t.id = a.ticket_id AND t.status NOT IN ('resolved', 'closed')
  WHERE u.role = 'technician' AND v_category_name = ANY(u.skill_tags)
  GROUP BY u.id
  ORDER BY COUNT(t.id) ASC, u.id ASC
  LIMIT 1;

  IF v_technician_id IS NULL THEN
    RAISE EXCEPTION 'No technician has the required skill: %', v_category_name;
  END IF;

  v_assignment_id := gen_random_uuid();
  INSERT INTO assignments (id, ticket_id, technician_id, assigned_by, assigned_at)
  VALUES (v_assignment_id, p_ticket_id, v_technician_id, p_assigned_by, now());
  PERFORM set_config('app.actor_id', p_assigned_by::text, TRUE);
  PERFORM set_config('app.status_note', 'Automatically assigned', TRUE);
  UPDATE tickets SET status = 'assigned' WHERE id = p_ticket_id;
  RETURN v_assignment_id;
END;
$$;
