import { Router, type IRouter } from "express";
import {
  fuseEvidence,
  parseStudentEvidence,
  parseTutorEvidence,
  studentExplanationFromEvidence,
} from "../lib/evidence-fusion";
import { isEverOSConfigured } from "../lib/everos-client";
import { recordTutoringSession } from "../lib/tutor-memory";
import {
  createSession,
  getSession,
  listSessionsForTutor,
  purgeSessionsForTutor,
  rememberAfterVerify,
  scoreVerification,
  updateSession,
  getButterbaseAppId,
  createTutoringRequest,
  listTutoringRequests,
  claimTutoringRequest,
  completeTutoringRequest,
  type PracticeProblem,
  type SessionType,
  type TutorRubric,
} from "../lib/tutoros-store";
import {
  generatePracticeProblems,
  normalizePracticeProblems,
} from "../lib/practice-problems-agent";

const router: IRouter = Router();

function requireAuth(req: {
  session: { userId?: number; username?: string; role?: string };
}, res: { status: (n: number) => { json: (b: unknown) => void } }): string | null {
  if (!req.session.userId || !req.session.username) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return req.session.username;
}

function requireTeacher(req: {
  session: { userId?: number; username?: string; role?: string };
}, res: { status: (n: number) => { json: (b: unknown) => void } }): string | null {
  const username = requireAuth(req, res);
  if (!username) return null;
  if (req.session.role !== "teacher") {
    res.status(403).json({ error: "Teacher access required" });
    return null;
  }
  return username;
}

function requireMember(req: {
  session: { userId?: number; username?: string; role?: string };
}, res: { status: (n: number) => { json: (b: unknown) => void } }): string | null {
  const username = requireAuth(req, res);
  if (!username) return null;
  if (req.session.role === "teacher") {
    res.status(403).json({ error: "Tutor / member access required" });
    return null;
  }
  return username;
}

router.get("/tutoros/meta", (_req, res): void => {
  res.json({
    appId: getButterbaseAppId(),
    everosConfigured: isEverOSConfigured(),
    butterbaseConfigured: Boolean(process.env.BUTTERBASE_API_KEY),
    prepAgent: "llm",
  });
});

router.post("/tutoros/sessions/purge", async (req, res): Promise<void> => {
  const username = requireAuth(req, res);
  if (!username) return;

  const tuteeName =
    typeof req.body?.tuteeName === "string" ? req.body.tuteeName.trim() : undefined;
  const tuteeSlug =
    typeof req.body?.tuteeSlug === "string" ? req.body.tuteeSlug.trim() : undefined;

  try {
    const result = await purgeSessionsForTutor(username, {
      tuteeName,
      tuteeSlug,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to purge sessions",
    });
  }
});

router.post("/tutoros/sessions/start", async (req, res): Promise<void> => {
  const username = requireMember(req, res);
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

function parsePracticeProblemsBody(body: unknown): PracticeProblem[] | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as { practiceProblems?: unknown }).practiceProblems;
  if (!Array.isArray(raw)) return null;
  const normalized = normalizePracticeProblems(
    raw.map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      return {
        id: typeof row.id === "string" ? row.id : crypto.randomUUID(),
        prompt: typeof row.prompt === "string" ? row.prompt : "",
        difficulty:
          row.difficulty === "warm-up" ||
          row.difficulty === "guided" ||
          row.difficulty === "independent"
            ? row.difficulty
            : "guided",
        steps: Array.isArray(row.steps)
          ? row.steps
              .map((step) => {
                if (!step || typeof step !== "object") return null;
                const s = step as Record<string, unknown>;
                const label = typeof s.label === "string" ? s.label : "Step";
                const detail = typeof s.detail === "string" ? s.detail : "";
                return detail ? { label, detail } : null;
              })
              .filter(Boolean)
          : [],
        discussionStems: Array.isArray(row.discussionStems)
          ? row.discussionStems.map(String).filter(Boolean)
          : [],
      };
    }).filter(Boolean) as PracticeProblem[],
  );
  return normalized.filter((p) => p.prompt.trim());
}

router.post("/tutoros/sessions/:id/practice-problems/generate", async (req, res): Promise<void> => {
  const username = requireMember(req, res);
  if (!username) return;

  try {
    const session = await getSession(req.params.id);
    if (!session || session.tutorUsername !== username) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const practiceProblems = await generatePracticeProblems({
      tuteeName: session.tuteeName,
      tuteeSlug: session.tuteeSlug,
      subject: session.subject,
      topic: session.topic,
      prepBrief: session.prepBrief,
    });

    const updated = await updateSession(session.id, {
      prepBrief: {
        ...session.prepBrief,
        practiceProblems,
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate practice problems",
    });
  }
});

router.patch("/tutoros/sessions/:id/practice-problems", async (req, res): Promise<void> => {
  const username = requireMember(req, res);
  if (!username) return;

  const practiceProblems = parsePracticeProblemsBody(req.body);
  if (!practiceProblems) {
    res.status(400).json({ error: "practiceProblems array is required" });
    return;
  }

  try {
    const session = await getSession(req.params.id);
    if (!session || session.tutorUsername !== username) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const updated = await updateSession(session.id, {
      prepBrief: {
        ...session.prepBrief,
        practiceProblems,
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to save practice problems",
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

  const tutorEvidence = parseTutorEvidence(req.body?.tutorEvidence);
  if (!tutorEvidence) {
    res.status(400).json({ error: "tutorEvidence is required with all reflection fields" });
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
      tutorEvidence,
      fusedHeadline: tutorEvidence.whatChangedToday,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to end session",
    });
  }
});

router.post("/tutoros/sessions/:id/verify", async (req, res): Promise<void> => {
  const answer = typeof req.body?.answer === "string" ? req.body.answer.trim() : "";
  const studentEvidence = parseStudentEvidence(req.body?.studentEvidence);

  if (!answer) {
    res.status(400).json({ error: "answer is required" });
    return;
  }
  if (!studentEvidence) {
    res.status(400).json({ error: "studentEvidence is required with confidence and what changed" });
    return;
  }

  const explanation = studentExplanationFromEvidence(studentEvidence);

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
      studentEvidence,
      fusedHeadline: fuseEvidence({
        subject: session.subject,
        topic: session.topic,
        tutorEvidence: session.tutorEvidence,
        studentEvidence,
        teacherEvidence: session.teacherEvidence,
        verifyScore: scored.score,
        tutorRubric: session.tutorRubric,
      }).headline,
    });

    if (updated) {
      await rememberAfterVerify(updated);

      if (isEverOSConfigured()) {
        try {
          const reflectionParts = [
            session.tutorEvidence?.whatChangedToday &&
              `Tutor: ${session.tutorEvidence.whatChangedToday}`,
            studentEvidence.whatChangedToday &&
              `Student: ${studentEvidence.whatChangedToday}`,
            session.teacherEvidence?.whatChangedToday &&
              `Teacher: ${session.teacherEvidence.whatChangedToday}`,
          ].filter(Boolean);

          await recordTutoringSession({
            tuteeId: updated.tuteeSlug,
            sessionId: updated.id,
            subject: updated.subject,
            topic: updated.topic,
            tutorReflection:
              reflectionParts.length > 0
                ? reflectionParts.join(" ")
                : `Rubric: ${updated.tutorRubric}. Student check-in recorded.`,
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

router.get("/tutoros/requests", async (req, res): Promise<void> => {
  const username = requireAuth(req, res);
  if (!username) return;

  try {
    const status =
      req.query.status === "open" || req.query.status === "claimed" || req.query.status === "done"
        ? req.query.status
        : undefined;

    // Teachers see all (or filtered); tutors default to open queue unless filtered
    const effectiveStatus =
      req.session.role === "teacher"
        ? status
        : status ?? "open";

    const requests = await listTutoringRequests(
      effectiveStatus ? { status: effectiveStatus } : undefined,
    );
    res.json({ requests });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list requests",
    });
  }
});

router.post("/tutoros/requests", async (req, res): Promise<void> => {
  const username = requireTeacher(req, res);
  if (!username) return;

  const studentName = typeof req.body?.studentName === "string" ? req.body.studentName.trim() : "";
  const grade = typeof req.body?.grade === "string" ? req.body.grade.trim() : "";
  const assignedBy = typeof req.body?.assignedBy === "string" ? req.body.assignedBy.trim() : "";
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : undefined;

  if (!studentName || !grade || !assignedBy || !subject || !topic) {
    res.status(400).json({
      error: "studentName, grade, assignedBy, subject, and topic are required",
    });
    return;
  }

  try {
    const request = await createTutoringRequest({
      studentName,
      grade,
      assignedBy,
      subject,
      topic,
      notes,
    });
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to create request",
    });
  }
});

router.post("/tutoros/requests/:id/claim", async (req, res): Promise<void> => {
  const username = requireMember(req, res);
  if (!username) return;

  try {
    const claimed = await claimTutoringRequest(req.params.id, username);
    if (!claimed) {
      res.status(404).json({ error: "Open request not found" });
      return;
    }
    res.json(claimed);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to claim request",
    });
  }
});

router.post("/tutoros/requests/:id/complete", async (req, res): Promise<void> => {
  const username = requireAuth(req, res);
  if (!username) return;

  const whatChangedToday =
    typeof req.body?.whatChangedToday === "string" ? req.body.whatChangedToday.trim() : "";
  if (!whatChangedToday) {
    res.status(400).json({ error: "whatChangedToday is required" });
    return;
  }

  try {
    const done = await completeTutoringRequest(req.params.id, { whatChangedToday });
    if (!done) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    res.json(done);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to complete request",
    });
  }
});

export default router;
