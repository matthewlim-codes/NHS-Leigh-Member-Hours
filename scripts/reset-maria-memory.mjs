#!/usr/bin/env node
/**
 * Reset Maria Garcia tutee memory in Butterbase to first-session demo profile.
 * Usage: BUTTERBASE_API_KEY=... node scripts/reset-maria-memory.mjs
 */

const APP_ID = process.env.BUTTERBASE_APP_ID ?? "app_tsc2mvlq21yo";
const API_BASE = process.env.BUTTERBASE_API_URL ?? `https://api.butterbase.ai/v1/${APP_ID}`;
const API_KEY = process.env.BUTTERBASE_API_KEY ?? process.env.butterbase_api_key;

const MARIA_SLUG = "maria-garcia";
const LEGACY_SLUG = "maria";

const mariaMemory = {
  tutee_slug: MARIA_SLUG,
  tutee_name: "Maria Garcia",
  profile: {
    grade: "10",
    assignedBy: "Ms. Chen · Period 3",
    teacherNotes: [
      "Assigned by Ms. Chen · Period 3 for Algebra II",
      "Recent quiz showed sign errors when factoring trinomials",
      "Struggles with word problems — prefers visual, step-by-step models",
      "Confidence drops quickly when signs flip; start with encouragement",
    ],
    preferredApproach: "visual / step-by-step",
    struggles: ["sign errors when factoring", "word problems feel overwhelming"],
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
  const method = init?.method?.toUpperCase() ?? "GET";
  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    ...(init?.body ? { "Content-Type": "application/json" } : {}),
    ...(init?.headers ?? {}),
  };
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    method,
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
    console.log(`Deleted legacy memory ${row.id} (${slug})`);
  }
}

await deleteBySlug(LEGACY_SLUG);
await deleteBySlug(MARIA_SLUG);

const created = await bbFetch("/tutee_memory", {
  method: "POST",
  body: JSON.stringify(mariaMemory),
});
console.log("Created fresh Maria Garcia memory:", created?.id ?? created);
