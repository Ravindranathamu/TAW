import { useEffect, useState } from "react";
import { BadgeCheck, Clipboard, Cloud, Loader2, MessageCircle, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { useTaw } from "../state/TawStore";
import { AlertStrip, Badge, Card, Field, PageHead } from "../components/ui";
import { checkPortalLicence, currentSession, getCloudConfig, saveCloudConfig, type CloudConfig, type PortalLicence } from "../lib/cloud";
import { getWahaConfig, saveWahaConfig, wahaWebhookHint, type WahaConfig } from "../lib/waha";
import { num } from "../lib/utils";

const LICENCE_KEY = "taw_license_key";

export function SettingsPage() {
  const { state, mode, updateCompany, refresh, notify } = useTaw();
  const [config, setConfig] = useState<CloudConfig>(getCloudConfig());
  const [waha, setWaha] = useState<WahaConfig>(getWahaConfig());
  const [licenceKey, setLicenceKey] = useState(localStorage.getItem(LICENCE_KEY) ?? "");
  const [licence, setLicence] = useState<PortalLicence | null>(null);
  const [checking, setChecking] = useState(false);
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState({ ...state.company });

  useEffect(() => {
    void currentSession().then((session) => setEmail(session?.user.email ?? ""));
  }, []);

  async function verify() {
    setChecking(true);
    localStorage.setItem(LICENCE_KEY, licenceKey.trim().toUpperCase());
    try {
      const result = await checkPortalLicence(licenceKey);
      setLicence(result);
      notify({ tone: result.valid ? "ok" : "error", text: result.message || (result.valid ? "Licence is active." : "Licence check failed.") });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Licence check failed.";
      setLicence({ valid: false, plan: "", status: "", expiresAt: "", seats: 0, message });
      notify({ tone: "error", text: message });
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <PageHead title="Settings" subtitle="Company profile, Supabase workspace and developer-portal licence" />
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
        <div className="form-grid">
          <Field label="Supabase URL" full><input className="input" value={config.url} onChange={(e) => setConfig({ ...config, url: e.target.value })} placeholder="https://project.supabase.co" /></Field>
          <Field label="Publishable / anon key" full><input className="input" value={config.anonKey} onChange={(e) => setConfig({ ...config, anonKey: e.target.value })} /></Field>
          <Field label="Portal URL" full><input className="input" value={config.portalUrl} onChange={(e) => setConfig({ ...config, portalUrl: e.target.value })} /></Field>
          <Field label="Licence RPC project URL" full><input className="input" value={config.licenseUrl} onChange={(e) => setConfig({ ...config, licenseUrl: e.target.value })} /></Field>
          <Field label="Licence RPC anon key" full><input className="input" value={config.licenseAnonKey} onChange={(e) => setConfig({ ...config, licenseAnonKey: e.target.value })} /></Field>
        </div>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <button className="btn btn-brand btn-block" onClick={() => { saveCloudConfig(config); notify({ tone: "ok", text: "Connection settings saved on this device." }); }}><Cloud size={14} /> Save connection</button>
          <button className="btn btn-ghost btn-block" disabled={mode !== "cloud"} onClick={() => void refresh()}><RefreshCw size={14} /> Pull latest cloud data</button>
        </div>
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

      <Card title="Developer-portal licence" subtitle="Verified against the RAVBsoft master licence RPC">
        <div className="form-grid">
          <Field label="Licence key" full><input className="input mono" value={licenceKey} onChange={(e) => setLicenceKey(e.target.value.toUpperCase())} placeholder="TAW-XXXX-XXXX-XXXX" /></Field>
        </div>
        <button className="btn btn-brand btn-block" style={{ marginTop: 12 }} disabled={checking || !licenceKey.trim()} onClick={() => void verify()}>
          {checking ? <Loader2 className="spin" size={14} /> : <BadgeCheck size={14} />} {checking ? "Checking…" : "Verify licence"}
        </button>
        {licence && (
          <div className={`alert-strip ${licence.valid ? "alert-ok" : "alert-danger"}`} style={{ marginTop: 12 }}>
            <strong>{licence.valid ? "Licence active" : "Licence inactive"}</strong>
            {licence.plan && <> · {licence.plan}</>}
            {licence.status && <> · {licence.status}</>}
            {licence.seats > 0 && <> · {licence.seats} seats</>}
            {licence.expiresAt && <> · expires {licence.expiresAt}</>}
            {licence.message && <><br />{licence.message}</>}
          </div>
        )}
        <p className="sub" style={{ marginTop: 10 }}>Licence keys are issued by the developer portal. This app never provisions Supabase projects itself.</p>
      </Card>

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
