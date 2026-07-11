import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const PgSession = connectPgSimple(session);

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const allowedOrigins = process.env.REPLIT_DOMAINS
  ? process.env.REPLIT_DOMAINS.split(",").map((d) => `https://${d.trim()}`)
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

app.use(
  session({
    store: new PgSession({
      pool,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
);

app.use("/api", router);

app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  const error = err as { type?: string; status?: number; message?: string };
  if (error?.type === "entity.too.large" || error?.status === 413) {
    res.status(413).json({
      error: "File too large to upload. Please use an image or document under 10 MB.",
    });
    return;
  }
  next(err);
});

logger.info(
  {
    tutoros: true,
    routes: [
      "GET /api/tutoros/meta",
      "POST /api/tutoros/sessions/start",
      "POST /api/tutoros/sessions/:id/practice-problems/generate",
      "PATCH /api/tutoros/sessions/:id/practice-problems",
      "GET /api/tutoros/sessions",
      "GET /api/tutoros/requests",
      "POST /api/tutoros/requests",
      "POST /api/auth/teacher-login",
    ],
  },
  "TutorOS API routes mounted",
);

export default app;
