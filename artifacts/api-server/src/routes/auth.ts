import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, membersTable } from "@workspace/db";
import { LoginBody, LoginResponse, GetMeResponse, LogoutResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { getMemberFromSheet, getStudentIdTemporaryPassword } from "../lib/sheets";

const router: IRouter = Router();

/** Fixed sentinel id for teacher sessions (not in members table). */
const TEACHER_USER_ID = -1;
const TEACHER_USERNAME = "Teacher";
const TEACHER_ACCESS_CODE = "teacher";

function authUserPayload(user: {
  id: number;
  username: string;
  role?: "member" | "teacher";
}) {
  return LoginResponse.parse({
    id: user.id,
    username: user.username,
    role: user.role ?? "member",
  });
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { username, password } = parsed.data;

  const sheetMember = await getMemberFromSheet(username);
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
    req.session.role = "member";

    req.log.info({ username: existingMember.username }, "User logged in");

    res.json(authUserPayload({
      id: existingMember.id,
      username: existingMember.username,
      role: "member",
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
  req.session.role = "member";

  req.log.info({ username: newMember.username }, "New member account provisioned and logged in");

  res.json(authUserPayload({
    id: newMember.id,
    username: newMember.username,
    role: "member",
  }));
});

router.post("/auth/teacher-login", async (req, res): Promise<void> => {
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!code) {
    res.status(400).json({ error: "Access code is required" });
    return;
  }

  if (code !== TEACHER_ACCESS_CODE) {
    res.status(401).json({ error: "Invalid teacher access code" });
    return;
  }

  req.session.userId = TEACHER_USER_ID;
  req.session.username = TEACHER_USERNAME;
  req.session.role = "teacher";

  req.log.info({ username: TEACHER_USERNAME }, "Teacher logged in");

  res.json(authUserPayload({
    id: TEACHER_USER_ID,
    username: TEACHER_USERNAME,
    role: "teacher",
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
  if (!req.session.userId || !req.session.username) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (req.session.role === "teacher" || req.session.userId === TEACHER_USER_ID) {
    res.json(GetMeResponse.parse({
      id: TEACHER_USER_ID,
      username: req.session.username || TEACHER_USERNAME,
      role: "teacher",
    }));
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
    role: "member",
  }));
});

export default router;
