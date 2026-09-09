/**
 * One-time QuickBooks import — seeds contacts + past shoots from QBO invoices.
 *
 * Run:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node import_qbo.js
 *
 * Safe to run multiple times — contacts upsert by email, shoots skip
 * any row that already has the same contact_id + address combination.
 */

const { createClient } = require("@supabase/supabase-js");
const data = require("./qbo_import_data.json");

const supabase = createClient(
  "https://jrgflpemeezqgkmelzfd.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  let contactsCreated = 0, contactsUpdated = 0, shootsCreated = 0, shootsSkipped = 0;

  for (const client of data) {
    // ── 1. Upsert contact ──────────────────────────────────────────────────
    let contactId;

    if (client.email) {
      // Check if contact already exists by email
      const { data: existing } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("email", client.email)
        .maybeSingle();

      if (existing) {
        // Update name if it's more complete (e.g. was imported as first-name-only before)
        if (existing.name !== client.name) {
          await supabase.from("contacts").update({ name: client.name }).eq("id", existing.id);
          contactsUpdated++;
        }
        contactId = existing.id;
      } else {
        const { data: inserted, error } = await supabase
          .from("contacts")
          .insert({ name: client.name, email: client.email, type: "client", stage: "client" })
          .select("id")
          .single();

        if (error) {
          console.error(`  ✗ Contact insert failed for ${client.name}: ${error.message}`);
          continue;
        }
        contactId = inserted.id;
        contactsCreated++;
      }
    } else {
      // No email — match by name only (less reliable, log it)
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .ilike("name", client.name)
        .maybeSingle();

      if (existing) {
        contactId = existing.id;
      } else {
        const { data: inserted, error } = await supabase
          .from("contacts")
          .insert({ name: client.name, type: "client", stage: "client" })
          .select("id")
          .single();

        if (error) {
          console.error(`  ✗ Contact insert failed for ${client.name}: ${error.message}`);
          continue;
        }
        contactId = inserted.id;
        contactsCreated++;
      }
    }

    // ── 2. Insert shoots ───────────────────────────────────────────────────
    for (const shoot of client.shoots) {
      // Check for existing shoot: same contact + address (close enough for dedup)
      const { data: existing } = await supabase
        .from("shoots")
        .select("id")
        .eq("contact_id", contactId)
        .eq("address", shoot.address)
        .maybeSingle();

      if (existing) {
        shootsSkipped++;
        continue;
      }

      // scheduled_at: invoice date at noon CST (UTC-6 = 18:00 UTC)
      const scheduledAt = `${shoot.date}T18:00:00.000Z`;

      const { error } = await supabase.from("shoots").insert({
        contact_id: contactId,
        address: shoot.address,
        scheduled_at: scheduledAt,
        services: shoot.services,
        price: shoot.amount,
        status: "completed",
      });

      if (error) {
        console.error(`  ✗ Shoot insert failed ${shoot.address}: ${error.message}`);
      } else {
        shootsCreated++;
      }
    }

    const tag = client.email ? client.email : "(no email)";
    console.log(`  ${client.name} <${tag}> — ${client.shoots.length} shoot(s)`);
  }

  console.log("\n── Summary ──────────────────────────────────────");
  console.log(`Contacts created : ${contactsCreated}`);
  console.log(`Contacts updated : ${contactsUpdated}`);
  console.log(`Shoots created   : ${shootsCreated}`);
  console.log(`Shoots skipped   : ${shootsSkipped} (already existed)`);
}

run().catch(err => { console.error("Fatal:", err); process.exit(1); });
