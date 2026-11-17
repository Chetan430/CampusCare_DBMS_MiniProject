# CampusCare — 8–12 Minute Level 3 Demonstration & Evidence Checklist

This checklist is a **test plan, not a claim that tests already passed**. Prepare screenshots with a running PostgreSQL database and Next.js app. Roles: admin, requester, technician.

## Preparation (before faculty arrives)

- [ ] Run `npm run setup:fresh` successfully (includes UUID schema, SQL scripts and rollback-only smoke test).
- [ ] `npm run seed` completed; Next.js starts; Chrome can log in.
- [ ] For genuine MiniLM semantic demo, run `npm run embeddings:check` with internet before presenting; otherwise the project transparently uses lexical pgvector fallback.
- [ ] Two real newly created similar tickets available for semantic comparison.
- [ ] pgAdmin or `psql` open and connected to the **new** `campuscare_final` database (NOT the old `campuscare` database).
- [ ] 3 dashboards, 2 sample status changes, overdue SLA and stored SQL/view results captured.
- [ ] Replace bracketed placeholders in the report; add team GitHub URL, individual contributions, and real screenshots.

## Live walkthrough

| Time | Action | DBMS evidence |
|---|---|---|
| 0:00–1:00 | Explain the missing central record for campus complaints, roles, and outcome | Problem statement + architecture |
| 1:00–2:00 | Show ER diagram: 8 relational tables; PK/FK, one-to-many, 1:1 feedback, self-reference | `docs/ER_DIAGRAM.png`, `prisma/schema.prisma` |
| 2:00–3:00 | Login as requester; enter category name from suggestions and location name, then file new ticket | `INSERT tickets`, `BEFORE INSERT` SLA trigger, `SELECT` query |
| 3:00–4:00 | Create another ticket with related wording; show duplicate suggestion and similarity | MiniLM (384-d) if model is loaded; otherwise lexical 384D fallback (not semantic), pgvector cosine `<=>`, HNSW |
| 4:00–5:30 | Login admin; show open tickets, SLA breach view and hotspots; auto-assign an electrical ticket | JOIN/aggregate views, workload-aware SQL function, transaction |
| 5:30–6:30 | Log in as technician; start work, resolve ticket | `UPDATE tickets`; history audit trigger and transaction-local actor |
| 6:30–7:30 | Login requester; see resolved ticket, rate it and remove rating to show DELETE | Feedback with 1–5 `CHECK`, `UNIQUE` ticket_id |
| 7:30–9:30 | Run SQL demo query pack in psql (including GROUP BY, HAVING, correlated/nested, demo UPDATE/DELETE/DDL rollback), show indexes/triggers | Database course requirements |
| 9:30–10:30 | Show test results, team contributions and future scope | Evidence checklist + report |

## SQL to capture (psql)

```sql
\dt
\d tickets
\d assignments
SELECT * FROM technician_workload;
SELECT * FROM sla_breach_report;
SELECT * FROM recurring_issue_hotspots;
SELECT tgname FROM pg_trigger WHERE tgrelid = 'tickets'::regclass AND NOT tgisinternal;
SELECT id, title, created_at, sla_due_at FROM tickets ORDER BY created_at DESC LIMIT 6;
SELECT ticket_id, old_status, new_status, changed_by, changed_at FROM status_history ORDER BY changed_at DESC LIMIT 6;
SELECT id, title, vector_dims(description_embedding) AS dimensions FROM tickets WHERE description_embedding IS NOT NULL;
SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('tickets','assignments');
```

Run **`sql/004_demonstration_queries.sql`** for query examples. Its INSERT/UPDATE/DELETE/CREATE/ALTER/DROP examples are wrapped in `BEGIN`/`ROLLBACK` and should not leave permanent changes.

## Test cases to execute / record

| ID | Steps | Expected result | Actual result |
|---|---|---|---|
| TC01 | Log in using each of the three role accounts | Redirect to own dashboard | [Capture pass/fail] |
| TC02 | Requester submits missing title or nonexisting category | Form rejects/HTTP 400 | [Capture pass/fail] |
| TC03 | Requester creates valid electrical ticket | Record inserted, SLA = created_at + category hours | [Capture pass/fail] |
| TC04 | Two semantically close newly created open tickets | Potential duplicate surfaced at threshold 0.8 if score qualifies; verify embedding_source for MiniLM vs lexical | [Capture score/result] |
| TC05 | Admin auto-assigns open electrical ticket | Qualified least-loaded technician + status assigned | [Capture pass/fail] |
| TC06 | Admin attempts second assignment to same ticket | Rejected; partial unique index prevents multiple active assignments | [Capture pass/fail] |
| TC07 | Technician tries changing another technician's ticket via API | HTTP 403 | [Capture pass/fail] |
| TC08 | Technician starts then resolves own ticket | Status trigger creates exactly 1 row per change with actual actor ID | [Capture pass/fail] |
| TC09 | Requester rates resolved ticket | Rating stored, 1–5 DB CHECK; repeat updates existing feedback; remove invokes DELETE | [Capture pass/fail] |
| TC10 | Open ticket past SLA due time appears in SLA breach view | Overdue row appears with numeric overdue hours | [Capture pass/fail] |
| TC11 | Non-admin requests `/api/analytics` | HTTP 403 | [Capture pass/fail] |
| TC12 | DB CHECK test: insert feedback rating 6 in rolled-back txn | Rejected by PostgreSQL CHECK | [Capture pass/fail] |
| TC13 | Query pack DDL/DML demo | Runs and rolls back without modifying main data | [Capture pass/fail] |
| TC14 | At least 2 tickets in same building/category | Grouped hotspot appears | [Capture pass/fail] |

## Recommended screenshot slots for the report

1. Prisma-created SQL tables (`\dt` or pgAdmin)
2. Inserted seeded rows in `users`, `categories`, `locations`, `tickets` (never expose `password_hash`)
3. Requester form with **category name suggestions** and **location name entry**, ticket list
4. Similar-ticket warning after creating two vectorized tickets; note provider mode
5. Admin ticket table, workload, overdue and hotspot cards
6. Technician status controls and status history SQL result
7. DDL/constraints, example UPDATE/DELETE rollback, correlated/nested SQL query results
8. PostgreSQL trigger definition and stored function body, `vector_dims=384`

## Team contribution notes (fill from real Git commits)

- Team member 1: [actual responsibilities and commits]
- Team member 2: [actual responsibilities and commits]
- GitHub repository: [public or faculty-accessible repository URL]

**Never label an unexecuted test as passed or a design mock-up as a real screenshot.**

## Updated name-based form demo

As requester, type a valid category **name** from the suggestions (not its ID), then type a building/location name, floor and room. Submit a ticket and show that the database stores foreign-key UUIDs while the UI displays readable names. Demonstrate rejection of an unknown category name and reuse of an existing location.
