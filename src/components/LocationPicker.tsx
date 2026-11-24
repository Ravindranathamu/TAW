import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { LocateFixed, MapPin, Search } from "lucide-react";
import type { MapPoint } from "../types";

const KNOWN_PLACES: MapPoint[] = [
  { label: "Colombo, Sri Lanka", lat: 6.9271, lng: 79.8612 },
  { label: "Kandy, Sri Lanka", lat: 7.2906, lng: 80.6337 },
  { label: "Galle, Sri Lanka", lat: 6.0329, lng: 80.2168 },
  { label: "Kurunegala, Sri Lanka", lat: 7.4865, lng: 80.3674 },
  { label: "Nuwara Eliya, Sri Lanka", lat: 6.9687, lng: 80.7704 },
  { label: "Matara, Sri Lanka", lat: 5.9487, lng: 80.5357 },
  { label: "Katunayake, Sri Lanka", lat: 7.1766, lng: 79.8841 },
  { label: "Negombo, Sri Lanka", lat: 7.2083, lng: 79.8379 },
];

interface SearchResult {
  label: string;
  lat: number;
  lng: number;
}

export function LocationPicker({
  label,
  value,
  onChange,
  placeholder = "Search a town, address or landmark",
}: {
  label: string;
  value?: MapPoint;
  onChange: (point: MapPoint) => void;
  placeholder?: string;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = L.map(container.current, { zoomControl: false }).setView(value ? [value.lat, value.lng] : [7.4, 80.5], value ? 12 : 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.on("click", (event: L.LeafletMouseEvent) => {
      const point: MapPoint = {
        label: `Pinned ${event.latlng.lat.toFixed(5)}, ${event.latlng.lng.toFixed(5)}`,
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      };
      onChange(point);
      setQuery(point.label);
      setResults([]);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is created once; marker updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) map.removeLayer(markerRef.current);
    markerRef.current = null;
    if (!value) return;
    markerRef.current = L.marker([value.lat, value.lng]).addTo(map).bindPopup(value.label);
    map.flyTo([value.lat, value.lng], Math.max(map.getZoom(), 12), { duration: 0.4 });
  }, [value?.lat, value?.lng, value?.label]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const needle = query.trim().toLowerCase();
    const local = KNOWN_PLACES.filter((place) => place.label.toLowerCase().includes(needle))
      .slice(0, 4)
      .map((place) => ({ label: place.label, lat: place.lat, lng: place.lng }));
    let active = true;
    setResults(local);
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=lk&q=${encodeURIComponent(query.trim())}`,
          { headers: { Accept: "application/json" } },
        );
        if (!response.ok) return;
        const rows = (await response.json()) as Array<{ display_name: string; lat: string; lon: string }>;
        if (!active) return;
        const remote = rows.map((row) => ({
          label: row.display_name.split(",").slice(0, 3).join(",").trim(),
          lat: Number(row.lat),
          lng: Number(row.lon),
        })).filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng));
        setResults([...local, ...remote.filter((row) => !local.some((known) => known.label === row.label))].slice(0, 7));
      } catch {
        // Local results remain available when geocoding is offline.
      } finally {
        if (active) setSearching(false);
      }
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  function select(point: SearchResult) {
    onChange({ label: point.label, lat: point.lat, lng: point.lng });
    setQuery(point.label);
    setResults([]);
    mapRef.current?.flyTo([point.lat, point.lng], 13, { duration: 0.5 });
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => select({
        label: `Current location ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="location-picker">
      <div className="field">
        <label>{label}</label>
        <div className="search-wrap">
          <Search />
          <input
            className="input"
            value={query}
            placeholder={placeholder}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {results.length > 0 && (
          <div className="location-results">
            {results.map((result) => (
              <button key={`${result.label}-${result.lat}`} type="button" onClick={() => select(result)}>
                <MapPin size={12} /> <span>{result.label}</span>
              </button>
            ))}
          </div>
        )}
        {searching && <small className="hint">Searching OpenStreetMap…</small>}
      </div>
      <div className="map-box location-map" ref={container} />
      <div className="location-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={useCurrentLocation}>
          <LocateFixed size={12} /> Use current location
        </button>
        <span className="cell-sub">
          {value ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : "Tap the map to pin the exact pickup/drop point"}
        </span>
      </div>
    </div>
  );
}
