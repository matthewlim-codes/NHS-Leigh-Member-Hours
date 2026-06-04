import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, membersTable } from "@workspace/db";
import { LoginBody, LoginResponse, GetMeResponse, LogoutResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import {
  SheetAccessError,
  SheetConfigError,
  getMemberFromSheet,
  getStudentIdTemporaryPassword,
  type SheetMember,
} from "../lib/sheets";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { username, password } = parsed.data;

  let sheetMember: SheetMember | null;
  try {
    sheetMember = await getMemberFromSheet(username);
  } catch (err) {
    req.log.error({ err, username }, "Failed to load member sheet during login");

    if (err instanceof SheetConfigError) {
      res.status(503).json({ error: "The member sheet is not configured. Please ask an officer to check the app's Google Sheet settings." });
      return;
    }

    if (err instanceof SheetAccessError) {
      res.status(503).json({ error: "We couldn't reach the member sheet. Please try again later or contact an NHS officer." });
      return;
    }

    res.status(503).json({ error: "We couldn't check your member record right now. Please try again later or contact an NHS officer." });
    return;
  }

  if (!sheetMember) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  if (password !== getStudentIdTemporaryPassword(sheetMember.studentId)) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const [existingMember] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.username, username));

  if (existingMember) {
    req.session.userId = existingMember.id;
    req.session.username = existingMember.username;

    req.log.info({ username: existingMember.username }, "User logged in");

    res.json(LoginResponse.parse({
      id: existingMember.id,
      username: existingMember.username,
    }));
    return;
  }

  // Auto-provision the account
  const passwordHash = await bcrypt.hash(password, 12);
  const [newMember] = await db
    .insert(membersTable)
    .values({ username, passwordHash })
    .returning();

  req.session.userId = newMember.id;
  req.session.username = newMember.username;

  req.log.info({ username: newMember.username }, "New member account provisioned and logged in");

  res.json(LoginResponse.parse({
    id: newMember.id,
    username: newMember.username,
  }));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy((err) => {
    if (err) {
      logger.error({ err }, "Failed to destroy session");
    }
  });
  res.json(LogoutResponse.parse({ success: true }));
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [member] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, req.session.userId));

  if (!member) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json(GetMeResponse.parse({
    id: member.id,
    username: member.username,
  }));
});

export default router;
