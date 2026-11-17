import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const [db, types, tickets, categories, users, ext, triggers] = await Promise.all([
    prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database()`,
    prisma.$queryRaw<{ table_name: string; data_type: string }[]>`
      SELECT table_name, data_type FROM information_schema.columns
      WHERE column_name = 'id' AND table_name IN ('users', 'tickets', 'categories', 'locations')
      ORDER BY table_name`,
    prisma.ticket.count(), prisma.category.count(), prisma.user.count(),
    prisma.$queryRaw<{ extname: string }[]>`SELECT extname FROM pg_extension WHERE extname='vector'`,
    prisma.$queryRaw<{ tgname: string }[]>`SELECT tgname FROM pg_trigger WHERE tgrelid='tickets'::regclass AND NOT tgisinternal`,
  ]);
  console.log("Database:", db[0]?.current_database);
  console.log("Primary-key types:", types);
  console.log("Records: tickets", tickets, "/ categories", categories, "/ users", users);
  console.log("pgvector:", ext.map((e) => e.extname));
  console.log("Ticket triggers:", triggers.map((t) => t.tgname));
  if (db[0]?.current_database !== "campuscare_final" || types.length !== 4 || types.some((t) => t.data_type !== "uuid") || !ext.length || triggers.length < 2) {
    throw new Error("Database is not the clean CampusCare schema; rerun npm run setup:fresh");
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
