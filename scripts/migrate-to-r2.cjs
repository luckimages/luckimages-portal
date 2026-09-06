// One-time migration: copies every object from the old Supabase Storage
// buckets into the new R2 buckets, preserving paths exactly so the `media`
// table's stored paths stay valid with zero DB changes needed.
//
// COPY ONLY — nothing is ever deleted from Supabase here. Safe to re-run;
// already-migrated files are skipped by default (pass --force to re-copy).
//
// Usage: node scripts/migrate-to-r2.cjs [--force] [--dry-run]

const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^=#]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;

const { createClient } = require("@supabase/supabase-js");
const { S3Client, PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
  console.error("Missing R2 credentials in .env.local (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY). Set them and re-run.");
  process.exit(1);
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});

// Recursively lists every file under `prefix` in a Supabase Storage bucket.
// Supabase's list() is one level at a time and marks folders by omitting id.
async function listAllSupabaseFiles(bucket, prefix = "") {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
  let files = [];
  for (const item of data || []) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) {
      files.push(itemPath);
    } else {
      files = files.concat(await listAllSupabaseFiles(bucket, itemPath));
    }
  }
  return files;
}

async function r2ObjectSize(bucket, key) {
  try {
    const res = await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return res.ContentLength ?? null;
  } catch {
    return null; // doesn't exist yet
  }
}

async function migrateBucket(supabaseBucket, r2Bucket, keyPrefix = "") {
  console.log(`\n=== ${supabaseBucket} → ${r2Bucket}${keyPrefix ? " (prefix: " + keyPrefix + ")" : ""} ===`);
  const files = await listAllSupabaseFiles(supabaseBucket);
  console.log(`Found ${files.length} file(s) in ${supabaseBucket}`);

  let copied = 0, skipped = 0, failed = 0, totalBytes = 0;

  for (const filePath of files) {
    const destKey = keyPrefix ? `${keyPrefix}${filePath}` : filePath;
    try {
      if (!FORCE) {
        const existingSize = await r2ObjectSize(r2Bucket, destKey);
        if (existingSize !== null) { skipped++; continue; }
      }

      if (DRY_RUN) {
        console.log(`[dry-run] would copy ${supabaseBucket}/${filePath} → ${r2Bucket}/${destKey}`);
        copied++;
        continue;
      }

      const { data: fileData, error: dlError } = await supabase.storage.from(supabaseBucket).download(filePath);
      if (dlError || !fileData) throw new Error(dlError?.message || "download failed");
      const buffer = Buffer.from(await fileData.arrayBuffer());

      const contentType = fileData.type || "application/octet-stream";
      await r2.send(new PutObjectCommand({ Bucket: r2Bucket, Key: destKey, Body: buffer, ContentType: contentType }));

      // Verify: byte size must match before we count this as done.
      const uploadedSize = await r2ObjectSize(r2Bucket, destKey);
      if (uploadedSize !== buffer.length) {
        throw new Error(`size mismatch after upload: source ${buffer.length} bytes, R2 reports ${uploadedSize}`);
      }

      copied++;
      totalBytes += buffer.length;
      if (copied % 25 === 0) console.log(`  ...${copied} copied so far`);
    } catch (e) {
      failed++;
      console.error(`  FAILED: ${supabaseBucket}/${filePath}: ${e.message}`);
    }
  }

  console.log(`${supabaseBucket}: ${copied} copied, ${skipped} already present, ${failed} failed. ${(totalBytes / 1024 / 1024).toFixed(1)} MB transferred.`);
  return { copied, skipped, failed };
}

async function run() {
  console.log(DRY_RUN ? "DRY RUN — no files will actually be copied.\n" : "Live run — copying files. Nothing is deleted from Supabase.\n");

  const results = await Promise.all([
    migrateBucket("shoot-media", "luckimages-media"),
    migrateBucket("shoot-thumbnails", "luckimages-thumbnails"),
    migrateBucket("avatars", "luckimages-thumbnails", "avatars/"),
  ]);

  const totalFailed = results.reduce((s, r) => s + r.failed, 0);
  console.log(`\n=== Done. ${totalFailed} total failure(s). ===`);
  if (totalFailed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
