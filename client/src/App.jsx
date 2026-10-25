import { useCallback, useEffect, useMemo, useState } from "react";
import AuthScreen from "./AuthScreen.jsx";
import { apiUrl } from "./lib/api.js";
import {
  Activity, AlertTriangle, Bug, CheckCircle2, ChevronDown, CirclePlus,
  Command, ExternalLink, Filter, LoaderCircle, RefreshCw, Search,
  ShieldCheck, Sparkles, Zap
} from "lucide-react";

const demoIssues = [
  { id: "demo-1042", title: "Checkout fails after applying discount", project: { name: "Storefront" }, severity: "CRITICAL", status: "INVESTIGATING", pageUrl: "https://store.example/checkout", occurrenceCount: 38, lastSeenAt: new Date(Date.now() - 4 * 60_000).toISOString(), demo: true },
  { id: "demo-1041", title: "TypeError: Cannot read properties of undefined", project: { name: "Customer Portal" }, severity: "HIGH", status: "OPEN", pageUrl: "https://app.example/account/profile", occurrenceCount: 21, lastSeenAt: new Date(Date.now() - 18 * 60_000).toISOString(), demo: true },
  { id: "demo-1040", title: "Product images fail on slow connections", project: { name: "Storefront" }, severity: "MEDIUM", status: "OPEN", pageUrl: "https://store.example/products/42", occurrenceCount: 14, lastSeenAt: new Date(Date.now() - 42 * 60_000).toISOString(), demo: true },
  { id: "demo-1039", title: "Settings page blank after session refresh", project: { name: "Customer Portal" }, severity: "HIGH", status: "RESOLVED", pageUrl: "https://app.example/settings", occurrenceCount: 9, lastSeenAt: new Date(Date.now() - 60 * 60_000).toISOString(), demo: true }
];

const severityLabels = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", CRITICAL: "Critical" };
const statusLabels = { OPEN: "Open", INVESTIGATING: "Investigating", RESOLVED: "Resolved", IGNORED: "Ignored" };

function timeAgo(value) {
  if (!value) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function displayId(issue, index) {
  if (issue.demo) return `RB-${1042 - index}`;
  return issue.id?.slice(-8).toUpperCase() ?? "RB-NEW";
}

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("reprobug-token") || "");
  const [workspaceSlug, setWorkspaceSlug] = useState(() => sessionStorage.getItem("reprobug-workspace") || "demo");
  const [issues, setIssues] = useState(demoIssues);
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [apiState, setApiState] = useState("checking");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ title: "", message: "", severity: "MEDIUM", pageUrl: "", projectSlug: "demo" });

  const loadIssues = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const [healthResponse, issuesResponse] = await Promise.all([
        fetch(apiUrl("/api/health")),
        fetch(apiUrl("/api/issues?limit=100"), { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      ]);
      const health = await healthResponse.json().catch(() => ({}));
      setApiState(healthResponse.ok && health.database === "connected" ? "online" : "degraded");
      if (!issuesResponse.ok) {
        if (issuesResponse.status === 401) { sessionStorage.removeItem("reprobug-token"); setToken(""); }
        const body = await issuesResponse.json().catch(() => ({}));
        throw new Error(body.error || "The issues API is not ready yet.");
      }
      const body = await issuesResponse.json();
      setIssues(Array.isArray(body.data) ? body.data : []);
      setNotice("");
    } catch (error) {
      setApiState("offline");
      setIssues(current => current.length ? current : demoIssues);
      setNotice(error.message || "Could not load issues. Showing sample data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { if (token) loadIssues(); }, [loadIssues, token]);

  const filtered = useMemo(() => issues.filter(issue => {
    const projectName = issue.project?.name ?? "Unassigned";
    const haystack = [issue.id, issue.title, projectName, issue.pageUrl, issue.message].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase())
      && (severityFilter === "ALL" || issue.severity === severityFilter)
      && (statusFilter === "ALL" || issue.status === statusFilter);
  }), [issues, query, severityFilter, statusFilter]);

  const openCount = issues.filter(issue => !["RESOLVED", "IGNORED"].includes(issue.status)).length;
  const resolvedCount = issues.filter(issue => issue.status === "RESOLVED").length;
  const criticalCount = issues.filter(issue => issue.severity === "CRITICAL" && !["RESOLVED", "IGNORED"].includes(issue.status)).length;
  const eventCount = issues.reduce((total, issue) => total + (issue.occurrenceCount || 1), 0);
  const usingDemo = issues.some(issue => issue.demo);

  function handleAuthenticated(data) {
    sessionStorage.setItem("reprobug-token", data.token);
    sessionStorage.setItem("reprobug-workspace", data.workspace?.slug || "demo");
    setWorkspaceSlug(data.workspace?.slug || "demo");
    setToken(data.token);
    setForm(current => ({ ...current, projectSlug: data.workspace?.slug || "demo" }));
  }

  function signOut() {
    sessionStorage.removeItem("reprobug-token");
    sessionStorage.removeItem("reprobug-workspace");
    setToken("");
    setIssues(demoIssues);
    setApiState("checking");
  }

  async function submitIssue(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch(apiUrl("/api/issues"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: form.title.trim(),
          message: form.message.trim() || undefined,
          severity: form.severity,
          pageUrl: form.pageUrl.trim() || undefined,
          projectSlug: workspaceSlug
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not create the issue.");
      setShowForm(false);
      setForm({ title: "", message: "", severity: "MEDIUM", pageUrl: "", projectSlug: workspaceSlug });
      await loadIssues({ quiet: true });
      setNotice(body.deduplicated ? "Issue matched an existing fingerprint; occurrence count updated." : "Issue reported successfully.");
    } catch (error) {
      setFormError(error.message || "Could not connect to the API. Start the backend and database, then retry.");
    } finally {
      setSaving(false);
    }
  }

  async function openIssueDetails(issue) {
    if (issue.demo) { setSelectedIssue({ ...issue, events: [] }); return; }
    setDetailLoading(true);
    setSelectedIssue({ ...issue, events: [] });
    try {
      const response = await fetch(apiUrl(`/api/issues/${encodeURIComponent(issue.id)}`), { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not load issue details.");
      setSelectedIssue(body.data);
    } catch (error) {
      setNotice(error.message || "Could not load issue details.");
      setSelectedIssue(null);
    } finally { setDetailLoading(false); }
  }

  async function changeStatus(issue, status) {
    if (issue.demo) {
      setNotice("Sample issues are read-only. Connect the database to update real issues.");
      return;
    }
    try {
      const response = await fetch(apiUrl(`/api/issues/${encodeURIComponent(issue.id)}/status`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Status update failed.");
      setIssues(current => current.map(item => item.id === issue.id ? body.data : item));
      setNotice(`Issue status changed to ${statusLabels[status]}.`);
    } catch (error) {
      setNotice(error.message || "Could not update this issue.");
    }
  }

  if (!token) return <AuthScreen onAuthenticated={handleAuthenticated} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="ReproBug home">
          <span className="brand-mark"><Bug size={20} strokeWidth={2.4} /></span>
          <span>repro<span className="brand-accent">bug</span><span className="brand-period">.</span></span>
        </a>
        <button className="workspace-switcher" type="button" onClick={() => setNotice("Workspace switching will arrive with authentication and team management.")}>
          <span className="workspace-avatar">R</span>
          <span className="workspace-copy"><strong>{workspaceSlug}</strong><small>Developer workspace</small></span>
          <ChevronDown size={15} />
        </button>
        <p className="nav-label">WORKSPACE</p>
        <nav className="navigation" aria-label="Main navigation">
          <a className="nav-item active" href="#overview"><Activity size={17} /><span>Overview</span></a>
          <a className="nav-item" href="#issues"><Bug size={17} /><span>Issues</span><span className="nav-count">{openCount}</span></a>
          <button className="nav-item" onClick={() => setNotice("Projects view is planned for the next milestone.")}><ShieldCheck size={17} /><span>Projects</span></button>
          <button className="nav-item" onClick={() => setNotice("Analytics view is planned after core issue workflows.")}><Zap size={17} /><span>Analytics</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip-icon"><Sparkles size={16} /></div>
          <strong>Debug with context.</strong>
          <p>One place to track errors, reproduce bugs, and ship fixes confidently.</p>
          <a href="https://github.com/yasish08/ReproBug" target="_blank" rel="noreferrer">View repository <ExternalLink size={12} /></a>
          <button className="sign-out-button" onClick={signOut}>Sign out</button>
          <div className="sidebar-status"><span className={`status-dot ${apiState}`} /><span>{apiState === "online" ? "API & database connected" : apiState === "checking" ? "Checking connection…" : apiState === "degraded" ? "API reachable · DB unavailable" : "API connection unavailable"}</span></div>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>Overview</strong></div>
          <div className="topbar-right"><span className="live-indicator"><span /> LIVE WORKSPACE</span><span className="keyboard-hint"><Command size={12} /> REPROBUG</span></div>
        </header>

        <section className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> YOUR DEBUGGING COMMAND CENTER</div>
            <h1>Good morning, <span>developer.</span></h1>
            <p>Here's what's happening across your applications today.</p>
          </div>
          <div className="heading-actions">
            <button className="button button-quiet" onClick={() => loadIssues({ quiet: true })} disabled={refreshing}><RefreshCw size={15} className={refreshing ? "spin" : ""} /> Refresh</button>
            <button className="button button-primary" onClick={() => { setFormError(""); setShowForm(true); }}><CirclePlus size={16} /> Report an issue</button>
          </div>
        </section>

        {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss notification">×</button></div>}
        {usingDemo && <div className="demo-banner"><Sparkles size={16} /><span><strong>Preview mode</strong> — these are sample issues because live database data isn't available yet.</span><button onClick={() => loadIssues({ quiet: true })}>Try connecting <RefreshCw size={13} /></button></div>}

        <section className="metric-grid" aria-label="Issue metrics">
          <article className="metric-card metric-purple"><div className="metric-top"><span>Open issues</span><span className="metric-icon"><Bug size={17} /></span></div><div className="metric-value">{loading ? "—" : openCount}</div><div className="metric-bottom"><span className="metric-note">Needs investigation or action</span><span className="metric-symbol">↗</span></div><div className="metric-accent" /></article>
          <article className="metric-card metric-blue"><div className="metric-top"><span>Events captured</span><span className="metric-icon"><Activity size={17} /></span></div><div className="metric-value">{loading ? "—" : eventCount.toLocaleString()}</div><div className="metric-bottom"><span className="metric-note">Occurrences across listed issues</span><span className="metric-symbol">⌁</span></div><div className="metric-accent" /></article>
          <article className="metric-card metric-green"><div className="metric-top"><span>Resolved issues</span><span className="metric-icon"><CheckCircle2 size={17} /></span></div><div className="metric-value">{loading ? "—" : resolvedCount}</div><div className="metric-bottom"><span className="metric-note">Marked as resolved</span><span className="metric-symbol">✓</span></div><div className="metric-accent" /></article>
          <article className="metric-card metric-red"><div className="metric-top"><span>Critical issues</span><span className="metric-icon"><AlertTriangle size={17} /></span></div><div className="metric-value">{loading ? "—" : criticalCount}</div><div className="metric-bottom"><span className="metric-note">High-priority attention</span><span className="metric-symbol">!</span></div><div className="metric-accent" /></article>
        </section>

        <section className="issues-panel" id="issues">
          <div className="issues-panel-header">
            <div className="section-title"><div className="section-title-icon"><Bug size={17} /></div><div><h2>Issue inbox</h2><p>Investigate recent errors from across your projects.</p></div></div>
            <div className="inbox-total"><span className="inbox-total-dot" /> {filtered.length} issues</div>
          </div>
          <div className="toolbar">
            <label className="search-box"><Search size={16} /><input aria-label="Search issues" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search errors, projects, URLs..." /><kbd>⌘ K</kbd></label>
            <div className="filter-controls"><Filter size={15} /><select aria-label="Filter by severity" value={severityFilter} onChange={event => setSeverityFilter(event.target.value)}><option value="ALL">All severities</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select><select aria-label="Filter by status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option value="OPEN">Open</option><option value="INVESTIGATING">Investigating</option><option value="RESOLVED">Resolved</option><option value="IGNORED">Ignored</option></select></div>
          </div>
          <div className="issue-table-wrap">
            <table className="issue-table">
              <thead><tr><th>ISSUE / ERROR</th><th>SEVERITY</th><th>STATUS</th><th>EVENTS</th><th>LAST SEEN</th><th aria-label="Actions" /></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="6" className="table-state"><LoaderCircle size={19} className="spin" /> Loading your issues…</td></tr> : filtered.map((issue, index) => (
                  <tr key={issue.id}>
                    <td><div className="issue-title-cell"><span className={`issue-type-icon ${String(issue.severity).toLowerCase()}`}><Bug size={15} /></span><div className="issue-title-copy"><strong className="issue-title-link" onClick={() => openIssueDetails(issue)}>{issue.title}</strong><span><code>{displayId(issue, index)}</code><i />{issue.project?.name ?? "Unassigned"}<i />{issue.pageUrl ? new URL(issue.pageUrl).pathname : "No URL recorded"}</span></div></div></td>
                    <td><span className={`severity-pill ${String(issue.severity).toLowerCase()}`}><span />{severityLabels[issue.severity] ?? issue.severity}</span></td>
                    <td><select className={`status-select ${String(issue.status).toLowerCase()}`} aria-label={`Change status for ${issue.title}`} value={issue.status} onChange={event => changeStatus(issue, event.target.value)}><option value="OPEN">Open</option><option value="INVESTIGATING">Investigating</option><option value="RESOLVED">Resolved</option><option value="IGNORED">Ignored</option></select></td>
                    <td><span className="event-count">{(issue.occurrenceCount || 1).toLocaleString()}</span></td>
                    <td><span className="last-seen">{timeAgo(issue.lastSeenAt)}</span></td>
                    <td><button className="row-action" title="Open issue details" aria-label={`Open details for ${issue.title}`} onClick={() => openIssueDetails(issue)}>↗</button></td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && <tr><td colSpan="6" className="table-state empty-state"><span className="empty-icon"><Search size={20} /></span><strong>No issues found</strong><span>Try a different search or loosen your filters.</span><button className="button button-quiet" onClick={() => { setQuery(""); setSeverityFilter("ALL"); setStatusFilter("ALL"); }}>Clear filters</button></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="panel-footer"><span>Showing <strong>{filtered.length}</strong> of <strong>{issues.length}</strong> issues</span><span><span className="footer-dot" /> Updated just now</span></div>
        </section>
        <footer className="app-footer"><span>Built for the moments when production breaks.</span><span>REPROBUG <i /> DEVELOPER TOOLING</span></footer>
      </main>

      {selectedIssue && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedIssue(null); }}><section className="report-modal issue-detail-modal" role="dialog" aria-modal="true" aria-labelledby="issue-detail-title">
        <div className="modal-heading"><div className="modal-icon"><Bug size={19} /></div><button type="button" className="modal-close" aria-label="Close issue details" onClick={() => setSelectedIssue(null)}>×</button><p className="eyebrow">ISSUE INVESTIGATION</p><h2 id="issue-detail-title">{selectedIssue.title}</h2><p>{selectedIssue.project?.name || "Sample project"} · {selectedIssue.id}</p></div>
        <div className="issue-detail-body">
          <div className="issue-detail-grid"><div><span>Severity</span><strong>{severityLabels[selectedIssue.severity] || selectedIssue.severity}</strong></div><div><span>Status</span><strong>{statusLabels[selectedIssue.status] || selectedIssue.status}</strong></div><div><span>Occurrences</span><strong>{(selectedIssue.occurrenceCount || 1).toLocaleString()}</strong></div></div>
          <div className="detail-section"><h3>Error message</h3><pre>{selectedIssue.message || "No stack trace or message was provided for this issue."}</pre></div>
          <div className="detail-section"><h3>Page URL</h3>{selectedIssue.pageUrl ? <a href={selectedIssue.pageUrl} target="_blank" rel="noreferrer">{selectedIssue.pageUrl}</a> : <p>No page URL recorded.</p>}</div>
          <div className="detail-section"><h3>Timeline</h3>{detailLoading ? <p>Loading issue history…</p> : selectedIssue.events?.length ? <ol className="issue-timeline">{selectedIssue.events.map(item => <li key={item.id}><span className="timeline-dot" /><div><strong>{item.type.replaceAll("_", " ")}</strong><p>{item.summary || "Issue activity recorded"}</p><time>{new Date(item.createdAt).toLocaleString()}{item.actor ? ` · ${item.actor}` : ""}</time></div></li>)}</ol> : <p>No activity history available yet.</p>}</div>
        </div>
        <div className="modal-actions"><button className="button button-quiet" onClick={() => setSelectedIssue(null)}>Close</button><button className="button button-primary" onClick={async () => { await changeStatus(selectedIssue, "INVESTIGATING"); setSelectedIssue(current => current ? { ...current, status: "INVESTIGATING" } : current); }}>Mark investigating</button></div>
      </section></div>}
      {showForm && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setShowForm(false); }}><form className="report-modal" onSubmit={submitIssue}>
        <div className="modal-heading"><div className="modal-icon"><Bug size={19} /></div><button type="button" className="modal-close" aria-label="Close dialog" onClick={() => setShowForm(false)} disabled={saving}>×</button><p className="eyebrow">ISSUE INTAKE</p><h2>Report a bug</h2><p>Capture the context your team needs to reproduce it.</p></div>
        <div className="form-body">
          <label className="field-label">Issue title <span>Required</span><input autoFocus maxLength={200} minLength={3} required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="e.g. Checkout crashes after applying a coupon" /></label>
          <label className="field-label">Error details <span>Optional</span><textarea maxLength={10000} rows={3} value={form.message} onChange={event => setForm({ ...form, message: event.target.value })} placeholder="Paste a safe error message or relevant context..." /></label>
          <div className="form-row"><label className="field-label">Severity<select value={form.severity} onChange={event => setForm({ ...form, severity: event.target.value })}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></label><label className="field-label">Project slug<input maxLength={60} pattern="[A-Za-z0-9-]+" value={form.projectSlug} onChange={event => setForm({ ...form, projectSlug: event.target.value })} placeholder="demo" /></label></div>
          <label className="field-label">Page URL <span>Optional</span><input type="url" maxLength={2048} value={form.pageUrl} onChange={event => setForm({ ...form, pageUrl: event.target.value })} placeholder="https://your-app.com/checkout" /></label>
          <p className="privacy-hint"><ShieldCheck size={14} /> Avoid including passwords, tokens, or personal data in error details.</p>
          {formError && <p className="form-error" role="alert">{formError}</p>}
        </div>
        <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? <><LoaderCircle size={15} className="spin" /> Sending…</> : <><CirclePlus size={15} /> Submit issue</>}</button></div>
      </form></div>}
    </div>
  );
}
