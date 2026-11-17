import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() });
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id || user.role !== "requester") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!z.string().uuid().safeParse(params.id).success) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const ticket = await prisma.ticket.findUnique({ where: { id: params.id }, select: { requesterId: true, status: true } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.requesterId !== user.id || !["resolved", "closed"].includes(ticket.status)) {
    return NextResponse.json({ error: "Only the requester may review resolved tickets" }, { status: 403 });
  }
  const feedback = await prisma.feedback.upsert({
    where: { ticketId: params.id }, update: parsed.data, create: { ...parsed.data, ticketId: params.id },
  });
  return NextResponse.json(feedback);
}

// A meaningful application DELETE without destroying the maintenance audit log.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (user?.role !== "requester") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!z.string().uuid().safeParse(params.id).success) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  const ticket = await prisma.ticket.findUnique({ where: { id: params.id }, select: { requesterId: true } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.requesterId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.feedback.deleteMany({ where: { ticketId: params.id } });
  return NextResponse.json({ deleted: true });
}
