import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, CalendarClock, FilePlus2, Trash2, Truck } from "lucide-react";
import { useTaw } from "../state/TawStore";
import { AlertStrip, Badge, Card, EmptyState, Field, KeyValue, Modal, PageHead, ProgressBar } from "../components/ui";
import { complianceLabel, daysUntil, money, shortDate, toneForDays, uid } from "../lib/utils";
import { calculateEfficiency, efficiencyLabel } from "../lib/efficiency";
import type { ComplianceDoc, ComplianceKind, Vehicle } from "../types";

const KINDS: ComplianceKind[] = ["INSURANCE", "REVENUE_LICENSE", "FITNESS", "EMISSION"];

export function VehicleDetailPage() {
  const { id } = useParams();
  const { state, saveVehicle, addCompliance, deleteCompliance, notify } = useTaw();
  const vehicle = state.vehicles.find((v) => v.id === id);
  const [docOpen, setDocOpen] = useState(false);
  const [doc, setDoc] = useState({ kind: "INSURANCE" as ComplianceKind, provider: "", number: "", expiry: "", documentUrl: "" });

  if (!vehicle) {
    return <Card><EmptyState message="Vehicle not found." action={<Link className="btn btn-ghost" to="/fleet">Back to fleet</Link>} /></Card>;
  }

  const vehicleId = vehicle.id;
  const patch = (changes: Partial<Vehicle>) => saveVehicle({ ...vehicle, ...changes });
  const expiring = vehicle.compliance.filter((d) => daysUntil(d.expiry) <= 30);
  const measured = calculateEfficiency(vehicle.id, state.fuelLogs, state.trips);

  function addDoc() {
    if (!doc.expiry || !doc.number) return;
    const item: ComplianceDoc = { id: uid(), kind: doc.kind, provider: doc.provider, number: doc.number, expiry: doc.expiry, documentUrl: doc.documentUrl };
    addCompliance(vehicleId, item);
    setDocOpen(false);
    setDoc({ kind: "INSURANCE", provider: "", number: "", expiry: "", documentUrl: "" });
  }

  return (
    <>
      <PageHead
        title={vehicle.plate}
        subtitle={`${vehicle.make} ${vehicle.model} · ${vehicle.year}`}
        action={<Link className="btn btn-ghost btn-sm" to="/fleet"><ArrowLeft size={13} /> Fleet</Link>}
      />

      {expiring.length > 0 && (
        <AlertStrip tone="danger">
          <strong>{expiring.length} compliance document{expiring.length === 1 ? "" : "s"}</strong> due within 30 days: {expiring.map((d) => complianceLabel[d.kind]).join(", ")}.
        </AlertStrip>
      )}

      <Card title="Vehicle profile" subtitle="Chassis, capacity and live mileage">
        <KeyValue rows={[
          ["Chassis", vehicle.chassis || "—"],
          ["Engine", vehicle.engine || "—"],
          ["Body", vehicle.bodyType],
          ["Max payload", `${vehicle.maxPayloadKg.toLocaleString()} kg`],
          ["Deck length", `${(vehicle.deckLengthMm / 1000).toFixed(2)} m`],
          ["Odometer", `${vehicle.odometerKm.toLocaleString()} km`],
          ["Efficiency", measured.samples > 0 ? `${efficiencyLabel(measured.kmpl)} · ${measured.samples} samples` : efficiencyLabel(undefined)],
          ["Status", <Badge key="s" tone={vehicle.status === "AVAILABLE" ? "ok" : "info"}>{vehicle.status.replace("_", " ")}</Badge>],
        ]} />
        <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => patch({ status: vehicle.status === "IN_WORKSHOP" ? "AVAILABLE" : "IN_WORKSHOP" })}>
            <Truck size={13} /> {vehicle.status === "IN_WORKSHOP" ? "Return to service" : "Report breakdown"}
          </button>
        </div>
      </Card>

      <Card
        title="Compliance & renewals"
        subtitle="Insurance, revenue licence, fitness and emission"
        action={<button className="btn btn-ghost btn-sm" onClick={() => setDocOpen(true)}><FilePlus2 size={13} /> Add</button>}
        padded={false}
      >
        {vehicle.compliance.length === 0 ? <EmptyState message="No compliance documents recorded." /> : (
          <div style={{ padding: "0 14px 10px" }}>
            {vehicle.compliance.map((d) => {
              const days = daysUntil(d.expiry);
              return (
                <div key={d.id} className="alert-item">
                  <span className={`alert-sev sev-${days < 0 || days <= 3 ? "URGENT" : days <= 14 ? "SOON" : "OK"}`} />
                  <span style={{ flex: 1 }}>
                    <strong>{complianceLabel[d.kind]}</strong>
                    <small>{d.provider ? `${d.provider} · ` : ""}{d.number} · expires {shortDate(d.expiry)}</small>
                  </span>
                  <Badge tone={toneForDays(days)}>{days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}</Badge>
                  <button className="icon-btn icon-btn-sm" onClick={() => deleteCompliance(vehicle.id, d.id)}><Trash2 size={13} /></button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Finance" subtitle="Leasing instalment tracking">
        {vehicle.finance ? (
          <>
            <KeyValue rows={[
              ["Institution", vehicle.finance.institution],
              ["Monthly instalment", money(vehicle.finance.monthlyAmount)],
              ["Due day", `${vehicle.finance.dueDay} of each month`],
              ["Terms remaining", `${vehicle.finance.remainingTerms} of ${vehicle.finance.totalTerms}`],
              ["Next due", `${shortDate(vehicle.finance.nextDue)} (${daysUntil(vehicle.finance.nextDue)} days)`],
            ]} />
            <ProgressBar value={vehicle.finance.totalTerms - vehicle.finance.remainingTerms} max={vehicle.finance.totalTerms} tone={daysUntil(vehicle.finance.nextDue) < 7 ? "amber" : "teal"} />
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => {
              const next = new Date(vehicle.finance!.nextDue);
              next.setMonth(next.getMonth() + 1);
              patch({ finance: { ...vehicle.finance!, nextDue: next.toISOString().slice(0, 10), remainingTerms: Math.max(0, vehicle.finance!.remainingTerms - 1) } });
              notify({ tone: "ok", text: "Instalment rolled forward." });
            }}><CalendarClock size={13} /> Mark this instalment paid</button>
          </>
        ) : <EmptyState message="No finance plan attached." />}
      </Card>

      <Card title="Tyres & battery" subtitle="Warranties and replacement mileage">
        {vehicle.tyres.length === 0 && !vehicle.battery ? <EmptyState message="No tyre or battery records." /> : (
          <>
            {vehicle.tyres.map((t) => (
              <div key={t.id} className="alert-item">
                <span style={{ flex: 1 }}>
                  <strong>{t.position} · {t.brand}</strong>
                  <small>Serial {t.serial} · replace at {t.replaceAtKm.toLocaleString()} km · warranty {shortDate(t.warrantyUntil)}</small>
                </span>
                <ProgressBar value={vehicle.odometerKm - t.fittedKm} max={t.replaceAtKm - t.fittedKm} tone={vehicle.odometerKm >= t.replaceAtKm - 1000 ? "red" : "teal"} />
              </div>
            ))}
            {vehicle.battery && (
              <div className="alert-item">
                <span style={{ flex: 1 }}>
                  <strong>Battery · {vehicle.battery.brand}</strong>
                  <small>Serial {vehicle.battery.serial} · warranty until {shortDate(vehicle.battery.warrantyUntil)}</small>
                </span>
                <Badge tone={toneForDays(daysUntil(vehicle.battery.warrantyUntil))}>{daysUntil(vehicle.battery.warrantyUntil)}d</Badge>
              </div>
            )}
          </>
        )}
      </Card>

      <Card title="Service history" subtitle="Records for this truck" padded={false}>
        {state.maintenance.filter((m) => m.vehicleId === vehicle.id).length === 0 ? (
          <EmptyState message="No maintenance records yet." />
        ) : (
          <div style={{ padding: "0 14px 12px" }}>
            {state.maintenance.filter((m) => m.vehicleId === vehicle.id).map((m) => (
              <div key={m.id} className="alert-item">
                <span style={{ flex: 1 }}>
                  <strong>{m.type.replace("_", " ")} · {m.category}</strong>
                  <small>{shortDate(m.date)} · {m.description} · {m.workshop} · {money(m.totalCost)}</small>
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{ padding: "0 14px 14px" }}>
          <Link className="btn btn-ghost btn-sm btn-block" to={`/maintenance?vehicle=${vehicle.id}`}>Open maintenance log</Link>
        </div>
      </Card>

      {docOpen && (
        <Modal
          title="Add compliance document"
          subtitle={vehicle.plate}
          onClose={() => setDocOpen(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setDocOpen(false)}>Cancel</button>
            <button className="btn btn-brand" disabled={!doc.number || !doc.expiry} onClick={addDoc}>Add document</button>
          </>}
        >
          <div className="form-grid">
            <Field label="Document type" full>
              <select className="select" value={doc.kind} onChange={(e) => setDoc({ ...doc, kind: e.target.value as ComplianceKind })}>
                {KINDS.map((k) => <option key={k} value={k}>{complianceLabel[k]}</option>)}
              </select>
            </Field>
            <Field label="Provider"><input className="input" value={doc.provider} onChange={(e) => setDoc({ ...doc, provider: e.target.value })} placeholder="SLIC" /></Field>
            <Field label="Number"><input className="input" value={doc.number} onChange={(e) => setDoc({ ...doc, number: e.target.value })} /></Field>
            <Field label="Expiry date" full><input className="input" type="date" value={doc.expiry} onChange={(e) => setDoc({ ...doc, expiry: e.target.value })} /></Field>
            <Field label="Document URL" full hint="Optional link to a scanned copy in Google Drive.">
              <input className="input" value={doc.documentUrl} onChange={(e) => setDoc({ ...doc, documentUrl: e.target.value })} />
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}
