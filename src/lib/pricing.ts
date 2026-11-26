import type { Company, MapPoint, PriceBreakdown, RoadFactor, Trip, WeightTier } from "../types";
import { sum } from "./utils";

export const WEIGHT_TIERS: Record<WeightTier, { label: string; factor: number; maxKg: number }> = {
  LIGHT: { label: "Light · up to 1,500 kg", factor: 1.0, maxKg: 1500 },
  MEDIUM: { label: "Medium · 1,500–3,000 kg", factor: 1.2, maxKg: 3000 },
  HEAVY: { label: "Heavy · over 3,000 kg", factor: 1.45, maxKg: Infinity },
};

export const ROAD_FACTORS: Record<RoadFactor, { label: string; multiplier: number; note: string }> = {
  NORMAL: { label: "Normal / highway", multiplier: 1.0, note: "Standard rate" },
  HIGHWAY: { label: "Expressway route", multiplier: 1.05, note: "Tolls added separately" },
  URBAN: { label: "Heavy urban traffic", multiplier: 1.15, note: "Colombo / rush hour" },
  HILLY: { label: "Hilly / winding roads", multiplier: 1.2, note: "Upcountry gradients" },
  OFFROAD: { label: "Off-road / winch recovery", multiplier: 1.35, note: "Recovery equipment needed" },
};

export const weightTierFor = (weightKg: number): WeightTier => {
  if (weightKg <= 1500) return "LIGHT";
  if (weightKg <= 3000) return "MEDIUM";
  return "HEAVY";
};

export interface PricingRates {
  baseFee: number;
  perKmRate: number;
  recoveryFee: number;
  offroadRecoveryFee: number;
}

export const DEFAULT_RATES: PricingRates = {
  baseFee: 3500,
  perKmRate: 180,
  recoveryFee: 8500,
  offroadRecoveryFee: 12500,
};

/** Owner-editable rates with safe defaults for older saved workspaces. */
export function ratesForCompany(company?: Partial<Company>): PricingRates {
  const baseFee = Number(company?.baseFee);
  const perKmRate = Number(company?.perKmRate);
  return {
    ...DEFAULT_RATES,
    baseFee: Number.isFinite(baseFee) && baseFee >= 0 ? baseFee : DEFAULT_RATES.baseFee,
    perKmRate: Number.isFinite(perKmRate) && perKmRate >= 0 ? perKmRate : DEFAULT_RATES.perKmRate,
  };
}

export interface QuoteInput {
  distanceKm: number;
  weightKg: number;
  roadFactor: RoadFactor;
  highwayTolls: number;
  finalQuote?: number;
  discount?: number;
  rates?: PricingRates;
}

/**
 * ((Base + Distance × PerKm) × WeightTier × RoadFactor) + HighwayCharges
 * Highway tolls are pass-through and remain outside the service multiplier.
 */
export function calculateQuote(input: QuoteInput): PriceBreakdown {
  const rates = input.rates ?? DEFAULT_RATES;
  const tier = weightTierFor(input.weightKg);
  const weightFactor = WEIGHT_TIERS[tier].factor;
  const roadMultiplier = ROAD_FACTORS[input.roadFactor].multiplier;
  const serviceSubtotal =
    (rates.baseFee + input.distanceKm * rates.perKmRate) * weightFactor * roadMultiplier;
  const suggestedTotal = serviceSubtotal + input.highwayTolls;
  const discount = input.discount ?? 0;
  return {
    baseFee: rates.baseFee,
    perKmRate: rates.perKmRate,
    distanceKm: input.distanceKm,
    weightTier: tier,
    weightFactor,
    roadFactor: input.roadFactor,
    roadMultiplier,
    highwayTolls: input.highwayTolls,
    serviceSubtotal,
    suggestedTotal,
    finalQuote: input.finalQuote ?? Math.round(suggestedTotal - discount),
    discount,
  };
}

/** Standard Sri Lankan expressway toll table (LKR, light vehicle basis). */
export const TOLL_TABLE: Record<string, number> = {
  "Colombo–Kandy (Central)": 780,
  "Colombo–Galle (Southern)": 620,
  "Colombo–Katunayake": 420,
  "Kandy–Galle": 940,
};

export const estimateToll = (from: string, to: string, heavy: boolean) => {
  const key = Object.keys(TOLL_TABLE).find(
    (k) =>
      [from, to].every((place) => k.toLowerCase().includes(place.toLowerCase().split(" ")[0])) ||
      k.toLowerCase().includes(from.toLowerCase()) ||
      k.toLowerCase().includes(to.toLowerCase()),
  );
  const base = key ? TOLL_TABLE[key] : 0;
  return heavy ? Math.round(base * 1.6) : base;
};

/** Rough distance table for common Sri Lankan routes, used when Maps API is absent. */
const ROUTE_KM: Array<[RegExp, number, number]> = [
  [/kandy.*colombo|colombo.*kandy/i, 116, 165],
  [/colombo.*galle|galle.*colombo/i, 119, 140],
  [/kandy.*galle|galle.*kandy/i, 190, 250],
  [/colombo.*katunayake|katunayake.*colombo/i, 35, 45],
  [/kandy.*nuwara|nuwara.*kandy/i, 105, 180],
  [/colombo.*kurunegala|kurunegala.*colombo/i, 95, 120],
  [/galle.*matara|matara.*galle/i, 45, 55],
];

/** Straight-line distance between map pins, inflated for Sri Lankan road routing. */
export function pinDistanceKm(from: MapPoint, to: MapPoint): number {
  const rad = Math.PI / 180;
  const dLat = (to.lat - from.lat) * rad;
  const dLng = (to.lng - from.lng) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.lat * rad) * Math.cos(to.lat * rad) * Math.sin(dLng / 2) ** 2;
  const straight = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(3, Math.round(straight * 1.28));
}

export function estimateRoute(
  from: string,
  to: string,
  heavy: boolean,
  useHighway: boolean,
  fromPoint?: MapPoint,
  toPoint?: MapPoint,
) {
  const text = `${from} ${to}`;
  const match = ROUTE_KM.find(([pattern]) => pattern.test(text));
  const tableDistance = match ? match[1] : Math.max(12, Math.min(420, (from.length + to.length) * 4));
  const distanceKm = fromPoint && toPoint ? pinDistanceKm(fromPoint, toPoint) : tableDistance;
  const tableDuration = match
    ? useHighway ? match[2] : Math.round(match[2] * 1.35)
    : Math.round(distanceKm * 2.1);
  const durationMins = fromPoint && toPoint
    ? Math.max(15, Math.round((distanceKm / (heavy ? 42 : 58)) * 60))
    : tableDuration;
  const oneWay = estimateToll(from, to, heavy);
  const highwayToll = useHighway ? oneWay : 0;
  return { distanceKm, durationMins, highwayToll };
}

export const tripRevenue = (trip: Trip) => trip.price.finalQuote;
export const tripCost = (
  opts: { fuel: number; maintenance: number; wages: number; partnerPayout?: number },
) => opts.fuel + opts.maintenance + opts.wages + (opts.partnerPayout ?? 0);

export const monthlyProfit = (
  trips: Trip[],
  fuel: Array<{ tripId?: string; cost: number }>,
  wagesByTrip: Map<string, number>,
  partnerPayoutByTrip: Map<string, number>,
) => {
  const revenue = sum(trips.map(tripRevenue));
  const fuelCost = sum(fuel.map((f) => f.cost));
  const wages = sum(trips.map((t) => wagesByTrip.get(t.id) ?? 0));
  const payouts = sum(trips.map((t) => partnerPayoutByTrip.get(t.id) ?? 0));
  return { revenue, fuelCost, wages, payouts, profit: revenue - fuelCost - wages - payouts };
};
