import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, membersTable } from "@workspace/db";
import { GetDashboardResponse } from "@workspace/api-zod";
import { getMemberFromSheet } from "../lib/sheets";

const router: IRouter = Router();

router.get("/dashboard", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [member] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, req.session.userId));

  if (!member) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const sheetMember = await getMemberFromSheet(member.username);

  if (!sheetMember) {
    res.status(404).json({ error: "Your record was not found in the spreadsheet. Please contact your administrator." });
    return;
  }

  res.json(GetDashboardResponse.parse({
    displayName: sheetMember.displayName,
    hours: sheetMember.hours,
  }));
});

export default router;
