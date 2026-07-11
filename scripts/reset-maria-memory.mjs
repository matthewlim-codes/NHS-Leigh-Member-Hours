#!/usr/bin/env node
/**
 * Reset Jordan Lee tutee memory in Butterbase to first-session demo profile.
 * Also removes legacy Maria slug rows if present.
 * Usage: BUTTERBASE_API_KEY=... node scripts/reset-maria-memory.mjs
 */

const APP_ID = process.env.BUTTERBASE_APP_ID ?? "app_tsc2mvlq21yo";
const API_BASE = process.env.BUTTERBASE_API_URL ?? `https://api.butterbase.ai/v1/${APP_ID}`;
const API_KEY = process.env.BUTTERBASE_API_KEY ?? process.env.butterbase_api_key;

const JORDAN_SLUG = "jordan-lee";
const LEGACY_SLUGS = ["maria", "maria-garcia"];

const jordanMemory = {
  tutee_slug: JORDAN_SLUG,
  tutee_name: "Jordan Lee",
  profile: {
    grade: "10",
    assignedBy: "Ms. Patel · IM2 Period 2",
    teacherNotes: [
      "Assigned by Ms. Patel · IM2 Period 2 for Algebra II / IM2",
      "Needs help factoring quadratics before the unit quiz. Prefers worked examples.",
    ],
    preferredApproach: "worked examples / step-by-step",
    struggles: ["factoring quadratics before the unit quiz"],
    skills: [],
  },
  episodes: [],
  updated_at: new Date().toISOString(),
};

if (!API_KEY) {
  console.error("BUTTERBASE_API_KEY is required");
  process.exit(1);
}

async function bbFetch(path, init) {
  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    ...(init?.body ? { "Content-Type": "application/json" } : {}),
    ...(init?.headers ?? {}),
  };
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${path} failed (${response.status}): ${text}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function deleteBySlug(slug) {
  const rows = await bbFetch(
    `/tutee_memory?tutee_slug=eq.${encodeURIComponent(slug)}&select=id,tutee_slug&limit=10`,
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`No tutee_memory row for slug "${slug}"`);
    return;
  }
  for (const row of rows) {
    await bbFetch(`/tutee_memory/${encodeURIComponent(row.id)}`, { method: "DELETE" });
    console.log(`Deleted memory ${row.id} (${slug})`);
  }
}

for (const slug of LEGACY_SLUGS) {
  await deleteBySlug(slug);
}
await deleteBySlug(JORDAN_SLUG);

const created = await bbFetch("/tutee_memory", {
  method: "POST",
  body: JSON.stringify(jordanMemory),
});
console.log("Created fresh Jordan Lee memory:", created?.id ?? created);
