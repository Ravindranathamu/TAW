import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  MapPin,
  MessageCircle,
  Navigation,
  Search,
  Send,
} from "lucide-react";
import { useTaw } from "../state/TawStore";
import { AlertStrip, Badge, Card, EmptyState, Field, KeyValue, Modal, PageHead, StatCard, Tabs } from "../components/ui";
import { copyToClipboard, dateTime, money, shortDate } from "../lib/utils";
import { downloadInvoice, whatsappLink } from "../lib/invoice";
import type { Trip, TripStatus } from "../types";

const FILTERS: Array<{ key: "ALL" | TripStatus; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "HEADING_TO_PICKUP", label: "Dispatched" },
  { key: "IN_TRANSIT", label: "In transit" },
  { key: "COMPLETED", label: "Completed" },
  { key: "ENQUIRY", label: "Enquiries" },
];

const toneForTrip = (status: TripStatus): "ok" | "info" | "warn" | "danger" | "neutral" =>
  status === "COMPLETED" ? "ok" : status === "CANCELLED" ? "danger" : status === "ENQUIRY" ? "neutral" : status === "SUBCONTRACTED" ? "warn" : "info";

export function TripsPage() {
  const { state } = useTaw();
  const [filter, setFilter] = useState<"ALL" | TripStatus>("ALL");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => state.trips
    .filter((t) => filter === "ALL" || t.status === filter)
    .filter((t) => `${t.code} ${t.customerName} ${t.customerVehicle.make} ${t.customerVehicle.model} ${t.route.from} ${t.route.to}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state.trips, filter, query]);
  const revenue = state.trips.filter((t) => t.status === "COMPLETED").reduce((s, t) => s + t.price.finalQuote, 0);
  const pending = state.trips.filter((t) => ["HEADING_TO_PICKUP", "AT_PICKUP", "IN_TRANSIT"].includes(t.status)).length;

  return (
    <>
      <PageHead title="Trip history" subtitle="Every enquiry, dispatch, delivery and tracking link" />
      <div className="grid grid-2">
        <StatCard label="All-time revenue" value={money(revenue)} foot={`${state.trips.filter((t) => t.status === "COMPLETED").length} completed trips`} />
        <StatCard label="Pending jobs" value={pending} foot="Live or awaiting pickup" icon={<Navigation size={16} />} tone="blue" />
      </div>
      <div className="toolbar" style={{ marginTop: 14 }}>
        <div className="search-wrap"><Search /><input className="input" placeholder="Search trip code, customer, vehicle…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      </div>
      <Tabs tabs={FILTERS.map((f) => ({ ...f, count: f.key === "ALL" ? state.trips.length : state.trips.filter((t) => t.status === f.key).length }))} active={filter} onChange={setFilter} />
      {filtered.length === 0 ? <Card><EmptyState message="No trips match this filter." /></Card> : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((trip) => (
            <Link key={trip.id} to={`/trips/${trip.id}`} className="card" style={{ margin: 0, padding: 14, display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div className="mono" style={{ fontWeight: 700 }}>{trip.code}</div>
                  <div className="cell-sub">{shortDate(trip.createdAt)} · {trip.customerName}</div>
                </div>
                <Badge tone={toneForTrip(trip.status)}>{trip.status.replace(/_/g, " ")}</Badge>
              </div>
              <div style={{ marginTop: 10, fontSize: 12.5 }}>{trip.customerVehicle.make} {trip.customerVehicle.model}</div>
              <div className="cell-sub" style={{ marginTop: 3 }}><MapPin size={11} style={{ verticalAlign: -1 }} /> {trip.route.from} → {trip.route.to} · {trip.route.distanceKm} km</div>
              <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ color: "var(--brand)" }}>{money(trip.price.finalQuote)}</strong>
                <Badge tone={trip.paymentStatus === "UNPAID" ? "warn" : "ok"}>{trip.paymentStatus.replace(/_/g, " ")}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export function TripDetailPage() {
  const { id } = useParams();
  const { state, saveTrip, saveVehicle, issueInvoice, notify } = useTaw();
  const trip = state.trips.find((t) => t.id === id);
  const [endKm, setEndKm] = useState(trip?.startKm?.toString() ?? "");
  const [tin, setTin] = useState("");
  const [payment, setPayment] = useState<Trip["paymentStatus"]>(trip?.paymentStatus ?? "UNPAID");
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [note, setNote] = useState(trip?.note ?? "");

  if (!trip) return <Card><EmptyState message="Trip not found." action={<Link className="btn btn-ghost" to="/trips">Back to trips</Link>} /></Card>;

  const vehicle = state.vehicles.find((v) => v.id === trip.vehicleId);
  const driver = state.staff.find((s) => s.id === trip.staffId);
  const helpers = state.staff.filter((s) => trip.helperIds.includes(s.id));
  const invoices = state.invoices.filter((i) => i.tripId === trip.id);
  const trackingUrl = `${window.location.origin}/track/${trip.trackingToken}`;

  function updateStatus(status: TripStatus, extra: Partial<Trip> = {}) {
    const next: Trip = {
      ...trip!,
      status,
      ...extra,
      milestones: [...trip!.milestones, { at: new Date().toISOString(), status, note: status.replace(/_/g, " ").toLowerCase() }],
    };
    saveTrip(next);
    notify({ tone: "ok", text: `Trip moved to ${status.replace(/_/g, " ")}.` });
  }

  function complete() {
    if (vehicle && endKm) saveVehicle({ ...vehicle, odometerKm: Math.max(vehicle.odometerKm, Number(endKm)), status: "AVAILABLE" });
    updateStatus("COMPLETED", { endKm: Number(endKm) || undefined, completedAt: new Date().toISOString(), paymentStatus: payment });
  }

  function issue(kind: "RECEIPT" | "TAX_INVOICE") {
    const invoice = issueInvoice(trip!.id, kind, tin, state.invoices.length + 1);
    if (invoice) {
      downloadInvoice(state.company, invoice);
      notify({ tone: "ok", text: `${invoice.serial} downloaded.` });
    }
    setInvoiceOpen(false);
  }

  return (
    <>
      <PageHead title={trip.code} subtitle={`${trip.customerVehicle.make} ${trip.customerVehicle.model} · ${shortDate(trip.createdAt)}`} action={<Link className="btn btn-ghost btn-sm" to="/trips"><ArrowLeft size={13} /> Trips</Link>} />
      <AlertStrip tone={trip.status === "COMPLETED" ? "ok" : "info"}>
        <strong>{trip.status.replace(/_/g, " ")}</strong> · {trip.route.from} → {trip.route.to} · {trip.route.distanceKm} km · {money(trip.price.finalQuote)}
      </AlertStrip>

      <Card title="Customer & load">
        <KeyValue rows={[
          ["Customer", trip.customerName],
          ["Phone", trip.customerPhone],
          ["Vehicle", `${trip.customerVehicle.make} ${trip.customerVehicle.model} ${trip.customerVehicle.year}`],
          ["Plate / dimensions", `${trip.customerVehicle.plate || "—"} · ${trip.customerVehicle.lengthMm.toLocaleString()} mm · ${trip.customerVehicle.weightKg.toLocaleString()} kg`],
          ["Route", `${trip.route.from} → ${trip.route.to}`],
          ["Highway", trip.route.useHighway ? `Yes · ${money(trip.route.highwayToll)} toll${trip.route.returnToll ? " incl. return" : ""}` : "No"],
          ["Distance / ETA", `${trip.route.distanceKm} km · ~${trip.route.durationMins} min`],
        ]} />
      </Card>

      <Card title="Assignment & costs">
        <KeyValue rows={[
          ["Carrier", vehicle?.plate ?? "Not assigned"],
          ["Support truck", state.vehicles.find((v) => v.id === trip.supportVehicleId)?.plate ?? "—"],
          ["Driver", driver?.name ?? "Not assigned"],
          ["Helpers", helpers.map((h) => h.name).join(", ") || "—"],
          ["Start odometer", `${(trip.startKm ?? 0).toLocaleString()} km`],
          ["End odometer", trip.endKm ? `${trip.endKm.toLocaleString()} km` : "—"],
          ["Fuel used", trip.endKm && trip.startKm && vehicle?.efficiencyKmpl
            ? `${((trip.endKm - trip.startKm) / vehicle.efficiencyKmpl).toFixed(1)} L using recorded km/L`
            : trip.endKm && trip.startKm
              ? "Awaiting recorded runs + fuel logs"
              : "—"],
          ["Quote", money(trip.price.finalQuote)],
          ["Payment", trip.paymentStatus.replace(/_/g, " ")],
        ]} />
      </Card>

      <Card title="Progress timeline" subtitle={trip.gps ? `Last GPS ${dateTime(trip.gps.updatedAt)} · ${trip.gps.speedKmh} km/h` : "No GPS fix yet"} padded={false}>
        <div style={{ padding: "4px 14px 14px" }}>
          {[...trip.milestones].reverse().map((m, i) => (
            <div key={`${m.at}-${i}`} className="alert-item">
              <span className={`alert-sev sev-${i === 0 ? "OK" : "SOON"}`} />
              <span style={{ flex: 1 }}><strong>{m.status.replace(/_/g, " ")}</strong><small>{dateTime(m.at)}{m.note ? ` · ${m.note}` : ""}{m.lat ? ` · ${m.lat.toFixed(5)}, ${m.lng?.toFixed(5)}` : ""}</small></span>
            </div>
          ))}
        </div>
      </Card>

      {trip.status !== "COMPLETED" && trip.status !== "CANCELLED" && (
        <Card title="Update trip">
          <div className="form-grid">
            <Field label="Next status">
              <select className="select" value={trip.status} onChange={(e) => updateStatus(e.target.value as TripStatus)}>
                {(["HEADING_TO_PICKUP", "AT_PICKUP", "IN_TRANSIT", "COMPLETED"] as TripStatus[]).map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </Field>
            <Field label="End odometer (km)"><input className="input" type="number" value={endKm} onChange={(e) => setEndKm(e.target.value)} /></Field>
            <Field label="Payment status">
              <select className="select" value={payment} onChange={(e) => setPayment(e.target.value as Trip["paymentStatus"])}>
                <option value="UNPAID">Unpaid</option><option value="PENDING_CORPORATE">Pending corporate</option><option value="PAID_CASH">Paid cash</option><option value="PAID_BANK">Paid bank</option>
              </select>
            </Field>
            <Field label="Job note" full><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <button className="btn btn-ghost btn-block" onClick={() => { saveTrip({ ...trip, note }); notify({ tone: "ok", text: "Note saved." }); }}>Save note</button>
            <button className="btn btn-brand btn-block big-btn" disabled={!endKm} onClick={complete}><CheckCircle2 size={16} /> Complete trip &amp; release truck</button>
          </div>
        </Card>
      )}

      <Card title="Customer tracking" subtitle="Send this link to the customer or driver">
        <div className="key-box"><span>{trackingUrl}</span><button onClick={() => void copyToClipboard(trackingUrl)}><Copy size={11} /> Copy</button></div>
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <a className="btn btn-ghost btn-block" target="_blank" rel="noreferrer" href={whatsappLink(trip.customerPhone, `${state.company.name} · ${trip.code}\nTrack your vehicle: ${trackingUrl}`)}><MessageCircle size={14} /> Send tracking link on WhatsApp</a>
          <Link className="btn btn-ghost btn-block" to={`/driver/${trip.id}`}><Send size={14} /> Open driver mobile view</Link>
        </div>
      </Card>

      <Card title="Invoices" subtitle="IRD-compliant serials with VAT where applicable" action={<button className="btn btn-ghost btn-sm" onClick={() => setInvoiceOpen(true)}><FileText size={13} /> Issue</button>} padded={false}>
        {invoices.length === 0 ? <EmptyState message="No invoice issued for this trip." /> : invoices.map((inv) => (
          <div key={inv.id} style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div><div className="mono cell-title">{inv.serial}</div><div className="cell-sub">{inv.kind.replace("_", " ")} · {shortDate(inv.date)} · {inv.copyType}</div></div>
              <strong>{money(inv.total)}</strong>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => downloadInvoice(state.company, inv)}><Download size={13} /> Download PDF</button>
          </div>
        ))}
      </Card>

      {invoiceOpen && (
        <Modal title="Issue invoice" subtitle={`${trip.code} · ${trip.customerName}`} onClose={() => setInvoiceOpen(false)} footer={<><button className="btn btn-ghost" onClick={() => setInvoiceOpen(false)}>Cancel</button><button className="btn btn-brand" onClick={() => issue("TAX_INVOICE")}><FileText size={14} /> Tax invoice</button></>}>
          <div className="form-grid">
            <Field label="Customer TIN" full hint="Required for VAT-registered corporate customers.">
              <input className="input" inputMode="numeric" maxLength={9} value={tin} onChange={(e) => setTin(e.target.value.replace(/\D/g, ""))} placeholder="9-digit TIN" />
            </Field>
          </div>
          <p className="sub" style={{ marginTop: 10 }}>Service amount is VAT-applicable; expressway tolls are pass-through and excluded from VAT.</p>
          <button className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 12 }} onClick={() => issue("RECEIPT")}>Issue receipt (no VAT)</button>
        </Modal>
      )}
    </>
  );
}
