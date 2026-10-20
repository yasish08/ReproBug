import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function tokenFor(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    const error = new Error("JWT_SECRET must be configured with at least 32 characters.");
    error.status = 503;
    throw error;
  }
  return jwt.sign({ sub: user.id, email: user.email }, secret, { expiresIn: "12h", issuer: "reprobug-api", audience: "reprobug-client" });
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

export function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return res.status(401).json({ error: "Sign in to continue." });
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) return res.status(503).json({ error: "Authentication is not configured." });
  try {
    const claims = jwt.verify(token, secret, { issuer: "reprobug-api", audience: "reprobug-client" });
    req.auth = { userId: claims.sub, email: claims.email };
    next();
  } catch {
    return res.status(401).json({ error: "Session is invalid or expired. Please sign in again." });
  }
}

router.post("/register", async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body?.password;
    const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 80) : null;
    if (!emailPattern.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email address." });
    if (typeof password !== "string" || password.length < 10 || password.length > 128) {
      return res.status(400).json({ error: "Password must be between 10 and 128 characters." });
    }
    if (typeof process.env.JWT_SECRET !== "string" || process.env.JWT_SECRET.length < 32) {
      return res.status(503).json({ error: "Authentication is not configured." });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, passwordHash, name: name || null } });
    const slug = `workspace-${user.id.slice(-12).toLowerCase()}`;
    const project = await prisma.project.create({
      data: {
        name: name ? `${name}'s workspace` : "My workspace",
        slug,
        members: { create: { userId: user.id, role: "OWNER" } }
      }
    });
    const token = tokenFor(user);
    res.status(201).json({ data: { user: publicUser(user), token, workspace: { id: project.id, name: project.name, slug: project.slug } } });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ error: "An account with that email already exists." });
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body?.password;
    if (!emailPattern.test(email) || typeof password !== "string" || password.length > 128) {
      return res.status(400).json({ error: "Enter your email and password." });
    }
    if (typeof process.env.JWT_SECRET !== "string" || process.env.JWT_SECRET.length < 32) {
      return res.status(503).json({ error: "Authentication is not configured." });
    }
    const user = await prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { project: { select: { id: true, name: true, slug: true } } }, orderBy: { createdAt: "asc" } } }
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    res.json({ data: { user: publicUser(user), token: tokenFor(user), workspace: user.memberships[0]?.project ?? null } });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: { id: true, email: true, name: true, createdAt: true }
    });
    if (!user) return res.status(401).json({ error: "Account no longer exists." });
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
});

export default router;
