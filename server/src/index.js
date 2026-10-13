import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import issuesRouter from "./routes/issues.js";
import { prisma } from "./lib/prisma.js";

const app = express();
const port = Number(process.env.PORT) || 4000;
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

app.use("/api/issues", issuesRouter);

app.use((req, res) => res.status(404).json({ error: "Not found", path: req.path }));
app.use((err, _req, res, _next) => {
  console.error("Unhandled request error:", err.message);
  if (err.code === "P1001" || err.code === "P1000" || err.code === "P2021") {
    return res.status(503).json({ error: "Database is unavailable or not migrated yet." });
  }
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(port, () => console.log(`ReproBug API listening on http://localhost:${port}`));
async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
