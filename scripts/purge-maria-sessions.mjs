#!/usr/bin/env node
/**
 * Purge Maria tutoring sessions for Matthew-Lim from Butterbase.
 * Usage: BUTTERBASE_API_KEY=... node scripts/purge-maria-sessions.mjs
 */

const APP_ID = process.env.BUTTERBASE_APP_ID ?? "app_tsc2mvlq21yo";
const API_BASE = process.env.BUTTERBASE_API_URL ?? `https://api.butterbase.ai/v1/${APP_ID}`;
const API_KEY = process.env.BUTTERBASE_API_KEY ?? process.env.butterbase_api_key;
const TUTOR = "Matthew-Lim";
const TUTEE_SLUG = "maria";

if (!API_KEY) {
  console.error("BUTTERBASE_API_KEY is required");
  process.exit(1);
}

async function bbFetch(path, init) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${path} failed (${response.status}): ${text}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const rows = await bbFetch(
  `/sessions?tutor_username=eq.${encodeURIComponent(TUTOR)}&tutee_slug=eq.${encodeURIComponent(TUTEE_SLUG)}&select=id,tutee_name,topic,status&limit=100`,
);

const sessions = Array.isArray(rows) ? rows : [];
console.log(`Found ${sessions.length} Maria session(s) for ${TUTOR}`);

for (const row of sessions) {
  const id = row.id;
  await bbFetch(`/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
  console.log(`Deleted ${id} · ${row.topic ?? ""} (${row.status ?? ""})`);
}

console.log(`Done. Removed ${sessions.length} session(s).`);
