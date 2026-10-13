import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Bug, CheckCircle2, CirclePlus, Search, ShieldCheck, Zap } from "lucide-react";

const seedIssues = [
  { id: "RB-1042", title: "Checkout fails after applying discount", project: "Storefront", severity: "Critical", status: "Investigating", route: "/checkout", count: 38, age: "4m ago" },
  { id: "RB-1041", title: "TypeError: Cannot read properties of undefined", project: "Customer Portal", severity: "High", status: "Open", route: "/account/profile", count: 21, age: "18m ago" },
  { id: "RB-1040", title: "Product images fail on slow connections", project: "Storefront", severity: "Medium", status: "Open", route: "/products/:id", count: 14, age: "42m ago" },
  { id: "RB-1039", title: "Settings page blank after session refresh", project: "Customer Portal", severity: "High", status: "Resolved", route: "/settings", count: 9, age: "1h ago" }
];

export default function App() {
  const [issues, setIssues] = useState(seedIssues);
  const [query, setQuery] = useState("");
  const [api, setApi] = useState("Checking API…");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  useEffect(() => { fetch("/api/health").then(r => r.ok ? r.json() : Promise.reject()).then(d => setApi("API online")).catch(() => setApi("API unavailable")); }, []);
  const filtered = useMemo(() => issues.filter(i => [i.id, i.title, i.project, i.route].join(" ").toLowerCase().includes(query.toLowerCase())), [issues, query]);
  function addIssue(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setIssues([{ id: `RB-${1043 + issues.length - seedIssues.length}`, title: title.trim(), project: "ReproBug Demo", severity: "Medium", status: "Open", route: "/", count: 1, age: "just now" }, ...issues]);
    setTitle(""); setShowForm(false);
  }
  return <div className="shell">
    <aside className="sidebar"><div className="brand"><span className="mark"><Bug size={19}/></span> Repro<span>Bug</span></div><div className="workspace"><span className="avatar">R</span><div><b>ReproBug workspace</b><small>Free plan</small></div></div><p className="label">WORKSPACE</p><div className="nav active"><Activity size={17}/> Overview</div><div className="nav"><Bug size={17}/> Issues <span className="count">{issues.length}</span></div><div className="nav"><ShieldCheck size={17}/> Projects</div><div className="nav"><Zap size={17}/> Analytics</div><div className="sidebar-bottom"><small>BUILD STATUS</small><p><span className="dot"/> {api}</p></div></aside>
    <main className="main"><header><div><p className="eyebrow">WORKSPACE / OVERVIEW</p><h1>Error intelligence</h1><p className="muted">See what broke, understand why, and help your team reproduce it.</p></div><button className="primary" onClick={() => setShowForm(true)}><CirclePlus size={16}/> Report issue</button></header>
    <section className="stats"><article><div className="stat-head">Open issues <Bug size={17}/></div><strong>{issues.filter(i=>i.status!=="Resolved").length}</strong><small>Across your workspace</small></article><article><div className="stat-head">Events captured <Activity size={17}/></div><strong>1,284</strong><small className="positive">Demo metric</small></article><article><div className="stat-head">Resolved issues <CheckCircle2 size={17}/></div><strong>{issues.filter(i=>i.status==="Resolved").length}</strong><small>In this sample workspace</small></article><article><div className="stat-head">Critical issues <AlertTriangle size={17}/></div><strong>{issues.filter(i=>i.severity==="Critical" && i.status!=="Resolved").length}</strong><small>Needs attention</small></article></section>
    <section className="panel"><div className="panel-head"><div><h2>Recent issues</h2><p className="muted">Latest browser errors and reports</p></div><label className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search issues…"/></label></div>
    <div className="table-wrap"><table><thead><tr><th>ISSUE</th><th>PROJECT</th><th>SEVERITY</th><th>STATUS</th><th>EVENTS</th><th>LAST SEEN</th></tr></thead><tbody>{filtered.map(i=><tr key={i.id}><td><b>{i.title}</b><small>{i.id} · {i.route}</small></td><td>{i.project}</td><td><span className={"pill "+i.severity.toLowerCase()}>{i.severity}</span></td><td><span className="status">{i.status}</span></td><td>{i.count}</td><td>{i.age}</td></tr>)}</tbody></table>{filtered.length===0&&<p className="empty">No issues match your search.</p>}</div>
    </section><footer>ReproBug · Day 1 foundation <span>Demo issue data · Persistence is the next milestone</span></footer></main>
    {showForm&&<div className="overlay" onClick={()=>setShowForm(false)}><form className="modal" onSubmit={addIssue} onClick={e=>e.stopPropagation()}><h2>Report an issue</h2><p className="muted">Create a local demo issue. API persistence is not implemented yet.</p><label>Issue title<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="What went wrong?" required/></label><div className="actions"><button type="button" className="secondary" onClick={()=>setShowForm(false)}>Cancel</button><button className="primary" type="submit">Create issue</button></div></form></div>}
  </div>;
}