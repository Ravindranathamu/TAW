import { useState } from "react";
import { Link } from "react-router-dom";
import { BellRing, CalendarClock } from "lucide-react";
import { useTaw } from "../state/TawStore";
import { Badge, Card, EmptyState, Field, Modal, PageHead, StatCard, Tabs } from "../components/ui";
import { complianceLabel, daysUntil, isoDays, num, shortDate, toneForDays } from "../lib/utils";
import type { ComplianceDoc, NotificationItem } from "../types";

type Filter = "ALL" | "URGENT" | "SOON" | "OK";

export function CompliancePage() {
  const { state, saveVehicle, markNotificationsRead, notify } = useTaw();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [renewing, setRenewing] = useState<{ vehicleId: string; doc: ComplianceDoc } | null>(null);
  const [form, setForm] = useState({ number: "", expiry: isoDays(365) });
  const alerts = state.notifications;
  const shown = alerts.filter((n) => filter === "ALL" || n.severity === filter);
  const urgent = alerts.filter((n) => n.severity === "URGENT").length;

  function openRenewal(vehicleId: string, doc: ComplianceDoc) {
    setRenewing({ vehicleId, doc });
    setForm({ number: doc.number, expiry: isoDays(365) });
  }

  function renew() {
    if (!renewing) return;
    const vehicle = state.vehicles.find((v) => v.id === renewing.vehicleId);
    if (!vehicle) return;
    saveVehicle({
      ...vehicle,
      compliance: vehicle.compliance.map((d) => d.id === renewing.doc.id ? { ...d, number: form.number || d.number, expiry: form.expiry } : d),
    });
    setRenewing(null);
    notify({ tone: "ok", text: "Renewal recorded. Alert cleared." });
  }

  const rows = state.vehicles.flatMap((v) => v.compliance.map((doc) => ({ vehicle: v, doc, days: daysUntil(doc.expiry) })))
    .sort((a, b) => a.days - b.days);

  return (
    <>
      <PageHead
        title="Compliance & alerts"
        subtitle={`30 / 14 / 3-day reminders · ${state.company.alertDays.join(" / ")}-day lead times`}
        action={<button className="btn btn-ghost btn-sm" onClick={() => { markNotificationsRead(); notify({ tone: "ok", text: "Alerts marked as read." }); }}><BellRing size={14} /> Mark all read</button>}
      />
      <div className="grid grid-3">
        <StatCard label="Urgent" value={urgent} foot="Expired or due in 3 days" icon={<BellRing size={16} />} tone={urgent ? "red" : "teal"} />
        <StatCard label="Documents" value={rows.length} foot="Across the fleet" icon={<CalendarClock size={16} />} tone="blue" />
        <StatCard label="Expiring soon" value={rows.filter((r) => r.days <= 30).length} foot="Within 30 days" icon={<CalendarClock size={16} />} tone="amber" />
      </div>
      <div style={{ marginTop: 14 }}>
        <Tabs
          tabs={[
            { key: "ALL", label: "All", count: alerts.length },
            { key: "URGENT", label: "Urgent", count: urgent },
            { key: "SOON", label: "Soon", count: alerts.filter((n) => n.severity === "SOON").length },
          ]}
          active={filter}
          onChange={setFilter}
        />
      </div>
      <Card title="Reminder feed" padded={false}>
        {shown.length === 0 ? <EmptyState message="Nothing in this alert category." /> : (
          <div style={{ padding: "0 14px 12px" }}>
            {shown.map((n: NotificationItem) => (
              <Link key={n.id} to={n.linkTo ?? "/compliance"} className="alert-item">
                <span className={`alert-sev sev-${n.severity}`} />
                <span style={{ flex: 1 }}>
                  <strong>{n.title}</strong>
                  <small>{n.detail}{n.read ? " · read" : ""}</small>
                </span>
                <Badge tone={n.severity === "URGENT" ? "danger" : n.severity === "SOON" ? "warn" : "ok"}>
                  {n.daysLeft < 0 ? `${num(Math.abs(n.daysLeft))}d overdue` : `${n.daysLeft}d`}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>
      <Card title="Compliance register" subtitle="Tap Renew to record a new document and clear the reminder" padded={false}>
        {rows.length === 0 ? <EmptyState message="No compliance documents recorded." /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Truck / document</th><th>Expiry</th><th></th></tr></thead>
              <tbody>
                {rows.map(({ vehicle, doc, days }) => (
                  <tr key={doc.id}>
                    <td>
                      <div className="cell-title mono">{vehicle.plate}</div>
                      <div className="cell-sub">{complianceLabel[doc.kind] ?? doc.kind} · {doc.number}</div>
                    </td>
                    <td><Badge tone={toneForDays(days)}>{shortDate(doc.expiry)}</Badge></td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => openRenewal(vehicle.id, doc)}>Renew</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {renewing && (
        <Modal title="Record renewal" subtitle={`${state.vehicles.find((v) => v.id === renewing.vehicleId)?.plate ?? "Vehicle"} · ${complianceLabel[renewing.doc.kind] ?? renewing.doc.kind}`} onClose={() => setRenewing(null)} footer={<><button className="btn btn-ghost" onClick={() => setRenewing(null)}>Cancel</button><button className="btn btn-brand" onClick={renew}>Save renewal</button></>}>
          <div className="form-grid">
            <Field label="New document number"><input className="input" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></Field>
            <Field label="New expiry date"><input className="input" type="date" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
