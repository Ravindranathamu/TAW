import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Wrench } from "lucide-react";
import { useTaw } from "../state/TawStore";
import { AlertStrip, Badge, Card, EmptyState, Field, Modal, PageHead, ProgressBar, StatCard } from "../components/ui";
import { money, num, shortDate, uid } from "../lib/utils";
import type { MaintenanceRecord } from "../types";

const CATEGORIES: MaintenanceRecord["category"][] = ["ENGINE", "HYDRAULIC", "TYRE", "BATTERY", "ELECTRICAL", "OTHER"];
const TYPES: MaintenanceRecord["type"][] = ["SCHEDULED_SERVICE", "REPAIR", "BREAKDOWN", "HYDRAULIC_SERVICE"];

const emptyRecord = (vehicleId: string): MaintenanceRecord => ({
  id: uid(), vehicleId, date: new Date().toISOString().slice(0, 10), odometerKm: 0,
  category: "ENGINE", type: "SCHEDULED_SERVICE", description: "", workshop: "TAW Workshop",
  labourCost: 0, parts: [], totalCost: 0,
});

export function MaintenancePage() {
  const { state, saveMaintenance, saveServiceRule } = useTaw();
  const [params, setParams] = useSearchParams();
  const [vehicleId, setVehicleId] = useState(params.get("vehicle") ?? state.vehicles[0]?.id ?? "");
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null);
  const [part, setPart] = useState({ name: "", supplier: "", cost: 0, warrantyUntil: "" });
  const [rule, setRule] = useState({ label: "", intervalKm: 10000, lastDoneKm: 0 });

  const records = useMemo(() => state.maintenance
    .filter((m) => !vehicleId || m.vehicleId === vehicleId)
    .sort((a, b) => b.date.localeCompare(a.date)), [state.maintenance, vehicleId]);
  const vehicle = state.vehicles.find((v) => v.id === vehicleId);
  const totalSpend = records.reduce((s, r) => s + r.totalCost, 0);
  const hydraulic = records.filter((r) => r.category === "HYDRAULIC").length;

  function openNew() {
    setEditing(emptyRecord(vehicleId));
  }

  function save() {
    if (!editing) return;
    const total = editing.labourCost + editing.parts.reduce((s, p) => s + p.cost, 0);
    saveMaintenance({ ...editing, totalCost: total });
    setEditing(null);
  }

  function addPart() {
    if (!editing || !part.name) return;
    setEditing({ ...editing, parts: [...editing.parts, { id: uid(), ...part, cost: num(part.cost) }] });
    setPart({ name: "", supplier: "", cost: 0, warrantyUntil: "" });
  }

  return (
    <>
      <PageHead
        title="Maintenance & warranties"
        subtitle="Service intervals, hydraulic repairs, part warranties and workshop history"
        action={<button className="btn btn-brand btn-sm" disabled={!vehicleId} onClick={openNew}><Plus size={14} /> Log service</button>}
      />
      <div className="grid grid-3">
        <StatCard label="Records" value={records.length} foot="Selected truck" icon={<Wrench size={16} />} tone="teal" />
        <StatCard label="Spend" value={money(totalSpend)} foot="On selected truck" icon={<Wrench size={16} />} tone="blue" />
        <StatCard label="Hydraulic jobs" value={hydraulic} foot="Pumps, winches and PTO" icon={<Wrench size={16} />} tone={hydraulic ? "amber" : "teal"} />
      </div>

      <div className="toolbar" style={{ marginTop: 14 }}>
        <select className="select" value={vehicleId} onChange={(e) => { setVehicleId(e.target.value); setParams({ vehicle: e.target.value }); }}>
          <option value="">All trucks</option>
          {state.vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} · {v.make}</option>)}
        </select>
      </div>

      <Card title="Service interval rules" subtitle="Alerts are raised when a truck is within 500 km of a due service">
        <div className="form-grid">
          <Field label="Rule name"><input className="input" value={rule.label} onChange={(e) => setRule({ ...rule, label: e.target.value })} placeholder="Hydraulic oil change" /></Field>
          <Field label="Interval (km)"><input className="input" type="number" value={rule.intervalKm} onChange={(e) => setRule({ ...rule, intervalKm: num(e.target.value) })} /></Field>
          <Field label="Last done at (km)"><input className="input" type="number" value={rule.lastDoneKm} onChange={(e) => setRule({ ...rule, lastDoneKm: num(e.target.value) })} /></Field>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="btn btn-ghost btn-block" disabled={!rule.label} onClick={() => { saveServiceRule({ id: uid(), ...rule }); setRule({ label: "", intervalKm: 10000, lastDoneKm: 0 }); }}><Plus size={13} /> Add rule</button>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          {state.serviceRules.map((r) => {
            const remaining = vehicle ? r.intervalKm - (vehicle.odometerKm - r.lastDoneKm) : r.intervalKm;
            return (
              <div key={r.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 5 }}>
                  <strong>{r.label}</strong>
                  <span style={{ color: remaining <= 500 ? "var(--danger)" : "var(--ink-3)" }}>{Math.max(0, remaining).toLocaleString()} km left</span>
                </div>
                <ProgressBar value={r.intervalKm - Math.max(0, remaining)} max={r.intervalKm} tone={remaining <= 500 ? "red" : "teal"} />
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Workshop history" padded={false}>
        {records.length === 0 ? <EmptyState message="No maintenance records for this selection." /> : records.map((m) => (
          <div key={m.id} style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div>
                <div className="cell-title">{m.type.replace(/_/g, " ")} · {m.category}</div>
                <div className="cell-sub">{shortDate(m.date)} · {m.odometerKm.toLocaleString()} km · {m.workshop}</div>
              </div>
              <strong style={{ fontSize: 12.5 }}>{money(m.totalCost)}</strong>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--ink-2)", margin: "8px 0 0" }}>{m.description}</p>
            {m.parts.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {m.parts.map((p) => <Badge key={p.id} tone={p.warrantyUntil ? "ok" : "neutral"}>{p.name} · {money(p.cost)}{p.warrantyUntil ? ` · warranty ${shortDate(p.warrantyUntil)}` : ""}</Badge>)}
              </div>
            )}
            {m.nextDueKm && <div className="cell-sub" style={{ marginTop: 7 }}>Next due at {m.nextDueKm.toLocaleString()} km</div>}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 9 }} onClick={() => setEditing({ ...m })}>Edit record</button>
          </div>
        ))}
      </Card>

      {editing && (
        <Modal
          title={state.maintenance.some((m) => m.id === editing.id) ? "Edit maintenance record" : "Log maintenance"}
          subtitle={state.vehicles.find((v) => v.id === editing.vehicleId)?.plate ?? "Select a truck"}
          onClose={() => setEditing(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-brand" disabled={!editing.description} onClick={save}>Save record</button></>}
        >
          <div className="form-grid">
            <Field label="Truck">
              <select className="select" value={editing.vehicleId} onChange={(e) => setEditing({ ...editing, vehicleId: e.target.value })}>
                {state.vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
              </select>
            </Field>
            <Field label="Date"><input className="input" type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} /></Field>
            <Field label="Odometer (km)"><input className="input" type="number" value={editing.odometerKm || ""} onChange={(e) => setEditing({ ...editing, odometerKm: num(e.target.value) })} /></Field>
            <Field label="Category"><select className="select" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as MaintenanceRecord["category"] })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
            <Field label="Type"><select className="select" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as MaintenanceRecord["type"] })}>{TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></Field>
            <Field label="Workshop"><input className="input" value={editing.workshop} onChange={(e) => setEditing({ ...editing, workshop: e.target.value })} /></Field>
            <Field label="Labour cost"><input className="input" type="number" value={editing.labourCost} onChange={(e) => setEditing({ ...editing, labourCost: num(e.target.value) })} /></Field>
            <Field label="Next due odometer"><input className="input" type="number" value={editing.nextDueKm ?? ""} onChange={(e) => setEditing({ ...editing, nextDueKm: num(e.target.value) || undefined })} /></Field>
            <Field label="Description" full><textarea className="textarea" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
          </div>
          <div className="divider" />
          <strong style={{ fontSize: 12 }}>Parts used</strong>
          {editing.parts.map((p) => (
            <div key={p.id} className="alert-item">
              <span style={{ flex: 1 }}><strong>{p.name}</strong><small>{p.supplier} · {money(p.cost)}{p.warrantyUntil ? ` · warranty until ${shortDate(p.warrantyUntil)}` : ""}</small></span>
              <button className="btn btn-danger btn-sm" onClick={() => setEditing({ ...editing, parts: editing.parts.filter((x) => x.id !== p.id) })}>Remove</button>
            </div>
          ))}
          <div className="form-grid" style={{ marginTop: 10 }}>
            <Field label="Part name"><input className="input" value={part.name} onChange={(e) => setPart({ ...part, name: e.target.value })} /></Field>
            <Field label="Supplier"><input className="input" value={part.supplier} onChange={(e) => setPart({ ...part, supplier: e.target.value })} /></Field>
            <Field label="Cost"><input className="input" type="number" value={part.cost || ""} onChange={(e) => setPart({ ...part, cost: num(e.target.value) })} /></Field>
            <Field label="Warranty until"><input className="input" type="date" value={part.warrantyUntil} onChange={(e) => setPart({ ...part, warrantyUntil: e.target.value })} /></Field>
          </div>
          <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 10 }} onClick={addPart}><Plus size={13} /> Add part to record</button>
          <AlertStrip tone="info">Total: <strong>{money(editing.labourCost + editing.parts.reduce((s, p) => s + p.cost, 0))}</strong></AlertStrip>
        </Modal>
      )}
    </>
  );
}
