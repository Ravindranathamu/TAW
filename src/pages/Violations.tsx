import { useState } from "react";
import { Gavel, Plus } from "lucide-react";
import { useTaw } from "../state/TawStore";
import { Badge, Card, EmptyState, Field, Modal, PageHead, StatCard } from "../components/ui";
import { money, num, shortDate, uid } from "../lib/utils";
import type { CourtCase } from "../types";

const emptyCase = (): CourtCase => ({ id: uid(), date: new Date().toISOString().slice(0, 10), court: "", caseNumber: "", description: "", fineAmount: 0, status: "PENDING" });

export function ViolationsPage() {
  const { state, saveCourtCase, notify } = useTaw();
  const [editing, setEditing] = useState<CourtCase | null>(null);
  const cases = [...state.courtCases].sort((a, b) => a.date.localeCompare(b.date));
  const pending = cases.filter((c) => c.status === "PENDING");
  const fines = cases.filter((c) => c.status === "PAID").reduce((s, c) => s + c.fineAmount, 0);
  const exposure = pending.reduce((s, c) => s + c.fineAmount, 0);

  return (
    <>
      <PageHead title="Violations & court" subtitle="Traffic fines, summons and court dates linked to drivers and trucks" action={<button className="btn btn-brand btn-sm" onClick={() => setEditing(emptyCase())}><Plus size={14} /> Add case</button>} />
      <div className="grid grid-2">
        <StatCard label="Pending cases" value={pending.length} foot="Upcoming court dates" icon={<Gavel size={16} />} tone={pending.length ? "amber" : "teal"} />
        <StatCard label="Fine exposure" value={money(exposure)} foot={`${money(fines)} already paid`} icon={<Gavel size={16} />} tone="red" />
      </div>
      <Card title="Case register" padded={false}>
        {cases.length === 0 ? <EmptyState message="No violations or court cases recorded." /> : (
          <div style={{ padding: "4px 14px 12px" }}>
            {cases.map((c) => {
              const person = state.staff.find((s) => s.id === c.staffId);
              const vehicle = state.vehicles.find((v) => v.id === c.vehicleId);
              return (
                <div key={c.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div className="mono cell-title">{c.caseNumber}</div>
                      <div className="cell-sub">{c.court} · {shortDate(c.date)}</div>
                    </div>
                    <Badge tone={c.status === "PENDING" ? "warn" : c.status === "PAID" ? "ok" : "info"}>{c.status}</Badge>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--ink-2)", margin: "8px 0 0" }}>{c.description}</p>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {person && <Badge>{person.name}</Badge>}
                    {vehicle && <Badge>{vehicle.plate}</Badge>}
                    <Badge tone="danger">{money(c.fineAmount)}</Badge>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...c })}>Edit</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { saveCourtCase({ ...c, status: c.status === "PENDING" ? "PAID" : "PENDING" }); notify({ tone: "ok", text: "Case status updated." }); }}>
                      {c.status === "PENDING" ? "Mark paid" : "Reopen"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      {editing && (
        <Modal title={state.courtCases.some((c) => c.id === editing.id) ? "Edit court case" : "Add court case"} onClose={() => setEditing(null)} footer={<><button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-brand" disabled={!editing.caseNumber || !editing.description} onClick={() => { saveCourtCase(editing); setEditing(null); }}>Save case</button></>}>
          <div className="form-grid">
            <Field label="Case number"><input className="input" value={editing.caseNumber} onChange={(e) => setEditing({ ...editing, caseNumber: e.target.value })} /></Field>
            <Field label="Court date"><input className="input" type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} /></Field>
            <Field label="Court" full><input className="input" value={editing.court} onChange={(e) => setEditing({ ...editing, court: e.target.value })} placeholder="Kandy Magistrate's Court" /></Field>
            <Field label="Driver"><select className="select" value={editing.staffId ?? ""} onChange={(e) => setEditing({ ...editing, staffId: e.target.value || undefined })}><option value="">None</option>{state.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Truck"><select className="select" value={editing.vehicleId ?? ""} onChange={(e) => setEditing({ ...editing, vehicleId: e.target.value || undefined })}><option value="">None</option>{state.vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}</select></Field>
            <Field label="Fine (LKR)"><input className="input" type="number" value={editing.fineAmount} onChange={(e) => setEditing({ ...editing, fineAmount: num(e.target.value) })} /></Field>
            <Field label="Status"><select className="select" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as CourtCase["status"] })}><option value="PENDING">Pending</option><option value="PAID">Paid</option><option value="DISMISSED">Dismissed</option></select></Field>
            <Field label="Description" full><textarea className="textarea" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
