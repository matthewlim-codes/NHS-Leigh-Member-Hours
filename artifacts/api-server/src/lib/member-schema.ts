import { pool } from "@workspace/db";

let ensureMemberTrackingColumnsPromise: Promise<void> | null = null;

export function ensureMemberTrackingColumns(): Promise<void> {
  ensureMemberTrackingColumnsPromise ??= (async () => {
    await pool.query(`
      ALTER TABLE members
        ADD COLUMN IF NOT EXISTS sheet_row_signature text,
        ADD COLUMN IF NOT EXISTS sheet_row_updated_at timestamptz
    `);
  })();

  return ensureMemberTrackingColumnsPromise;
}
