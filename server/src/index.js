import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();
const port = Number(process.env.PORT) || 4000;
const allowedOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "reprobug-api", timestamp: new Date().toISOString() });
});

app.use((req, res) => res.status(404).json({ error: "Not found", path: req.path }));
app.use((err, _req, res, _next) => {
  console.error("Unhandled request error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => console.log(`ReproBug API listening on http://localhost:${port}`));
