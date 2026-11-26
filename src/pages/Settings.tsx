import { useEffect, useState } from "react";
import { Clipboard, Cloud, MessageCircle, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { useTaw } from "../state/TawStore";
import { AlertStrip, Badge, Card, Field, PageHead } from "../components/ui";
import { currentSession, getCloudConfig } from "../lib/cloud";
import { getWahaConfig, saveWahaConfig, wahaWebhookHint, type WahaConfig } from "../lib/waha";
import { ratesForCompany } from "../lib/pricing";
import { num } from "../lib/utils";

export function SettingsPage() {
  const { state, mode, updateCompany, mutate, refresh, notify } = useTaw();
  const config = getCloudConfig();
  const [waha, setWaha] = useState<WahaConfig>(getWahaConfig());
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState({ ...state.company });
  const [rates, setRates] = useState(() => {
    const current = ratesForCompany(state.company);
    return { baseFee: current.baseFee, perKmRate: current.perKmRate };
  });

  useEffect(() => {
    void currentSession().then((session) => setEmail(session?.user.email ?? ""));
  }, []);

  useEffect(() => {
    setCompany({ ...state.company });
    const current = ratesForCompany(state.company);
    setRates({ baseFee: current.baseFee, perKmRate: current.perKmRate });
  }, [state.company]);

  return (
    <>
      <PageHead title="Settings" subtitle="Company profile, workspace status and WhatsApp connection" />
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

      <Card title="Pricing rates" subtitle="Owner-controlled base fee and per-kilometre rate for new dispatch quotes">
        <div className="form-grid">
          <Field label="Base fee (LKR)" hint="Applied once before distance, weight and road factors.">
            <input className="input" type="number" min="0" step="100" value={rates.baseFee} onChange={(e) => setRates({ ...rates, baseFee: num(e.target.value) })} />
          </Field>
          <Field label="Rate per km (LKR)" hint="Multiplied by the estimated trip distance.">
            <input className="input" type="number" min="0" step="10" value={rates.perKmRate} onChange={(e) => setRates({ ...rates, perKmRate: num(e.target.value) })} />
          </Field>
        </div>
        <div className="alert-strip alert-info" style={{ marginTop: 12 }}>
          Quote formula: (base fee + km × rate per km) × weight tier × road factor + tolls. Saving new rates affects future quotes only; existing trips and invoices stay unchanged.
        </div>
        <button
          className="btn btn-brand btn-block btn-sm"
          style={{ marginTop: 12 }}
          disabled={rates.baseFee < 0 || rates.perKmRate < 0}
          onClick={() => mutate((d) => {
            d.company.baseFee = rates.baseFee;
            d.company.perKmRate = rates.perKmRate;
          }, { tone: "ok", text: "Pricing rates saved." })}
        >
          <Save size={13} /> Save pricing rates
        </button>
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
