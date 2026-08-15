/**
 * One-time contact dedup script.
 *
 * Finds duplicates two ways:
 *   1. Same email (case-insensitive) — auto-merges, definitely the same person
 *   2. Same name (case-insensitive, different emails) — lists them for manual review
 *
 * Run:
 *   SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2) node dedup_contacts.js
 *
 * Add --merge-names to also auto-merge same-name pairs (only do this if you're sure).
 */

const { createClient } = require("@supabase/supabase-js");

const db = createClient(
  "https://jrgflpemeezqgkmelzfd.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Tables that reference contacts — all get re-pointed to the keeper on merge
const CONTACT_REF_TABLES = [
  { table: "shoots",      col: "contact_id" },
  { table: "invoices",    col: "contact_id" },
  { table: "email_log",   col: "contact_id" },
  { table: "link_clicks", col: "contact_id" },
  { table: "cold_calls",  col: "contact_id" },
  { table: "messages",    col: "contact_id" },
  { table: "quotes",      col: "contact_id" },
];

async function mergeContacts(keepId, dropId, reason) {
  console.log(`  Merging ${dropId} → ${keepId} (${reason})`);

  // Fetch both contacts
  const [{ data: keep }, { data: drop }] = await Promise.all([
    db.from("contacts").select("*").eq("id", keepId).single(),
    db.from("contacts").select("*").eq("id", dropId).single(),
  ]);

  if (!keep || !drop) { console.error("  ✗ Could not fetch both contacts"); return; }

  // Patch keeper with any missing fields from the duplicate
  const patch = {};
  if (!keep.email    && drop.email)    patch.email    = drop.email;
  if (!keep.phone    && drop.phone)    patch.phone    = drop.phone;
  if (!keep.brokerage && drop.brokerage) patch.brokerage = drop.brokerage;
  if (!keep.notes    && drop.notes)    patch.notes    = drop.notes;
  if (!keep.user_id  && drop.user_id)  patch.user_id  = drop.user_id;
  if (!keep.lead_source && drop.lead_source) patch.lead_source = drop.lead_source;
  if (!keep.total_revenue && drop.total_revenue) patch.total_revenue = drop.total_revenue;
  if (Object.keys(patch).length > 0) {
    await db.from("contacts").update(patch).eq("id", keepId);
    console.log(`  ↳ Patched keeper with: ${Object.keys(patch).join(", ")}`);
  }

  // Re-point all child records
  for (const { table, col } of CONTACT_REF_TABLES) {
    const { count } = await db.from(table).select("id", { count: "exact", head: true }).eq(col, dropId);
    if (count && count > 0) {
      await db.from(table).update({ [col]: keepId }).eq(col, dropId);
      console.log(`  ↳ Moved ${count} row(s) in ${table}`);
    }
  }

  // Delete the duplicate
  const { error } = await db.from("contacts").delete().eq("id", dropId);
  if (error) console.error(`  ✗ Delete failed: ${error.message}`);
  else console.log(`  ✓ Deleted duplicate contact ${dropId}`);
}

function pickKeeper(a, b) {
  // Prefer the one that's registered (has user_id)
  if (a.user_id && !b.user_id) return [a, b];
  if (b.user_id && !a.user_id) return [b, a];
  // Then prefer the one with an email
  if (a.email && !b.email) return [a, b];
  if (b.email && !a.email) return [b, a];
  // Then the older record
  return new Date(a.created_at) <= new Date(b.created_at) ? [a, b] : [b, a];
}

async function run() {
  const mergeNames = process.argv.includes("--merge-names");

  const { data: contacts, error } = await db
    .from("contacts")
    .select("id, name, email, phone, user_id, brokerage, notes, lead_source, total_revenue, created_at, stage")
    .neq("stage", "deleted");

  if (error) { console.error("Failed to load contacts:", error.message); process.exit(1); }

  console.log(`Loaded ${contacts.length} contacts\n`);

  // ── 1. Same email (case-insensitive) ──────────────────────────────────────
  const byEmail = new Map();
  for (const c of contacts) {
    if (!c.email) continue;
    const key = c.email.toLowerCase().trim();
    if (!byEmail.has(key)) byEmail.set(key, []);
    byEmail.get(key).push(c);
  }

  const emailDupes = [...byEmail.values()].filter(g => g.length > 1);
  console.log(`── Same-email duplicates: ${emailDupes.length} group(s) ──────────────────`);

  let emailMerged = 0;
  for (const group of emailDupes) {
    const [keep, ...drops] = group.sort((a, b) => {
      const [k] = pickKeeper(a, b);
      return k.id === a.id ? -1 : 1;
    });
    console.log(`\n  "${group[0].name}" — email: ${group[0].email?.toLowerCase()}`);
    for (const drop of drops) {
      await mergeContacts(keep.id, drop.id, "same email (case-insensitive)");
      emailMerged++;
    }
  }
  if (emailDupes.length === 0) console.log("  None found.");

  // ── 2. Honorific duplicates — "Mr John Smith" vs "John Smith" ────────────────
  // Auto-merge: the prefixed one is always the QBO import artifact; keep the one with an email.
  const HONORIFICS = /^(mr\.?|mrs\.?|ms\.?|dr\.?|prof\.?)\s+/i;
  const normName = (n) => n?.toLowerCase().trim().replace(HONORIFICS, "") ?? "";
  const hasHonorific = (n) => HONORIFICS.test(n?.trim() || "");

  // Reload contacts after email merges
  const { data: freshContacts } = await db
    .from("contacts")
    .select("id, name, email, phone, user_id, brokerage, notes, lead_source, total_revenue, created_at, stage")
    .neq("stage", "deleted");
  const alive = freshContacts || contacts;

  const byNormName = new Map();
  for (const c of alive) {
    const key = normName(c.name);
    if (!key) continue;
    if (!byNormName.has(key)) byNormName.set(key, []);
    byNormName.get(key).push(c);
  }

  const honorificGroups = [...byNormName.values()].filter(g => g.length > 1 && g.some(c => hasHonorific(c.name)));
  console.log(`\n── Honorific duplicates (auto-merged): ${honorificGroups.length} group(s) ─────`);

  let honorificMerged = 0;
  const honorificMergedIds = new Set();
  for (const group of honorificGroups) {
    const plain  = group.filter(c => !hasHonorific(c.name));
    const titled = group.filter(c =>  hasHonorific(c.name));
    // keep the plain-name one (or the one with email if both plain)
    const [keep, ...drops] = [...plain, ...titled].sort((a, b) => {
      const [k] = pickKeeper(a, b);
      return k.id === a.id ? -1 : 1;
    });
    console.log(`\n  "${group.map(c=>c.name).join('" + "')}" → keep "${keep.name}"`);
    for (const drop of drops) {
      await mergeContacts(keep.id, drop.id, "honorific duplicate");
      honorificMergedIds.add(drop.id);
      honorificMerged++;
    }
  }
  if (honorificGroups.length === 0) console.log("  None found.");

  // ── 3. Same name (case-insensitive, honorific-stripped), different emails ────
  const byName = new Map();
  for (const c of alive) {
    if (honorificMergedIds.has(c.id)) continue;
    const key = normName(c.name);
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(c);
  }

  // Exclude pairs already merged above
  const mergedIds = new Set([...emailDupes.flatMap(g => g.slice(1).map(c => c.id)), ...honorificMergedIds]);
  const nameDupes = [...byName.values()].filter(g => {
    const stillAlive = g.filter(c => !mergedIds.has(c.id));
    return stillAlive.length > 1;
  });

  console.log(`\n── Same-name duplicates: ${nameDupes.length} group(s) ─────────────────────`);

  let nameMerged = 0;
  for (const group of nameDupes) {
    const alive = group.filter(c => !mergedIds.has(c.id));
    console.log(`\n  "${alive[0].name}"`);
    alive.forEach(c => console.log(`    id=${c.id}  email=${c.email || "(none)"}  phone=${c.phone || "(none)"}`));

    if (mergeNames) {
      const [keep, ...drops] = alive;
      for (const drop of drops) {
        await mergeContacts(keep.id, drop.id, "same name");
        nameMerged++;
      }
    } else {
      console.log("    → Skipped (run with --merge-names to auto-merge, or use the Nocturne UI)");
    }
  }
  if (nameDupes.length === 0) console.log("  None found.");

  console.log(`\n── Summary ───────────────────────────────────────────────────────────────`);
  console.log(`Same-email merges     : ${emailMerged}`);
  console.log(`Honorific merges      : ${honorificMerged}`);
  console.log(`Same-name merges      : ${nameMerged}`);
  if (nameDupes.length > 0 && !mergeNames) {
    console.log(`\nReview the ${nameDupes.length} same-name group(s) above in the Nocturne contacts page.`);
    console.log(`They'll appear in the duplicate banner for you to confirm or dismiss.`);
  }
}

run().catch(err => { console.error("Fatal:", err); process.exit(1); });
