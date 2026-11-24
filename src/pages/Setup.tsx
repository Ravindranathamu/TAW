import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useTaw } from "../state/TawStore";
import { Field, PageHead } from "../components/ui";
import { seedCatalog } from "../lib/seed";
import { uid } from "../lib/utils";

export function SetupPage() {
  const { state, mutate, notify } = useTaw();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...state.company });

  const steps = ["Company", "Tax & billing", "Alerts", "Done"];

  function finish() {
    mutate((draft) => {
      Object.assign(draft.company, {
        ...form,
        setupComplete: true,
        catalog: draft.catalog.length ? draft.catalog : seedCatalog(),
      });
    }, { tone: "ok", text: "Workspace ready." });
    notify({ tone: "ok", text: "Setup complete — welcome to TAW." });
    navigate("/dashboard");
  }

  return (
    <>
      <PageHead title="Initial setup" subtitle="Tell TAW about your company so reminders and invoices are correct." />
      <div className="wizard-steps">
        {steps.map((label, i) => (
          <div key={label} className={`wizard-step ${i <= step ? "active" : ""}`} title={label} />
        ))}
      </div>

      <div className="card">
        <div className="card-body">
          {step === 0 && (
            <div className="form-grid">
              <Field label="Company name" full>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Registered name" full hint="Appears on IRD tax invoices.">
                <input className="input" value={form.registeredName} onChange={(e) => setForm({ ...form, registeredName: e.target.value })} />
              </Field>
              <Field label="Address" full>
                <textarea className="textarea" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
              <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="TAW partner code" full hint="Used for TAW-to-TAW job handover and settlement.">
                <input className="input" value={form.partnerCode} onChange={(e) => setForm({ ...form, partnerCode: e.target.value.toUpperCase() })} />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="form-grid">
              <Field label="IRD TIN (9 digits)" hint="Mandatory when the customer requires a VAT invoice.">
                <input className="input" inputMode="numeric" maxLength={9} value={form.tin} onChange={(e) => setForm({ ...form, tin: e.target.value.replace(/\D/g, "") })} />
              </Field>
              <Field label="VAT rate (%)">
                <input className="input" type="number" value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) })} />
              </Field>
              <Field label="VAT registered">
                <select className="select" value={form.vatRegistered ? "yes" : "no"} onChange={(e) => setForm({ ...form, vatRegistered: e.target.value === "yes" })}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
              <Field label="Google Drive root folder ID" hint="Trip evidence folders are created here (when configured).">
                <input className="input" value={form.driveRootFolderId} onChange={(e) => setForm({ ...form, driveRootFolderId: e.target.value })} />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="form-grid">
              <Field label="Reminder lead days" full hint="Alerts are raised 30, 14 and 3 days before a due date by default.">
                <div style={{ display: "flex", gap: 8 }}>
                  {[30, 14, 3].map((days, i) => (
                    <input
                      key={days}
                      className="input"
                      type="number"
                      value={form.alertDays[i] ?? days}
                      onChange={(e) => {
                        const next = [...form.alertDays];
                        next[i] = Number(e.target.value);
                        setForm({ ...form, alertDays: next });
                      }}
                    />
                  ))}
                </div>
              </Field>
              <Field label="Currency" full>
                <input className="input" readOnly value="LKR — Sri Lankan Rupee" />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ width: 62, height: 62, borderRadius: "50%", background: "var(--brand-soft)", color: "var(--brand)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
                <Check size={30} />
              </div>
              <h3 style={{ fontSize: 17 }}>Your workspace is ready</h3>
              <p className="sub" style={{ maxWidth: 300, margin: "8px auto 0" }}>
                {form.name} · {form.partnerCode} · TIN {form.tin || "not set"}
              </p>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            {step > 0 && <button className="btn btn-ghost" onClick={() => setStep(step - 1)}><ArrowLeft size={14} /> Back</button>}
            <button
              className="btn btn-brand"
              style={{ marginLeft: "auto" }}
              onClick={() => (step === 3 ? finish() : setStep(step + 1))}
            >
              {step === 3 ? "Finish setup" : "Continue"} <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <button className="btn btn-ghost btn-block" onClick={() => {
        mutate((d) => {
          d.catalog = d.catalog.length ? d.catalog : seedCatalog();
          d.company.setupComplete = true;
        });
        navigate("/dashboard");
      }}>
        Skip — use demo defaults (adds {seedCatalog().length} vehicles to the directory) · seed id {uid().slice(0, 4)}
      </button>
    </>
  );
}
