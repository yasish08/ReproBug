import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import issuesRouter from "./routes/issues.js";
import authRouter from "./routes/auth.js";
import { prisma } from "./lib/prisma.js";

export const app = express();
const allowedOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", async (_req, res) => {
  let database = "disconnected";
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "connected";
  } catch {
    // Keep the health endpoint useful while local infrastructure is being configured.
  }
  res.status(database === "connected" ? 200 : 503).json({
    status: database === "connected" ? "ok" : "degraded",
    service: "reprobug-api",
    database,
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", authRouter);
app.use("/api/issues", issuesRouter);
app.use((req, res) => res.status(404).json({ error: "Not found", path: req.path }));
app.use((err, _req, res, _next) => {
  console.error("Unhandled request error:", err.message);
  if (["P1000", "P1001", "P2021"].includes(err.code)) {
    return res.status(503).json({ error: "Database is unavailable or not migrated yet." });
  }
  res.status(500).json({ error: "Internal server error" });
});
