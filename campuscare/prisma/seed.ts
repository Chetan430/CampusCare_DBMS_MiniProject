import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();
const pwd = process.env.DEMO_PASSWORD || "password123";
const categories = [
  { id: "10000000-0000-4000-8000-000000000001", name: "Electrical", defaultSlaHours: 4 },
  { id: "10000000-0000-4000-8000-000000000002", name: "Plumbing", defaultSlaHours: 24 },
  { id: "10000000-0000-4000-8000-000000000003", name: "IT", defaultSlaHours: 12 },
  { id: "10000000-0000-4000-8000-000000000004", name: "Housekeeping", defaultSlaHours: 48 },
  { id: "10000000-0000-4000-8000-000000000005", name: "Carpentry", defaultSlaHours: 48 },
];
const locations = [
  { id: "20000000-0000-4000-8000-000000000001", building: "Block A", floor: "2", roomNo: "214", locationType: "Classroom" },
  { id: "20000000-0000-4000-8000-000000000002", building: "Block A", floor: "2", roomNo: "215", locationType: "Classroom" },
  { id: "20000000-0000-4000-8000-000000000003", building: "Hostel B", floor: "1", roomNo: "108", locationType: "Dorm" },
  { id: "20000000-0000-4000-8000-000000000004", building: "Library", floor: "G", roomNo: null, locationType: "Common" },
];
async function main() {
  for (const c of categories) await prisma.category.upsert({ where: { id: c.id }, create: c, update: { name: c.name, defaultSlaHours: c.defaultSlaHours } });
  for (const l of locations) await prisma.location.upsert({ where: { id: l.id }, create: l, update: l });
  const passwordHash = await bcrypt.hash(pwd, 12);
  const users = [
    { id: "30000000-0000-4000-8000-000000000001", name: "Campus Admin", email: "admin@campuscare.edu", role: "admin" as const, skillTags: [] },
    { id: "30000000-0000-4000-8000-000000000002", name: "Ravi Kumar", email: "tech.electrical@campuscare.edu", role: "technician" as const, skillTags: ["Electrical", "Carpentry"] },
    { id: "30000000-0000-4000-8000-000000000003", name: "Aisha Rao", email: "student1@campuscare.edu", role: "requester" as const, skillTags: [] },
    { id: "30000000-0000-4000-8000-000000000004", name: "Neha Patel", email: "tech.it@campuscare.edu", role: "technician" as const, skillTags: ["IT"] },
    { id: "30000000-0000-4000-8000-000000000005", name: "Imran Ali", email: "tech.facilities@campuscare.edu", role: "technician" as const, skillTags: ["Plumbing", "Housekeeping"] },
  ];
  for (const u of users) await prisma.user.upsert({
    where: { id: u.id }, create: { ...u, passwordHash },
    update: { name: u.name, role: u.role, skillTags: u.skillTags },
  });
  // Demo tickets are intentionally preloaded WITHOUT vectors. Newly created
  // tickets obtain MiniLM embeddings via the API; use those to demo similarity.
  const demos = [
    { id: "40000000-0000-4000-8000-000000000001", title: "Classroom fan is not running", description: "The ceiling fan in Block A room 214 stopped rotating.", categoryId: categories[0].id, locationId: locations[0].id, hoursAgo: 8 },
    { id: "40000000-0000-4000-8000-000000000002", title: "Ceiling fan making noise", description: "The fan in Block A room 215 creates a loud sound.", categoryId: categories[0].id, locationId: locations[1].id, hoursAgo: 3 },
    { id: "40000000-0000-4000-8000-000000000003", title: "Library Wi-Fi unstable", description: "Devices in the library repeatedly lose the wireless connection.", categoryId: categories[2].id, locationId: locations[3].id, hoursAgo: 2 },
  ];
  for (const item of demos) {
    const { hoursAgo, ...ticket } = item;
    await prisma.ticket.upsert({
      where: { id: ticket.id },
      update: {},
      create: {
        ...ticket, requesterId: users[2].id,
        createdAt: new Date(Date.now() - hoursAgo * 3600 * 1000),
      },
    });
  }
  console.log(`Seed complete: ${categories.length} categories, ${locations.length} locations, ${users.length} users, ${demos.length} demo tickets`);
  console.log("Demo emails: admin@campuscare.edu / tech.electrical@campuscare.edu / tech.it@campuscare.edu / tech.facilities@campuscare.edu / student1@campuscare.edu");
  console.log("Demo password: value of DEMO_PASSWORD (defaults to password123). Never use demo credentials in production.");
}
main().catch((err) => { console.error(err); process.exitCode = 1; }).finally(() => prisma.$disconnect());
