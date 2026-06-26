"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { formatPhone, normalizePhone } from "@/lib/format";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];
const EMPLOYEE_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
  stage: string;
  notes: string | null;
  is_hot: boolean;
  user_id: string | null;
  created_at: string;
};

const STAGES = ["lead", "interested", "follow-up", "booked", "client", "dead"];

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-zinc-800 text-zinc-400",
  interested: "bg-blue-950 text-blue-400",
  "follow-up": "bg-yellow-950 text-yellow-400",
  booked: "bg-green-950 text-green-400",
  client: "bg-emerald-950 text-emerald-400",
  dead: "bg-red-950/50 text-red-600",
};

const PORTAL_STATUS = (c: Contact): { label: string; color: string } => {
  if (!c.user_id) return { label: "No Account", color: "text-[#333]" };
  return { label: "Registered", color: "text-[#60a5fa]" };
};

function ContactsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [filterPortal, setFilterPortal] = useState(searchParams.get("portal") || "all");
  const [statFilter, setStatFilter] = useState<"registered" | "unregistered" | "employee" | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", brokerage: "", stage: "lead", notes: "" });
  const [showDeleted, setShowDeleted] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("contacts").select("id, name, email, phone, brokerage, stage, notes, is_hot, user_id, created_at").order("name", { ascending: true });
    setContacts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) router.replace("/dashboard");
      else loadContacts();
    });
  }, [router, loadContacts]);

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { data } = await supabase.from("contacts").insert({
      name: form.name.trim(),
      email: form.email || null,
      phone: normalizePhone(form.phone),
      brokerage: form.brokerage || null,
      stage: form.stage,
      notes: form.notes || null,
      type: "lead",
    }).select().single();
    setSaving(false);
    setShowAdd(false);
    setForm({ name: "", email: "", phone: "", brokerage: "", stage: "lead", notes: "" });
    if (data) router.push(`/admin/contacts/${data.id}`);
    else loadContacts();
  }

  async function updateStage(e: React.MouseEvent, contact: Contact, stage: string) {
    e.stopPropagation();
    const supabase = createClient();
    await supabase.from("contacts").update({ stage }).eq("id", contact.id);
    setContacts(cs => cs.map(c => c.id === contact.id ? { ...c, stage } : c));
  }

  const active = contacts.filter(c => c.stage !== "deleted");
  const deletedContacts = contacts.filter(c => c.stage === "deleted");

  const registeredCount = active.filter(c => c.user_id).length;
  const unregisteredCount = active.filter(c => !c.user_id).length;
  const employeeCount = active.filter(c => EMPLOYEE_EMAILS.includes(c.email || "")).length;

  function clearAllFilters() {
    setStatFilter(null);
    setSearch("");
    setFilterStage("all");
    setFilterPortal("all");
  }

  const hasAnyFilter = statFilter || search || filterStage !== "all" || filterPortal !== "all";

  const filtered = active.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      c.name.toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.brokerage || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q);
    const matchStage = filterStage === "all" || c.stage === filterStage;
    const matchPortal = filterPortal === "all" ||
      (filterPortal === "registered" && c.user_id) ||
      (filterPortal === "no_account" && !c.user_id);
    const matchStat = !statFilter ||
      (statFilter === "registered" && c.user_id) ||
      (statFilter === "unregistered" && !c.user_id) ||
      (statFilter === "employee" && EMPLOYEE_EMAILS.includes(c.email || ""));
    return matchSearch && matchStage && matchPortal && matchStat;
  });

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">

      {/* Nav */}
      <div className="border-b border-white/10 px-4 md:px-8 py-4 flex items-center justify-between gap-4">
        <button onClick={() => router.push("/dashboard")} className="text-[#555] text-sm hover:text-white transition-colors">← Dashboard</button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/cold-calls")}
            className="text-xs tracking-[1px] uppercase border border-white/10 px-4 py-2 text-[#888] hover:text-white hover:border-white/30 transition-all"
          >
            Cold Calls
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="text-xs tracking-[1px] uppercase bg-white text-black px-4 py-2 font-bold hover:bg-[#ddd] transition-colors"
          >
            + New Contact
          </button>
        </div>
      </div>

      {/* Page title + stats */}
      <div className="max-w-4xl mx-auto px-4 pt-10 pb-6">
        <h1 className="text-4xl font-black tracking-tight leading-none uppercase mb-8">Contacts</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Registered */}
          <button
            onClick={() => setStatFilter(f => f === "registered" ? null : "registered")}
            className={`px-5 py-3 text-left transition-all border ${statFilter === "registered" ? "border-[#60a5fa]/40 bg-[#60a5fa]/5" : "border-white/5 hover:border-white/15"}`}
          >
            <p className="text-2xl font-bold tabular-nums text-[#60a5fa]">{registeredCount}</p>
            <p className="text-[10px] tracking-[2px] uppercase text-[#555] mt-1">Registered</p>
          </button>

          {/* Unregistered */}
          <button
            onClick={() => setStatFilter(f => f === "unregistered" ? null : "unregistered")}
            className={`px-5 py-3 text-left transition-all border ${statFilter === "unregistered" ? "border-white/30 bg-white/5" : "border-white/5 hover:border-white/15"}`}
          >
            <p className="text-2xl font-bold tabular-nums text-[#aaa]">{unregisteredCount}</p>
            <p className="text-[10px] tracking-[2px] uppercase text-[#555] mt-1">Unregistered</p>
          </button>

          {/* Employees */}
          <button
            onClick={() => setStatFilter(f => f === "employee" ? null : "employee")}
            className={`px-5 py-3 text-left transition-all border ${statFilter === "employee" ? "border-[#fbbf24]/40 bg-[#fbbf24]/5" : "border-white/5 hover:border-white/15"}`}
          >
            <p className="text-2xl font-bold tabular-nums text-[#fbbf24]">{employeeCount}</p>
            <p className="text-[10px] tracking-[2px] uppercase text-[#555] mt-1">Employees</p>
          </button>

          <div className="w-px h-8 bg-white/10 mx-2" />

          {/* Total (non-clickable) */}
          <div className="px-5 py-3">
            <p className="text-2xl font-bold tabular-nums">{active.length}</p>
            <p className="text-[10px] tracking-[2px] uppercase text-[#555] mt-1">Total</p>
          </div>

          {/* Clear filter */}
          {hasAnyFilter && (
            <button
              onClick={clearAllFilters}
              className="ml-2 text-[10px] tracking-[1px] uppercase text-[#444] hover:text-[#888] transition-colors"
            >
              Clear ✕
            </button>
          )}
        </div>
      </div>

      {/* Filters + Table */}
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, phone, brokerage..."
            className="flex-1 min-w-[180px] bg-[#111] border border-white/10 text-white text-xs px-4 py-2.5 outline-none focus:border-white/30 placeholder:text-[#333]"
          />
          <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
            className="bg-[#111] border border-white/10 text-xs text-[#888] px-3 py-2.5 outline-none focus:border-white/30">
            <option value="all">All stages</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterPortal} onChange={e => setFilterPortal(e.target.value)}
            className="bg-[#111] border border-white/10 text-xs text-[#888] px-3 py-2.5 outline-none focus:border-white/30">
            <option value="all">All portal status</option>
            <option value="registered">Registered</option>
            <option value="no_account">No Account</option>
          </select>
          {hasAnyFilter && (
            <button onClick={clearAllFilters} className="text-xs text-[#555] hover:text-white transition-colors">Clear</button>
          )}
          <span className="text-xs text-[#444]">{filtered.length} contacts</span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-xs text-[#444] tracking-[3px] uppercase">Loading...</div>
        ) : (
          <div className="border border-white/10 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[#444] tracking-[1px] uppercase">
                  <th className="text-left px-4 py-3 font-normal">Name</th>
                  <th className="text-left px-4 py-3 font-normal">Phone</th>
                  <th className="text-left px-4 py-3 font-normal">Brokerage</th>
                  <th className="text-left px-4 py-3 font-normal">Stage</th>
                  <th className="text-left px-4 py-3 font-normal">Added</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-16 text-center text-[#333] italic">No contacts found</td></tr>
                ) : filtered.map(contact => {
                  const ps = PORTAL_STATUS(contact);
                  return (
                    <tr
                      key={contact.id}
                      onClick={() => router.push(`/admin/contacts/${contact.id}`)}
                      className="border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {contact.is_hot && <span className="text-[#fbbf24] text-[10px]">●</span>}
                          <span className="font-medium">{contact.name}</span>
                          {contact.user_id && (
                            <span className="text-[9px] tracking-[1px] uppercase text-[#60a5fa] bg-[#60a5fa]/10 px-1.5 py-0.5 rounded-sm">{ps.label}</span>
                          )}
                        </div>
                        {contact.email && <p className="text-[#444] mt-0.5 text-[11px]">{contact.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-[#666] font-mono whitespace-nowrap">{contact.phone ? formatPhone(contact.phone) : "—"}</td>
                      <td className="px-4 py-3 text-[#666]">{contact.brokerage || "—"}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <select
                          value={contact.stage}
                          onChange={e => updateStage(e as unknown as React.MouseEvent, contact, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className={`text-[10px] px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none font-semibold tracking-wide uppercase ${STAGE_COLORS[contact.stage] || "bg-zinc-800 text-zinc-400"}`}
                        >
                          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-[#444] whitespace-nowrap">
                        {new Date(contact.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}


        {/* Deleted contacts folder */}
        {deletedContacts.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setShowDeleted(v => !v)}
              className="flex items-center gap-2 text-xs tracking-[2px] uppercase text-[#444] hover:text-[#666] transition-colors mb-3"
            >
              <span className={`transition-transform ${showDeleted ? "rotate-90" : ""}`}>▶</span>
              Deleted Contacts
              <span className="text-[#333]">({deletedContacts.length})</span>
            </button>

            {showDeleted && (
              <div className="border border-white/5 overflow-x-auto opacity-60">
                <table className="w-full text-xs">
                  <tbody>
                    {deletedContacts.map(contact => (
                      <tr
                        key={contact.id}
                        onClick={() => router.push(`/admin/contacts/${contact.id}`)}
                        className="border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-[#555]">{contact.name}</span>
                          {contact.email && <p className="text-[#333] mt-0.5 text-[11px]">{contact.email}</p>}
                        </td>
                        <td className="px-4 py-3 text-[#444] font-mono whitespace-nowrap">{contact.phone ? formatPhone(contact.phone) : "—"}</td>
                        <td className="px-4 py-3 text-[#333]">{contact.brokerage || "—"}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase bg-red-950/50 text-red-600">dead</span>
                        </td>
                        <td className="px-4 py-3 text-[#333] whitespace-nowrap">
                          {new Date(contact.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Contact Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-[#111] border border-white/15 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-bold tracking-[2px] uppercase">New Contact</p>
              <button onClick={() => setShowAdd(false)} className="text-[#555] hover:text-white">✕</button>
            </div>
            <form onSubmit={saveContact} className="space-y-3">
              <input
                required autoFocus
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full Name *"
                className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 placeholder:text-[#333]"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone"
                  className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 placeholder:text-[#333]"
                />
                <input
                  type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="Email"
                  className="bg-[#181818] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 placeholder:text-[#333]"
                />
              </div>
              <input
                value={form.brokerage} onChange={e => setForm(f => ({ ...f, brokerage: e.target.value }))}
                placeholder="Brokerage / Company"
                className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 placeholder:text-[#333]"
              />
              <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30">
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <textarea
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Notes (optional)"
                rows={3}
                className="w-full bg-[#181818] border border-white/10 text-white text-sm px-4 py-3 outline-none focus:border-white/30 resize-none placeholder:text-[#333]"
              />
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 py-3 text-xs tracking-[1px] uppercase border border-white/10 text-[#555] hover:text-white hover:border-white/30 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 text-xs tracking-[1px] uppercase bg-white text-black font-bold hover:bg-[#ddd] transition-colors disabled:opacity-40">
                  {saving ? "Creating..." : "Create & Open Profile"}
                </button>
              </div>
            </form>

            <div className="mt-5 pt-5 border-t border-white/5 space-y-2">
              <p className="text-[10px] tracking-[2px] uppercase text-[#333]">Other ways contacts are created</p>
              <p className="text-xs text-[#444]">Cold call log → "Create Contact" automatically adds them here</p>
              <p className="text-xs text-[#444]">Client registers a portal account → auto-linked or auto-created here</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0c0c0c]" />}>
      <ContactsPageInner />
    </Suspense>
  );
}
