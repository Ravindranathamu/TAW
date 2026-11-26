import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Clipboard,
  MapPin,
  MessageCircle,
  Navigation,
  Route as RouteIcon,
  Search,
  Send,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { useTaw } from "../state/TawStore";
import { AlertStrip, Badge, Card, Field, KeyValue, Modal, PageHead } from "../components/ui";
import { LocationPicker } from "../components/LocationPicker";
import { calculateQuote, estimateRoute, ratesForCompany, ROAD_FACTORS, WEIGHT_TIERS, weightTierFor } from "../lib/pricing";
import { eligibleDrivers, helpers, matchCarriers } from "../lib/matching";
import { money, uid, daysUntil } from "../lib/utils";
import { quoteMessage, whatsappLink } from "../lib/invoice";
import { parseWahaLocation, wahaConfigured, wahaSendText } from "../lib/waha";
import type { MapPoint, RoadFactor, Trip, TripStatus } from "../types";

export function DispatchPage() {
  const { state, addTrip, saveVehicle, handoffToPartners, notify } = useTaw();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [catalogId, setCatalogId] = useState("");
  const [custom, setCustom] = useState(false);
  const [spec, setSpec] = useState({ make: "", model: "", year: "", lengthMm: 0, weightKg: 0, bodyType: "", plate: "" });
  const [pickup, setPickup] = useState<MapPoint | undefined>();
  const [drop, setDrop] = useState<MapPoint | undefined>();
  const [route, setRoute] = useState({ from: "Kandy", to: "Colombo", useHighway: true, returnToll: false });
  const [roadFactor, setRoadFactor] = useState<RoadFactor>("NORMAL");
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [vehicleId, setVehicleId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [helperIds, setHelperIds] = useState<string[]>([]);
  const [supportVehicleId, setSupportVehicleId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [created, setCreated] = useState<Trip | null>(null);
  const [wahaOpen, setWahaOpen] = useState(false);
  const [wahaInput, setWahaInput] = useState("");

  // Suggestions appear only while typing. There is no permanent vehicle list.
  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || catalogId || custom) return [];
    return state.catalog
      .filter((item) => `${item.make} ${item.model} ${item.yearRange}`.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [state.catalog, query, catalogId, custom]);

  function chooseCatalog(id: string) {
    const item = state.catalog.find((c) => c.id === id);
    if (!item) return;
    setCatalogId(id);
    setSpec({
      make: item.make,
      model: item.model,
      year: item.yearRange,
      lengthMm: item.lengthMm,
      weightKg: item.maxWeightKg,
      bodyType: item.bodyType,
      plate: "",
    });
    setQuery("");
  }

  function clearVehicle() {
    setCatalogId("");
    setCustom(false);
    setQuery("");
    setSpec({ make: "", model: "", year: "", lengthMm: 0, weightKg: 0, bodyType: "", plate: "" });
  }

  function setPickupPoint(point: MapPoint) {
    setPickup(point);
    setRoute((current) => ({ ...current, from: point.label }));
  }

  function setDropPoint(point: MapPoint) {
    setDrop(point);
    setRoute((current) => ({ ...current, to: point.label }));
  }

  const heavy = spec.weightKg > 1500;
  const routeInfo = useMemo(
    () => estimateRoute(route.from, route.to, heavy, route.useHighway, pickup, drop),
    [route.from, route.to, route.useHighway, heavy, pickup, drop],
  );
  const highwayTolls = routeInfo.highwayToll + (route.returnToll ? routeInfo.highwayToll : 0);
  const price = calculateQuote({
    distanceKm: routeInfo.distanceKm,
    weightKg: spec.weightKg || 1200,
    roadFactor,
    highwayTolls,
    discount,
    rates: ratesForCompany(state.company),
  });
  const matches = useMemo(
    () => matchCarriers(state.vehicles, { customerVehicle: {
      ...spec,
      lengthMm: spec.lengthMm || 4300,
      weightKg: spec.weightKg || 1200,
    } }),
    [state.vehicles, spec],
  );
  const eligibleMatches = matches.filter((match) => match.eligible);
  const tawPartners = state.partners.filter((p) => !p.external && p.linkState === "ACTIVE");
  const drivers = useMemo(
    () => eligibleDrivers(state.staff, state.courtCases, new Date().toISOString().slice(0, 10)),
    [state.staff, state.courtCases],
  );
  const crew = helpers(state.staff);
  const selectedVehicle = state.vehicles.find((v) => v.id === vehicleId);
  const selectedDriver = state.staff.find((s) => s.id === staffId);
  const canDispatch = Boolean(spec.make && pickup && drop && customer.name && customer.phone);
  const fuelNote = selectedVehicle?.efficiencyKmpl
    ? `~${(routeInfo.distanceKm / selectedVehicle.efficiencyKmpl).toFixed(1)} L using recorded ${selectedVehicle.efficiencyKmpl} km/L`
    : "km/L not calculated yet — needs completed runs and fuel records";

  function createTrip(status: TripStatus): Trip {
    const trip: Trip = {
      id: uid(),
      code: `TAW-${String(10000 + state.trips.length + 43).padStart(5, "0")}`,
      enquiryOnly: status === "ENQUIRY",
      status,
      customerName: customer.name || "Walk-in enquiry",
      customerPhone: customer.phone || "—",
      customerVehicle: { ...spec, catalogId: catalogId || undefined },
      route: {
        from: route.from,
        to: route.to,
        fromPoint: pickup,
        toPoint: drop,
        distanceKm: routeInfo.distanceKm,
        durationMins: routeInfo.durationMins,
        useHighway: route.useHighway,
        highwayToll: highwayTolls,
        returnToll: route.returnToll,
      },
      vehicleId: vehicleId || undefined,
      supportVehicleId: supportVehicleId || undefined,
      staffId: staffId || undefined,
      helperIds,
      startKm: selectedVehicle?.odometerKm,
      price,
      paymentStatus: "UNPAID",
      milestones: [{ at: new Date().toISOString(), status, note: status === "ENQUIRY" ? "Enquiry recorded" : "Dispatch created" }],
      trackingToken: `trk_${uid().slice(0, 12)}`,
      createdAt: new Date().toISOString(),
    };
    addTrip(trip);
    return trip;
  }

  function sendCustomerNotice(trip: Trip, message: string) {
    if (!wahaConfigured() || trip.customerPhone === "—") return;
    void wahaSendText(trip.customerPhone, message).catch(() => undefined);
  }

  function dispatch() {
    if (!canDispatch) return;
    const trip = createTrip("HEADING_TO_PICKUP");
    if (selectedVehicle) saveVehicle({ ...selectedVehicle, status: "ON_TRIP" });
    sendCustomerNotice(
      trip,
      `${state.company.name} · ${trip.code}\nPickup: ${trip.route.from}\nDrop: ${trip.route.to}\nTrack live: ${window.location.origin}/track/${trip.trackingToken}`,
    );
    setCreated(trip);
    setConfirmOpen(false);
    notify({ tone: "ok", text: `${trip.code} dispatched. Customer tracking link ready.` });
  }

  function fallback() {
    if (!canDispatch) return;
    const trip = createTrip("SUBCONTRACTED");
    const handed = handoffToPartners(trip);
    if (!handed) {
      notify({ tone: "error", text: "No active TAW partner with your app installed. Activate one in Partner network." });
      return;
    }
    sendCustomerNotice(
      handed,
      `${state.company.name} · ${handed.code}\nYour vehicle has been assigned to a TAW partner carrier.\nTrack live: ${window.location.origin}/track/${handed.trackingToken}`,
    );
    setCreated(handed);
  }

  function importWhatsappLocation() {
    const parsed = parseWahaLocation(wahaInput);
    if (!parsed) {
      notify({ tone: "error", text: "No WhatsApp location found. Paste the WAHA webhook JSON or a Google Maps share link." });
      return;
    }
    setPickupPoint({ label: parsed.label, lat: parsed.lat, lng: parsed.lng });
    if (!customer.phone && parsed.customerPhone) {
      setCustomer((current) => ({ ...current, phone: parsed.customerPhone }));
    }
    setWahaOpen(false);
    setWahaInput("");
    notify({ tone: "ok", text: "Pickup pin imported from WhatsApp." });
  }

  async function pasteFromClipboard() {
    try {
      setWahaInput(await navigator.clipboard.readText());
    } catch {
      notify({ tone: "info", text: "Clipboard is blocked here. Paste the location manually." });
    }
  }

  function requestWhatsappLocation() {
    if (!customer.phone) {
      notify({ tone: "error", text: "Add the customer phone number first." });
      return;
    }
    void wahaSendText(
      customer.phone,
      `${state.company.name}: please reply with your pickup location pin so we can place it accurately on the TAW map.`,
    ).then(
      () => notify({ tone: "ok", text: "Location request sent through WAHA." }),
      (cause: unknown) => notify({ tone: "error", text: cause instanceof Error ? cause.message : "WAHA send failed." }),
    );
  }

  return (
    <>
      <PageHead title="Smart dispatch" subtitle="Type to find the customer vehicle, pin the route on the map, then price and dispatch." />

      {spec.make && (
        <AlertStrip tone="ok">
          <strong>{spec.make} {spec.model}</strong> · {spec.lengthMm.toLocaleString()} mm · {spec.weightKg.toLocaleString()} kg · {WEIGHT_TIERS[weightTierFor(spec.weightKg)].label}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 10 }} onClick={clearVehicle}><X size={11} /> Change</button>
        </AlertStrip>
      )}

      {!spec.make && (
        <Card title="Customer vehicle" subtitle="Start typing to see model suggestions">
          {!custom ? (
            <>
              <div className="search-wrap">
                <Search />
                <input
                  className="input"
                  placeholder="e.g. Honda Vezel, Hilux, Atto 3…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoComplete="off"
                />
              </div>
              {suggestions.length > 0 && (
                <div className="catalog-suggestions">
                  {suggestions.map((item) => (
                    <button key={item.id} type="button" onClick={() => chooseCatalog(item.id)}>
                      <span><strong>{item.make} {item.model}</strong><small>{item.yearRange} · {item.bodyType}</small></span>
                      <span className="cell-sub">{item.maxWeightKg.toLocaleString()} kg</span>
                    </button>
                  ))}
                </div>
              )}
              {query.trim() && suggestions.length === 0 && <p className="sub">No directory match. Try another make or add an unlisted vehicle.</p>}
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setCustom(true)}>Unlisted vehicle / custom load</button>
            </>
          ) : (
            <div className="form-grid">
              <Field label="Make"><input className="input" value={spec.make} onChange={(e) => setSpec({ ...spec, make: e.target.value })} /></Field>
              <Field label="Model"><input className="input" value={spec.model} onChange={(e) => setSpec({ ...spec, model: e.target.value })} /></Field>
              <Field label="Length (mm)"><input className="input" type="number" value={spec.lengthMm || ""} onChange={(e) => setSpec({ ...spec, lengthMm: Number(e.target.value) })} /></Field>
              <Field label="Weight (kg)"><input className="input" type="number" value={spec.weightKg || ""} onChange={(e) => setSpec({ ...spec, weightKg: Number(e.target.value) })} /></Field>
              <Field label="Vehicle plate (optional)" full><input className="input" value={spec.plate} onChange={(e) => setSpec({ ...spec, plate: e.target.value })} /></Field>
              <button className="btn btn-ghost btn-sm" style={{ gridColumn: "1 / -1" }} onClick={() => setCustom(false)}>Search the directory instead</button>
            </div>
          )}
        </Card>
      )}

      <Card
        title="Pickup & drop-off"
        subtitle="Search the map or tap it to pin the exact collection and delivery points"
        action={<button className="btn btn-ghost btn-sm" onClick={() => setWahaOpen(true)}><MessageCircle size={12} /> WhatsApp location</button>}
      >
        <div className="two-picker-grid">
          <LocationPicker label="Pickup pin" value={pickup} onChange={setPickupPoint} placeholder="Search pickup town or address" />
          <LocationPicker label="Drop-off pin" value={drop} onChange={setDropPoint} placeholder="Search drop-off town or address" />
        </div>
        {(!pickup || !drop) && <AlertStrip tone="warn"><MapPin size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> Pin both locations before dispatch so the driver and customer see the same points.</AlertStrip>}
        <div className="form-grid" style={{ marginTop: 12 }}>
          <Field label="Use expressway / highway">
            <select className="select" value={route.useHighway ? "yes" : "no"} onChange={(e) => setRoute({ ...route, useHighway: e.target.value === "yes" })}>
              <option value="yes">Yes — use highway</option>
              <option value="no">No — surface roads</option>
            </select>
          </Field>
          <Field label="Include return toll">
            <select className="select" value={route.returnToll ? "yes" : "no"} onChange={(e) => setRoute({ ...route, returnToll: e.target.value === "yes" })}>
              <option value="no">No</option>
              <option value="yes">Yes — return empty</option>
            </select>
          </Field>
          <Field label="Road / traffic condition" full>
            <select className="select" value={roadFactor} onChange={(e) => setRoadFactor(e.target.value as RoadFactor)}>
              {(Object.keys(ROAD_FACTORS) as RoadFactor[]).map((key) => (
                <option key={key} value={key}>{ROAD_FACTORS[key].label} · ×{ROAD_FACTORS[key].multiplier}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="alert-strip alert-info" style={{ marginTop: 14, marginBottom: 0 }}>
          <RouteIcon size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
          {routeInfo.distanceKm} km · ~{routeInfo.durationMins} min · Highway charges {money(highwayTolls)} · {fuelNote}
        </div>
      </Card>

      <Card title="Carrier matching" subtitle="Only compliant trucks that physically fit the load are eligible">
        {eligibleMatches.length === 0 ? (
          <>
            <AlertStrip tone="warn">No in-house carrier is available for this load. TAW can pass the order to an active TAW partner with the app installed.</AlertStrip>
            {tawPartners.length === 0 ? (
              <AlertStrip tone="danger">No active TAW partner yet. Add and activate one in Partner network.</AlertStrip>
            ) : (
              <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
                {tawPartners.map((partner) => (
                  <div key={partner.id} className="match-card">
                    <div className="match-top">
                      <span className="match-plate"><Truck size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{partner.companyName}</span>
                      <Badge tone="info">{partner.commissionPct}% commission</Badge>
                    </div>
                    <div className="match-specs"><span>{partner.tawPartnerId ?? "TAW partner"}</span><span>{money(partner.agreedRate)} agreed</span><span>App installed</span></div>
                  </div>
                ))}
                <button className="btn btn-brand btn-block big-btn" disabled={!canDispatch} onClick={fallback}>
                  <Send size={15} /> Pass order to TAW partner
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {matches.map((match) => (
              <button
                key={match.vehicle.id}
                className={`match-card ${match.eligible ? "eligible" : "ineligible"}`}
                style={{ width: "100%", textAlign: "left", ...(vehicleId === match.vehicle.id ? { outline: "2px solid var(--brand)" } : {}) }}
                onClick={() => match.eligible && setVehicleId(match.vehicle.id)}
                disabled={!match.eligible}
              >
                <div className="match-top">
                  <span className="match-plate"><Truck size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{match.vehicle.plate}</span>
                  {match.eligible ? <Badge tone="ok"><Check size={10} /> Fits</Badge> : <Badge tone="danger">Not eligible</Badge>}
                </div>
                <div className="match-specs">
                  <span>{match.vehicle.maxPayloadKg.toLocaleString()} kg payload</span>
                  <span>{(match.vehicle.deckLengthMm / 1000).toFixed(2)} m deck</span>
                  <span>{match.vehicle.efficiencyKmpl ? `${match.vehicle.efficiencyKmpl} km/L` : "km/L unrecorded"}</span>
                  <span>{match.vehicle.status.replace("_", " ")}</span>
                </div>
                {match.reasons.length > 0 && <div className="match-reasons">{match.reasons.join(" · ")}</div>}
              </button>
            ))}
            <button className="btn btn-ghost btn-sm btn-block" disabled={!canDispatch} onClick={fallback}>
              No suitable truck? Pass to a TAW partner instead
            </button>
          </div>
        )}
      </Card>

      <Card title="Crew & customer" subtitle="Licence validation blocks ineligible drivers">
        <div className="form-grid">
          <Field label="Driver" full>
            <select className="select" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Select a driver…</option>
              {drivers.map((d) => (
                <option key={d.staff.id} value={d.staff.id} disabled={!d.eligible}>
                  {d.staff.name} · {d.staff.role === "TEMP_DRIVER" ? "Temporary" : "Permanent"} · {d.eligible ? "eligible" : d.reason}
                </option>
              ))}
            </select>
          </Field>
          {selectedDriver && (
            <div className="alert-strip alert-info" style={{ gridColumn: "1 / -1", marginBottom: 0 }}>
              <UserRound size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
              Licence {selectedDriver.licenseNumber} · {selectedDriver.licenseClasses.join(", ")} · expires {daysUntil(selectedDriver.licenseExpiry)} days
              {selectedDriver.licenseHeldByPolice && " · licence held by police"}
            </div>
          )}
          <Field label="Helper / support crew" full>
            <select className="select" value={helperIds[0] ?? ""} onChange={(e) => setHelperIds(e.target.value ? [e.target.value] : [])}>
              <option value="">No helper</option>
              {crew.map((h) => <option key={h.id} value={h.id}>{h.name} · batta {money(h.battaPerTrip ?? 0)}</option>)}
            </select>
          </Field>
          <Field label="Recovery / support vehicle" full>
            <select className="select" value={supportVehicleId} onChange={(e) => setSupportVehicleId(e.target.value)}>
              <option value="">None</option>
              {state.vehicles.filter((v) => v.id !== vehicleId).map((v) => <option key={v.id} value={v.id}>{v.plate} · {v.status.replace("_", " ")}</option>)}
            </select>
          </Field>
          <Field label="Customer name"><input className="input" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /></Field>
          <Field label="Customer phone"><input className="input" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></Field>
        </div>
      </Card>

      <Card title="Quote" subtitle="Formula: (base + km × rate) × weight tier × road factor + tolls">
        <KeyValue rows={[
          [`Base fee (${money(price.baseFee)}) + ${price.distanceKm} km × ${money(price.perKmRate)}`, money(price.baseFee + price.distanceKm * price.perKmRate)],
          [`Weight tier ${price.weightTier} (×${price.weightFactor})`, money((price.baseFee + price.distanceKm * price.perKmRate) * price.weightFactor)],
          [`Road factor ${price.roadFactor} (×${price.roadMultiplier})`, money(price.serviceSubtotal)],
          ["Highway charges (pass-through)", money(price.highwayTolls)],
          ["Suggested total", money(price.suggestedTotal)],
        ]} />
        <div style={{ marginTop: 14 }}>
          <Field label="Discount (LKR)"><input className="input" type="number" min={0} value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))} /></Field>
        </div>
        <div className="price-total" style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, marginTop: 14, borderTop: "1px solid var(--line)", fontFamily: "Space Grotesk, sans-serif", fontSize: 18 }}>
          <span>Final quote</span><strong style={{ color: "var(--brand)" }}>{money(price.finalQuote)}</strong>
        </div>
      </Card>

      <div style={{ display: "grid", gap: 8, paddingBottom: 20 }}>
        <button className="btn btn-ghost btn-block" onClick={() => { const trip = createTrip("ENQUIRY"); setCreated(trip); }}>
          <Clipboard size={14} /> Save as enquiry
        </button>
        <button className="btn btn-brand btn-block big-btn" disabled={!canDispatch || !vehicleId || !staffId} onClick={() => setConfirmOpen(true)}>
          <Navigation size={16} /> Dispatch {selectedVehicle?.plate ?? "trip"}
        </button>
      </div>

      {confirmOpen && (
        <Modal
          title="Confirm dispatch"
          subtitle={`${spec.make} ${spec.model} · ${route.from} → ${route.to}`}
          onClose={() => setConfirmOpen(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setConfirmOpen(false)}>Cancel</button>
            <button className="btn btn-brand" onClick={dispatch}><Send size={14} /> Dispatch now</button>
          </>}
        >
          <KeyValue rows={[
            ["Customer", customer.name],
            ["Carrier", selectedVehicle?.plate ?? "—"],
            ["Driver", selectedDriver?.name ?? "—"],
            ["Pins", `${pickup?.lat.toFixed(5)}, ${pickup?.lng.toFixed(5)} → ${drop?.lat.toFixed(5)}, ${drop?.lng.toFixed(5)}`],
            ["Distance", `${routeInfo.distanceKm} km`],
            ["Total", money(price.finalQuote)],
          ]} />
          <p className="sub" style={{ marginTop: 12 }}>The truck is marked On Trip and a customer tracking link is generated.</p>
        </Modal>
      )}

      {wahaOpen && (
        <Modal
          title="WhatsApp location"
          subtitle="Paste the WAHA webhook payload or a customer's Google Maps share link"
          onClose={() => setWahaOpen(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={requestWhatsappLocation}><MessageCircle size={13} /> Ask customer</button>
            <button className="btn btn-brand" disabled={!wahaInput.trim()} onClick={importWhatsappLocation}><MapPin size={13} /> Use location</button>
          </>}
        >
          <Field label="Incoming location / webhook JSON" full>
            <textarea className="textarea" rows={6} value={wahaInput} onChange={(e) => setWahaInput(e.target.value)} placeholder='{"event":"message","payload":{"from":"9477...","body":"https://maps.app.goo.gl/..."}}' />
          </Field>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => void pasteFromClipboard()}><Clipboard size={12} /> Paste from clipboard</button>
          <p className="sub" style={{ marginTop: 10 }}>WAHA webhook target: <code>{window.location.origin}/taw-waha-webhook</code>. Point your relay at Settings → WAHA to receive location messages automatically.</p>
        </Modal>
      )}

      {created && (
        <Modal
          title={created.status === "SUBCONTRACTED" ? "Order handed over" : "Trip dispatched"}
          subtitle={created.code}
          onClose={() => setCreated(null)}
          footer={<>
            <a className="btn btn-ghost" href={whatsappLink(created.customerPhone, quoteMessage(state.company, created))} target="_blank" rel="noreferrer"><Send size={14} /> Send quote</a>
            <button className="btn btn-brand" onClick={() => navigate(`/trips/${created.id}`)}>Open trip <ArrowRight size={14} /></button>
          </>}
        >
          <AlertStrip tone="ok"><Check size={13} /> {created.code} is live. The tracking link is <strong>/track/{created.trackingToken}</strong>.</AlertStrip>
          <KeyValue rows={[
            ["Customer", created.customerName],
            ["Route", `${created.route.from} → ${created.route.to}`],
            ["Status", created.status.replace(/_/g, " ")],
            ["Quote", money(created.price.finalQuote)],
          ]} />
        </Modal>
      )}
    </>
  );
}
