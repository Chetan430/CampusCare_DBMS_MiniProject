# CampusCare — Level 3 Clean Final Edition

A full Next.js + Prisma + PostgreSQL/pgvector maintenance-management mini-project with requester, technician, and admin dashboards. This edition **does not reuse the broken legacy database**. It creates a separate `campuscare_final` database with consistent PostgreSQL **UUID** IDs and a dedicated login. The existing `campuscare` database and its data are preserved.

## Fast setup — Windows (recommended)

1. Extract this ZIP to your Desktop. Keep Docker Desktop open and ensure at least 3 GB free disk space. Do not delete your previous project until this one is working.
2. Open the extracted `campuscare` folder and double-click **`SETUP_WINDOWS.cmd`**. This installs packages, creates a fresh database, applies the schema/pgvector/triggers/views, seeds accounts and runs a rollback-only database smoke test.
3. After it says **SUCCESS**, double-click **`START_WINDOWS.cmd`**.
4. Open **http://localhost:3100/login**.

Alternatively, open CMD inside `campuscare` and run:

```cmd
npm install
npm run setup:fresh
npm run dev
```

> If you already have `campuscare-db` running, setup uses that same Docker container, but creates a NEW database named `campuscare_final`. If no container exists, setup starts the included Docker Compose service. You do not need to manually copy `.env`, run `prisma db pull`, or use `prisma migrate`.

**Setup must complete successfully before opening the website.** The script creates `.env` automatically and uses port **3100**, avoiding collisions with older apps on 3000/3001. Do not overwrite the generated `.env` with the old project's `.env`.

### Demo logins

Password: **`password123`** (local demo only; configurable in `.env` before re-seeding).

| Role | Email |
|---|---|
| Requester | `student1@campuscare.edu` |
| Admin | `admin@campuscare.edu` |
| Electrical technician | `tech.electrical@campuscare.edu` |
| IT technician | `tech.it@campuscare.edu` |
| Facilities technician | `tech.facilities@campuscare.edu` |

### Ticket test

Sign in as the requester and submit:

- Title: `Fan not working in classroom 217`
- Description: `The ceiling fan in classroom 217 does not rotate when switched on.`
- Category: `Electrical` (choose suggestion)
- Building: `Academic Block A` (free text)
- Floor: `2`; Room: `217`; Priority: `medium`

The app should display a ticket ID and increment **My tickets**. A vector failure cannot roll back a successfully saved ticket. To verify the database:

```cmd
docker exec campuscare-db psql -U postgres -d campuscare_final -c "SELECT title,status,created_at,vector_dims(description_embedding) AS dimensions FROM tickets ORDER BY created_at DESC LIMIT 5;"
```

### Advanced DBMS / Level 3 features

- **Relational model** with UUID primary/foreign keys, enum roles/status/priority, unique and CHECK constraints.
- **DDL**: Prisma `db push` creates schema; SQL scripts add extension, partial unique index, HNSW index, triggers, functions, and views.
- **DML/queries**: insert ticket, update lifecycle, delete feedback, JOIN/GROUP BY/HAVING, nested and correlated queries in `sql/004_demonstration_queries.sql`.
- **Triggers**: SLA deadline on insert; audit row on status change.
- **Stored function**: skill-aware, least-loaded technician assignment.
- **Views**: workload, SLA breaches, recurring issue hotspots.
- **pgvector**: 384-dimensional cosine similarity and HNSW index. Ticket embeddings are tagged by provider to avoid comparing incompatible vectors.
- **Transactions**: status changes, assignments, vector updates and similarity links; rollback-only integration smoke test.
- **Authentication**: NextAuth credentials + bcrypt, role-aware dashboards and API access checks.

### MiniLM and offline behavior

By default `EMBEDDING_MODE=auto` tries the MiniLM 384D model, then falls back to a **local lexical 384D vector** if the model cannot initialize within 8 seconds. The fallback still uses pgvector, but is **not a MiniLM semantic embedding**. Vectors from different providers are never compared. To prepare true MiniLM semantic matching:

```cmd
npm run embeddings:check
```

Then, if desired, set `EMBEDDING_MODE="minilm"` in `.env` and restart the server. `EMBEDDING_MODE="lexical"` skips all model downloads and gives fast offline matching. Even if vector processing fails, the requester ticket is saved and an informative warning is shown.

### Verification commands

```cmd
npm run check:db
npm run smoke:test
```

`smoke:test` runs actual database operations in a transaction and intentionally rolls them back. It verifies ticket insert, SLA trigger, 384D vector insert, auto-assignment, audit history, and feedback. It does not leave extra tickets.

**Do not claim live verification until the setup/smoke test passes on your laptop.** The project was statically reviewed in the packaging environment, which did not have Docker/PostgreSQL or npm registry access.

### Troubleshooting

- `operator does not exist: text = uuid`: You are using the OLD database. Run `npm run setup:fresh` and verify `npm run check:db` prints database `campuscare_final` and UUID IDs. Do not use `prisma db pull`.
- `@prisma/client did not initialize`: Stop the dev server, run `npx prisma generate`, restart.
- `Port 3000 in use`: This edition uses port **3100**, so open **http://localhost:3100**.
- `No space left on device`: Free 3+ GB on C: and retry `npm install`.
- `Docker not running`: Start Docker Desktop; rerun setup.
- `NEXTAUTH` sign-in error: Ensure the generated `.env` contains `NEXTAUTH_URL="http://localhost:3100"` and restart the server.
- `SyntaxError Unexpected end of JSON input` in Next.js lockfile patcher: Can be caused by an invalid/empty lockfile. The source package contains no generated `.next` or `node_modules`; a clean `npm install` is required.

### Contents

- `app/` — Next.js pages, dashboards and APIs
- `prisma/schema.prisma` — normalized relational schema with UUIDs and pgvector
- `prisma/seed.ts` — five demo users, categories, locations and example tickets
- `lib/tickets.ts` — save-first submission, vector matching, assignment and status transactions
- `scripts/setup-fresh.mjs` — safe fresh database setup (never drops legacy DB)
- `scripts/smoke-test.ts` — rollback-only real DB test
- `sql/001...004` — constraints/indexes, functions/triggers, views, queries
- `docs/` — ER diagram, architecture, report draft and demo runbook

**Security:** Demo passwords and database credentials are for local development only. Do not expose this app publicly with demo accounts or commit `.env` to GitHub.
