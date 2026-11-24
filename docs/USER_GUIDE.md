# TAW user guide

## Views

Views are determined by login, not by a selector:

- Owners sign in at `/login` and reach `/dashboard`.
- Drivers sign in separately at `/driver-login` and reach `/driver`.
- Customers never sign in. They open the public `/track/:token` link sent by TAW.

### Owner

- **Home** — fleet status, urgent renewal alerts, live trips, revenue and quick actions.
- **Dispatch** — type to search the customer vehicle directory (suggestions only, no permanent list), search and pin pickup/drop on the map, import a WhatsApp location, see eligible trucks and drivers, adjust the quote, then dispatch, save an enquiry or pass the order to an active TAW partner.
- **Fleet** — carrier trucks, compliance documents, lease tracking, tyres, battery and service history.
- **History** — all trips and their timeline, costs, tracking link and invoices.
- **More** — drivers/crew, vehicle directory, compliance, maintenance, fuel, invoices, finance, partners, live map, settings and portal.

### Driver

Open an assigned trip and:

1. Location starts automatically — there is no manual coordinate form. In a browser it works while the driver page stays open; in the native TAW wrapper it continues with the screen off.
2. Advance the trip through pickup, transit and completion.
3. Call or WhatsApp the customer with the tracking link (WAHA sends it automatically when configured).
4. Check the carrier's compliance documents before departure.

### Customer

Open the tracking link sent by TAW. No login is needed. The page shows the vehicle, route, carrier, driver contact, live map, progress timeline and a QR code, and refreshes its position automatically every 10 seconds.

## Pricing rules

`(base fee + distance × per-km rate) × weight tier × road factor + highway tolls`

- Weight tiers: Light ≤ 1,500 kg (×1.0), Medium ≤ 3,000 kg (×1.2), Heavy > 3,000 kg (×1.45).
- Road factors: normal, expressway, urban traffic, hilly, off-road.
- Toll charges are pass-through and are **not** VAT-applicable.

## Fuel efficiency

Owners do not enter km/L anywhere. TAW calculates it from:

1. Completed runs using trip start/end odometer and fuel logs linked to those trips; or
2. Consecutive full-tank refills when no linked run exists.

If neither exists, the app shows **No records yet** instead of assuming a baseline.

## WhatsApp via WAHA

Set the WAHA base URL, API key, session and webhook in **Settings → WAHA**. Dispatch can request a customer's location on WhatsApp and import a received location from a WAHA webhook payload or a Google Maps share link. Driver status changes and live locations are sent to the customer's WhatsApp when WAHA is configured.

## Partner fallback

When no in-house carrier fits the load, Dispatch offers active TAW partners with the app installed. The order is handed over with a commission, the trip is marked `SUBCONTRACTED`, and the job appears in **Partner network** for settlement.

## Renewal alerts

TAW raises alerts at 30, 14 and 3 days before due dates for insurance, revenue licence, fitness, emission, lease instalments, service intervals, tyre replacement, battery warranty, driving licences and court dates. The lead days can be changed in Settings.

## Invoices

 completed trip can be issued as a VAT tax invoice or a non-VAT receipt. Serials follow IRD Gazette 2481/22 style: `YYMMM_QQQQ_XXXXX`. Toll lines are marked non-VAT. Downloads are PDF; duplicate copies are clearly labelled.

## Partners and subcontracting

Mark a partner Active after the link is confirmed. Create partner jobs from the Partners page; unsettled payouts and commissions are included in Finance → P&L.

## Data safety

Demo mode stores everything locally in the browser. Cloud mode stores company-scoped rows in Supabase through the workspace RPCs. The golden master never contains client data.
