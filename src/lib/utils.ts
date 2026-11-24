import type { NotificationItem, TawState, Vehicle } from "../types";
import type { Role } from "../types";

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export const money = (value: number, currency = "LKR") =>
  `${currency} ${Math.round(value).toLocaleString("en-LK")}`;

export const shortDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const dateTime = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

export const isoDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const daysUntil = (iso?: string) => {
  if (!iso) return 9999;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return 9999;
  return Math.ceil((target - Date.now()) / 86_400_000);
};

export type Tone = "ok" | "warn" | "danger" | "info" | "neutral";

export const toneForDays = (days: number, thresholds: number[] = [30, 14, 3]): Tone => {
  const [far, mid, near] = [thresholds[0] ?? 30, thresholds[1] ?? 14, thresholds[2] ?? 3];
  if (days < 0) return "danger";
  if (days <= near) return "danger";
  if (days <= mid) return "warn";
  if (days <= far) return "info";
  return "ok";
};

export const severityForDays = (days: number, thresholds: number[] = [30, 14, 3]): NotificationItem["severity"] => {
  if (days < 0 || days <= (thresholds[2] ?? 3)) return "URGENT";
  if (days <= (thresholds[1] ?? 14)) return "SOON";
  return "OK";
};

export const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
};

export const num = (value: string | number | undefined, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const monthKey = (iso = new Date().toISOString()) => iso.slice(0, 7);

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const plateSlug = (plate: string) => plate.replace(/[^a-z0-9]/gi, "").toUpperCase();

export const roleLabel: Record<Role, string> = {
  owner: "Owner",
  driver: "Driver",
  customer: "Customer",
};

export const complianceLabel: Record<string, string> = {
  INSURANCE: "Insurance",
  REVENUE_LICENSE: "Revenue licence",
  FITNESS: "Fitness report",
  EMISSION: "Emission test",
};

/** Height of a truck in metres estimated from deck length, used for visual only. */
export const vehicleIsCompliant = (v: Vehicle) =>
  v.compliance.length > 0 && v.compliance.every((doc) => daysUntil(doc.expiry) > 0);

export const compactNumber = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);

export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export const groupByMonth = <T extends { date?: string; paidAt?: string }>(items: T[]) => {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const key = (item.date ?? item.paidAt ?? "").slice(0, 7);
    if (!key) continue;
    out.set(key, [...(out.get(key) ?? []), item]);
  }
  return [...out.entries()].sort((a, b) => b[0].localeCompare(a[0]));
};

export const seedStateKey = (role: Role) => `taw_state_v1_${role}`;
export const demoUnlockedKey = "taw_demo_unlocked";

export function loadState<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveState<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable */
  }
}

export function makeNotifications(state: TawState): NotificationItem[] {
  const out: NotificationItem[] = [];
  const thresholds = state.company.alertDays;
  const push = (item: Omit<NotificationItem, "id" | "read" | "daysLeft" | "severity">) => {
    const days = daysUntil(item.dueDate);
    if (days > (thresholds[0] ?? 30)) return;
    out.push({
      ...item,
      id: `${item.kind}-${item.title}-${item.dueDate}`,
      daysLeft: days,
      severity: severityForDays(days, thresholds),
      read: false,
    });
  };

  for (const v of state.vehicles) {
    for (const doc of v.compliance) {
      push({
        kind: "COMPLIANCE",
        title: `${v.plate} · ${complianceLabel[doc.kind] ?? doc.kind}`,
        detail: `${doc.provider || doc.number} — renew before ${shortDate(doc.expiry)}`,
        dueDate: doc.expiry,
        linkTo: `/fleet/${v.id}`,
      });
    }
    if (v.finance) {
      push({
        kind: "FINANCE",
        title: `${v.plate} · Leasing instalment`,
        detail: `${v.finance.institution} · ${money(v.finance.monthlyAmount)} · ${v.finance.remainingTerms} terms left`,
        dueDate: v.finance.nextDue,
        linkTo: `/fleet/${v.id}`,
      });
    }
    for (const rule of state.serviceRules) {
      const remaining = rule.intervalKm - (v.odometerKm - rule.lastDoneKm);
      if (remaining <= 500) {
        push({
          kind: "SERVICE",
          title: `${v.plate} · ${rule.label} due`,
          detail: `${Math.max(0, remaining)} km remaining at ${v.odometerKm.toLocaleString()} km`,
          dueDate: isoDays(Math.max(0, Math.round(remaining / 120))),
          linkTo: `/fleet/${v.id}`,
        });
      }
    }
    for (const tyre of v.tyres) {
      const remaining = tyre.replaceAtKm - v.odometerKm;
      if (remaining <= 1000) {
        push({
          kind: "WARRANTY",
          title: `${v.plate} · Tyre ${tyre.position}`,
          detail: `${tyre.brand} · replace at ${tyre.replaceAtKm.toLocaleString()} km`,
          dueDate: isoDays(Math.max(0, Math.round(remaining / 120))),
          linkTo: `/fleet/${v.id}`,
        });
      }
    }
    if (v.battery && daysUntil(v.battery.warrantyUntil) <= 30) {
      push({
        kind: "WARRANTY",
        title: `${v.plate} · Battery warranty`,
        detail: `${v.battery.brand} · ${v.battery.serial}`,
        dueDate: v.battery.warrantyUntil,
        linkTo: `/fleet/${v.id}`,
      });
    }
  }

  for (const s of state.staff) {
    if (!s.active) continue;
    push({
      kind: "LICENSE",
      title: `${s.name} · Driving licence`,
      detail: s.licenseHeldByPolice
        ? "Licence held by police — temporary permit required"
        : `${s.licenseNumber} · classes ${s.licenseClasses.join(", ")}`,
      dueDate: s.licenseHeldByPolice && s.temporaryPermitUntil ? s.temporaryPermitUntil : s.licenseExpiry,
      linkTo: `/staff/${s.id}`,
    });
  }

  for (const c of state.courtCases) {
    if (c.status === "PENDING") {
      push({
        kind: "COURT",
        title: `Court case ${c.caseNumber}`,
        detail: `${c.court} · ${c.description}`,
        dueDate: c.date,
        linkTo: "/violations",
      });
    }
  }

  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}
