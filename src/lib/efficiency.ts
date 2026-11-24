import type { FuelLog, Trip } from "../types";

export interface EfficiencyResult {
  kmpl: number;
  samples: number;
  distanceKm: number;
  litres: number;
}

/**
 * Efficiency is never entered by the owner.
 * It is derived from recorded runs (trip start/end odometer) and full-tank refills.
 */
export function calculateEfficiency(
  vehicleId: string,
  fuelLogs: FuelLog[],
  trips: Trip[] = [],
): EfficiencyResult {
  const empty: EfficiencyResult = { kmpl: 0, samples: 0, distanceKm: 0, litres: 0 };
  const logs = fuelLogs
    .filter((log) => log.vehicleId === vehicleId && log.odometerKm > 0 && log.litres > 0)
    .sort((a, b) => a.odometerKm - b.odometerKm || a.date.localeCompare(b.date));
  if (logs.length === 0) return empty;

  // Preferred sample: a completed run with its own fuel records.
  const runSamples = trips
    .filter((trip) => trip.vehicleId === vehicleId && trip.status === "COMPLETED")
    .map((trip) => {
      const distance = Number(trip.endKm ?? 0) - Number(trip.startKm ?? 0);
      const litres = logs
        .filter((log) => log.tripId === trip.id)
        .reduce((sum, log) => sum + log.litres, 0);
      return { distance, litres };
    })
    .filter((sample) => sample.distance > 0 && sample.litres > 0);

  // Fallback sample: between two full-tank refills. Litres at the later fill
  // represent the fuel burned since the previous full tank.
  const refillSamples: Array<{ distance: number; litres: number }> = [];
  for (let index = 1; index < logs.length; index += 1) {
    const previous = logs[index - 1];
    const current = logs[index];
    const distance = current.odometerKm - previous.odometerKm;
    if (distance <= 0 || !current.fullTank) continue;
    refillSamples.push({ distance, litres: current.litres });
  }

  const samples = runSamples.length > 0 ? runSamples : refillSamples;
  const totalDistance = samples.reduce((sum, sample) => sum + sample.distance, 0);
  const totalLitres = samples.reduce((sum, sample) => sum + sample.litres, 0);
  if (totalDistance <= 0 || totalLitres <= 0) return empty;

  return {
    kmpl: Number((totalDistance / totalLitres).toFixed(2)),
    samples: samples.length,
    distanceKm: Math.round(totalDistance),
    litres: Number(totalLitres.toFixed(1)),
  };
}

export function efficiencyMap(fuelLogs: FuelLog[], trips: Trip[]): Map<string, EfficiencyResult> {
  const ids = new Set<string>();
  for (const log of fuelLogs) ids.add(log.vehicleId);
  for (const trip of trips) if (trip.vehicleId) ids.add(trip.vehicleId);
  return new Map([...ids].map((id) => [id, calculateEfficiency(id, fuelLogs, trips)]));
}

/** Flags a new full refill only against this truck's own recorded history. */
export function fuelAnomaly(
  log: Pick<FuelLog, "vehicleId" | "odometerKm" | "litres" | "fullTank">,
  fuelLogs: FuelLog[],
  trips: Trip[] = [],
): boolean {
  if (!log.fullTank || log.litres <= 0) return false;
  const previous = fuelLogs
    .filter((item) => item.vehicleId === log.vehicleId && item.odometerKm < log.odometerKm)
    .sort((a, b) => b.odometerKm - a.odometerKm)[0];
  if (!previous) return false;

  const history = fuelLogs.filter((item) =>
    item.vehicleId === log.vehicleId && item.odometerKm < log.odometerKm,
  );
  const baseline = calculateEfficiency(log.vehicleId, history, trips).kmpl;
  if (baseline <= 0) return false;
  const current = (log.odometerKm - previous.odometerKm) / log.litres;
  return current > 0 && current < baseline * 0.75;
}

export const efficiencyLabel = (value?: number) =>
  value && value > 0 ? `${value.toFixed(1)} km/L` : "No records yet";
