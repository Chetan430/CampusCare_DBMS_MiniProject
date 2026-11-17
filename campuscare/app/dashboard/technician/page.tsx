"use client";
import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
type Ticket = { id: string; title: string; description: string; status: string; priority: string;
  category: { name: string }; location: { building: string; roomNo: string | null } };
export default function TechnicianDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  async function load() { const res = await fetch("/api/tickets"); if (res.ok) setTickets(await res.json()); else setError("Unable to load assigned requests"); }
  useEffect(() => { void load(); }, []);
  async function update(id: string, status: string) {
    setError(""); setMessage("");
    const note = window.prompt("Optional work note for the audit history") ?? "";
    const res = await fetch(`/api/tickets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, note }) });
    const response = await res.json();
    if (res.ok) { setMessage(`Ticket moved to ${status.replace(/_/g, " ")}`); await load(); }
    else setError(response.error ?? "Could not change status");
  }
  return <><DashboardHeader subtitle="Technician workspace"/><main className="mx-auto max-w-4xl px-5 py-9">
    <h1 className="text-3xl font-bold">My assigned repairs</h1><p className="mb-6 mt-1 text-slate-600">Update progress; database triggers save the audit trail.</p>
    {error && <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}{message && <p className="mb-4 rounded bg-green-50 p-3 text-green-700">{message}</p>}
    <div className="space-y-4">{tickets.map((t) => <article key={t.id} className="rounded-xl border bg-white p-5 shadow-sm"><div className="flex justify-between"><h2 className="text-lg font-semibold">{t.title}</h2><span className="rounded bg-slate-100 px-3 py-1 text-xs">{t.status}</span></div><p className="my-3 text-sm text-slate-600">{t.description}</p><p className="text-xs text-slate-500">{t.category.name} · {t.location.building} {t.location.roomNo} · {t.priority} priority</p><div className="mt-4 flex gap-2">{["assigned", "reopened"].includes(t.status) && <button className="rounded bg-[var(--brand)] px-3 py-2 text-sm text-white" onClick={() => update(t.id, "in_progress")}>Start work</button>}{["assigned", "in_progress", "reopened"].includes(t.status) && <button className="rounded border border-[var(--brand)] px-3 py-2 text-sm text-[var(--brand)]" onClick={() => update(t.id, "resolved")}>Mark resolved</button>}</div></article>)}{!tickets.length && <p className="rounded border bg-white p-6 text-slate-500">You have no active assignments.</p>}</div>
  </main></>;
}
