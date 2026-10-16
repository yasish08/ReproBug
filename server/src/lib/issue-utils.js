import { createHash } from "node:crypto";

export function createIssueFingerprint(title, message = "") {
  return createHash("sha256")
    .update(`${title.trim().toLowerCase()}::${message.trim().toLowerCase()}`)
    .digest("hex");
}

export function normalizePageUrl(value) {
  if (value === undefined || value === null || value === "") {
    return { valid: true, value: null };
  }
  if (typeof value !== "string" || value.length > 2048) {
    return { valid: false, value: null };
  }
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, value: null };
    }
    return { valid: true, value: parsed.toString() };
  } catch {
    return { valid: false, value: null };
  }
}
