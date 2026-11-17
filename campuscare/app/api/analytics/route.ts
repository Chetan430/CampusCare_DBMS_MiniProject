import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [workload, slaBreaches, hotspots] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT * FROM technician_workload`),
    prisma.$queryRawUnsafe(`SELECT * FROM sla_breach_report`),
    prisma.$queryRawUnsafe(`SELECT * FROM recurring_issue_hotspots`),
  ]);

  return NextResponse.json({ workload, slaBreaches, hotspots });
}
