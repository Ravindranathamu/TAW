/**
 * WAHA (WhatsApp HTTP API) client and webhook helpers.
 * Configure the endpoint/session in Settings. No credentials are shipped in golden files.
 */

export interface WahaConfig {
  url: string;
  apiKey: string;
  session: string;
  webhookSecret: string;
  relayUrl: string;
}

const CONFIG_KEY = "taw_waha_config_v1";

export function getWahaConfig(): WahaConfig {
  let stored: Partial<WahaConfig> = {};
  try {
    stored = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? "{}") as Partial<WahaConfig>;
  } catch {
    /* ignore */
  }
  return {
    url: stored.url || import.meta.env.VITE_WAHA_URL || "",
    apiKey: stored.apiKey || import.meta.env.VITE_WAHA_API_KEY || "",
    session: stored.session || import.meta.env.VITE_WAHA_SESSION || "default",
    webhookSecret: stored.webhookSecret || import.meta.env.VITE_WAHA_WEBHOOK_SECRET || "",
    relayUrl: stored.relayUrl || import.meta.env.VITE_WAHA_WEBHOOK_RELAY_URL || "",
  };
}

export function saveWahaConfig(config: WahaConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export const wahaConfigured = () => Boolean(getWahaConfig().url && getWahaConfig().apiKey);

export function toChatId(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  const international = cleaned.startsWith("0") ? `94${cleaned.slice(1)}` : cleaned;
  return `${international}@c.us`;
}

async function wahaPost(path: string, body: Record<string, unknown>) {
  const config = getWahaConfig();
  if (!config.url || !config.apiKey) throw new Error("WAHA is not configured. Add its URL and API key in Settings.");
  const response = await fetch(`${config.url.replace(/\/+$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Api-Key": config.apiKey,
    },
    body: JSON.stringify({ session: config.session, ...body }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WAHA request failed (${response.status})${text ? `: ${text.slice(0, 220)}` : ""}`);
  }
  const result: unknown = await response.json().catch(() => ({}));
  return result as Record<string, unknown>;
}

export function wahaSendText(phone: string, text: string) {
  const chatId = toChatId(phone);
  if (!chatId) return Promise.reject(new Error("Customer phone number is missing."));
  return wahaPost("/api/sendText", { chatId, text });
}

export function wahaSendLocation(
  phone: string,
  point: { lat: number; lng: number; label?: string },
) {
  const chatId = toChatId(phone);
  if (!chatId) return Promise.reject(new Error("Customer phone number is missing."));
  return wahaPost("/api/sendLocation", {
    chatId,
    latitude: point.lat,
    longitude: point.lng,
    title: point.label || "TAW live location",
  });
}

export interface WahaLocation {
  lat: number;
  lng: number;
  label: string;
  chatId: string;
  customerPhone: string;
}

function finite(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= 180 ? n : null;
}

function locationFromObject(value: unknown): { lat: number; lng: number; label: string } | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const lat = finite(item.latitude ?? item.lat ?? item.y);
  const lng = finite(item.longitude ?? item.lng ?? item.x);
  if (lat !== null && lng !== null) {
    return { lat, lng, label: String(item.title ?? item.name ?? item.label ?? "WhatsApp location") };
  }
  for (const nested of Object.values(item)) {
    if (nested && typeof nested === "object") {
      const found = locationFromObject(nested);
      if (found) return found;
    }
  }
  return null;
}

function locationFromText(text: string): { lat: number; lng: number; label: string } | null {
  // Google Maps share links: !3d7.29!4d80.63, @7.29,80.63, or ?q=7.29,80.63
  const maps = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
    ?? text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
    ?? text.match(/[?&]q=(-?\d+(?:\.\d+)?)[,%20]+(-?\d+(?:\.\d+)?)/);
  if (maps) return { lat: Number(maps[1]), lng: Number(maps[2]), label: "WhatsApp map link" };

  const pair = text.match(/(-?\d{1,2}\.\d{4,})[\s,]+(-?\d{1,3}\.\d{4,})/);
  if (pair) return { lat: Number(pair[1]), lng: Number(pair[2]), label: "WhatsApp coordinates" };
  return null;
}

/** Accepts a raw WAHA webhook payload, a JSON string, or pasted WhatsApp location text. */
export function parseWahaLocation(input: unknown): WahaLocation | null {
  let value = input;
  if (typeof value === "string") {
    const trimmed = value.trim();
    try {
      value = JSON.parse(trimmed) as unknown;
    } catch {
      const point = locationFromText(trimmed);
      return point ? { ...point, chatId: "", customerPhone: "" } : null;
    }
  }

  const root = (value ?? {}) as Record<string, unknown>;
  const payload = (root.payload ?? root) as Record<string, unknown>;
  const point = locationFromObject(payload) ?? locationFromText(String(payload.body ?? ""));
  if (!point) return null;

  const chatId = String(payload.from ?? payload.chatId ?? root.from ?? root.chatId ?? "");
  return {
    ...point,
    chatId,
    customerPhone: chatId.replace(/@.*$/, ""),
  };
}

export const wahaWebhookHint = () => {
  const config = getWahaConfig();
  return config.relayUrl || `${window.location.origin}/taw-waha-webhook`;
};
