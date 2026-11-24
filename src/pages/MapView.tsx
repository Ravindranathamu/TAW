import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { LocateFixed, MapPinned } from "lucide-react";
import { useTaw } from "../state/TawStore";
import { AlertStrip, Badge, EmptyState, PageHead, StatCard } from "../components/ui";
import { dateTime } from "../lib/utils";

const PLACES: Record<string, [number, number]> = {
  colombo: [6.9271, 79.8612],
  kandy: [7.2906, 80.6337],
  galle: [6.0329, 80.2168],
  kurunegala: [7.4865, 80.3674],
  nuwara: [6.9687, 80.7704],
  matara: [5.9487, 80.5357],
  katunayake: [7.1766, 79.8841],
};

const coordsFor = (name: string): [number, number] | null => {
  const key = Object.keys(PLACES).find((k) => name.toLowerCase().includes(k));
  return key ? PLACES[key] : null;
};

export function MapPage() {
  const { state, mode, refresh } = useTaw();
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [focus, setFocus] = useState<string>("ALL");
  const live = state.trips.filter((t) => t.gps);
  const active = state.trips.filter((t) => ["HEADING_TO_PICKUP", "AT_PICKUP", "IN_TRANSIT"].includes(t.status));

  useEffect(() => {
    if (mode !== "cloud") return;
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [mode, refresh]);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = L.map(container.current, { zoomControl: false }).setView([7.4, 80.5], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.eachLayer((layer) => { if (layer instanceof L.Marker) map.removeLayer(layer); });
    const shown = focus === "ALL" ? active : active.filter((t) => t.id === focus);
    const points: Array<{ label: string; coords: [number, number]; live: boolean }> = [];
    for (const trip of shown) {
      if (trip.gps) points.push({ label: `${trip.code} · ${state.vehicles.find((v) => v.id === trip.vehicleId)?.plate ?? "Carrier"}`, coords: [trip.gps.lat, trip.gps.lng], live: true });
      else {
        const from = trip.route.fromPoint
          ? [trip.route.fromPoint.lat, trip.route.fromPoint.lng] as [number, number]
          : coordsFor(trip.route.from);
        const to = trip.route.toPoint
          ? [trip.route.toPoint.lat, trip.route.toPoint.lng] as [number, number]
          : coordsFor(trip.route.to);
        if (from) points.push({ label: `${trip.code} · ${trip.route.from}`, coords: from, live: false });
        if (to) points.push({ label: `${trip.code} · ${trip.route.to}`, coords: to, live: false });
      }
    }
    for (const point of points) {
      L.marker(point.coords).addTo(map).bindPopup(`<div class="pin-label">${point.label}${point.live ? " · LIVE" : ""}</div>`);
    }
    if (points.length > 0) map.fitBounds(L.latLngBounds(points.map((p) => p.coords)), { padding: [30, 30], maxZoom: 10 });
  }, [active, focus, state.vehicles]);

  return (
    <>
      <PageHead title="Live fleet map" subtitle="Driver GPS updates automatically; pinned pickup and drop points are shown too" />
      <div className="grid grid-2">
        <StatCard label="Live GPS fixes" value={live.length} foot="Devices publishing location" icon={<LocateFixed size={16} />} tone={live.length ? "teal" : "blue"} />
        <StatCard label="Active trips" value={active.length} foot="On the road or heading to pickup" icon={<MapPinned size={16} />} tone="blue" />
      </div>
      <div className="toolbar" style={{ marginTop: 14 }}>
        <select className="select" value={focus} onChange={(e) => setFocus(e.target.value)}>
          <option value="ALL">All active trips</option>
          {active.map((t) => <option key={t.id} value={t.id}>{t.code} · {t.customerName}</option>)}
        </select>
      </div>
      <div className="map-box" ref={container} />
      <div className="map-sheet">
        {active.length === 0 ? <EmptyState message="No active trips to show." /> : active.map((trip) => (
          <div key={trip.id} className="alert-item">
            <span className={`alert-sev sev-${trip.gps ? "OK" : "SOON"}`} />
            <span style={{ flex: 1 }}>
              <strong>{trip.code} · {trip.customerName}</strong>
              <small>{trip.route.from} → {trip.route.to} · {state.vehicles.find((v) => v.id === trip.vehicleId)?.plate ?? "unassigned"}{trip.gps ? ` · ${trip.gps.speedKmh} km/h · ${dateTime(trip.gps.updatedAt)}` : " · awaiting GPS"}</small>
            </span>
            <Badge tone={trip.gps ? "ok" : "warn"}>{trip.gps ? "Live" : "Planned"}</Badge>
          </div>
        ))}
      </div>
      {live.length === 0 && <AlertStrip tone="info">Automatic driver GPS will place a live marker here. In a browser it works while the driver page is open; the native TAW wrapper keeps it updating with the screen off.</AlertStrip>}
    </>
  );
}
