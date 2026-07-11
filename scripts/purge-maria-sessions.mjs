#!/usr/bin/env node
/**
 * Purge Maria tutoring sessions for Matthew-Lim from Butterbase.
 * Usage: BUTTERBASE_API_KEY=... node scripts/purge-maria-sessions.mjs
 */

const APP_ID = process.env.BUTTERBASE_APP_ID ?? "app_tsc2mvlq21yo";
const API_BASE = process.env.BUTTERBASE_API_URL ?? `https://api.butterbase.ai/v1/${APP_ID}`;
const API_KEY = process.env.BUTTERBASE_API_KEY ?? process.env.butterbase_api_key;
const TUTOR = "Matthew-Lim";
const TUTEE_SLUGS = ["maria", "maria-garcia", "jordan-lee"];

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

let totalRemoved = 0;

for (const slug of TUTEE_SLUGS) {
  const rows = await bbFetch(
    `/sessions?tutor_username=eq.${encodeURIComponent(TUTOR)}&tutee_slug=eq.${encodeURIComponent(slug)}&select=id,tutee_name,tutee_slug,topic,status&limit=100`,
  );
  const sessions = Array.isArray(rows) ? rows : [];
  console.log(`Found ${sessions.length} session(s) for ${TUTOR} / ${slug}`);

  for (const row of sessions) {
    const id = row.id;
    await bbFetch(`/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
    console.log(`Deleted ${id} · ${row.tutee_name ?? slug} · ${row.topic ?? ""} (${row.status ?? ""})`);
    totalRemoved += 1;
  }
}

console.log(`Done. Removed ${totalRemoved} session(s).`);
