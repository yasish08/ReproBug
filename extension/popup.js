const $ = id => document.getElementById(id);
const status = message => { $("status").textContent = message; };

async function loadSettings() {
  const settings = await chrome.storage.local.get(["apiBaseUrl", "email"]);
  $("apiBaseUrl").value = settings.apiBaseUrl || "http://localhost:4000";
  $("email").value = settings.email || "";
}
$("save").addEventListener("click", async () => {
  try {
    const api = new URL($("apiBaseUrl").value.trim());
    if (!["http:", "https:"].includes(api.protocol)) throw new Error("API URL must use HTTP or HTTPS.");
    const email = $("email").value.trim().toLowerCase();
    const password = $("password").value;
    if (!email || !password) throw new Error("Enter your account email and password.");
    const granted = await chrome.permissions.request({ origins: [`${api.origin}/*`] });
    if (!granted) throw new Error("Allow access to the configured API host to continue.");
    const response = await fetch(api.origin + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Sign-in failed.");
    if (!body.data.workspace?.slug) throw new Error("This account has no workspace membership yet.");
    await chrome.storage.local.set({
      apiBaseUrl: api.origin,
      email,
      projectSlug: body.data.workspace.slug,
      token: body.data.token
    });
    $("password").value = "";
    status("Connected to " + body.data.workspace.name + ". Enable capture on a tab to begin.");
  } catch (error) { status(error.message); }
});
$("capture").addEventListener("click", async () => {
  try {
    const { apiBaseUrl, projectSlug, token } = await chrome.storage.local.get(["apiBaseUrl", "projectSlug", "token"]);
    if (!apiBaseUrl || !projectSlug || !token) throw new Error("Sign in and save your connection first.");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url || "")) throw new Error("Open a regular HTTP/HTTPS webpage first.");
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
      if (window.__reprobugCaptureInstalled) return;
      window.__reprobugCaptureInstalled = true;
      const send = (title, message) => chrome.runtime.sendMessage({
        type: "REPROBUG_CAPTURE_ERROR",
        title: String(title || "Uncaught browser error").slice(0, 200),
        message: String(message || title || "Browser error").slice(0, 8000),
        pageUrl: location.href
      });
      window.addEventListener("error", event => {
        const detail = event.error?.stack ? `${event.message}\n${event.error.stack}` : event.message;
        send(event.message || "Uncaught JavaScript error", detail || "Script error");
      });
      window.addEventListener("unhandledrejection", event => {
        const reason = event.reason;
        send("Unhandled promise rejection", reason?.stack || reason?.message || String(reason));
      });
      chrome.runtime.sendMessage({ type: "REPROBUG_CAPTURE_READY" });
    } });
    status("Capture enabled on this tab. Errors after this point will be reported.");
  } catch (error) { status(error.message); }
});
loadSettings();
