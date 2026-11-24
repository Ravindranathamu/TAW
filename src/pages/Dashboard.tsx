import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Navigation,
  Truck,
  Wrench,
} from "lucide-react";
import { useTaw } from "../state/TawStore";
import { AlertStrip, Badge, Card, EmptyState, PageHead, StatCard } from "../components/ui";
import { daysUntil, money, shortDate } from "../lib/utils";

export function DashboardPage() {
  const { state, role } = useTaw();
  const available = state.vehicles.filter((v) => v.status === "AVAILABLE").length;
  const onTrip = state.vehicles.filter((v) => v.status === "ON_TRIP").length;
  const inWorkshop = state.vehicles.filter((v) => v.status === "IN_WORKSHOP").length;
  const activeTrips = state.trips.filter((t) => ["HEADING_TO_PICKUP", "AT_PICKUP", "IN_TRANSIT"].includes(t.status));
  const urgent = state.notifications.filter((n) => n.severity === "URGENT");
  const soon = state.notifications.filter((n) => n.severity === "SOON");
  const month = new Date().toISOString().slice(0, 7);
  const monthlyTrips = state.trips.filter((t) => t.createdAt?.startsWith(month) && t.status === "COMPLETED");
  const revenue = monthlyTrips.reduce((sum, t) => sum + t.price.finalQuote, 0);
  const outstanding = state.invoices.filter((i) => i.paymentStatus !== "PAID_BANK" && i.paymentStatus !== "PAID_CASH").reduce((s, i) => s + i.total, 0);

  return (
    <>
      <PageHead
        title={role === "owner" ? "Fleet overview" : "Welcome to TAW"}
        subtitle={`${state.company.name} · ${shortDate(new Date().toISOString())}`}
        action={<Link className="btn btn-brand btn-sm" to="/dispatch"><Navigation size={14} /> New order</Link>}
      />

      {urgent.length > 0 && (
        <AlertStrip tone="danger">
          <strong>{urgent.length} urgent item{urgent.length === 1 ? "" : "s"}.</strong>{" "}
          {urgent.slice(0, 2).map((n) => n.title).join(" · ")}{urgent.length > 2 ? "…" : ""}.{" "}
          <Link to="/compliance" style={{ textDecoration: "underline", fontWeight: 700 }}>Review</Link>
        </AlertStrip>
      )}

      <div className="grid grid-2">
        <StatCard label="Available carriers" value={`${available}/${state.vehicles.length}`} foot={`${onTrip} on trip · ${inWorkshop} in workshop`} icon={<Truck size={16} />} tone="teal" />
        <StatCard label="Live trips" value={activeTrips.length} foot="Currently dispatched" icon={<Navigation size={16} />} tone="blue" />
        <StatCard label="This month's revenue" value={money(revenue)} foot={`${monthlyTrips.length} completed trips`} icon={<Banknote size={16} />} tone="teal" />
        <StatCard label="Outstanding" value={money(outstanding)} foot="Unpaid / pending invoices" icon={<CalendarClock size={16} />} tone={outstanding > 0 ? "amber" : "teal"} />
      </div>

      <Card title="Active fleet board" subtitle="Live status of every carrier truck" action={<Link className="btn btn-ghost btn-sm" to="/fleet">All <ArrowRight size={12} /></Link>} padded={false}>
        {state.vehicles.length === 0 ? (
          <EmptyState message="Add your first carrier truck to get started." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Truck</th><th>Status</th><th>Driver</th><th>KM</th></tr>
              </thead>
              <tbody>
                {state.vehicles.map((v) => {
                  const trip = activeTrips.find((t) => t.vehicleId === v.id);
                  const driver = state.staff.find((s) => s.id === trip?.staffId);
                  return (
                    <tr key={v.id}>
                      <td><div className="cell-title mono">{v.plate}</div><div className="cell-sub">{v.make} {v.model}</div></td>
                      <td>
                        <Badge tone={v.status === "AVAILABLE" ? "ok" : v.status === "IN_WORKSHOP" ? "danger" : v.status === "ON_TRIP" ? "info" : "neutral"}>
                          {v.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="cell-sub">{driver?.name ?? "—"}</td>
                      <td className="mono">{v.odometerKm.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Renewals &amp; reminders" subtitle={`${urgent.length} urgent · ${soon.length} coming up`} action={<Link className="btn btn-ghost btn-sm" to="/compliance">Open <ArrowRight size={12} /></Link>} padded={false}>
        {state.notifications.length === 0 ? (
          <EmptyState message="No upcoming renewals or service dates." />
        ) : (
          <div style={{ padding: "0 14px 12px" }}>
            {state.notifications.slice(0, 6).map((n) => (
              <Link key={n.id} to={n.linkTo ?? "/compliance"} className="alert-item">
                <span className={`alert-sev sev-${n.severity}`} />
                <span style={{ flex: 1 }}>
                  <strong>{n.title}</strong>
                  <small>{n.detail}</small>
                </span>
                <span className={`alert-days ${n.severity === "URGENT" ? "badge badge-danger" : "badge badge-warn"}`}>
                  {n.daysLeft < 0 ? `${Math.abs(n.daysLeft)}d overdue` : `${n.daysLeft}d`}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-2">
        <Card title="Recent trips" padded={false} action={<Link to="/trips" className="btn btn-ghost btn-sm">All</Link>}>
          {state.trips.slice(0, 4).map((trip) => (
            <Link key={trip.id} to={`/trips/${trip.id}`} style={{ display: "block", padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: 12 }}>{trip.customerName}</strong>
                <Badge tone={trip.status === "COMPLETED" ? "ok" : "info"}>{trip.status.replace("_", " ")}</Badge>
              </div>
              <div className="cell-sub">{trip.route.from} → {trip.route.to} · {money(trip.price.finalQuote)}</div>
            </Link>
          ))}
        </Card>
        <Card title="Quick actions">
          <div style={{ display: "grid", gap: 8 }}>
            <Link className="btn btn-ghost btn-block" to="/maintenance"><Wrench size={14} /> Log a repair or service</Link>
            <Link className="btn btn-ghost btn-block" to="/fuel"><CheckCircle2 size={14} /> Record a fuel refill</Link>
            <Link className="btn btn-ghost btn-block" to="/invoices"><ClipboardList size={14} /> Issue an invoice</Link>
            <Link className="btn btn-ghost btn-block" to="/map"><AlertTriangle size={14} /> Open live fleet map</Link>
          </div>
        </Card>
      </div>
      <p style={{ fontSize: 10, color: "var(--ink-3)", textAlign: "center", marginTop: 18 }}>
        Next compliance due in {state.notifications[0] ? `${daysUntil(state.notifications[0].dueDate)} days` : "—"}
      </p>
    </>
  );
}
