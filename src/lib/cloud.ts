import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { Company, Staff, TawState, Trip, Vehicle } from "../types";
import { ratesForCompany } from "./pricing";

export interface CloudConfig {
  url: string;
  anonKey: string;
  portalUrl: string;
  licenseUrl: string;
  licenseAnonKey: string;
  /** Assigned by the portal and baked into the deployed build. */
  installationId: string;
  /** Compatibility fallback for installations issued before the order pipeline. */
  licenseKey: string;
}

/**
 * Workspace values are injected by the deployment pipeline at build time.
 * Owners never enter or edit them; demo mode simply runs without them.
 */
export function getCloudConfig(): CloudConfig {
  return {
    url: import.meta.env.VITE_SUPABASE_URL || "",
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
    portalUrl: import.meta.env.VITE_PORTAL_URL || "https://ravsoft-portal.pages.dev/developer",
    licenseUrl: import.meta.env.VITE_MASTER_LICENSE_URL || "",
    licenseAnonKey: import.meta.env.VITE_MASTER_LICENSE_ANON_KEY || "",
    installationId: import.meta.env.VITE_TAW_INSTALLATION_ID || "",
    licenseKey: import.meta.env.VITE_TAW_LICENSE_KEY || "",
  };
}

let client: SupabaseClient | null = null;
let clientUrl = "";
export function supabase(): SupabaseClient | null {
  const config = getCloudConfig();
  if (!config.url || !config.anonKey) return null;
  if (!client || clientUrl !== config.url) {
    client = createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    clientUrl = config.url;
  }
  return client;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const sb = supabase();
  if (!sb) throw new Error("Workspace connection is missing from this deployment. Contact RAVBsoft.");
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error("No session was returned. Check your credentials.");
  return data.session;
}

export async function signOut() {
  await supabase()?.auth.signOut();
}

export async function currentSession(): Promise<Session | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

/** Loads the company workspace (all modules) from the golden-master RPC. */
export async function pullCloud(): Promise<TawState> {
  const sb = supabase();
  if (!sb) throw new Error("Master project is not configured.");
  const { data, error } = await sb.rpc("taw_get_workspace");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No workspace returned. Run the golden-master migration first.");
  const state = data as TawState;
  const installationId = getCloudConfig().installationId.trim().toUpperCase();
  if (installationId && !state.company?.installationId) {
    state.company.installationId = installationId;
  }
  // Pricing rates live in their own additive migration, so older installations
  // simply keep the built-in defaults until that migration is applied.
  let remote: { baseFee?: number; perKmRate?: number } = {};
  try {
    const { data: pricing } = await sb.rpc("taw_get_pricing_rates");
    if (pricing && typeof pricing === "object") {
      remote = pricing as { baseFee?: number; perKmRate?: number };
    }
  } catch {
    /* pricing RPC not installed yet */
  }
  const rates = ratesForCompany({
    ...state.company,
    baseFee: Number.isFinite(Number(remote.baseFee)) ? Number(remote.baseFee) : undefined,
    perKmRate: Number.isFinite(Number(remote.perKmRate)) ? Number(remote.perKmRate) : undefined,
  });
  state.company.baseFee = rates.baseFee;
  state.company.perKmRate = rates.perKmRate;
  return state;
}

/** Persists the whole workspace; the server-side RPC validates the company scope. */
export async function pushCloud(state: TawState): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Master project is not configured.");
  const { error } = await sb.rpc("taw_save_workspace", { p_state: state });
  if (error) throw new Error(error.message);
  // Additive RPC keeps owner-editable rates even though the whole-workspace RPC
  // predates those columns. Older installations simply ignore this call.
  const rates = ratesForCompany(state.company);
  try {
    const { error: rateError } = await sb.rpc("taw_save_pricing_rates", {
      p_base_fee: rates.baseFee,
      p_per_km_rate: rates.perKmRate,
    });
    if (rateError) throw rateError;
  } catch {
    /* pricing RPC not installed yet */
  }
}

/** Public customer-tracking payload, returned by the anon-callable TAW RPC. */
export interface PublicTracking {
  company: Company;
  trip: Trip;
  driver?: Staff;
  vehicle?: Vehicle;
  publicSlug?: string;
}

export async function getPublicTracking(token: string): Promise<PublicTracking | null> {
  const sb = supabase();
  if (!sb || !token) return null;
  const { data, error } = await sb.rpc("taw_public_tracking", { p_token: token });
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as PublicTracking;
}

export interface PortalLicence {
  valid: boolean;
  product?: string;
  plan: string;
  status: string;
  expiresAt: string;
  seats: number;
  installationId?: string;
  holder?: string;
  serverTime?: string;
  message?: string;
}

const emptyLicence = (message: string): PortalLicence => ({
  valid: false,
  plan: "",
  status: "",
  expiresAt: "",
  seats: 0,
  message,
});

/**
 * Outbound-only licence poll against the RAVBsoft developer portal.
 *
 * The new order pipeline assigns a TAW-LK installation ID; the portal's
 * poll_taw_license accepts that ID and returns Trial/Active directly. Older
 * TAW-YYYYMMDD keys are still accepted by the same RPC as a fallback.
 */
export async function checkPortalLicence(identifier: string): Promise<PortalLicence> {
  const config = getCloudConfig();
  const url = config.licenseUrl || config.url;
  const anon = config.licenseAnonKey || config.anonKey;
  if (!url || !anon || !identifier.trim()) {
    return emptyLicence("Installation ID or licence key not configured.");
  }
  const res = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/rpc/poll_taw_license`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` },
    body: JSON.stringify({ p_license_key: identifier.trim().toUpperCase() }),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text || `Licence check failed (${res.status}).`;
    try {
      const parsed = JSON.parse(text) as unknown;
      const detail = (Array.isArray(parsed) ? parsed[0] : parsed) as
        | { message?: string }
        | undefined;
      message = detail?.message || message;
    } catch {
      /* keep raw */
    }
    return emptyLicence(message);
  }
  const parsed = JSON.parse(text) as unknown;
  const data = (Array.isArray(parsed) ? parsed[0] : parsed) as Record<string, unknown> | undefined;
  if (!data) {
    return emptyLicence("Licence RPC returned no data.");
  }
  const product = String(data.product ?? "TAW");
  const valid = Boolean(data.valid ?? data.ok);
  return {
    valid: valid && product.toUpperCase() === "TAW",
    product,
    plan: String(data.plan ?? ""),
    status: String(data.status ?? ""),
    expiresAt: String(data.expires_at ?? data.expiresAt ?? ""),
    seats: Number(data.seats ?? 0),
    installationId: String(data.installation_id ?? data.installationId ?? "") || undefined,
    holder: String(data.holder ?? "") || undefined,
    serverTime: String(data.server_time ?? data.serverTime ?? "") || undefined,
    message:
      product.toUpperCase() === "TAW"
        ? String(data.message ?? "")
        : `This key belongs to ${product}, not TAW.`,
  };
}

/** Device identity used by the driver PWA GPS publisher. */
export const machineId = () => {
  const key = "taw_machine_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `TAW-${Math.random().toString(16).slice(2, 12).toUpperCase()}`;
    localStorage.setItem(key, id);
  }
  return id;
};
