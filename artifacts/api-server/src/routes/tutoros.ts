import { Router, type IRouter } from "express";
import { isEverOSConfigured } from "../lib/everos-client";
import { recordTutoringSession } from "../lib/tutor-memory";
import {
  createSession,
  getSession,
  listSessionsForTutor,
  rememberAfterVerify,
  scoreVerification,
  updateSession,
  getButterbaseAppId,
  type SessionType,
  type TutorRubric,
} from "../lib/tutoros-store";

const router: IRouter = Router();

function requireAuth(req: { session: { userId?: number; username?: string } }, res: { status: (n: number) => { json: (b: unknown) => void } }): string | null {
  if (!req.session.userId || !req.session.username) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return req.session.username;
}

router.get("/tutoros/meta", (_req, res): void => {
  res.json({
    appId: getButterbaseAppId(),
    everosConfigured: isEverOSConfigured(),
    butterbaseConfigured: Boolean(process.env.BUTTERBASE_API_KEY),
    prepAgent: "llm",
  });
});

router.post("/tutoros/sessions/start", async (req, res): Promise<void> => {
  const username = requireAuth(req, res);
  if (!username) return;

  const tuteeName = typeof req.body?.tuteeName === "string" ? req.body.tuteeName.trim() : "";
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";

  if (!tuteeName || !subject || !topic) {
    res.status(400).json({ error: "tuteeName, subject, and topic are required" });
    return;
  }

  try {
    const session = await createSession({
      tutorUsername: username,
      tuteeName,
      subject,
      topic,
    });
    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to start session",
    });
  }
});

router.get("/tutoros/sessions", async (req, res): Promise<void> => {
  const username = requireAuth(req, res);
  if (!username) return;

  try {
    const sessions = await listSessionsForTutor(username);
    const verified = sessions.filter((s) => s.learningMoment).length;
    const awaiting = sessions.filter(
      (s) => s.status === "awaiting_verify" && s.timerStarted,
    ).length;
    res.json({
      sessions,
      stats: {
        total: sessions.filter((s) => s.timerStarted || s.status === "verified").length,
        learningMoments: verified,
        unverified: sessions.filter(
          (s) =>
            s.timerStarted &&
            (s.status === "logged" || s.status === "awaiting_verify"),
        ).length,
        awaitingVerify: awaiting,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list sessions",
    });
  }
});

router.get("/tutoros/sessions/:id", async (req, res): Promise<void> => {
  try {
    const session = await getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    // Public read for verify flow (student on tutor's phone / link)
    res.json(session);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load session",
    });
  }
});

router.post("/tutoros/sessions/:id/begin", async (req, res): Promise<void> => {
  const username = requireAuth(req, res);
  if (!username) return;

  try {
    const session = await getSession(req.params.id);
    if (!session || session.tutorUsername !== username) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    if (session.status !== "prep") {
      res.status(400).json({ error: "Session timer has already started or session ended" });
      return;
    }
    const updated = await updateSession(session.id, {
      status: "active",
      startedAt: new Date().toISOString(),
      timerStarted: true,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to begin session",
    });
  }
});

router.post("/tutoros/sessions/:id/end", async (req, res): Promise<void> => {
  const username = requireAuth(req, res);
  if (!username) return;

  const rubric = req.body?.tutorRubric as TutorRubric | undefined;
  const sessionType = req.body?.sessionType as SessionType | undefined;
  const durationMinutes =
    typeof req.body?.durationMinutes === "number" ? req.body.durationMinutes : undefined;

  if (!rubric || !["independent", "with_hints", "not_yet"].includes(rubric)) {
    res.status(400).json({ error: "tutorRubric must be independent | with_hints | not_yet" });
    return;
  }
  if (!sessionType || !["hw_center", "tutorial"].includes(sessionType)) {
    res.status(400).json({ error: "sessionType must be hw_center | tutorial" });
    return;
  }
  if (durationMinutes !== undefined && (durationMinutes < 1 || durationMinutes > 240)) {
    res.status(400).json({ error: "durationMinutes must be 1–240" });
    return;
  }

  try {
    const session = await getSession(req.params.id);
    if (!session || session.tutorUsername !== username) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (session.status !== "active" || !session.timerStarted) {
      res.status(400).json({ error: "Session timer must be running before ending" });
      return;
    }

    const endedAt = new Date().toISOString();
    const computedDuration =
      durationMinutes ??
      Math.max(
        1,
        Math.round(
          (Date.parse(endedAt) - Date.parse(session.startedAt ?? endedAt)) / 60000,
        ),
      );

    const updated = await updateSession(session.id, {
      status: "awaiting_verify",
      endedAt,
      durationMinutes: computedDuration,
      sessionType,
      tutorRubric: rubric,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to end session",
    });
  }
});

router.post("/tutoros/sessions/:id/verify", async (req, res): Promise<void> => {
  const explanation =
    typeof req.body?.explanation === "string" ? req.body.explanation.trim() : "";
  const answer = typeof req.body?.answer === "string" ? req.body.answer.trim() : "";

  if (!explanation || !answer) {
    res.status(400).json({ error: "explanation and answer are required" });
    return;
  }

  try {
    const session = await getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    if (session.status !== "awaiting_verify" && session.status !== "active") {
      res.status(400).json({ error: "Session is not awaiting verification" });
      return;
    }
    if (!session.tutorRubric) {
      res.status(400).json({ error: "Tutor must complete the rubric before verify" });
      return;
    }

    const scored = scoreVerification({
      explanation,
      answer,
      topic: session.topic,
      tutorRubric: session.tutorRubric,
    });

    const updated = await updateSession(session.id, {
      status: "verified",
      verifyExplanation: explanation,
      verifyAnswer: answer,
      verifyScore: scored.score,
      verifyMismatch: scored.mismatch,
      learningMoment: scored.learningMoment,
      memoryNotes: { notes: scored.notes },
    });

    if (updated) {
      await rememberAfterVerify(updated);

      if (isEverOSConfigured()) {
        try {
          await recordTutoringSession({
            tuteeId: updated.tuteeSlug,
            sessionId: updated.id,
            subject: updated.subject,
            topic: updated.topic,
            tutorReflection: `Rubric: ${updated.tutorRubric}. Student explanation recorded.`,
            understandingScore: scored.score,
            durationMinutes: updated.durationMinutes ?? undefined,
            location: updated.sessionType ?? undefined,
          });
        } catch {
          // demo memory already updated
        }
      }
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to verify session",
    });
  }
});

export default router;
