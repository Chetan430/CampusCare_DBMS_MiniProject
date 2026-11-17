import { prisma } from "./prisma";
import { embedText, lexicalVector, toVectorLiteral } from "./embeddings";
import { TicketStatus } from "@prisma/client";

interface CreateTicketInput {
  requesterId: string;
  categoryId: string;
  locationId: string;
  title: string;
  description: string;
  priority?: "low" | "medium" | "high" | "urgent";
}

interface SimilarTicket { id: string; title: string; status: string; similarity: number; }

type EmbeddingSource = "minilm" | "lexical";
async function embeddingFor(text: string): Promise<{ literal: string; source: EmbeddingSource; warning: string | null }> {
  const mode = (process.env.EMBEDDING_MODE ?? "auto").toLowerCase();
  if (mode === "lexical") return {
    literal: toVectorLiteral(lexicalVector(text)), source: "lexical",
    warning: "Offline lexical vectors are active. For MiniLM semantic matching, set EMBEDDING_MODE=minilm and download the model.",
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const configured = Number(process.env.EMBEDDING_TIMEOUT_MS ?? "8000");
    const ms = Number.isFinite(configured) && configured > 0 ? configured : 8000;
    const vec = await Promise.race([
      embedText(text),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`MiniLM not ready within ${ms}ms`)), ms);
      }),
    ]);
    return { literal: toVectorLiteral(vec), source: "minilm", warning: null };
  } catch (error) {
    console.warn("[CampusCare] MiniLM unavailable; using a separately tagged lexical vector:", error);
    return {
      literal: toVectorLiteral(lexicalVector(text)), source: "lexical",
      warning: "Ticket saved with an offline lexical vector because MiniLM was unavailable. This is not semantic MiniLM matching.",
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function createTicketWithEmbedding(input: CreateTicketInput) {
  // MOST IMPORTANT RELIABILITY GUARANTEE:
  // Save the real maintenance request FIRST. Model downloads, vector indexes,
  // or similarity queries cannot roll back or prevent the complaint itself.
  const ticket = await prisma.ticket.create({ data: input });
  let possibleDuplicates: SimilarTicket[] = [];
  let embeddingWarning: string | null = null;

  try {
    const embedding = await embeddingFor(`${input.title}. ${input.description}`);
    embeddingWarning = embedding.warning;
    const { literal, source } = embedding;
    possibleDuplicates = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE tickets
        SET description_embedding = ${literal}::vector,
            embedding_source = ${source}
        WHERE id = ${ticket.id}::uuid
      `;
      const matches = await tx.$queryRaw<SimilarTicket[]>`
        SELECT id::text AS id, title, status::text AS status,
               (1 - (description_embedding <=> ${literal}::vector))::double precision AS similarity
        FROM tickets
        WHERE id <> ${ticket.id}::uuid
          AND embedding_source = ${source}
          AND description_embedding IS NOT NULL
          AND status NOT IN ('resolved', 'closed')
        ORDER BY description_embedding <=> ${literal}::vector
        LIMIT 5
      `;
      const candidates = matches.filter((m) => m.similarity >= 0.8);
      if (candidates.length) {
        await tx.duplicateLink.createMany({
          data: candidates.map((m) => ({
            ticketId: ticket.id, similarTicketId: m.id, similarityScore: m.similarity,
          })),
          skipDuplicates: true,
        });
      }
      return candidates;
    }, { timeout: 15000 });
  } catch (error) {
    console.error("[CampusCare] Ticket was SAVED; optional vector matching failed:", error);
    embeddingWarning = "Ticket saved successfully, but vector duplicate checking could not complete. Check the server terminal.";
  }
  return { ticket, possibleDuplicates, embeddingWarning };
}

export async function updateTicketStatus(ticketId: string, newStatus: TicketStatus, changedBy: string, note?: string) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    const allowed: Record<TicketStatus, TicketStatus[]> = {
      open: ["assigned"], assigned: ["in_progress", "resolved"],
      in_progress: ["resolved"], resolved: ["reopened", "closed"],
      closed: ["reopened"], reopened: ["assigned", "in_progress", "resolved"],
    };
    if (!allowed[current.status].includes(newStatus)) throw new Error(`Invalid transition: ${current.status} -> ${newStatus}`);
    await tx.$queryRaw`SELECT set_config('app.actor_id', ${changedBy}, true)`;
    await tx.$queryRaw`SELECT set_config('app.status_note', ${note || ""}, true)`;
    const changed = await tx.ticket.updateMany({
      where: { id: ticketId, status: current.status }, data: { status: newStatus },
    });
    if (changed.count !== 1) throw new Error("Ticket status changed concurrently; retry");
    if (newStatus === "closed") {
      await tx.assignment.updateMany({
        where: { ticketId, unassignedAt: null }, data: { unassignedAt: new Date() },
      });
    }
    return tx.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  });
}

export async function autoAssignTechnician(ticketId: string, assignedBy: string) {
  const result = await prisma.$queryRaw<{ assignment_id: string }[]>`
    SELECT auto_assign_technician(${ticketId}::uuid, ${assignedBy}::uuid) AS assignment_id
  `;
  return result[0]?.assignment_id;
}
