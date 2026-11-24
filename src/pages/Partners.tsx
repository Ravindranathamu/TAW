import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, Check, Plus, Route, Wallet } from "lucide-react";
import { useTaw } from "../state/TawStore";
import { Badge, Card, EmptyState, Field, Modal, PageHead, StatCard } from "../components/ui";
import { money, num, shortDate, uid } from "../lib/utils";
import type { Partner, PartnerJob, PartnerMode } from "../types";

const emptyPartner = (): Partner => ({ id: uid(), companyName: "", contactName: "", phone: "", truckPlate: "", driverPhone: "", agreedRate: 0, commissionPct: 0, external: true, linkState: "PENDING" });

export function PartnersPage() {
  const { state, savePartner, savePartnerJob, notify } = useTaw();
  const [editing, setEditing] = useState<Partner | null>(null);
  const [jobFor, setJobFor] = useState<string | null>(null);
  const [job, setJob] = useState<PartnerJob>({ id: uid(), partnerId: "", tripId: "", mode: "SUBCONTRACT", customerPrice: 0, partnerPayout: 0, commission: 0, settled: false, createdAt: new Date().toISOString().slice(0, 10) });
  const openJobs = state.partnerJobs.filter((j) => !j.settled);
  const payouts = openJobs.reduce((s, j) => s + j.partnerPayout + j.commission, 0);

  function openJob(partnerId: string) {
    setJob({ id: uid(), partnerId, tripId: "", mode: "SUBCONTRACT", customerPrice: 0, partnerPayout: 0, commission: 0, settled: false, createdAt: new Date().toISOString().slice(0, 10) });
    setJobFor(partnerId);
  }

  return (
    <>
      <PageHead title="Partner network" subtitle="TAW-to-TAW handover, subcontracting, commissions and settlement" action={<button className="btn btn-brand btn-sm" onClick={() => setEditing(emptyPartner())}><Plus size={14} /> Add partner</button>} />
      <div className="grid grid-2">
        <StatCard label="Active partners" value={state.partners.filter((p) => p.linkState === "ACTIVE").length} foot={`${state.partners.length} in network`} icon={<ArrowLeftRight size={16} />} />
        <StatCard label="Open settlements" value={money(payouts)} foot={`${openJobs.length} unsettled jobs`} icon={<Wallet size={16} />} tone={payouts ? "amber" : "teal"} />
      </div>

      <Card title="Partners" subtitle="Mark a TAW partner as Active after the link is confirmed in the portal" padded={false}>
        {state.partners.length === 0 ? <EmptyState message="No partners in the network yet." /> : (
          <div style={{ padding: "4px 14px 12px" }}>
            {state.partners.map((p) => (
              <div key={p.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div className="cell-title">{p.companyName}</div>
                    <div className="cell-sub">{p.contactName} · {p.phone} · {p.truckPlate}</div>
                  </div>
                  <Badge tone={p.linkState === "ACTIVE" ? "ok" : p.linkState === "SUSPENDED" ? "danger" : "warn"}>{p.linkState}</Badge>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
                  <Badge tone={p.external ? "neutral" : "info"}>{p.external ? "External" : `TAW · ${p.tawPartnerId ?? "—"}`}</Badge>
                  <Badge>{money(p.agreedRate)} agreed</Badge>
                  <Badge>{p.commissionPct}% commission</Badge>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...p })}>Edit</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => openJob(p.id)}><Route size={12} /> New job</button>
                  {p.linkState !== "ACTIVE" && <button className="btn btn-brand btn-sm" onClick={() => { savePartner({ ...p, linkState: "ACTIVE" }); notify({ tone: "ok", text: `${p.companyName} is now active.` }); }}><Check size={12} /> Activate</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Subcontracted jobs" subtitle="Customer price minus partner payout and commission is your margin" padded={false}>
        {state.partnerJobs.length === 0 ? <EmptyState message="No partner jobs recorded." /> : (
          <div style={{ padding: "4px 14px 12px" }}>
            {state.partnerJobs.map((j) => {
              const partner = state.partners.find((p) => p.id === j.partnerId);
              const trip = state.trips.find((t) => t.id === j.tripId);
              const margin = j.customerPrice - j.partnerPayout - j.commission;
              return (
                <div key={j.id} className="alert-item">
                  <span style={{ flex: 1 }}>
                    <strong>{partner?.companyName ?? "Partner"} · {j.mode}</strong>
                    <small>{trip?.code ?? "Trip"} · {shortDate(j.createdAt)} · customer {money(j.customerPrice)} · payout {money(j.partnerPayout)} · commission {money(j.commission)}</small>
                  </span>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ color: margin >= 0 ? "var(--ok)" : "var(--danger)" }}>{money(margin)}</strong>
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} disabled={j.settled} onClick={() => { savePartnerJob({ ...j, settled: true }); notify({ tone: "ok", text: "Job settled." }); }}>{j.settled ? "Settled" : "Settle"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {editing && (
        <Modal title={state.partners.some((p) => p.id === editing.id) ? "Edit partner" : "Add partner"} onClose={() => setEditing(null)} footer={<><button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-brand" disabled={!editing.companyName} onClick={() => { savePartner(editing); setEditing(null); }}>Save partner</button></>}>
          <div className="form-grid">
            <Field label="Company name" full><input className="input" value={editing.companyName} onChange={(e) => setEditing({ ...editing, companyName: e.target.value })} /></Field>
            <Field label="Contact"><input className="input" value={editing.contactName} onChange={(e) => setEditing({ ...editing, contactName: e.target.value })} /></Field>
            <Field label="Phone"><input className="input" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
            <Field label="Truck plate"><input className="input" value={editing.truckPlate} onChange={(e) => setEditing({ ...editing, truckPlate: e.target.value })} /></Field>
            <Field label="Driver phone"><input className="input" value={editing.driverPhone} onChange={(e) => setEditing({ ...editing, driverPhone: e.target.value })} /></Field>
            <Field label="Agreed rate"><input className="input" type="number" value={editing.agreedRate} onChange={(e) => setEditing({ ...editing, agreedRate: num(e.target.value) })} /></Field>
            <Field label="Commission %"><input className="input" type="number" value={editing.commissionPct} onChange={(e) => setEditing({ ...editing, commissionPct: num(e.target.value) })} /></Field>
            <Field label="Type"><select className="select" value={editing.external ? "external" : "taw"} onChange={(e) => setEditing({ ...editing, external: e.target.value === "external" })}><option value="external">External carrier</option><option value="taw">TAW partner</option></select></Field>
            {!editing.external && <Field label="TAW partner ID"><input className="input" value={editing.tawPartnerId ?? ""} onChange={(e) => setEditing({ ...editing, tawPartnerId: e.target.value.toUpperCase() })} /></Field>}
            <Field label="Link state"><select className="select" value={editing.linkState} onChange={(e) => setEditing({ ...editing, linkState: e.target.value as Partner["linkState"] })}><option value="PENDING">Pending</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select></Field>
          </div>
        </Modal>
      )}

      {jobFor && (
        <Modal title="Create partner job" subtitle={state.partners.find((p) => p.id === jobFor)?.companyName ?? "Partner"} onClose={() => setJobFor(null)} footer={<><button className="btn btn-ghost" onClick={() => setJobFor(null)}>Cancel</button><button className="btn btn-brand" disabled={!job.tripId} onClick={() => { savePartnerJob(job); setJobFor(null); }}>Save job</button></>}>
          <div className="form-grid">
            <Field label="Trip" full><select className="select" value={job.tripId} onChange={(e) => setJob({ ...job, tripId: e.target.value })}><option value="">Select a trip…</option>{state.trips.map((t) => <option key={t.id} value={t.id}>{t.code} · {t.customerName} · {money(t.price.finalQuote)}</option>)}</select></Field>
            <Field label="Mode"><select className="select" value={job.mode} onChange={(e) => setJob({ ...job, mode: e.target.value as PartnerMode })}><option value="SUBCONTRACT">Subcontract</option><option value="COMMISSION">Commission referral</option></select></Field>
            <Field label="Customer price"><input className="input" type="number" value={job.customerPrice || ""} onChange={(e) => setJob({ ...job, customerPrice: num(e.target.value) })} /></Field>
            <Field label="Partner payout"><input className="input" type="number" value={job.partnerPayout || ""} onChange={(e) => setJob({ ...job, partnerPayout: num(e.target.value) })} /></Field>
            <Field label="Commission"><input className="input" type="number" value={job.commission || ""} onChange={(e) => setJob({ ...job, commission: num(e.target.value) })} /></Field>
          </div>
          <p className="sub" style={{ marginTop: 12 }}><Link to="/finance">Finance</Link> includes unsettled payouts in the P&amp;L.</p>
        </Modal>
      )}
    </>
  );
}
