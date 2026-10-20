function redact(value) {
  let text = String(value ?? "").slice(0, 8000);
  text = text.replace(/(password|passwd|token|secret|api[_-]?key)(\s*[:=]\s*)[^\s,;]+/ig, "$1$2[REDACTED]");
  text = text.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/ig, "Bearer [REDACTED]");
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
        pageUrl: String(message.pageUrl || "").slice(0, 2048),
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
