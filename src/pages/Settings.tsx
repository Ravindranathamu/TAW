import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { BadgeCheck, Clipboard, Cloud, Loader2, MessageCircle, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { useTaw } from "../state/TawStore";
import { AlertStrip, Badge, Card, Field, PageHead } from "../components/ui";
import { currentSession, getCloudConfig } from "../lib/cloud";
import { getWahaConfig, saveWahaConfig, wahaWebhookHint, type WahaConfig } from "../lib/waha";
import { TAW_LICENSE_KEY_STORAGE } from "../lib/licence";
import { num, shortDate } from "../lib/utils";

export function SettingsPage() {
  const { state, mode, updateCompany, refresh, notify, licence, verifyLicence, syncLicence } = useTaw();
  const location = useLocation();
  const config = getCloudConfig();
  const [waha, setWaha] = useState<WahaConfig>(getWahaConfig());
  const [licenceKey, setLicenceKey] = useState(localStorage.getItem(TAW_LICENSE_KEY_STORAGE) ?? "");
  const [checking, setChecking] = useState(false);
  const [email, setEmail] = useState("");
  const [installationId, setInstallationId] = useState(state.company.installationId);
  const [company, setCompany] = useState({ ...state.company });

  useEffect(() => {
    void currentSession().then((session) => setEmail(session?.user.email ?? ""));
  }, []);

  useEffect(() => {
    setInstallationId(state.company.installationId);
    setCompany({ ...state.company });
  }, [state.company]);

  useEffect(() => {
    if ((location.state as { tab?: string } | null)?.tab === "licence") {
      document.getElementById("licence-settings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.state]);

  async function verify(identifier?: string) {
    setChecking(true);
    try {
      const result = await verifyLicence(identifier);
      setLicenceKey((identifier ?? licenceKey).trim().toUpperCase());
      notify({ tone: result.ok ? "ok" : "error", text: result.message });
    } finally {
      setChecking(false);
    }
  }

  async function saveInstallation() {
    const clean = installationId.trim().toUpperCase();
    if (!clean) {
      notify({ tone: "error", text: "Enter the installation ID from the RAVBsoft handover." });
      return;
    }
    updateCompany({ installationId: clean });
    await verify(clean);
  }

  return (
    <>
      <PageHead title="Settings" subtitle="Company profile, workspace status and developer-portal licence" />
      <AlertStrip tone="info"><ShieldCheck size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> TAW is a separate RAVBsoft product line. Deployment, releases and licensing are managed from the <a href={config.portalUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "underline", fontWeight: 700 }}>developer portal</a>.</AlertStrip>

      <Card title="Company profile" subtitle="Used on IRD invoices and customer tracking">
        <div className="form-grid">
          <Field label="Company name" full><input className="input" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} /></Field>
          <Field label="Registered name" full><input className="input" value={company.registeredName} onChange={(e) => setCompany({ ...company, registeredName: e.target.value })} /></Field>
          <Field label="Address" full><textarea className="textarea" value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} /></Field>
          <Field label="Phone"><input className="input" value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} /></Field>
          <Field label="Email"><input className="input" value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} /></Field>
          <Field label="IRD TIN"><input className="input" inputMode="numeric" maxLength={9} value={company.tin} onChange={(e) => setCompany({ ...company, tin: e.target.value.replace(/\D/g, "") })} /></Field>
          <Field label="VAT rate (%)"><input className="input" type="number" value={company.vatRate} onChange={(e) => setCompany({ ...company, vatRate: num(e.target.value) })} /></Field>
          <Field label="TAW partner code"><input className="input" value={company.partnerCode} onChange={(e) => setCompany({ ...company, partnerCode: e.target.value.toUpperCase() })} /></Field>
          <Field label="Google Drive root folder ID" full><input className="input" value={company.driveRootFolderId} onChange={(e) => setCompany({ ...company, driveRootFolderId: e.target.value })} /></Field>
        </div>
        <button className="btn btn-brand btn-block btn-sm" style={{ marginTop: 12 }} onClick={() => updateCompany(company)}><Save size={13} /> Save company profile</button>
      </Card>

      <Card title="Workspace connection" subtitle={email ? `Signed in as ${email}` : mode === "demo" ? "Local demo — no server connection" : "No active session"}>
        <div className="alert-strip alert-info">
          <Cloud size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
          Server URLs and keys are applied automatically during the initial deployment. Owners do not need to fill or change them here.
        </div>
        <div className="kv" style={{ marginTop: 12 }}>
          <dt>Workspace</dt>
          <dd>{mode === "demo" ? "Local demo" : config.url ? config.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "Not configured"}</dd>
          <dt>Session</dt>
          <dd>{email || (mode === "demo" ? "Local demo" : "Not signed in")}</dd>
          <dt>Developer portal</dt>
          <dd><a href={config.portalUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>Open portal</a></dd>
          <dt>Licence server</dt>
          <dd>{config.licenseUrl ? "Configured" : "Not configured"}</dd>
        </div>
        <button className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 12 }} disabled={mode !== "cloud"} onClick={() => void refresh()}>
          <RefreshCw size={14} /> Pull latest cloud data
        </button>
      </Card>

      <Card title="WAHA (WhatsApp HTTP API)" subtitle="Send tracking links, quotes and live locations; import customer location pins">
        <div className="form-grid">
          <Field label="WAHA base URL" full><input className="input" value={waha.url} onChange={(e) => setWaha({ ...waha, url: e.target.value })} placeholder="https://waha.your-domain.com" /></Field>
          <Field label="API key" full><input className="input" type="password" value={waha.apiKey} onChange={(e) => setWaha({ ...waha, apiKey: e.target.value })} placeholder="X-Api-Key" /></Field>
          <Field label="Session name"><input className="input" value={waha.session} onChange={(e) => setWaha({ ...waha, session: e.target.value })} placeholder="default" /></Field>
          <Field label="Webhook secret"><input className="input" type="password" value={waha.webhookSecret} onChange={(e) => setWaha({ ...waha, webhookSecret: e.target.value })} /></Field>
          <Field label="Webhook relay URL" full><input className="input" value={waha.relayUrl} onChange={(e) => setWaha({ ...waha, relayUrl: e.target.value })} placeholder="https://relay.your-domain.com/taw-waha-webhook" /></Field>
        </div>
        <div className="alert-strip alert-info" style={{ marginTop: 12 }}>
          <MessageCircle size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
          Incoming location webhook: <code>{wahaWebhookHint()}</code>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => void navigator.clipboard?.writeText(wahaWebhookHint())}><Clipboard size={11} /> Copy</button>
        </div>
        <button className="btn btn-brand btn-block btn-sm" style={{ marginTop: 12 }} onClick={() => { saveWahaConfig(waha); notify({ tone: "ok", text: "WAHA connection saved on this device." }); }}><Save size={13} /> Save WAHA connection</button>
        <p className="sub" style={{ marginTop: 10 }}>TAW uses <code>/api/sendText</code> and <code>/api/sendLocation</code>. Customer location messages arrive as <code>message</code> webhooks; Dispatch can also paste the payload directly.</p>
      </Card>

      <div id="licence-settings">
        <Card title="Developer-portal licence" subtitle="30-day full-access trial · activation managed by the RAVBsoft portal">
          <div className="licence-summary">
            <Badge tone={licence.mode === "Active" ? "ok" : licence.mode === "Trial" ? "info" : "danger"} plain>
              {mode === "demo" ? "Local demo" : licence.mode}
            </Badge>
            <span>Plan {licence.plan}</span>
            <span>Installation {licence.installationId || state.company.installationId || "—"}</span>
            {licence.mode === "Trial" && <span>{licence.daysLeft} trial day{licence.daysLeft === 1 ? "" : "s"} left · all features unlocked</span>}
            {licence.mode === "Active" && <span>{licence.lifetime ? "Lifetime licence" : `Active${licence.expiresAt ? ` until ${shortDate(licence.expiresAt)}` : ""}`}</span>}
            {state.company.licenseActivatedAt && <span>Activated {shortDate(state.company.licenseActivatedAt)}</span>}
            {licence.clockRollback && <span>Clock check required — reconnect</span>}
            {!licence.clockRollback && mode !== "demo" && state.company.lastLicenceSyncAt && (
              <span>{licence.offlineGraceDaysLeft} offline grace day{licence.offlineGraceDaysLeft === 1 ? "" : "s"} left</span>
            )}
          </div>

          <div className="form-grid" style={{ marginTop: 12 }}>
            <Field label="Installation ID" hint="Assigned by the portal during provisioning — for example TAW-LK-4A9C21EF" full>
              <input className="input mono" value={installationId} onChange={(e) => setInstallationId(e.target.value.toUpperCase())} placeholder="TAW-LK-XXXXXXXX" />
            </Field>
            <Field label="Activation key (optional)" hint="Older TAW-YYYYMMDD keys are still accepted; the installation ID is preferred." full>
              <input className="input mono" value={licenceKey} onChange={(e) => setLicenceKey(e.target.value.toUpperCase())} placeholder="TAW-YYYYMMDD-XXXXXXXX" />
            </Field>
          </div>

          <div className="row wrap" style={{ marginTop: 12 }}>
            <button className="btn btn-brand" disabled={checking || !installationId.trim()} onClick={() => void saveInstallation()}>
              {checking ? <Loader2 className="spin" size={14} /> : <BadgeCheck size={14} />} {checking ? "Checking…" : "Save ID & sync licence"}
            </button>
            <button className="btn btn-secondary" disabled={checking} onClick={() => void syncLicence()}>
              <RefreshCw size={14} /> Sync now
            </button>
            <button className="btn btn-ghost" disabled={checking || !licenceKey.trim()} onClick={() => void verify(licenceKey)}>
              Verify key
            </button>
          </div>

          <div className="alert-strip alert-info" style={{ marginTop: 12 }}>
            Trial = every TAW feature. After payment the developer activates this installation from
            the portal; the app records the activation, removes the reminder and keeps all data,
            drivers and settings unchanged. Licensing is outbound-only — TAW never opens an
            inbound licence endpoint.
          </div>

          <div className="kv" style={{ marginTop: 12 }}>
            <dt>Licensed features</dt><dd>All TAW features (activation is all-or-nothing)</dd>
            <dt>Last portal check</dt><dd>{state.company.lastLicenceSyncAt ? shortDate(state.company.lastLicenceSyncAt) : "—"}</dd>
            <dt>Licence holder</dt><dd>{state.company.licenseHolder || state.company.name}</dd>
          </div>
        </Card>
      </div>

      <Card title="Golden master" subtitle="Clean template files shipped with this installation">
        <div className="kv">
          <dt>Domain model</dt><dd>src/types.ts</dd>
          <dt>Catalog seed</dt><dd>supabase/seed_vehicles_sl.sql</dd>
          <dt>Verification</dt><dd>supabase/golden-master/verify.sql</dd>
          <dt>Documentation</dt><dd>README.md · AGENTS.md</dd>
        </div>
        <div style={{ marginTop: 10 }}><Badge tone="ok" plain>Zero client data in golden files</Badge></div>
      </Card>
    </>
  );
}
