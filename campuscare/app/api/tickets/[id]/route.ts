import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateTicketStatus } from "@/lib/tickets";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum(["in_progress", "resolved", "reopened", "closed"]),
  note: z.string().trim().max(1000).optional(),
});
const validId = (id: string) => z.string().uuid().safeParse(id).success;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!validId(params.id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  const ticket = await prisma.ticket.findUnique({ where: { id: params.id }, include: {
    category: true, location: true,
    assignments: { include: { technician: { select: { id: true, name: true, email: true } } } },
    history: { orderBy: { changedAt: "asc" } }, feedback: true,
    duplicatesOf: { include: { similarTicket: { select: { id: true, title: true, status: true } } } },
  } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id, role } = session.user as any;
  const owner = ticket.requesterId === id;
  const activeTechnician = ticket.assignments.some((a) => a.technicianId === id && !a.unassignedAt);
  if (role !== "admin" && !owner && !activeTechnician) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(ticket);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const { id, role } = (session?.user ?? {}) as any;
  if (!id || !["technician", "admin"].includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!validId(params.id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  const parsed = statusSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id }, include: { assignments: { where: { unassignedAt: null } } },
  });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role === "technician" && !ticket.assignments.some((a) => a.technicianId === id)) {
    return NextResponse.json({ error: "Not assigned to this ticket" }, { status: 403 });
  }
  if (role === "technician" && ["closed", "reopened"].includes(parsed.data.status)) {
    return NextResponse.json({ error: "Admin must reopen or close a ticket" }, { status: 403 });
  }
  try {
    const updated = await updateTicketStatus(params.id, parsed.data.status, id, parsed.data.note);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Status update failed" }, { status: 409 });
  }
}
