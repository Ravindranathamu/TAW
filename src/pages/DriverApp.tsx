import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Camera,
  CheckCircle2,
  LocateFixed,
  LogOut,
  MessageCircle,
  Navigation,
  Phone,
  QrCode,
  Truck,
} from "lucide-react";
import { useTaw } from "../state/TawStore";
import { AlertStrip, Badge, Card, EmptyState, PageHead, StatCard } from "../components/ui";
import { copyToClipboard, dateTime, daysUntil, money, shortDate } from "../lib/utils";
import { machineId } from "../lib/cloud";
import { startAutomaticGps, type AutomaticPoint } from "../lib/location";
import { wahaConfigured, wahaSendLocation, wahaSendText } from "../lib/waha";
import type { GpsPoint, Trip, TripStatus } from "../types";

const NEXT: Record<string, TripStatus> = {
  HEADING_TO_PICKUP: "AT_PICKUP",
  AT_PICKUP: "IN_TRANSIT",
  IN_TRANSIT: "COMPLETED",
};
const ACTIVE: TripStatus[] = ["HEADING_TO_PICKUP", "AT_PICKUP", "IN_TRANSIT"];

export function DriverPage() {
  const { tripId } = useParams();
  const { state, updateGps, saveTrip, saveVehicle, notify, leave } = useTaw();
  const [selected, setSelected] = useState(tripId ?? state.trips.find((t) => ACTIVE.includes(t.status))?.id ?? "");
  const [gpsMode, setGpsMode] = useState<"native" | "browser" | "starting">("starting");
  const [gpsError, setGpsError] = useState("");
  const trip = state.trips.find((t) => t.id === selected);
  const tripRef = useRef<Trip | undefined>(trip);
  const lastWahaSend = useRef(0);
  const device = machineId();
  const driver = state.staff.find((s) => s.id === trip?.staffId);

  useEffect(() => { if (tripId) setSelected(tripId); }, [tripId]);
  useEffect(() => { tripRef.current = trip; }, [trip]);

  const publish = useCallback((point: AutomaticPoint) => {
    const active = tripRef.current;
    if (!active || ACTIVE.includes(active.status) === false) return;
    const gps: GpsPoint = {
      tripId: active.id,
      lat: point.lat,
      lng: point.lng,
      heading: point.heading,
      speedKmh: point.speedKmh,
      updatedAt: point.at,
      status: active.status,
    };
    updateGps(gps);

    if (wahaConfigured() && active.customerPhone !== "—" && Date.now() - lastWahaSend.current > 60_000) {
      lastWahaSend.current = Date.now();
      void wahaSendLocation(active.customerPhone, {
        lat: point.lat,
        lng: point.lng,
        label: `${state.company.name} · ${active.code}`,
      }).catch(() => undefined);
    }
  }, [updateGps, state.company.name]);

  const publishRef = useRef(publish);
  useEffect(() => { publishRef.current = publish; }, [publish]);

  const isActive = Boolean(trip && ACTIVE.includes(trip.status));
  useEffect(() => {
    if (!selected || !isActive) return;
    let cancelled = false;
    setGpsMode("starting");
    setGpsError("");
    let stop: (() => Promise<void>) | undefined;
    void startAutomaticGps({
      onPoint: (point) => { if (!cancelled) publishRef.current(point); },
      onMode: (mode) => { if (!cancelled) setGpsMode(mode); },
      onError: (message) => { if (!cancelled) setGpsError(message); },
    }).then((session) => {
      if (cancelled) void session.stop();
      else stop = session.stop;
    }).catch((cause: unknown) => {
      if (!cancelled) setGpsError(cause instanceof Error ? cause.message : "Automatic GPS could not start.");
    });
    return () => {
      cancelled = true;
      if (stop) void stop();
    };
  }, [selected, isActive]);

  function advance() {
    if (!trip || !NEXT[trip.status]) return;
    const next = NEXT[trip.status];
    const changes: Partial<Trip> = {};
    if (next === "COMPLETED") {
      changes.completedAt = new Date().toISOString();
      const vehicle = state.vehicles.find((v) => v.id === trip.vehicleId);
      if (vehicle) saveVehicle({ ...vehicle, status: "AVAILABLE" });
    }
    saveTrip({ ...trip, ...changes, status: next, milestones: [...trip.milestones, { at: new Date().toISOString(), status: next, note: `Driver app · ${device}` }] });
    const trackingUrl = `${window.location.origin}/track/${trip.trackingToken}`;
    if (wahaConfigured() && trip.customerPhone !== "—") {
      void wahaSendText(trip.customerPhone, `${state.company.name} · ${trip.code}\nStatus: ${next.replace(/_/g, " ")}\nTrack: ${trackingUrl}`)
        .then(() => notify({ tone: "ok", text: `Status updated and sent via WAHA.` }))
        .catch(() => notify({ tone: "ok", text: `Status updated to ${next.replace(/_/g, " ")}.` }));
    } else {
      notify({ tone: "ok", text: `Status updated to ${next.replace(/_/g, " ")}.` });
    }
  }

  const trackingUrl = trip ? `${window.location.origin}/track/${trip.trackingToken}` : "";
  const compliance = trip ? state.vehicles.find((v) => v.id === trip.vehicleId)?.compliance ?? [] : [];
  const availableTrips = state.trips.filter((t) => ACTIVE.includes(t.status) || t.status === "COMPLETED");

  return (
    <>
      <PageHead
        title="Driver workspace"
        subtitle={`Signed in as driver · device ${device}`}
        action={<button className="btn btn-ghost btn-sm" onClick={() => void leave().then(() => notify({ tone: "info", text: "Signed out." }))}><LogOut size={13} /> Sign out</button>}
      />

      <Card title="My trips" subtitle="Open the assigned trip; live tracking starts automatically">
        <select className="select" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select a trip…</option>
          {availableTrips.map((t) => <option key={t.id} value={t.id}>{t.code} · {t.customerName} · {t.status.replace(/_/g, " ")}</option>)}
        </select>
      </Card>

      {!trip ? <Card><EmptyState message="Select an assigned trip to start the driver workspace." /></Card> : (
        <>
          <div className="driver-hero">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div><span className="badge badge-info">{trip.status.replace(/_/g, " ")}</span><h2 style={{ marginTop: 9 }}>{trip.code}</h2><p>{trip.route.from} → {trip.route.to} · {trip.route.distanceKm} km</p></div>
              <Truck size={28} opacity={0.75} />
            </div>
            <div className="status-track">
              {(["HEADING_TO_PICKUP", "AT_PICKUP", "IN_TRANSIT", "COMPLETED"] as TripStatus[]).map((s) => (
                <span key={s} className={trip.status === s || (s === "HEADING_TO_PICKUP" && ["AT_PICKUP", "IN_TRANSIT", "COMPLETED"].includes(trip.status)) || (s === "AT_PICKUP" && ["IN_TRANSIT", "COMPLETED"].includes(trip.status)) || (s === "IN_TRANSIT" && trip.status === "COMPLETED") ? "done" : ""} />
              ))}
            </div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>{trip.customerVehicle.make} {trip.customerVehicle.model} · {trip.customerVehicle.plate || "plate not recorded"} · {money(trip.price.finalQuote)}</div>
          </div>

          <div className="grid grid-2">
            <StatCard label="Driver" value={driver?.name ?? "Unassigned"} foot={driver?.phone ?? "—"} icon={<Navigation size={16} />} />
            <StatCard label="Last GPS" value={trip.gps ? dateTime(trip.gps.updatedAt) : "Acquiring…"} foot={trip.gps ? `${trip.gps.speedKmh.toFixed(0)} km/h` : "Automatic"} icon={<LocateFixed size={16} />} tone={trip.gps ? "teal" : "amber"} />
          </div>

          <Card title="Automatic live location" subtitle="No manual location updates are required">
            {isActive ? (
              <AlertStrip tone={gpsError ? "warn" : "ok"}>
                <LocateFixed size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
                {gpsMode === "native"
                  ? "Background GPS is active. Location keeps updating even with the screen off."
                  : gpsMode === "browser"
                    ? "Browser GPS is active while this page is open. For screen-off tracking, use the TAW native driver wrapper."
                    : "Starting automatic location…"}
                {gpsError && <> {gpsError}</>}
              </AlertStrip>
            ) : (
              <AlertStrip tone="info">This trip is no longer active. Automatic tracking is stopped.</AlertStrip>
            )}
            <p className="sub" style={{ marginTop: 10 }}>
              Each fix is published to the owner map and the customer link. WAHA sends the same position to the customer's WhatsApp when configured.
            </p>
          </Card>

          <Card title="Trip actions">
            <div style={{ display: "grid", gap: 8 }}>
              {NEXT[trip.status] && <button className="btn btn-brand btn-block big-btn" onClick={advance}><CheckCircle2 size={16} /> Mark {NEXT[trip.status].replace(/_/g, " ").toLowerCase()}</button>}
              <a className="btn btn-ghost btn-block" href={`tel:${trip.customerPhone.replace(/\s/g, "")}`}><Phone size={14} /> Call customer</a>
              <a className="btn btn-ghost btn-block" target="_blank" rel="noreferrer" href={`https://wa.me/${trip.customerPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`${state.company.name} · ${trip.code}\nTrack: ${trackingUrl}`)}`}><MessageCircle size={14} /> Send tracking link</a>
              <button className="btn btn-ghost btn-block" onClick={() => void copyToClipboard(trackingUrl)}><QrCode size={14} /> Copy tracking link</button>
            </div>
          </Card>

          <Card title="Vehicle checklist" subtitle="Attached carrier and valid documents">
            {compliance.length === 0 ? <EmptyState message="No compliance documents attached to this carrier." /> : compliance.map((doc) => {
              const days = daysUntil(doc.expiry);
              return <div key={doc.id} className="alert-item"><span style={{ flex: 1 }}><strong>{doc.kind.replace(/_/g, " ")}</strong><small>{doc.number} · expires {shortDate(doc.expiry)}</small></span><Badge tone={days <= 3 ? "danger" : days <= 14 ? "warn" : "ok"}>{days}d</Badge></div>;
            })}
          </Card>

          <Card title="Evidence">
            <AlertStrip tone="info"><Camera size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> Photos and scanned documents are stored in the company Drive folder when configured in Settings. No AI analysis is run on driver uploads.</AlertStrip>
            <p className="sub">{state.company.driveRootFolderId ? `Folder ID: ${state.company.driveRootFolderId}` : "Drive folder not configured yet."}</p>
            <Link className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 10 }} to="/driver-login">Driver sign-in help</Link>
          </Card>
        </>
      )}
    </>
  );
}
