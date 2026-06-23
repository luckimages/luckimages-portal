"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

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
  total_invoices: number;
  total_revenue: number;
  is_hot: boolean;
  created_at: string;
};

const STAGES = ["lead", "interested", "follow-up", "booked", "client", "dead"];
const STAGE_COLORS: Record<string, string> = {
  lead: "bg-zinc-700 text-zinc-300",
  interested: "bg-blue-900 text-blue-300",
  "follow-up": "bg-yellow-900 text-yellow-300",
  booked: "bg-green-900 text-green-300",
  client: "bg-emerald-900 text-emerald-300",
  dead: "bg-red-950 text-red-400",
};

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", brokerage: "", stage: "lead", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) router.replace("/dashboard");
    });
    loadContacts();
  }, [router]);

  async function loadContacts() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .order("name", { ascending: true });
    setContacts(data || []);
    setLoading(false);
  }

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    if (selected) {
      await supabase.from("contacts").update({ ...form, updated_at: new Date().toISOString() }).eq("id", selected.id);
    } else {
      await supabase.from("contacts").insert({ ...form, type: "lead" });
    }
    setSaving(false);
    setShowAdd(false);
    setSelected(null);
    setForm({ name: "", email: "", phone: "", brokerage: "", stage: "lead", notes: "" });
    loadContacts();
  }

  async function toggleHot(contact: Contact) {
    const supabase = createClient();
    await supabase.from("contacts").update({ is_hot: !contact.is_hot }).eq("id", contact.id);
    setContacts(cs => cs.map(c => c.id === contact.id ? { ...c, is_hot: !c.is_hot } : c));
  }

  async function updateStage(contact: Contact, stage: string) {
    const supabase = createClient();
    await supabase.from("contacts").update({ stage }).eq("id", contact.id);
    setContacts(cs => cs.map(c => c.id === contact.id ? { ...c, stage } : c));
  }

  async function deleteContact(contact: Contact) {
    if (!confirm(`Delete ${contact.name}? This cannot be undone.`)) return;
    const supabase = createClient();
    await supabase.from("contacts").delete().eq("id", contact.id);
    setContacts(cs => cs.filter(c => c.id !== contact.id));
  }

  function openEdit(contact: Contact) {
    setSelected(contact);
    setForm({
      name: contact.name,
      email: contact.email || "",
      phone: contact.phone || "",
      brokerage: contact.brokerage || "",
      stage: contact.stage,
      notes: contact.notes || "",
    });
    setShowAdd(true);
  }

  const filtered = contacts.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.brokerage?.toLowerCase().includes(search.toLowerCase());
    const matchStage = filterStage === "all" || c.stage === filterStage;
    return matchSearch && matchStage;
  });

  const allSorted = filtered;

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={() => router.push("/dashboard")} className="text-zinc-500 text-sm hover:text-white mb-2 flex items-center gap-1">
              ← Dashboard
            </button>
            <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
            <p className="text-zinc-500 text-sm mt-1">{contacts.length} total · {contacts.filter(c => c.is_hot).length} hot leads</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/admin/cold-calls")}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
            >
              📞 Cold Calls
            </button>
            <button
              onClick={() => { setSelected(null); setForm({ name: "", email: "", phone: "", brokerage: "", stage: "lead", notes: "" }); setShowAdd(true); }}
              className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors"
            >
              + Add Contact
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {STAGES.filter(s => s !== "dead").map(s => {
            const count = contacts.filter(c => c.stage === s).length;
            return (
              <button
                key={s}
                onClick={() => setFilterStage(filterStage === s ? "all" : s)}
                className={`p-3 rounded-lg border text-left transition-all ${filterStage === s ? "border-white bg-zinc-800" : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"}`}
              >
                <div className="text-xl font-bold">{count}</div>
                <div className="text-xs text-zinc-500 capitalize mt-0.5">{s}</div>
              </button>
            );
          })}
        </div>

        {/* Search + filter */}
        <div className="flex gap-3 mb-6">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, brokerage..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-600"
          />
          <select
            value={filterStage}
            onChange={e => setFilterStage(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none"
          >
            <option value="all">All stages</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-zinc-500 text-center py-20">Loading...</div>
        ) : (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 w-8"></th>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Brokerage</th>
                  <th className="text-left px-4 py-3">Stage</th>
                  <th className="text-right px-4 py-3">Invoices</th>
                  <th className="text-right px-4 py-3">Revenue</th>
                  <th className="text-left px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {allSorted.map(contact => (
                  <tr key={contact.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => toggleHot(contact)} className="text-lg leading-none" title="Toggle hot lead">
                        {contact.is_hot ? "🔥" : <span className="text-zinc-700 hover:text-zinc-500">🔥</span>}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium">{contact.name}</td>
                    <td className="px-4 py-3 text-zinc-400">{contact.email || "—"}</td>
                    <td className="px-4 py-3 text-zinc-400">{contact.brokerage || "—"}</td>
                    <td className="px-4 py-3">
                      <select
                        value={contact.stage}
                        onChange={e => updateStage(contact, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none ${STAGE_COLORS[contact.stage] || "bg-zinc-700 text-zinc-300"}`}
                      >
                        {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400">{contact.total_invoices}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {contact.total_revenue > 0 ? `$${contact.total_revenue.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => openEdit(contact)}
                          className="text-xs text-zinc-500 hover:text-white transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => router.push(`/admin/cold-calls?contact=${contact.id}`)}
                          className="text-xs text-zinc-500 hover:text-white transition-colors"
                        >
                          Call
                        </button>
                        <button
                          onClick={() => deleteContact(contact)}
                          className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allSorted.length === 0 && (
              <div className="text-center text-zinc-500 py-16">No contacts found</div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-5">{selected ? "Edit Contact" : "Add Contact"}</h2>
            <form onSubmit={saveContact} className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Brokerage</label>
                <input value={form.brokerage} onChange={e => setForm(f => ({ ...f, brokerage: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Stage</label>
                <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Notes</label>
                <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowAdd(false); setSelected(null); }}
                  className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm hover:bg-zinc-800 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50">
                  {saving ? "Saving..." : selected ? "Save Changes" : "Add Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
