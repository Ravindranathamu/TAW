import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck, Loader2, MapPin, Truck } from "lucide-react";
import { useTaw } from "../state/TawStore";
import { getCloudConfig, signIn } from "../lib/cloud";

export function LoginPage({ kind = "owner" }: { kind?: "owner" | "driver" }) {
  const { mode, role, enterDemo, enterCloud, notify } = useTaw();
  const navigate = useNavigate();
  const config = getCloudConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const home = kind === "driver" ? "/driver" : "/dashboard";

  useEffect(() => {
    if (mode && role === kind) navigate(home, { replace: true });
  }, [mode, role, kind, home, navigate]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await signIn(email.trim(), password);
      await enterCloud(session, kind);
      navigate(home, { replace: true });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Sign-in failed.";
      setError(message);
      notify({ tone: "error", text: message });
    } finally {
      setBusy(false);
    }
  }

  function demo() {
    enterDemo(kind);
    navigate(home, { replace: true });
  }

  return (
    <div className="auth-shell">
      <aside className="auth-art">
        <div className="auth-brand">
          <div className="brand-mark">TAW</div>
          <div>
            <strong>TAW</strong>
            <span>Vehicle Carrier Management · RAVBsoft</span>
          </div>
        </div>
        <div className="auth-hero">
          <h2>
            {kind === "driver" ? <>Your trip.<br />Your route.<br /><em>Live with TAW.</em></> : <>Your fleet.<br />Your dispatch.<br /><em>Your profit.</em></>}
          </h2>
          <p>
            {kind === "driver"
              ? "Sign in with your driver account. TAW publishes your live location automatically so the owner and customer can follow the job."
              : "Compliance renewals, smart carrier matching, IRD-compliant billing, live GPS and partner settlement — all in one phone-first workspace."}
          </p>
          <div className="auth-features">
            <div className="auth-feature"><Truck /> {kind === "driver" ? "Assigned trips and compliance checklist" : "Fleet, compliance and maintenance in one place"}</div>
            <div className="auth-feature"><MapPin /> {kind === "driver" ? "Automatic GPS — no manual coordinates" : "Live dispatch and customer tracking"}</div>
            <div className="auth-feature"><BadgeCheck /> Managed through the RAVBsoft developer portal</div>
          </div>
        </div>
        <div className="auth-art-foot">TAW · RAVBsoft product line · v0.1</div>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          <span className="badge badge-info">{kind === "driver" ? "Driver sign in" : "Owner sign in"}</span>
          <h1 style={{ marginTop: 12 }}>{kind === "driver" ? "Driver workspace" : "Welcome back"}</h1>
          <p className="sub">
            {kind === "driver"
              ? "Use the account issued by your company owner. Customer tracking needs no login."
              : "Sign in with your company workspace account. Licensing is verified against the RAVBsoft developer portal."}
          </p>

          {error && <div className="alert-strip alert-danger" style={{ marginTop: 14 }}>{error}</div>}

          <form onSubmit={(event) => void submit(event)}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" className="input" type="email" autoComplete="email" placeholder={kind === "driver" ? "driver@yourcompany.lk" : "operations@yourcompany.lk"} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" className="input" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={busy || !config.url}>
              {busy ? <Loader2 className="spin" size={15} /> : <ArrowRight size={15} />}
              {busy ? "Signing in…" : kind === "driver" ? "Start my driver shift" : "Continue to TAW"}
            </button>
          </form>

          {!config.url && (
            <p className="sub" style={{ color: "#ad3a4e", marginTop: 12 }}>
              This deployment has no workspace connection. Contact RAVBsoft with the installation ID; the demo below works without one.
            </p>
          )}

          <div className="auth-divider">or</div>
          <button className="btn btn-brand btn-block" onClick={demo}>
            {kind === "driver" ? "Open the driver demo" : "Explore the owner demo"}
          </button>
          <p className="sub" style={{ textAlign: "center", marginTop: 12 }}>
            {kind === "driver"
              ? <>Owners use <a href="/login">owner sign in</a>. Customers open the tracking link sent by TAW.</>
              : <>Drivers use a <a href="/driver-login">separate driver sign in</a>. Customers only need the tracking link.</>}
          </p>
        </div>
      </main>
    </div>
  );
}
