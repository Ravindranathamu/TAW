import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Fuel, Plus, Search, Truck, Wrench } from "lucide-react";
import { useTaw } from "../state/TawStore";
import { Badge, Card, EmptyState, Field, Modal, PageHead } from "../components/ui";
import { daysUntil, shortDate, uid } from "../lib/utils";
import { efficiencyLabel } from "../lib/efficiency";
import type { TruckStatus, Vehicle } from "../types";

const STATUS_TONE: Record<TruckStatus, "ok" | "info" | "danger" | "neutral"> = {
  AVAILABLE: "ok",
  ON_TRIP: "info",
  IN_WORKSHOP: "danger",
  RETIRED: "neutral",
};

export function FleetPage() {
  const { state, saveVehicle } = useTaw();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    plate: "", make: "", model: "", year: 2018, chassis: "", engine: "",
    maxPayloadKg: 2750, deckLengthMm: 4400, odometerKm: 0,
  });

  const filtered = state.vehicles.filter((v) =>
    `${v.plate} ${v.make} ${v.model}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function addVehicle() {
    const vehicle: Vehicle = {
      id: uid(),
      plate: form.plate.toUpperCase(),
      make: form.make,
      model: form.model,
      year: form.year,
      chassis: form.chassis,
      engine: form.engine,
      bodyType: "Flatbed Carrier",
      colour: "White",
      maxPayloadKg: form.maxPayloadKg,
      deckLengthMm: form.deckLengthMm,
      status: "AVAILABLE",
      odometerKm: form.odometerKm,
      efficiencyKmpl: 0, // system-calculated from completed runs + fuel logs
      compliance: [],
      tyres: [],
      createdAt: new Date().toISOString(),
    };
    saveVehicle(vehicle);
    setAdding(false);
    setForm({ plate: "", make: "", model: "", year: 2018, chassis: "", engine: "", maxPayloadKg: 2750, deckLengthMm: 4400, odometerKm: 0 });
  }

  return (
    <>
      <PageHead
        title="Carrier fleet"
        subtitle={`${state.vehicles.length} trucks · km/L is calculated by TAW from completed runs and fuel records`}
        action={<button className="btn btn-brand btn-sm" onClick={() => setAdding(true)}><Plus size={14} /> Add truck</button>}
      />

      <div className="toolbar">
        <div className="search-wrap"><Search /><input className="input" placeholder="Search plate, make or model…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState message="No carrier trucks match this search." /></Card>
      ) : (
        <div style={{ display: "grid", gap: 11 }}>
          {filtered.map((v) => {
            const expiring = v.compliance.filter((d) => daysUntil(d.expiry) <= 30).length;
            const nextDue = v.compliance.map((d) => d.expiry).sort()[0];
            return (
              <Link key={v.id} to={`/fleet/${v.id}`} className="card" style={{ margin: 0, display: "block", padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div className="match-plate"><Truck size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{v.plate}</div>
                    <div className="cell-sub">{v.make} {v.model} · {v.year}</div>
                  </div>
                  <Badge tone={STATUS_TONE[v.status]}>{v.status.replace("_", " ")}</Badge>
                </div>
                <div className="match-specs" style={{ marginTop: 12 }}>
                  <span>{v.odometerKm.toLocaleString()} km</span>
                  <span>{v.maxPayloadKg.toLocaleString()} kg</span>
                  <span>{(v.deckLengthMm / 1000).toFixed(2)} m deck</span>
                  <span>{efficiencyLabel(v.efficiencyKmpl)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 8 }}>
                  <span style={{ fontSize: 10.5, color: expiring ? "var(--danger)" : "var(--ink-3)" }}>
                    {expiring > 0 ? `${expiring} document${expiring === 1 ? "" : "s"} expiring soon` : `Next renewal ${shortDate(nextDue)}`}
                  </span>
                  <ArrowRight size={15} color="var(--brand)" />
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/maintenance?vehicle=${v.id}`); }}><Wrench size={12} /> Service</button>
                  <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/fuel?vehicle=${v.id}`); }}><Fuel size={12} /> Fuel</button>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {adding && (
        <Modal
          title="Add a carrier truck"
          subtitle="Payload and deck length drive the smart matcher."
          onClose={() => setAdding(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn btn-brand" disabled={!form.plate || !form.make} onClick={addVehicle}><Plus size={14} /> Add truck</button>
          </>}
        >
          <div className="form-grid">
            <Field label="Registration plate"><input className="input" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} placeholder="WP LB 4582" /></Field>
            <Field label="Year"><input className="input" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} /></Field>
            <Field label="Make"><input className="input" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Mitsubishi" /></Field>
            <Field label="Model"><input className="input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Fuso Canter Flatbed" /></Field>
            <Field label="Chassis number"><input className="input" value={form.chassis} onChange={(e) => setForm({ ...form, chassis: e.target.value })} /></Field>
            <Field label="Engine number"><input className="input" value={form.engine} onChange={(e) => setForm({ ...form, engine: e.target.value })} /></Field>
            <Field label="Max payload (kg)"><input className="input" type="number" value={form.maxPayloadKg} onChange={(e) => setForm({ ...form, maxPayloadKg: Number(e.target.value) })} /></Field>
            <Field label="Deck length (mm)"><input className="input" type="number" value={form.deckLengthMm} onChange={(e) => setForm({ ...form, deckLengthMm: Number(e.target.value) })} /></Field>
            <Field label="Current odometer (km)" full><input className="input" type="number" value={form.odometerKm} onChange={(e) => setForm({ ...form, odometerKm: Number(e.target.value) })} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
