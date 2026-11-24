import type { CourtCase, Staff, Trip, Vehicle } from "../types";
import { daysUntil } from "./utils";
import { weightTierFor } from "./pricing";

export interface MatchResult {
  vehicle: Vehicle;
  eligible: boolean;
  reasons: string[];
}

/** Only available, compliant trucks that physically fit the load are eligible. */
export function matchCarriers(vehicles: Vehicle[], trip: Pick<Trip, "customerVehicle">): MatchResult[] {
  const lengthMm = trip.customerVehicle.lengthMm;
  const weightKg = trip.customerVehicle.weightKg;
  return vehicles
    .map((vehicle) => {
      const reasons: string[] = [];
      if (vehicle.status === "IN_WORKSHOP") reasons.push("In workshop");
      if (vehicle.status === "ON_TRIP") reasons.push("Currently on a trip");
      if (vehicle.status === "RETIRED") reasons.push("Retired");
      if (vehicle.maxPayloadKg < weightKg) reasons.push(`Payload ${vehicle.maxPayloadKg.toLocaleString()} kg < ${weightKg.toLocaleString()} kg`);
      if (vehicle.deckLengthMm < lengthMm) reasons.push(`Deck ${vehicle.deckLengthMm} mm < ${lengthMm} mm`);
      for (const doc of vehicle.compliance) {
        if (daysUntil(doc.expiry) <= 0) reasons.push(`${doc.kind.replace("_", " ").toLowerCase()} expired`);
      }
      return { vehicle, eligible: reasons.length === 0, reasons };
    })
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return (b.vehicle.efficiencyKmpl || 0) - (a.vehicle.efficiencyKmpl || 0);
    });
}

export interface StaffEligibility {
  staff: Staff;
  eligible: boolean;
  reason: string;
}

/** Blocks dispatch for expired / police-held licences and court dates on the trip day. */
export function eligibleDrivers(
  staff: Staff[],
  courtCases: CourtCase[] = [],
  tripDate = new Date().toISOString().slice(0, 10),
  requireHeavy = true,
): StaffEligibility[] {
  return staff
    .filter((s) => s.role !== "HELPER" && s.active)
    .map((s) => {
      let reason = "Eligible";
      if (s.licenseHeldByPolice) {
        if (!s.temporaryPermitUntil || daysUntil(s.temporaryPermitUntil) <= 0) {
          reason = "Licence held by police — no valid permit";
        }
      } else if (daysUntil(s.licenseExpiry) <= 0) {
        reason = "Driving licence expired";
      } else if (daysUntil(s.licenseExpiry) < 14) {
        reason = `Licence expires in ${daysUntil(s.licenseExpiry)} days`;
      }
      if (requireHeavy && !s.licenseClasses.some((c) => /heavy|h|ce|c1e/i.test(c))) {
        reason = "No heavy-vehicle class endorsement";
      }
      const conflict = courtCases.find((c) => c.staffId === s.id && c.status === "PENDING" && c.date === tripDate);
      if (conflict) reason = `Court case ${conflict.caseNumber} on trip day`;
      return { staff: s, eligible: reason === "Eligible", reason };
    });
}

export const helpers = (staff: Staff[]) => staff.filter((s) => s.role === "HELPER" && s.active);
export const weightTierLabel = (kg: number) => weightTierFor(kg);
