import { eq } from "drizzle-orm";
import { listMembersFromSheet } from "../lib/sheets";

const shouldDelete = process.argv.includes("--delete");
let closePool: (() => Promise<void>) | undefined;

try {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Run this command in the Replit environment that has the app database secret.");
  }

  const { db, membersTable, pool } = await import("@workspace/db");
  closePool = () => pool.end();
  const sheetMembers = await listMembersFromSheet();
  const currentUsernames = new Set(sheetMembers.map((member) => member.username));

  if (currentUsernames.size === 0) {
    throw new Error("No current members were loaded from Google Sheets; refusing to delete any database accounts.");
  }

  const dbMembers = await db
    .select({
      id: membersTable.id,
      username: membersTable.username,
    })
    .from(membersTable);

  const staleMembers = dbMembers.filter((member) => !currentUsernames.has(member.username));

  console.log(`Current sheet members: ${currentUsernames.size}`);
  console.log(`Database accounts: ${dbMembers.length}`);
  console.log(`Stale accounts: ${staleMembers.length}`);

  if (staleMembers.length > 0) {
    console.log("Stale usernames:");
    for (const member of staleMembers) {
      console.log(`- ${member.username}`);
    }
  }

  if (!shouldDelete) {
    console.log("Dry run only. Re-run with --delete to remove stale accounts.");
  } else {
    for (const member of staleMembers) {
      await db.delete(membersTable).where(eq(membersTable.id, member.id));
    }
    console.log(`Deleted ${staleMembers.length} stale account(s).`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closePool?.();
}
