import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Fuel as FuelIcon, Plus, TrendingDown } from "lucide-react";
import { useTaw } from "../state/TawStore";
import { AlertStrip, Badge, Card, EmptyState, Field, Modal, PageHead, StatCard } from "../components/ui";
import { money, num, shortDate, uid } from "../lib/utils";
import { calculateEfficiency, efficiencyLabel, fuelAnomaly } from "../lib/efficiency";
import type { FuelLog } from "../types";

const emptyLog = (vehicleId: string): FuelLog => ({
  id: uid(), vehicleId, date: new Date().toISOString().slice(0, 10), station: "", odometerKm: 0,
  litres: 0, cost: 0, fullTank: true, anomaly: false,
});

export function FuelPage() {
  const { state, addFuelLog } = useTaw();
  const [params, setParams] = useSearchParams();
  const [vehicleId, setVehicleId] = useState(params.get("vehicle") ?? state.vehicles[0]?.id ?? "");
  const [editing, setEditing] = useState<FuelLog | null>(null);
  const logs = useMemo(() => state.fuelLogs
    .filter((l) => !vehicleId || l.vehicleId === vehicleId)
    .sort((a, b) => b.date.localeCompare(a.date)), [state.fuelLogs, vehicleId]);
  const vehicle = state.vehicles.find((v) => v.id === vehicleId);
  const spend = logs.reduce((s, l) => s + l.cost, 0);
  const litres = logs.reduce((s, l) => s + l.litres, 0);
  const anomalies = logs.filter((l) => l.anomaly).length;
  const measured = calculateEfficiency(vehicleId, state.fuelLogs, state.trips);
  const avg = vehicleId ? measured.kmpl : 0;

  function save() {
    if (!editing || editing.litres <= 0) return;
    const previous = state.fuelLogs.filter((l) => l.vehicleId === editing.vehicleId && l.odometerKm < editing.odometerKm)
      .sort((a, b) => b.odometerKm - a.odometerKm)[0];
    let efficiency: number | undefined;
    if (previous && editing.fullTank) {
      efficiency = Number(((editing.odometerKm - previous.odometerKm) / editing.litres).toFixed(2));
    }
    // The baseline itself is system-calculated from this truck's own history.
    const anomaly = fuelAnomaly(editing, state.fuelLogs, state.trips);
    addFuelLog({ ...editing, efficiencyKmpl: efficiency, anomaly });
    setEditing(null);
  }

  return (
    <>
      <PageHead title="Fuel & mileage" subtitle={`System-calculated km/L from runs and refills${vehicle ? ` · ${vehicle.plate}` : ""}`} action={<button className="btn btn-brand btn-sm" disabled={!vehicleId} onClick={() => setEditing(emptyLog(vehicleId))}><Plus size={14} /> Add refill</button>} />
      <div className="grid grid-3">
        <StatCard label="Fuel spend" value={money(spend)} foot="Selected range" icon={<FuelIcon size={16} />} tone="teal" />
        <StatCard label="System km/L" value={efficiencyLabel(avg)} foot={measured.samples > 0 ? `${measured.samples} samples · ${measured.distanceKm.toLocaleString()} km / ${measured.litres} L` : `${litres.toFixed(0)} L recorded`} icon={<TrendingDown size={16} />} tone="blue" />
        <StatCard label="Anomalies" value={anomalies} foot="Below expected efficiency" icon={<TrendingDown size={16} />} tone={anomalies ? "red" : "teal"} />
      </div>
      <div className="toolbar" style={{ marginTop: 14 }}>
        <select className="select" value={vehicleId} onChange={(e) => { setVehicleId(e.target.value); setParams({ vehicle: e.target.value }); }}>
          <option value="">All trucks</option>
          {state.vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
        </select>
      </div>
      {anomalies > 0 && <AlertStrip tone="danger"><strong>{anomalies} anomaly/anomalies.</strong> Consumption is more than 25% below the truck's expected km/L — check for a leak, idle time or record error.</AlertStrip>}
      <Card title="Fuel log" padded={false}>
        {logs.length === 0 ? <EmptyState message="No fuel logs for this truck." /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date / station</th><th>Odometer</th><th>Litres</th><th>Cost</th><th>Recorded km/L</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td><div className="cell-title">{shortDate(l.date)}</div><div className="cell-sub">{l.station || "—"}</div></td>
                    <td className="mono">{l.odometerKm.toLocaleString()}</td>
                    <td className="mono">{l.litres} L</td>
                    <td className="mono">{money(l.cost)}</td>
                    <td>{l.anomaly ? <Badge tone="danger">{l.efficiencyKmpl ?? "—"} ⚠</Badge> : <span className="cell-sub">{l.efficiencyKmpl ? l.efficiencyKmpl.toFixed(2) : "—"}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {editing && (
        <Modal title="Record fuel refill" subtitle={state.vehicles.find((v) => v.id === editing.vehicleId)?.plate ?? "Truck"} onClose={() => setEditing(null)} footer={<><button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-brand" disabled={!editing.station || editing.litres <= 0} onClick={save}>Save refill</button></>}>
          <div className="form-grid">
            <Field label="Truck"><select className="select" value={editing.vehicleId} onChange={(e) => setEditing({ ...editing, vehicleId: e.target.value })}>{state.vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}</select></Field>
            <Field label="Date"><input className="input" type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} /></Field>
            <Field label="Station"><input className="input" value={editing.station} onChange={(e) => setEditing({ ...editing, station: e.target.value })} placeholder="Shell Kandy Road" /></Field>
            <Field label="Odometer (km)"><input className="input" type="number" value={editing.odometerKm || ""} onChange={(e) => setEditing({ ...editing, odometerKm: num(e.target.value) })} /></Field>
            <Field label="Litres"><input className="input" type="number" step="0.1" value={editing.litres || ""} onChange={(e) => setEditing({ ...editing, litres: num(e.target.value) })} /></Field>
            <Field label="Cost (LKR)"><input className="input" type="number" value={editing.cost || ""} onChange={(e) => setEditing({ ...editing, cost: num(e.target.value) })} /></Field>
            <Field label="Full tank"><select className="select" value={editing.fullTank ? "yes" : "no"} onChange={(e) => setEditing({ ...editing, fullTank: e.target.value === "yes" })}><option value="yes">Yes — used in system km/L</option><option value="no">No — partial top-up</option></select></Field>
            <Field label="Receipt URL" full><input className="input" value={editing.receiptUrl ?? ""} onChange={(e) => setEditing({ ...editing, receiptUrl: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
