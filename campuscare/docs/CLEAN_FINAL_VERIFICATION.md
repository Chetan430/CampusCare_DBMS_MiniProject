# Clean-final change log and verification

## Root cause avoided
The legacy database used a mix of TEXT and UUID identifiers, leading to PostgreSQL `42883: operator does not exist: text = uuid` during ticket creation. Merely changing a raw SQL comparison did not correct the schema/trigger mismatch.

## Corrective approach
1. Fresh database `campuscare_final`, separate dedicated role `campuscare_final_user` and randomly generated password. The old `campuscare` database and postgres password are untouched.
2. Prisma creates all PK/FK IDs as UUID, verified against `information_schema` before SQL triggers are applied.
3. pgvector extension installed **before** Prisma schema push; Prisma models the vector column as `Unsupported("vector(384)")` so future pushes do not remove it.
4. Ticket row is committed first. MiniLM/lexical embedding and similarity are performed afterwards in a separate transaction. If vector matching fails, the requester still receives a successfully saved ticket and warning.
5. Embedding provider tag prevents mixing MiniLM and lexical vectors.
6. Automated integration smoke test verifies ticket INSERT, SLA trigger, vector update, stored auto-assignment function, audit trigger, and feedback; all test writes roll back.
7. Dev port 3100 and matching NEXTAUTH_URL avoid confusion with old instances on ports 3000 and 3001.

## Evidence to capture on your laptop

Run `npm run setup:fresh` and save the final `SUCCESS` output. Run `npm run smoke:test` and save the PASS output. Submit a real request as `student1@campuscare.edu`; capture success message and increased ticket count. Query the `campuscare_final` database for the new row and `vector_dims(description_embedding) = 384`. Demonstrate admin assignment, technician status updates, feedback, and SQL views.

**Packaging environment limitation:** No Docker daemon/PostgreSQL server and no npm registry access; these live checks are provided for execution on your laptop, not falsely reported as passed in the packaging environment.
