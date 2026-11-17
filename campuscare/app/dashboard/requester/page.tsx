"use client";
import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";

type Category = { id: string; name: string; defaultSlaHours: number };
type Ticket = { id: string; title: string; status: string; priority: string; slaDueAt: string | null;
  category: { name: string }; location: { building: string; roomNo: string | null };
  feedback?: { rating: number } | null };
type Duplicate = { id: string; title: string; similarity: number };
const initial = { title: "", description: "", categoryName: "", building: "", floor: "", roomNo: "", priority: "medium" };

export default function RequesterDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(initial);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [embeddingWarning, setEmbeddingWarning] = useState("");
  const [lastCreatedId, setLastCreatedId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    const res = await fetch("/api/tickets", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || `Could not refresh tickets (HTTP ${res.status})`);
    if (!Array.isArray(data)) throw new Error("Ticket list response was invalid");
    setTickets(data);
  }
  useEffect(() => {
    void reload().catch((err) => setError(err.message || "Unable to load tickets"));
    fetch("/api/catalog").then((r) => r.ok ? r.json() : Promise.reject())
      .then((x) => { setCategories(x.categories); })
      .catch(() => setError("Unable to load categories."));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setMessage(""); setEmbeddingWarning(""); setLastCreatedId("");
    setDuplicates([]); setSubmitting(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : `Ticket submission failed (HTTP ${res.status})`);
      setDuplicates(data?.possibleDuplicates ?? []);
      setLastCreatedId(data?.ticket?.id ?? "");
      setEmbeddingWarning(data?.embeddingWarning ?? "");
      setMessage(`Ticket created successfully: ${data?.ticket?.title || form.title}.`);
      setForm(initial);
      try {
        await reload();
      } catch (reloadError: any) {
        setError(`Ticket was saved, but the list did not refresh: ${reloadError.message || "Please reload the page."}`);
      }
    } catch (err: any) {
      setError(err.message ?? "Request failed. Check the server terminal for details.");
    } finally {
      setSubmitting(false);
    }
  }
  async function review(id: string) {
    const response = window.prompt("Rate the resolution 1 to 5 (leave blank to cancel)");
    if (response === null || response.trim() === "") return;
    const rating = Number(response);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) { setError("Rating must be between 1 and 5"); return; }
    const comment = window.prompt("Optional feedback") ?? "";
    const res = await fetch(`/api/tickets/${id}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating, comment }) });
    if (res.ok) { setMessage("Feedback saved."); setError(""); await reload(); }
    else setError("Feedback could not be saved");
  }
  async function removeReview(id: string) {
    if (!window.confirm("Remove your feedback for this resolved ticket?")) return;
    const res = await fetch(`/api/tickets/${id}/feedback`, { method: "DELETE" });
    if (res.ok) { setError(""); setMessage("Feedback removed."); await reload(); }
    else setError("Could not remove feedback");
  }
  return <>
    <DashboardHeader subtitle="Requester workspace" />
    <main className="mx-auto max-w-6xl px-5 py-9">
      <div className="mb-7"><h1 className="text-3xl font-bold">Report a campus issue</h1><p className="mt-1 text-slate-600">Track maintenance, SLA deadlines and potentially duplicate complaints.</p></div>
      <form onSubmit={create} className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-xl font-semibold">New maintenance ticket</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium md:col-span-2">Ticket title<input required minLength={3} maxLength={200} className="mt-1 w-full rounded-md border p-3" placeholder="Fan not working in A-214" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label className="block text-sm font-medium md:col-span-2">Description<textarea required minLength={10} maxLength={4000} rows={3} className="mt-1 w-full rounded-md border p-3" placeholder="Describe what is broken and where..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="block text-sm font-medium">Maintenance category name
            <input required list="campuscare-categories" className="mt-1 w-full rounded-md border p-3" placeholder="e.g. Electrical" value={form.categoryName} onChange={(e) => setForm({ ...form, categoryName: e.target.value })} />
            <datalist id="campuscare-categories">{categories.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            <span className="mt-1 block text-xs text-slate-500">Enter a category name from the suggestions (SLA is determined by category).</span>
          </label>
          <label className="block text-sm font-medium">Building / location name
            <input required maxLength={120} className="mt-1 w-full rounded-md border p-3" placeholder="e.g. Academic Block A" value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} />
          </label>
          <label className="block text-sm font-medium">Floor (optional)
            <input maxLength={40} className="mt-1 w-full rounded-md border p-3" placeholder="e.g. 2" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
          </label>
          <label className="block text-sm font-medium">Room number (optional)
            <input maxLength={40} className="mt-1 w-full rounded-md border p-3" placeholder="e.g. 214" value={form.roomNo} onChange={(e) => setForm({ ...form, roomNo: e.target.value })} />
          </label>
          <label className="block text-sm font-medium">Priority<select className="mt-1 w-full rounded-md border bg-white p-3" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{["low", "medium", "high", "urgent"].map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
        </div>
        <button disabled={submitting || !categories.length} className="mt-5 rounded-md bg-[var(--brand)] px-6 py-3 text-sm font-medium text-white disabled:opacity-50">{submitting ? "Submitting (MiniLM may take up to 30 seconds)..." : "Submit request"}</button>
        {error && <div role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {message && <div role="status" className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}{lastCreatedId && <span className="block mt-1 text-xs">Ticket ID: {lastCreatedId}</span>}<a className="mt-1 inline-block underline" href="#my-tickets">View my tickets ↓</a></div>}
        {embeddingWarning && <div role="alert" className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">{embeddingWarning}</div>}
      </form>
      {duplicates.length > 0 && <aside className="mb-7 rounded-xl border border-amber-300 bg-amber-50 p-5"><h2 className="font-semibold text-amber-900">Potential duplicate tickets</h2><p className="text-sm text-amber-800">Similarity is a suggestion, not proof of duplication.</p>{duplicates.map((x) => <p key={x.id} className="mt-2 text-sm">{x.title} — {(x.similarity * 100).toFixed(1)}% similarity</p>)}</aside>}
      <section id="my-tickets"><h2 className="mb-4 text-xl font-semibold">My tickets ({tickets.length})</h2><div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-100"><tr>{["Title", "Category / location", "Status", "Priority", "SLA deadline", "Feedback"].map((x) => <th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{tickets.map((t) => <tr key={t.id} className="border-t"><td className="p-3 font-medium">{t.title}</td><td className="p-3">{t.category.name}<br/><span className="text-xs text-slate-500">{t.location.building} {t.location.roomNo}</span></td><td className="p-3 capitalize">{t.status.replace(/_/g, " ")}</td><td className="p-3 capitalize">{t.priority}</td><td className="p-3 text-xs">{t.slaDueAt ? new Date(t.slaDueAt).toLocaleString() : "—"}</td><td className="p-3">{["resolved", "closed"].includes(t.status) ? <button className="text-[var(--brand)] underline" onClick={() => review(t.id)}>{t.feedback ? `Edit ${t.feedback.rating}/5` : "Rate"}</button> : "—"}{t.feedback && <button className="ml-2 text-xs text-red-700 underline" onClick={() => removeReview(t.id)}>Remove</button>}</td></tr>)}{!tickets.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No tickets yet. Submit your first request above.</td></tr>}</tbody></table></div></section>
    </main>
  </>;
}
