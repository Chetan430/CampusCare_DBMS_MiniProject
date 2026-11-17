import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { autoAssignTechnician } from "@/lib/tickets";
import { z } from "zod";

const assignSchema = z.object({ technicianId: z.string().uuid().optional() });
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (user?.role !== "admin") return NextResponse.json({ error: "Admin required" }, { status: 403 });
  if (!z.string().uuid().safeParse(params.id).success) return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
  const parsed = assignSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    if (!parsed.data.technicianId) {
      const assignmentId = await autoAssignTechnician(params.id, user.id);
      return NextResponse.json({ assignmentId }, { status: 201 });
    }
    const technicianId = parsed.data.technicianId;
    const result = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: params.id }, include: { category: true, assignments: { where: { unassignedAt: null } } } });
      if (!["open", "reopened"].includes(ticket.status) || ticket.assignments.length) throw new Error("Ticket is already assigned or not open");
      const technician = await tx.user.findUnique({ where: { id: technicianId } });
      if (technician?.role !== "technician" || !technician.skillTags.includes(ticket.category.name)) {
        throw new Error("Choose a technician qualified for this category");
      }
      const assignment = await tx.assignment.create({ data: { ticketId: params.id, technicianId, assignedById: user.id } });
      await tx.$queryRaw`SELECT set_config('app.actor_id', ${user.id}, true)`;
      await tx.$queryRaw`SELECT set_config('app.status_note', 'Manually assigned', true)`;
      await tx.ticket.update({ where: { id: params.id }, data: { status: "assigned" } });
      return assignment;
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Assignment failed" }, { status: 409 });
  }
}
