import { Router, type IRouter } from "express";
import { isEverOSConfigured } from "../lib/everos-client";
import { getTutoringContext, recordTutoringSession, type RecordTutoringSessionInput } from "../lib/tutor-memory";

const router: IRouter = Router();

function parseRecordSessionBody(body: unknown): RecordTutoringSessionInput | null {
  if (!body || typeof body !== "object") return null;

  const value = body as Record<string, unknown>;
  const tuteeId = typeof value.tuteeId === "string" ? value.tuteeId.trim() : "";
  const sessionId = typeof value.sessionId === "string" ? value.sessionId.trim() : "";
  const subject = typeof value.subject === "string" ? value.subject.trim() : "";
  const topic = typeof value.topic === "string" ? value.topic.trim() : "";
  const tutorReflection = typeof value.tutorReflection === "string" ? value.tutorReflection.trim() : "";

  if (!tuteeId || !sessionId || !subject || !topic || !tutorReflection) {
    return null;
  }

  const understandingScore =
    typeof value.understandingScore === "number" && Number.isInteger(value.understandingScore)
      ? value.understandingScore
      : undefined;
  if (understandingScore !== undefined && (understandingScore < 1 || understandingScore > 5)) {
    return null;
  }

  const durationMinutes =
    typeof value.durationMinutes === "number" && Number.isInteger(value.durationMinutes)
      ? value.durationMinutes
      : undefined;
  if (durationMinutes !== undefined && (durationMinutes < 1 || durationMinutes > 240)) {
    return null;
  }

  const location = value.location === "hw_center" || value.location === "tutorial"
    ? value.location
    : undefined;

  return {
    tuteeId,
    sessionId,
    subject,
    topic,
    tutorReflection,
    understandingScore,
    durationMinutes,
    location,
  };
}

router.get("/tutoring/tutees/:tuteeId/context", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!isEverOSConfigured()) {
    res.status(503).json({ error: "EverOS is not configured. Set EVEROS_API_KEY." });
    return;
  }

  const topic = typeof req.query.topic === "string" ? req.query.topic : "";
  if (!topic) {
    res.status(400).json({ error: "Query parameter 'topic' is required." });
    return;
  }

  try {
    const context = await getTutoringContext(req.params.tuteeId, topic);
    res.json(context);
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to fetch tutoring context from EverOS",
    });
  }
});

router.post("/tutoring/sessions/record", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!isEverOSConfigured()) {
    res.status(503).json({ error: "EverOS is not configured. Set EVEROS_API_KEY." });
    return;
  }

  const parsed = parseRecordSessionBody(req.body);
  if (!parsed) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    const result = await recordTutoringSession(parsed);
    res.json(result);
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to record tutoring session in EverOS",
    });
  }
});

export default router;
