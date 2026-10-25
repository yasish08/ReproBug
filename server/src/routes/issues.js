import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { createIssueFingerprint, normalizePageUrl } from "../lib/issue-utils.js";
import { requireAuth } from "./auth.js";

const router = Router();
const severities = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const statuses = new Set(["OPEN", "INVESTIGATING", "RESOLVED", "IGNORED"]);

function serializeIssue(issue) {
  return {
    id: issue.id,
    fingerprint: issue.fingerprint,
    title: issue.title,
    message: issue.message,
    severity: issue.severity,
    status: issue.status,
    pageUrl: issue.pageUrl,
    firstSeenAt: issue.firstSeenAt,
    lastSeenAt: issue.lastSeenAt,
    occurrenceCount: issue.occurrenceCount,
    project: issue.project ? { id: issue.project.id, name: issue.project.name, slug: issue.project.slug } : undefined
  };
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
    const where = { project: { members: { some: { userId: req.auth.userId } } } };
    if (typeof req.query.status === "string" && statuses.has(req.query.status.toUpperCase())) {
      where.status = req.query.status.toUpperCase();
    }
    if (typeof req.query.severity === "string" && severities.has(req.query.severity.toUpperCase())) {
      where.severity = req.query.severity.toUpperCase();
    }
    if (typeof req.query.projectId === "string" && req.query.projectId.length <= 64) {
      where.projectId = req.query.projectId;
    }
    const [issues, total] = await Promise.all([
      prisma.issue.findMany({ where, include: { project: true }, orderBy: { lastSeenAt: "desc" }, take: limit }),
      prisma.issue.count({ where })
    ]);
    res.json({ data: issues.map(serializeIssue), pagination: { limit, total } });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { title, message, pageUrl, severity = "MEDIUM", projectSlug = "demo" } = req.body ?? {};
    if (typeof title !== "string" || title.trim().length < 3 || title.trim().length > 200) {
      return res.status(400).json({ error: "Title must contain between 3 and 200 characters." });
    }
    if (message !== undefined && (typeof message !== "string" || message.length > 10000)) {
      return res.status(400).json({ error: "Message must be a string of at most 10000 characters." });
    }
    if (!severities.has(String(severity).toUpperCase())) {
      return res.status(400).json({ error: "Severity must be LOW, MEDIUM, HIGH, or CRITICAL." });
    }
    if (typeof projectSlug !== "string" || !/^[a-z0-9-]{1,60}$/i.test(projectSlug)) {
      return res.status(400).json({ error: "Project slug is invalid." });
    }
    const normalizedPageUrl = normalizePageUrl(pageUrl);
    if (!normalizedPageUrl.valid) {
      return res.status(400).json({ error: "pageUrl must be a valid HTTP or HTTPS URL no longer than 2048 characters." });
    }
    const safePageUrl = normalizedPageUrl.value;

    const project = await prisma.project.findFirst({
      where: { slug: projectSlug.toLowerCase(), members: { some: { userId: req.auth.userId } } }
    });
    if (!project) return res.status(404).json({ error: "Workspace not found or access denied." });
    const cleanTitle = title.trim();
    const cleanMessage = typeof message === "string" ? message.trim() : "";
    const issueFingerprint = createIssueFingerprint(cleanTitle, cleanMessage);
    const now = new Date();
    const issue = await prisma.issue.upsert({
      where: { projectId_fingerprint: { projectId: project.id, fingerprint: issueFingerprint } },
      update: { occurrenceCount: { increment: 1 }, lastSeenAt: now, pageUrl: safePageUrl, severity: severity.toUpperCase() },
      create: {
        projectId: project.id,
        fingerprint: issueFingerprint,
        title: cleanTitle,
        message: cleanMessage || null,
        severity: severity.toUpperCase(),
        pageUrl: safePageUrl
      },
      include: { project: true }
    });
    await prisma.issueEvent.create({
      data: { issueId: issue.id, eventType: "REPORTED", summary: cleanTitle.slice(0, 200) }
    });
    res.status(201).json({ data: serializeIssue(issue), deduplicated: issue.occurrenceCount > 1 });
  } catch (error) {
    next(error);
  }
});


router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const issue = await prisma.issue.findFirst({
      where: { id: req.params.id, project: { members: { some: { userId: req.auth.userId } } } },
      include: {
        project: true,
        events: {
          orderBy: { createdAt: "desc" },
          take: 100,
          include: { user: { select: { email: true, name: true } } }
        }
      }
    });
    if (!issue) return res.status(404).json({ error: "Issue not found." });
    res.json({
      data: {
        ...serializeIssue(issue),
        events: issue.events.map(event => ({
          id: event.id,
          type: event.eventType,
          summary: event.summary,
          createdAt: event.createdAt,
          actor: event.user?.name || event.user?.email || null
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/status", requireAuth, async (req, res, next) => {
  try {
    const status = String(req.body?.status ?? "").toUpperCase();
    if (!statuses.has(status)) return res.status(400).json({ error: "Invalid issue status." });
    const accessibleIssue = await prisma.issue.findFirst({
      where: { id: req.params.id, project: { members: { some: { userId: req.auth.userId } } } }
    });
    if (!accessibleIssue) return res.status(404).json({ error: "Issue not found." });
    const issue = await prisma.issue.update({
      where: { id: accessibleIssue.id },
      data: { status },
      include: { project: true }
    });
    await prisma.issueEvent.create({
      data: { issueId: issue.id, userId: req.auth.userId, eventType: "STATUS_CHANGED", summary: `Status changed to ${status}` }
    });
    res.json({ data: serializeIssue(issue) });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ error: "Issue not found." });
    next(error);
  }
});

export default router;
