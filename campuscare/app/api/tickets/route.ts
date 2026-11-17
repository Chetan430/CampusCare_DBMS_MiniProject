import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTicketWithEmbedding } from "@/lib/tickets";
import { z } from "zod";

export const runtime = "nodejs";

const createSchema = z.object({
  categoryName: z.string().trim().min(1).max(120),
  building: z.string().trim().min(1).max(120),
  floor: z.string().trim().max(40).optional(),
  roomNo: z.string().trim().max(40).optional(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(4000),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});

function errorText(err: unknown, fallback: string) {
  if (process.env.NODE_ENV !== "production" && err instanceof Error) return `${fallback}: ${err.message}`;
  return fallback;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized; please log in again." }, { status: 401 });
  const { id, role } = session.user as any;
  if (!["admin", "requester", "technician"].includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const where = role === "requester" ? { requesterId: id } :
      role === "technician" ? { assignments: { some: { technicianId: id, unassignedAt: null } } } : {};
    const tickets = await prisma.ticket.findMany({
      where, include: { category: true, location: true, assignments: true, feedback: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(tickets, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[CampusCare] GET /api/tickets failed:", err);
    return NextResponse.json({ error: errorText(err, "Could not load tickets") }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id) return NextResponse.json({ error: "Your session expired; please log in again." }, { status: 401 });
  if (user.role !== "requester") return NextResponse.json({ error: "Requester access required" }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") }, { status: 400 });
  }
  try {
    const category = await prisma.category.findFirst({
      where: { name: { equals: parsed.data.categoryName, mode: "insensitive" } },
    });
    if (!category) return NextResponse.json({ error: "Unknown category name. Choose a suggested category." }, { status: 400 });
    const { building, floor, roomNo, title, description, priority } = parsed.data;
    const location = await prisma.location.findFirst({ where: {
      building: { equals: building, mode: "insensitive" },
      floor: floor || null, roomNo: roomNo || null,
    } });
    const savedLocation = location ?? await prisma.location.create({
      data: { building, floor: floor || null, roomNo: roomNo || null },
    });
    const data = await createTicketWithEmbedding({
      requesterId: user.id, categoryId: category.id, locationId: savedLocation.id,
      title, description, priority,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[CampusCare] POST /api/tickets failed:", err);
    return NextResponse.json({
      error: errorText(err, "Could not create ticket; check the terminal for the PostgreSQL or pgvector error"),
    }, { status: 500 });
  }
}
