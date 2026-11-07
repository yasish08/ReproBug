import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "./auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { members: { some: { userId: req.auth.userId } } },
      select: {
        id: true, name: true, slug: true, description: true, createdAt: true, updatedAt: true,
        _count: { select: { issues: true, members: true } }
      },
      orderBy: { createdAt: "asc" }
    });
    res.json({ data: projects.map(({ _count, ...project }) => ({
      ...project, issueCount: _count.issues, memberCount: _count.members
    })) });
  } catch (error) { next(error); }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
    const slug = typeof req.body?.slug === "string"
      ? req.body.slug.trim().toLowerCase()
      : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ error: "Project name must contain between 2 and 80 characters." });
    }
    if (!/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(slug)) {
      return res.status(400).json({ error: "Project slug must be 1–60 lowercase letters, numbers, or hyphens." });
    }
    if (description.length > 500) {
      return res.status(400).json({ error: "Project description must be at most 500 characters." });
    }
    const project = await prisma.project.create({
      data: {
        name, slug, description: description || null,
        members: { create: { userId: req.auth.userId, role: "OWNER" } }
      },
      select: {
        id: true, name: true, slug: true, description: true, createdAt: true, updatedAt: true,
        _count: { select: { issues: true, members: true } }
      }
    });
    const { _count, ...data } = project;
    res.status(201).json({ data: { ...data, issueCount: _count.issues, memberCount: _count.members } });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ error: "That project slug is already in use. Choose another one." });
    next(error);
  }
});

export default router;
