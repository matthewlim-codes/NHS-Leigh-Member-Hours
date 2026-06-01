import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, membersTable } from "@workspace/db";
import { LoginBody, ChangePasswordBody, LoginResponse, GetMeResponse, ChangePasswordResponse, LogoutResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { getMemberFromSheet, getStudentIdTemporaryPassword } from "../lib/sheets";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { username, password } = parsed.data;

  const [existingMember] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.username, username));

  if (existingMember) {
    // Block login if member no longer in sheet
    const sheetMember = await getMemberFromSheet(username);
    if (!sheetMember) {
      res.status(401).json({ error: "Your account could not be found in the member list. Please contact your administrator." });
      return;
    }

    let passwordMatches = await bcrypt.compare(password, existingMember.passwordHash);
    if (!passwordMatches && existingMember.mustChangePassword && password === getStudentIdTemporaryPassword(sheetMember.studentId)) {
      const passwordHash = await bcrypt.hash(password, 12);
      await db
        .update(membersTable)
        .set({ passwordHash })
        .where(eq(membersTable.id, existingMember.id));
      passwordMatches = true;
    }

    if (!passwordMatches) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    req.session.userId = existingMember.id;
    req.session.username = existingMember.username;
    req.session.mustChangePassword = existingMember.mustChangePassword;

    req.log.info({ username: existingMember.username }, "User logged in");

    res.json(LoginResponse.parse({
      id: existingMember.id,
      username: existingMember.username,
      mustChangePassword: existingMember.mustChangePassword,
    }));
    return;
  }

  // No account yet — verify against Google Sheets and temp password
  const sheetMember = await getMemberFromSheet(username);
  if (!sheetMember) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const expectedTempPassword = getStudentIdTemporaryPassword(sheetMember.studentId);
  if (password !== expectedTempPassword) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  // Auto-provision the account
  const passwordHash = await bcrypt.hash(password, 12);
  const [newMember] = await db
    .insert(membersTable)
    .values({ username, passwordHash, mustChangePassword: true })
    .returning();

  req.session.userId = newMember.id;
  req.session.username = newMember.username;
  req.session.mustChangePassword = true;

  req.log.info({ username: newMember.username }, "New member account provisioned and logged in");

  res.json(LoginResponse.parse({
    id: newMember.id,
    username: newMember.username,
    mustChangePassword: true,
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
    mustChangePassword: member.mustChangePassword,
  }));
});

router.post("/auth/change-password", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  const [member] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, req.session.userId));

  if (!member) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const currentMatches = await bcrypt.compare(currentPassword, member.passwordHash);
  if (!currentMatches) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const sameAsOld = await bcrypt.compare(newPassword, member.passwordHash);
  if (sameAsOld) {
    res.status(400).json({ error: "New password must be different from your current password" });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 12);

  const [updated] = await db
    .update(membersTable)
    .set({ passwordHash: newHash, mustChangePassword: false })
    .where(eq(membersTable.id, member.id))
    .returning();

  req.session.mustChangePassword = false;

  req.log.info({ username: member.username }, "Password changed");

  res.json(ChangePasswordResponse.parse({
    id: updated.id,
    username: updated.username,
    mustChangePassword: updated.mustChangePassword,
  }));
});

export default router;
