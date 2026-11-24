import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Plus, Search, UserRound, Users } from "lucide-react";
import { useTaw } from "../state/TawStore";
import { Avatar, Badge, Card, EmptyState, Field, KeyValue, Modal, PageHead, StatCard } from "../components/ui";
import { daysUntil, money, shortDate, toneForDays, uid } from "../lib/utils";
import type { Staff as StaffMember, StaffRole } from "../types";

const ROLE_LABEL: Record<StaffRole, string> = {
  PERMANENT_DRIVER: "Permanent driver",
  TEMP_DRIVER: "Temporary driver",
  HELPER: "Helper / support crew",
};

const emptyMember = (): StaffMember => ({
  id: uid(),
  name: "",
  role: "PERMANENT_DRIVER",
  nic: "",
  phone: "",
  emergencyContact: "",
  address: "",
  licenseNumber: "",
  licenseClasses: ["CE", "B"],
  licenseExpiry: "",
  licenseHeldByPolice: false,
  monthlySalary: 65000,
  perTripWage: 4500,
  battaPerTrip: 2000,
  epfEligible: true,
  active: true,
});

export function StaffPage() {
  const { state, saveStaff } = useTaw();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | StaffRole>("ALL");
  const [editing, setEditing] = useState<StaffMember | null>(null);

  const filtered = state.staff.filter((s) => {
    if (filter !== "ALL" && s.role !== filter) return false;
    return `${s.name} ${s.nic} ${s.phone}`.toLowerCase().includes(query.trim().toLowerCase());
  });
  const expired = state.staff.filter((s) => s.active && daysUntil(s.licenseExpiry) <= 0).length;
  const helpers = state.staff.filter((s) => s.role === "HELPER" && s.active).length;

  return (
    <>
      <PageHead
        title="Drivers & crew"
        subtitle="Licences, temporary permits, helpers and payroll rates"
        action={<button className="btn btn-brand btn-sm" onClick={() => setEditing(emptyMember())}><Plus size={14} /> Add person</button>}
      />

      <div className="grid grid-3">
        <StatCard label="Active crew" value={state.staff.filter((s) => s.active).length} foot="Across all roles" icon={<Users size={16} />} tone="teal" />
        <StatCard label="Expired licences" value={expired} foot="Dispatch is blocked" icon={<BadgeCheck size={16} />} tone={expired ? "red" : "teal"} />
        <StatCard label="Helpers" value={helpers} foot="Support crew" icon={<UserRound size={16} />} tone="blue" />
      </div>

      <div className="toolbar" style={{ marginTop: 14 }}>
        <div className="search-wrap"><Search /><input className="input" placeholder="Search name, NIC or phone…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <select className="select" style={{ width: 170 }} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="ALL">All roles</option>
          {(Object.keys(ROLE_LABEL) as StaffRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? <Card><EmptyState message="No crew members match this filter." /></Card> : (
        <div style={{ display: "grid", gap: 11 }}>
          {filtered.map((s) => {
            const days = daysUntil(s.licenseExpiry);
            return (
              <button key={s.id} className="card" style={{ margin: 0, textAlign: "left", padding: 14 }} onClick={() => setEditing({ ...s })}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <Avatar name={s.name} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</div>
                    <div className="cell-sub">{ROLE_LABEL[s.role]} · {s.phone}</div>
                  </div>
                  <Badge tone={s.active ? toneForDays(days) : "neutral"}>
                    {s.active ? (s.licenseHeldByPolice ? "Permit" : `${days}d`) : "Inactive"}
                  </Badge>
                </div>
                <div className="match-specs" style={{ marginTop: 11 }}>
                  <span>Licence {s.licenseNumber || "—"}</span>
                  <span>Classes {s.licenseClasses.join(", ")}</span>
                  <span>Expiry {shortDate(s.licenseExpiry)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {editing && (
        <Modal
          title={state.staff.some((s) => s.id === editing.id) ? "Edit crew member" : "Add crew member"}
          subtitle={editing.name || "New team member"}
          onClose={() => setEditing(null)}
          footer={<>
            <button className="btn btn-danger btn-sm" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-brand" disabled={!editing.name} onClick={() => { saveStaff(editing); setEditing(null); }}>Save member</button>
          </>}
        >
          <div className="form-grid">
            <Field label="Full name"><input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Role">
              <select className="select" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value as StaffRole })}>
                {(Object.keys(ROLE_LABEL) as StaffRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </Field>
            <Field label="NIC / ID"><input className="input" value={editing.nic} onChange={(e) => setEditing({ ...editing, nic: e.target.value })} /></Field>
            <Field label="Phone"><input className="input" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
            <Field label="Emergency contact"><input className="input" value={editing.emergencyContact} onChange={(e) => setEditing({ ...editing, emergencyContact: e.target.value })} /></Field>
            <Field label="Address"><input className="input" value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></Field>
            <Field label="Licence number"><input className="input" value={editing.licenseNumber} onChange={(e) => setEditing({ ...editing, licenseNumber: e.target.value })} /></Field>
            <Field label="Licence expiry"><input className="input" type="date" value={editing.licenseExpiry} onChange={(e) => setEditing({ ...editing, licenseExpiry: e.target.value })} /></Field>
            <Field label="Classes (comma separated)" full><input className="input" value={editing.licenseClasses.join(", ")} onChange={(e) => setEditing({ ...editing, licenseClasses: e.target.value.split(",").map((c) => c.trim()).filter(Boolean) })} /></Field>
            <Field label="Licence held by police">
              <select className="select" value={editing.licenseHeldByPolice ? "yes" : "no"} onChange={(e) => setEditing({ ...editing, licenseHeldByPolice: e.target.value === "yes" })}>
                <option value="no">No</option><option value="yes">Yes</option>
              </select>
            </Field>
            {editing.licenseHeldByPolice && <Field label="Temporary permit until"><input className="input" type="date" value={editing.temporaryPermitUntil ?? ""} onChange={(e) => setEditing({ ...editing, temporaryPermitUntil: e.target.value })} /></Field>}
            <Field label="Monthly salary"><input className="input" type="number" value={editing.monthlySalary ?? 0} onChange={(e) => setEditing({ ...editing, monthlySalary: Number(e.target.value) })} /></Field>
            <Field label="Per-trip wage"><input className="input" type="number" value={editing.perTripWage ?? 0} onChange={(e) => setEditing({ ...editing, perTripWage: Number(e.target.value) })} /></Field>
            <Field label="Batta per trip"><input className="input" type="number" value={editing.battaPerTrip ?? 0} onChange={(e) => setEditing({ ...editing, battaPerTrip: Number(e.target.value) })} /></Field>
            <Field label="Active">
              <select className="select" value={editing.active ? "yes" : "no"} onChange={(e) => setEditing({ ...editing, active: e.target.value === "yes" })}>
                <option value="yes">Yes</option><option value="no">No</option>
              </select>
            </Field>
            <div className="full" style={{ fontSize: 11, color: "var(--ink-3)" }}>Monthly base {money(editing.monthlySalary ?? 0)} · batta {money(editing.battaPerTrip ?? 0)}/trip</div>
          </div>
          <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 12 }} onClick={() => { navigate("/violations"); setEditing(null); }}>
            View traffic fines &amp; court cases
          </button>
        </Modal>
      )}
    </>
  );
}

export function StaffDetailPage() {
  const { id } = useParams();
  const { state } = useTaw();
  const member = state.staff.find((s) => s.id === id);
  if (!member) return <Card><EmptyState message="Crew member not found." action={<Link className="btn btn-ghost" to="/staff">Back to crew</Link>} /></Card>;
  const cases = state.courtCases.filter((c) => c.staffId === member.id);
  const payroll = state.payroll.filter((p) => p.staffId === member.id);
  const days = daysUntil(member.licenseExpiry);
  return (
    <>
      <PageHead title={member.name} subtitle={ROLE_LABEL[member.role]} action={<Link className="btn btn-ghost btn-sm" to="/staff"><ArrowLeft size={13} /> Crew</Link>} />
      <Card title="Profile">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <Avatar name={member.name} />
          <div><strong>{member.name}</strong><div className="cell-sub">{member.nic || "NIC not recorded"} · {member.phone}</div></div>
        </div>
        <KeyValue rows={[
          ["Emergency contact", member.emergencyContact || "—"],
          ["Address", member.address || "—"],
          ["Licence", member.licenseNumber || "—"],
          ["Classes", member.licenseClasses.join(", ") || "—"],
          ["Licence expiry", <span key="e"><Badge tone={toneForDays(days)}>{shortDate(member.licenseExpiry)}</Badge></span>],
          ["Police hold", member.licenseHeldByPolice ? `Yes · permit ${shortDate(member.temporaryPermitUntil)}` : "No"],
          ["Status", member.active ? "Active" : "Inactive"],
        ]} />
      </Card>
      <Card title="Pay rates" subtitle="Used by payroll and per-trip wage calculation">
        <KeyValue rows={[
          ["Monthly base", money(member.monthlySalary ?? 0)],
          ["Per-trip wage", money(member.perTripWage ?? 0)],
          ["Batta per trip", money(member.battaPerTrip ?? 0)],
          ["EPF eligible", member.epfEligible ? "Yes" : "No"],
        ]} />
      </Card>
      <Card title="Court cases" padded={false}>
        {cases.length === 0 ? <EmptyState message="No court cases recorded." /> : cases.map((c) => (
          <div key={c.id} className="alert-item" style={{ padding: "11px 14px" }}>
            <span style={{ flex: 1 }}><strong>{c.caseNumber}</strong><small>{c.court} · {shortDate(c.date)} · {c.description}</small></span>
            <Badge tone={c.status === "PENDING" ? "warn" : "ok"}>{c.status}</Badge>
          </div>
        ))}
      </Card>
      <Card title="Payroll history" padded={false}>
        {payroll.length === 0 ? <EmptyState message="No payroll entries yet." /> : payroll.map((p) => (
          <div key={p.id} className="alert-item" style={{ padding: "11px 14px" }}>
            <span style={{ flex: 1 }}><strong>{p.month}</strong><small>Base {money(p.base)} · batta {money(p.batta)} · deductions {money(p.deductions)}</small></span>
            <strong>{money(p.net)}</strong>
            <Badge tone={p.paid ? "ok" : "warn"}>{p.paid ? "Paid" : "Due"}</Badge>
          </div>
        ))}
      </Card>
    </>
  );
}
