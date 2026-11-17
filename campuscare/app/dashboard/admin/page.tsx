"use client";
import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";

type Ticket = { id: string; title: string; status: string; category: { name: string }; location: { building: string }; assignments: { technicianId: string }[] };
type Technician = { id: string; name: string; skillTags: string[] };
type Workload = { technician_id: string; technician_name: string; open_tickets: number };
type Breach = { id: string; title: string; category: string; building: string; overdue_hours: number };
type Hotspot = { building: string; category: string; ticket_count: number };
export default function AdminDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [techs, setTechs] = useState<Technician[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState(""); const [status, setStatus] = useState("all");
  const [analytics, setAnalytics] = useState<{ workload: Workload[]; slaBreaches: Breach[]; hotspots: Hotspot[] }>({ workload: [], slaBreaches: [], hotspots: [] });
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  async function load() {
    try {
      const [t, a, u] = await Promise.all([fetch("/api/tickets"), fetch("/api/analytics"), fetch("/api/technicians")]);
      if (!t.ok || !a.ok || !u.ok) throw new Error("Could not load dashboard data. Check database setup.");
      setTickets(await t.json()); setAnalytics(await a.json()); setTechs(await u.json());
    } catch (err: any) { setError(err.message); }
  }
  useEffect(() => { void load(); }, []);
  async function assign(ticketId: string) {
    setError(""); setMessage("");
    const technicianId = selected[ticketId] || undefined;
    const r = await fetch(`/api/tickets/${ticketId}/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ technicianId }) });
    const x = await r.json();
    if (!r.ok) setError(typeof x.error === "string" ? x.error : "Assignment failed");
    else { setMessage(technicianId ? "Manual assignment successful" : "Least-loaded qualified technician selected"); await load(); }
  }
  async function changeStatus(ticketId: string, newStatus: string) {
    const r = await fetch(`/api/tickets/${ticketId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    const x = await r.json(); if (!r.ok) setError(x.error ?? "Update failed"); else { setMessage(`Ticket ${newStatus}`); setError(""); await load(); }
  }
  const shown = tickets.filter((t) => (status === "all" || t.status === status) && (t.title + t.category.name + t.location.building).toLowerCase().includes(filter.toLowerCase()));
  return <><DashboardHeader subtitle="Administrator & analytics"/><main className="mx-auto max-w-6xl px-5 py-9">
    <h1 className="text-3xl font-bold">Operations overview</h1><p className="mt-1 text-slate-600">Assignment, SLA monitoring, workload and recurring-issue analysis.</p>
    {error && <div role="alert" className="my-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}{message && <div className="my-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div>}
    <div className="my-7 grid gap-4 md:grid-cols-3">
      <section className="rounded-xl border bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold">Technician workload</h2>{analytics.workload.map((w) => <p key={w.technician_id} className="mb-2 flex justify-between text-sm"><span>{w.technician_name}</span><b>{w.open_tickets} active</b></p>)}{!analytics.workload.length && <p className="text-sm text-slate-500">No technicians</p>}</section>
      <section className="rounded-xl border bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold">SLA breaches</h2>{analytics.slaBreaches.map((b) => <p key={b.id} className="mb-2 text-sm text-rose-700">{b.title} · {b.building}<br/><span className="text-xs">Overdue {b.overdue_hours} hours</span></p>)}{!analytics.slaBreaches.length && <p className="text-sm text-green-700">No overdue unresolved tickets</p>}</section>
      <section className="rounded-xl border bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold">Recurring issue hotspots</h2>{analytics.hotspots.map((h) => <p key={`${h.building}-${h.category}`} className="mb-2 flex justify-between text-sm"><span>{h.building} · {h.category}</span><b>{h.ticket_count}</b></p>)}{!analytics.hotspots.length && <p className="text-sm text-slate-500">No repeated building/category pairs</p>}</section>
    </div>
    <section className="rounded-xl border bg-white p-5"><div className="mb-4 flex flex-wrap justify-between gap-3"><h2 className="text-xl font-semibold">Tickets ({shown.length})</h2><div className="flex gap-2"><input aria-label="Search tickets" placeholder="Search tickets" className="rounded-md border px-3 py-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}/><select aria-label="Filter by status" className="rounded-md border p-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>{["all", "open", "assigned", "in_progress", "resolved", "closed", "reopened"].map((s) => <option value={s} key={s}>{s}</option>)}</select></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[750px] text-left text-sm"><thead className="bg-slate-100"><tr>{["Issue", "Location", "Status", "Assignment / lifecycle"].map((v) => <th className="p-3" key={v}>{v}</th>)}</tr></thead><tbody>{shown.map((t) => <tr key={t.id} className="border-t"><td className="p-3 font-semibold">{t.title}<br/><span className="font-normal text-slate-500">{t.category.name}</span></td><td className="p-3">{t.location.building}</td><td className="p-3 capitalize">{t.status.replace(/_/g, " ")}</td><td className="p-3">{["open", "reopened"].includes(t.status) ? <div className="flex flex-wrap items-center gap-2"><select aria-label={`Technician for ${t.title}`} className="max-w-[170px] rounded border p-2 text-xs" value={selected[t.id] || ""} onChange={(e) => setSelected({ ...selected, [t.id]: e.target.value })}><option value="">Auto-assign by workload</option>{techs.filter((x) => x.skillTags.includes(t.category.name)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><button className="rounded bg-[var(--brand)] px-3 py-2 text-xs text-white" onClick={() => assign(t.id)}>Assign</button></div> : t.status === "resolved" ? <button onClick={() => changeStatus(t.id, "closed")} className="rounded border px-3 py-2 text-xs">Close</button> : t.status === "closed" ? <button onClick={() => changeStatus(t.id, "reopened")} className="rounded border px-3 py-2 text-xs">Reopen</button> : "In service"}</td></tr>)}</tbody></table></div>
    </section>
  </main></>;
}
