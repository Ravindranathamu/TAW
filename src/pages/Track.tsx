import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import QRCode from "qrcode";
import { CheckCircle2, Clock3, MapPin, Navigation, Phone } from "lucide-react";
import { useTaw } from "../state/TawStore";
import { AlertStrip, Badge, Card, EmptyState, KeyValue } from "../components/ui";
import { dateTime, money, shortDate } from "../lib/utils";
import { getPublicTracking } from "../lib/cloud";
import type { Company, Staff, Trip, Vehicle } from "../types";

interface TrackingView {
  company: Company;
  trip: Trip;
  driver?: Staff;
  vehicle?: Vehicle;
}

export function TrackPage() {
  const { token } = useParams();
  const { state } = useTaw();
  const [remote, setRemote] = useState<TrackingView | null>(null);
  const [qr, setQr] = useState("");
  const url = typeof window === "undefined" ? "" : window.location.href;

  // Customer links are public. Cloud links poll the token-scoped RPC so live GPS
  // appears automatically; local demo links read the browser workspace.
  useEffect(() => {
    if (!token) return;
    let active = true;
    const load = () => {
      void getPublicTracking(token)
        .then((data) => { if (active && data) setRemote(data as unknown as TrackingView); })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token]);

  useEffect(() => {
    if (!url) return;
    void QRCode.toDataURL(url, { width: 220, margin: 1, color: { dark: "#075e57", light: "#ffffff" } }).then(setQr).catch(() => undefined);
  }, [url]);

  const localTrip = state.trips.find((t) => t.trackingToken === token);
  const view: TrackingView | null = remote ?? (localTrip ? {
    company: state.company,
    trip: localTrip,
    driver: state.staff.find((s) => s.id === localTrip.staffId),
    vehicle: state.vehicles.find((v) => v.id === localTrip.vehicleId),
  } : null);

  if (!view) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 16px" }}>
        <Card><EmptyState message="This tracking link is invalid or has expired." action={<Link className="btn btn-brand" to="/">TAW home</Link>} /></Card>
      </div>
    );
  }

  const { trip, company, driver, vehicle } = view;
  const done = trip.status === "COMPLETED";
  const eta = new Date(trip.createdAt).getTime() + trip.route.durationMins * 60_000;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "14px 14px 30px" }}>
      <div className="driver-hero">
        <span className="badge badge-info">{done ? "Delivered" : trip.status === "SUBCONTRACTED" ? "Partner carrier assigned" : "Live tracking"}</span>
        <h2 style={{ marginTop: 10 }}>{trip.code}</h2>
        <p>{company.name}</p>
      </div>

      {done ? (
        <AlertStrip tone="ok"><CheckCircle2 size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> Your vehicle was delivered on {shortDate(trip.completedAt)}. Thank you for choosing TAW.</AlertStrip>
      ) : (
        <AlertStrip tone="info"><Navigation size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> <strong>{trip.status.replace(/_/g, " ")}</strong> · estimated arrival {new Date(eta).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</AlertStrip>
      )}

      <Card title="Your vehicle" subtitle={`${trip.customerVehicle.make} ${trip.customerVehicle.model} ${trip.customerVehicle.year}`}>
        <KeyValue rows={[
          ["Registration", trip.customerVehicle.plate || "—"],
          ["Pickup", trip.route.from],
          ["Drop-off", trip.route.to],
          ["Distance", `${trip.route.distanceKm} km`],
          ["Quote", money(trip.price.finalQuote)],
        ]} />
      </Card>

      <Card title="Carrier & driver">
        <KeyValue rows={[
          ["Carrier", vehicle?.plate ?? "Being assigned"],
          ["Driver", driver?.name ?? "Being assigned"],
          ["Driver phone", driver?.phone ?? "—"],
          ["Last update", trip.gps ? dateTime(trip.gps.updatedAt) : "Awaiting first GPS update"],
        ]} />
        {driver?.phone && <a className="btn btn-ghost btn-block" href={`tel:${driver.phone.replace(/\s/g, "")}`}><Phone size={14} /> Call the driver</a>}
      </Card>

      <Card title="Live location" subtitle="Updates automatically every 10 seconds">
        {trip.gps ? (
          <>
            <div className="map-box" style={{ height: 230 }}>
              <iframe
                title="Live vehicle location"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${trip.gps.lng - 0.05}%2C${trip.gps.lat - 0.05}%2C${trip.gps.lng + 0.05}%2C${trip.gps.lat + 0.05}&layer=mapnik&marker=${trip.gps.lat}%2C${trip.gps.lng}`}
              />
            </div>
            <p className="sub" style={{ marginTop: 8 }}><MapPin size={12} style={{ verticalAlign: -2 }} /> {trip.gps.lat.toFixed(5)}, {trip.gps.lng.toFixed(5)} · {trip.gps.speedKmh.toFixed(0)} km/h</p>
          </>
        ) : (
          <EmptyState message="The driver has not published a location yet. This page updates automatically when they do." />
        )}
      </Card>

      <Card title="Progress" padded={false}>
        <div style={{ padding: "4px 14px 14px" }}>
          {[...trip.milestones].reverse().map((m, i) => (
            <div key={`${m.at}-${i}`} className="alert-item">
              {i === 0 ? <CheckCircle2 size={14} color="var(--brand)" style={{ marginTop: 2 }} /> : <Clock3 size={14} color="var(--ink-3)" style={{ marginTop: 2 }} />}
              <span style={{ flex: 1 }}><strong>{m.status.replace(/_/g, " ")}</strong><small>{dateTime(m.at)}{m.note ? ` · ${m.note}` : ""}</small></span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Tracking code">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {qr && <img src={qr} alt="Tracking QR code" width={92} height={92} style={{ borderRadius: 8 }} />}
          <div><div className="mono" style={{ fontSize: 11, wordBreak: "break-all" }}>{trip.trackingToken}</div><p className="sub">Scan or share this code to reopen live tracking. This page refreshes its position automatically.</p></div>
        </div>
      </Card>

      <p style={{ fontSize: 10, color: "var(--ink-3)", textAlign: "center" }}><Badge tone={done ? "ok" : "info"} plain>TAW · RAVBsoft</Badge> · Powered by TAW Vehicle Carrier Management</p>
    </div>
  );
}
