function sanitizePageUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/(token|key|secret|password|passwd|auth|session|email|code|signature|credential)/i.test(key)) {
        url.searchParams.set(key, "[REDACTED]");
      }
    }
    return url.toString().slice(0, 2048);
  } catch {
    return "";
  }
}

function redact(value) {
  let text = String(value ?? "").slice(0, 8000);
  text = text.replace(/(password|passwd|token|secret|api[_-]?key)(\s*[:=]\s*)[^\s,;]+/ig, "$1$2[REDACTED]");
  text = text.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/ig, "Bearer [REDACTED]");
  text = text.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[REDACTED_EMAIL]");
  text = text.replace(/(cookie|set-cookie|authorization)(\s*[:=]\s*)[^\r\n]+/ig, "$1$2[REDACTED]");
  return text;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "REPROBUG_CAPTURE_ERROR") return;
  (async () => {
    const settings = await chrome.storage.local.get(["apiBaseUrl", "projectSlug", "token"]);
    if (!settings.apiBaseUrl || !settings.projectSlug || !settings.token) throw new Error("Save your ReproBug connection first.");
    const api = new URL(settings.apiBaseUrl);
    if (api.protocol !== "http:" && api.protocol !== "https:") throw new Error("API URL must use HTTP or HTTPS.");
    const response = await fetch(api.origin + "/api/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + settings.token },
      body: JSON.stringify({
        title: redact(message.title).slice(0, 200),
        message: redact(message.message),
        pageUrl: sanitizePageUrl(message.pageUrl),
        severity: "HIGH",
        projectSlug: settings.projectSlug
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "API request failed with status " + response.status);
    sendResponse({ ok: true, deduplicated: Boolean(body.deduplicated) });
  })().catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});
