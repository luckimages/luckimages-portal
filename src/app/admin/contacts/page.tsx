"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { formatPhone, normalizePhone } from "@/lib/format";
import ContactAvatar from "@/components/ContactAvatar";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
  type: string;
  stage: string;
  notes: string | null;
  is_hot: boolean;
  user_id: string | null;
  created_at: string;
  lead_source: string | null;
  total_revenue: number | null;
};

function healthGrade(contact: Contact, shootMap: Record<string, { count: number; lastDate: string | null }>, refMap: Record<string, number>): { grade: string; score: number; color: string } {
  const now = Date.now();
  const sh = shootMap[contact.id] || { count: 0, lastDate: null };
  const lastShootDays = sh.lastDate ? Math.floor((now - new Date(sh.lastDate).getTime()) / 86400000) : null;
  const refCount = refMap[contact.id] || 0;

  const recencyPts = lastShootDays === null ? 0 : lastShootDays < 30 ? 30 : lastShootDays < 60 ? 20 : lastShootDays < 90 ? 10 : 0;
  const freqPts    = sh.count >= 5 ? 25 : sh.count >= 3 ? 18 : sh.count === 2 ? 12 : sh.count === 1 ? 6 : 0;
  const refPts     = refCount >= 2 ? 20 : refCount === 1 ? 12 : 0;
  const portalPts  = contact.user_id ? 15 : 0;
  const sourcePts  = contact.lead_source ? 10 : 0;
  const score      = recencyPts + freqPts + refPts + portalPts + sourcePts;

  const grade = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";
  const color = grade === "A" ? "text-[#4ade80]" : grade === "B" ? "text-[#60a5fa]" : grade === "C" ? "text-[#fbbf24]" : "text-red-400";
  return { grade, score, color };
}

// Pipeline stages — only applies to leads. "dead" triggers soft-delete.
const LEAD_STAGES = ["new", "contacted", "interested", "follow-up", "invited", "dead"];

const LEAD_STAGE_COLORS: Record<string, string> = {
  new: "bg-zinc-800 text-zinc-400",
  contacted: "bg-zinc-800 text-zinc-300",
  interested: "bg-blue-950 text-blue-400",
  "follow-up": "bg-yellow-950 text-yellow-400",
  invited: "bg-purple-950 text-purple-400",
  dead: "bg-red-950/50 text-red-600",
};

const TYPE_COLORS: Record<string, { color: string; badge: string; label: string }> = {
  lead:     { color: "#fbbf24", badge: "text-[#fbbf24] bg-[#fbbf24]/10",  label: "Lead" },
  realtor:  { color: "#4ade80", badge: "text-[#4ade80] bg-[#4ade80]/10",  label: "Realtor" },
  employee: { color: "#60a5fa", badge: "text-[#60a5fa] bg-[#60a5fa]/10",  label: "Employee" },
  admin:    { color: "#a78bfa", badge: "text-[#a78bfa] bg-[#a78bfa]/10",  label: "Admin" },
};

function ContactsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [shootMap, setShootMap] = useState<Record<string, { count: number; lastDate: string | null }>>({});
  const [refMap, setRefMap]     = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [statFilter, setStatFilter] = useState<"lead" | "realtor" | "employee" | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", brokerage: "", stage: "new", notes: "" });
  const [showDeleted, setShowDeleted] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data }, { data: shoots }, { data: refs }] = await Promise.all([
      supabase.from("contacts").select("id, name, email, phone, brokerage, type, stage, notes, is_hot, user_id, created_at, lead_source, total_revenue").order("name", { ascending: true }),
      supabase.from("shoots").select("contact_id, scheduled_at").neq("status", "cancelled").order("scheduled_at", { ascending: false }),
      supabase.from("contacts").select("referred_by_contact_id").not("referred_by_contact_id", "is", null),
    ]);
    setContacts(data || []);

    // Build shoot map: contact_id → { count, lastDate }
    const sm: Record<string, { count: number; lastDate: string | null }> = {};
    for (const s of (shoots || [])) {
      if (!s.contact_id) continue;
      if (!sm[s.contact_id]) sm[s.contact_id] = { count: 0, lastDate: null };
      sm[s.contact_id].count++;
      if (!sm[s.contact_id].lastDate) sm[s.contact_id].lastDate = s.scheduled_at;
    }
    setShootMap(sm);

    // Build referral map: contact_id → count of people they referred
    const rm: Record<string, number> = {};
    for (const r of (refs || [])) {
      if (!r.referred_by_contact_id) continue;
      rm[r.referred_by_contact_id] = (rm[r.referred_by_contact_id] || 0) + 1;
    }
    setRefMap(rm);
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
    setForm({ name: "", email: "", phone: "", brokerage: "", stage: "new", notes: "" });
    if (data) router.push(`/admin/contacts/${data.id}`);
    else loadContacts();
  }

  async function updateStage(e: React.MouseEvent, contact: Contact, stage: string) {
    e.stopPropagation();
    const supabase = createClient();
    if (stage === "dead") {
      await supabase.from("contacts").update({ stage: "deleted" }).eq("id", contact.id);
      setContacts(cs => cs.map(c => c.id === contact.id ? { ...c, stage: "deleted" } : c));
    } else {
      await supabase.from("contacts").update({ stage }).eq("id", contact.id);
      setContacts(cs => cs.map(c => c.id === contact.id ? { ...c, stage } : c));
    }
  }

  const active = contacts.filter(c => c.stage !== "deleted");
  const deletedContacts = contacts.filter(c => c.stage === "deleted");

  const leadCount = active.filter(c => c.type === "lead").length;
  const realtorCount = active.filter(c => c.type === "realtor").length;
  const employeeCount = active.filter(c => c.type === "employee").length;

  function clearAllFilters() {
    setStatFilter(null);
    setSearch("");
    setFilterStage("all");
    setFilterType("all");
  }

  const hasAnyFilter = statFilter || search || filterStage !== "all" || filterType !== "all";

  const filtered = active.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      c.name.toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.brokerage || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q);
    const matchStage = filterStage === "all" || c.stage === filterStage;
    const matchType = filterType === "all" || c.type === filterType;
    const matchStat = !statFilter || c.type === statFilter;
    return matchSearch && matchStage && matchType && matchStat;
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
          {/* Leads */}
          <button
            onClick={() => setStatFilter(f => f === "lead" ? null : "lead")}
            className={`px-5 py-3 text-left transition-all border ${statFilter === "lead" ? "border-[#fbbf24]/40 bg-[#fbbf24]/5" : "border-white/5 hover:border-white/15"}`}
          >
            <p className="text-2xl font-bold tabular-nums text-[#fbbf24]">{leadCount}</p>
            <p className="text-[10px] tracking-[2px] uppercase text-[#555] mt-1">Leads</p>
          </button>

          {/* Realtors */}
          <button
            onClick={() => setStatFilter(f => f === "realtor" ? null : "realtor")}
            className={`px-5 py-3 text-left transition-all border ${statFilter === "realtor" ? "border-[#4ade80]/40 bg-[#4ade80]/5" : "border-white/5 hover:border-white/15"}`}
          >
            <p className="text-2xl font-bold tabular-nums text-[#4ade80]">{realtorCount}</p>
            <p className="text-[10px] tracking-[2px] uppercase text-[#555] mt-1">Realtors</p>
          </button>

          {/* Employees */}
          <button
            onClick={() => setStatFilter(f => f === "employee" ? null : "employee")}
            className={`px-5 py-3 text-left transition-all border ${statFilter === "employee" ? "border-[#60a5fa]/40 bg-[#60a5fa]/5" : "border-white/5 hover:border-white/15"}`}
          >
            <p className="text-2xl font-bold tabular-nums text-[#60a5fa]">{employeeCount}</p>
            <p className="text-[10px] tracking-[2px] uppercase text-[#555] mt-1">Employees</p>
          </button>

          <div className="w-px h-8 bg-white/10 mx-2" />

          {/* Total — clears all filters */}
          <button
            onClick={clearAllFilters}
            className={`px-5 py-3 text-left transition-all border ${hasAnyFilter ? "border-white/20 hover:border-white/40" : "border-transparent cursor-default"}`}
          >
            <p className="text-2xl font-bold tabular-nums">{active.length}</p>
            <p className="text-[10px] tracking-[2px] uppercase text-[#555] mt-1">Total</p>
          </button>
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
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="bg-[#111] border border-white/10 text-xs text-[#888] px-3 py-2.5 outline-none focus:border-white/30">
            <option value="all">All types</option>
            <option value="lead">Leads</option>
            <option value="realtor">Realtors</option>
            <option value="employee">Employees</option>
          </select>
          <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
            className="bg-[#111] border border-white/10 text-xs text-[#888] px-3 py-2.5 outline-none focus:border-white/30">
            <option value="all">All lead stages</option>
            {LEAD_STAGES.filter(s => s !== "dead").map(s => <option key={s} value={s}>{s}</option>)}
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
                  <th className="text-left px-4 py-3 font-normal">Status</th>
                  <th className="text-left px-4 py-3 font-normal">Health</th>
                  <th className="text-left px-4 py-3 font-normal">Added</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-16 text-center text-[#333] italic">No contacts found</td></tr>
                ) : filtered.map(contact => {
                  const tc = TYPE_COLORS[contact.type] || TYPE_COLORS.lead;
                  return (
                    <tr
                      key={contact.id}
                      onClick={() => router.push(`/admin/contacts/${contact.id}`)}
                      className="border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <ContactAvatar contactId={contact.id} name={contact.name} size={28} />
                          <div>
                            <div className="flex items-center gap-2">
                              {contact.is_hot && <span className="text-[#fbbf24] text-[10px]">●</span>}
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tc.color }} />
                              <span className="font-medium">{contact.name}</span>
                            </div>
                            {contact.email && <p className="text-[#444] mt-0.5 text-[11px]">{contact.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#666] font-mono whitespace-nowrap">{contact.phone ? formatPhone(contact.phone) : "—"}</td>
                      <td className="px-4 py-3 text-[#666]">{contact.brokerage || "—"}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {contact.type === "lead" ? (
                          <select
                            value={contact.stage}
                            onChange={e => updateStage(e as unknown as React.MouseEvent, contact, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className={`text-[10px] px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none font-semibold tracking-wide uppercase ${LEAD_STAGE_COLORS[contact.stage] || "bg-zinc-800 text-zinc-400"}`}
                          >
                            {LEAD_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase ${tc.badge}`}>
                            {tc.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {(() => { const { grade, color } = healthGrade(contact, shootMap, refMap); return (
                          <span className={`text-sm font-black tabular-nums ${color}`}>{grade}</span>
                        ); })()}
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
                          <div className="flex items-center gap-2.5">
                            <ContactAvatar contactId={contact.id} name={contact.name} size={24} />
                            <div>
                              <span className="font-medium text-[#555]">{contact.name}</span>
                              {contact.email && <p className="text-[#333] mt-0.5 text-[11px]">{contact.email}</p>}
                            </div>
                          </div>
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
                {LEAD_STAGES.filter(s => s !== "dead").map(s => <option key={s} value={s}>{s}</option>)}
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
