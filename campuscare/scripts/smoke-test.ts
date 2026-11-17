/**
 * Real database integration smoke test. Every test write is rolled back.
 * Checks ticket creation, SLA trigger, pgvector, auto assignment, audit
 * triggers and feedback, with no demo tickets left behind.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
class ExpectedRollback extends Error {}

async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      const [student, admin, tech, category, location] = await Promise.all([
        tx.user.findUniqueOrThrow({ where: { email: "student1@campuscare.edu" } }),
        tx.user.findUniqueOrThrow({ where: { email: "admin@campuscare.edu" } }),
        tx.user.findUniqueOrThrow({ where: { email: "tech.electrical@campuscare.edu" } }),
        tx.category.findUniqueOrThrow({ where: { name: "Electrical" } }),
        tx.location.findFirstOrThrow({ where: { building: "Block A" } }),
      ]);
      const ticket = await tx.ticket.create({ data: {
        requesterId: student.id, categoryId: category.id, locationId: location.id,
        title: "Smoke test fan request", description: "The ceiling fan in classroom is not working.",
        priority: "medium",
      } });
      if (!ticket.slaDueAt) throw new Error("SLA trigger did not populate sla_due_at");
      const vector = `[1,${new Array(383).fill(0).join(",")}]`;
      await tx.$executeRaw`UPDATE tickets SET description_embedding = ${vector}::vector, embedding_source = 'lexical' WHERE id = ${ticket.id}::uuid`;
      const dimensions = await tx.$queryRaw<{ n: number }[]>`
        SELECT vector_dims(description_embedding)::int AS n FROM tickets WHERE id = ${ticket.id}::uuid`;
      if (dimensions[0]?.n !== 384) throw new Error("pgvector 384D insert/query failed");
      const assigned = await tx.$queryRaw<{ assignment_id: string }[]>`
        SELECT auto_assign_technician(${ticket.id}::uuid, ${admin.id}::uuid) AS assignment_id`;
      if (!assigned[0]?.assignment_id) throw new Error("Auto assignment did not return an ID");
      await tx.$queryRaw`SELECT set_config('app.actor_id', ${tech.id}, true)`;
      await tx.$queryRaw`SELECT set_config('app.status_note', 'Smoke test work', true)`;
      await tx.ticket.update({ where: { id: ticket.id }, data: { status: "in_progress" } });
      await tx.ticket.update({ where: { id: ticket.id }, data: { status: "resolved" } });
      const history = await tx.statusHistory.count({ where: { ticketId: ticket.id } });
      if (history !== 3) throw new Error(`Expected 3 status history entries, found ${history}`);
      await tx.feedback.create({ data: { ticketId: ticket.id, rating: 5, comment: "Verified" } });
      console.log("PASS: ticket insert, SLA trigger, pgvector(384), auto assignment, status audit, feedback");
      throw new ExpectedRollback("Rollback smoke-test data");
    }, { timeout: 30000 });
    throw new Error("Smoke test should have rolled back");
  } catch (error) {
    if (error instanceof ExpectedRollback) {
      console.log("PASS: all smoke-test writes rolled back; demo data is untouched.");
      return;
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((err) => { console.error("SMOKE TEST FAILED:", err); process.exitCode = 1; });
