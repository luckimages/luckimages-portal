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

type CallLog = {
  id: string;
  outcome: string;
  notes: string | null;
  called_at: string;
  called_by: string;
  listing_address: string | null;
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
const OUTCOME_LABELS: Record<string, string> = {
  no_answer: "No Answer",
  not_interested: "Not Interested",
  interested: "Interested",
  callback: "Callback",
  booked: "Booked",
};

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [profile, setProfile] = useState<Contact | null>(null);
  const [profileCalls, setProfileCalls] = useState<CallLog[]>([]);
  const [profileEditing, setProfileEditing] = useState(false);
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
    const { data } = await supabase.from("contacts").select("*").order("name", { ascending: true });
    setContacts(data || []);
    setLoading(false);
  }

  async function openProfile(contact: Contact) {
    setProfile(contact);
    setProfileEditing(false);
    setForm({
      name: contact.name,
      email: contact.email || "",
      phone: contact.phone || "",
      brokerage: contact.brokerage || "",
      stage: contact.stage,
      notes: contact.notes || "",
    });
    const supabase = createClient();
    const { data } = await supabase
      .from("cold_calls")
      .select("*")
      .eq("contact_id", contact.id)
      .order("called_at", { ascending: false })
      .limit(20);
    setProfileCalls(data || []);
  }

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    if (selected) {
      const { data } = await supabase.from("contacts").update({ ...form, updated_at: new Date().toISOString() }).eq("id", selected.id).select().single();
      if (data) {
        setContacts(cs => cs.map(c => c.id === selected.id ? data : c));
        if (profile?.id === selected.id) setProfile(data);
      }
    } else {
      await supabase.from("contacts").insert({ ...form, type: "lead" });
      loadContacts();
    }
    setSaving(false);
    setShowAdd(false);
    setProfileEditing(false);
    setSelected(null);
    setForm({ name: "", email: "", phone: "", brokerage: "", stage: "lead", notes: "" });
  }

  async function saveProfileEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    const supabase = createClient();
    const { data } = await supabase.from("contacts").update({ ...form, updated_at: new Date().toISOString() }).eq("id", profile.id).select().single();
    if (data) {
      setContacts(cs => cs.map(c => c.id === profile.id ? data : c));
      setProfile(data);
    }
    setSaving(false);
    setProfileEditing(false);
  }

  async function toggleHot(contact: Contact) {
    const supabase = createClient();
    await supabase.from("contacts").update({ is_hot: !contact.is_hot }).eq("id", contact.id);
    const updated = { ...contact, is_hot: !contact.is_hot };
    setContacts(cs => cs.map(c => c.id === contact.id ? updated : c));
    if (profile?.id === contact.id) setProfile(updated);
  }

  async function updateStage(contact: Contact, stage: string) {
    const supabase = createClient();
    await supabase.from("contacts").update({ stage }).eq("id", contact.id);
    const updated = { ...contact, stage };
    setContacts(cs => cs.map(c => c.id === contact.id ? updated : c));
    if (profile?.id === contact.id) setProfile(updated);
  }

  async function deleteContact(contact: Contact) {
    if (!confirm(`Delete ${contact.name}? This cannot be undone.`)) return;
    const supabase = createClient();
    await supabase.from("contacts").delete().eq("id", contact.id);
    setContacts(cs => cs.filter(c => c.id !== contact.id));
    if (profile?.id === contact.id) setProfile(null);
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
            <button onClick={() => router.push("/admin/cold-calls")}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors">
              📞 Cold Calls
            </button>
            <button
              onClick={() => { setSelected(null); setForm({ name: "", email: "", phone: "", brokerage: "", stage: "lead", notes: "" }); setShowAdd(true); }}
              className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors">
              + Add Contact
            </button>
          </div>
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
                  <th className="text-right px-4 py-3">Revenue</th>
                  <th className="text-left px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(contact => (
                  <tr
                    key={contact.id}
                    onClick={() => openProfile(contact)}
                    className={`border-b border-zinc-800/50 cursor-pointer transition-colors ${profile?.id === contact.id ? "bg-zinc-800/60" : "hover:bg-zinc-800/30"}`}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button onClick={() => toggleHot(contact)} className="text-lg leading-none" title="Toggle hot lead">
                        {contact.is_hot ? "🔥" : <span className="text-zinc-700 hover:text-zinc-500">🔥</span>}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium">{contact.name}</td>
                    <td className="px-4 py-3 text-zinc-400">{contact.email || "—"}</td>
                    <td className="px-4 py-3 text-zinc-400">{contact.brokerage || "—"}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <select
                        value={contact.stage}
                        onChange={e => updateStage(contact, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none ${STAGE_COLORS[contact.stage] || "bg-zinc-700 text-zinc-300"}`}
                      >
                        {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {contact.total_revenue > 0 ? `$${contact.total_revenue.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button onClick={() => deleteContact(contact)}
                        className="text-xs text-zinc-600 hover:text-red-400 transition-colors">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center text-zinc-500 py-16">No contacts found</div>
            )}
          </div>
        )}
      </div>

      {/* Profile Modal */}
      {profile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <button onClick={() => toggleHot(profile)} className="text-2xl leading-none">
                  {profile.is_hot ? "🔥" : <span className="text-zinc-700 hover:text-zinc-500">🔥</span>}
                </button>
                <div>
                  <h2 className="text-lg font-bold">{profile.name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STAGE_COLORS[profile.stage] || "bg-zinc-700 text-zinc-300"}`}>
                    {profile.stage}
                  </span>
                </div>
              </div>
              <button onClick={() => setProfile(null)} className="text-zinc-500 hover:text-white text-xl leading-none">✕</button>
            </div>

            {/* Contact info */}
            <div className="p-6 border-b border-zinc-800 space-y-4">
              {profileEditing ? (
                <form onSubmit={saveProfileEdit} className="space-y-3">
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Name" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="Phone" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="Email" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
                    <input value={form.brokerage} onChange={e => setForm(f => ({ ...f, brokerage: e.target.value }))}
                      placeholder="Brokerage" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
                    <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none">
                      {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Notes..." className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 resize-none" />
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setProfileEditing(false)}
                      className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm hover:bg-zinc-800 transition-colors">Cancel</button>
                    <button type="submit" disabled={saving}
                      className="flex-1 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 disabled:opacity-50">
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-zinc-500 text-xs mb-1">Phone</p>
                      <p>{profile.phone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs mb-1">Email</p>
                      <p className="truncate">{profile.email || "—"}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs mb-1">Brokerage</p>
                      <p>{profile.brokerage || "—"}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs mb-1">Revenue</p>
                      <p className="font-medium">{profile.total_revenue > 0 ? `$${profile.total_revenue.toLocaleString()}` : "—"}</p>
                    </div>
                  </div>
                  {profile.notes && (
                    <div>
                      <p className="text-zinc-500 text-xs mb-1">Notes</p>
                      <p className="text-sm text-zinc-300">{profile.notes}</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setProfileEditing(true)}
                      className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm hover:bg-zinc-800 transition-colors">Edit</button>
                    <button onClick={() => router.push(`/admin/cold-calls?contact=${profile.id}`)}
                      className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm transition-colors">📞 Call</button>
                    <button onClick={() => deleteContact(profile)}
                      className="px-4 py-2 rounded-lg border border-zinc-800 text-sm text-zinc-600 hover:text-red-400 hover:border-red-900 transition-colors">Delete</button>
                  </div>
                </>
              )}
            </div>

            {/* Call history */}
            <div className="p-6">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-4">Call History</p>
              {profileCalls.length === 0 ? (
                <p className="text-zinc-600 text-sm">No calls logged yet.</p>
              ) : (
                <div className="space-y-2">
                  {profileCalls.map(call => (
                    <div key={call.id} className="bg-zinc-800 rounded-lg p-3 flex items-start justify-between gap-3">
                      <div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          call.outcome === "booked" ? "bg-green-900 text-green-300" :
                          call.outcome === "interested" || call.outcome === "callback" ? "bg-blue-900 text-blue-300" :
                          call.outcome === "not_interested" ? "bg-red-950 text-red-400" :
                          "bg-zinc-700 text-zinc-300"
                        }`}>{OUTCOME_LABELS[call.outcome] || call.outcome}</span>
                        {call.listing_address && <p className="text-xs text-zinc-400 mt-1">{call.listing_address}</p>}
                        {call.notes && <p className="text-xs text-zinc-500 mt-1 italic">{call.notes}</p>}
                      </div>
                      <span className="text-xs text-zinc-500 whitespace-nowrap">
                        {new Date(call.called_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
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
