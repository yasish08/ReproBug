import { useState } from "react";
import { Bug, ArrowRight, ShieldCheck, LoaderCircle, Sparkles } from "lucide-react";
import { apiUrl } from "./lib/api.js";

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch(apiUrl(`/api/auth/${mode === "login" ? "login" : "register"}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(mode === "register" ? { name } : {}) })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Authentication failed. Please try again.");
      onAuthenticated(body.data);
    } catch (err) {
      setError(err.message || "Unable to connect to ReproBug.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-shell">
    <div className="auth-glow auth-glow-one" /><div className="auth-glow auth-glow-two" />
    <section className="auth-card">
      <a className="brand auth-brand" href="#signin"><span className="brand-mark"><Bug size={20} strokeWidth={2.4} /></span><span>repro<span className="brand-accent">bug</span><span className="brand-period">.</span></span></a>
      <div className="auth-kicker"><Sparkles size={14} /> YOUR DEBUGGING COMMAND CENTER</div>
      <h1>{mode === "login" ? "Welcome back." : "Build with confidence."}</h1>
      <p className="auth-subtitle">{mode === "login" ? "Sign in to see your team's errors and get back to shipping." : "Create your workspace and start tracking browser errors."}</p>
      <form className="auth-form" onSubmit={submit}>
        {mode === "register" && <label className="field-label">Your name<input autoComplete="name" maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Ada Lovelace" /></label>}
        <label className="field-label">Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" /></label>
        <label className="field-label">Password<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 10 : 1} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} placeholder={mode === "register" ? "At least 10 characters" : "Your password"} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle size={16} className="spin" /> Please wait…</> : <>{mode === "login" ? "Sign in" : "Create workspace"} <ArrowRight size={16} /></>}</button>
      </form>
      <p className="auth-switch">{mode === "login" ? "New to ReproBug?" : "Already have an account?"} <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Create an account" : "Sign in"}</button></p>
      <div className="auth-trust"><ShieldCheck size={14} /> Passwords are securely hashed. Sessions expire after 12 hours.</div>
    </section>
    <p className="auth-footnote">REPROBUG <span /> MADE FOR DEVELOPERS WHO SHIP.</p>
  </main>;
}
