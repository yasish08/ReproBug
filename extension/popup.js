const $ = id => document.getElementById(id);
const status = message => { $("status").textContent = message; };

async function loadSettings() {
  const settings = await chrome.storage.local.get(["apiBaseUrl", "projectSlug", "token"]);
  $("apiBaseUrl").value = settings.apiBaseUrl || "http://localhost:4000";
  $("projectSlug").value = settings.projectSlug || "";
  $("token").value = settings.token || "";
}
$("save").addEventListener("click", async () => {
  try {
    const api = new URL($("apiBaseUrl").value.trim());
    if (!["http:", "https:"].includes(api.protocol)) throw new Error("API URL must use HTTP or HTTPS.");
    const projectSlug = $("projectSlug").value.trim();
    const token = $("token").value.trim();
    if (!/^[a-z0-9-]{1,60}$/i.test(projectSlug)) throw new Error("Enter a valid workspace slug.");
    if (!token) throw new Error("Paste your session token.");
    const originPattern = `${api.origin}/*`;
    const granted = await chrome.permissions.request({ origins: [originPattern] });
    if (!granted) throw new Error("Allow access to your configured API host to continue.");
    await chrome.storage.local.set({ apiBaseUrl: api.origin, projectSlug, token });
    status("Connection saved. Enable capture on a tab to start reporting errors.");
  } catch (error) { status(error.message); }
});
$("capture").addEventListener("click", async () => {
  try {
    const { apiBaseUrl, projectSlug, token } = await chrome.storage.local.get(["apiBaseUrl", "projectSlug", "token"]);
    if (!apiBaseUrl || !projectSlug || !token) throw new Error("Save your connection before enabling capture.");
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
      chrome.runtime.sendMessage({ type: "REPROBUG_CAPTURE_ERROR", title: "ReproBug capture enabled", message: "Capture was enabled by the user.", pageUrl: location.href });
    } });
    status("Capture enabled on this tab. Errors after this point will be reported.");
  } catch (error) { status(error.message); }
});
chrome.runtime.onMessage.addListener(message => {
  if (message?.type === "REPROBUG_CAPTURE_RESULT") status(message.ok ? "Error sent to ReproBug." : `Capture failed: ${message.error}`);
});
loadSettings();
