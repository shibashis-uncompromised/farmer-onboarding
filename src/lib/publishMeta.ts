// Labels/colours shared by the Publish to TerraOS admin page and its detail
// modals (publish = onboarding backend → uc-core; not device sync).
import type { PublishCurrentState, PublishEntityType, PublishStatus } from "./api";
import type { TranslationKey } from "./i18n/LanguageContext";
import { ENTITY_COLOR, ENTITY_LABEL_KEY } from "./dynamicFieldMeta";

export const PUBLISH_TYPE_LABEL_KEY: Record<PublishEntityType, TranslationKey> = {
  village: "adminPublish_entityVillage",
  ...ENTITY_LABEL_KEY,
};
export const PUBLISH_TYPE_COLOR: Record<PublishEntityType, string> = { village: "orange", ...ENTITY_COLOR };

export const PUBLISH_STATUS_META: Record<PublishStatus, { key: TranslationKey; color: string }> = {
  would_create: { key: "adminPublish_statusWouldCreate", color: "green" },
  would_update: { key: "adminPublish_statusWouldUpdate", color: "blue" },
  would_delete: { key: "adminPublish_statusWouldDelete", color: "gray" },
  created: { key: "adminPublish_statusCreated", color: "green" },
  updated: { key: "adminPublish_statusUpdated", color: "blue" },
  deleted: { key: "adminPublish_statusDeleted", color: "gray" },
  skipped: { key: "adminPublish_statusSkipped", color: "gray" },
  conflict: { key: "adminPublish_statusConflict", color: "yellow" },
  error: { key: "adminPublish_statusError", color: "red" },
};

// A record's position right now (vs. the result of one past run).
export const PUBLISH_CURRENT_META: Record<PublishCurrentState, { key: TranslationKey; color: string }> = {
  up_to_date: { key: "adminPublish_nowUpToDate", color: "green" },
  changed: { key: "adminPublish_nowChanged", color: "blue" },
  conflict: { key: "adminPublish_nowConflict", color: "yellow" },
  error: { key: "adminPublish_nowError", color: "red" },
  skipped: { key: "adminPublish_nowSkipped", color: "gray" },
  deleted: { key: "adminPublish_nowDeleted", color: "gray" },
  discarded: { key: "adminPublish_nowDiscarded", color: "dark" },
  not_published: { key: "adminPublish_nowNotPublished", color: "orange" },
  gone: { key: "adminPublish_nowGone", color: "dark" },
};

export const PUBLISH_CHANGE_KEY: Record<string, TranslationKey> = {
  new: "adminPublish_changeNew", changed: "adminPublish_changeChanged", deleted: "adminPublish_changeDeleted",
};

export const PUBLISH_CONFLICT_KEY: Record<string, TranslationKey> = {
  name: "adminPublish_conflictName", modified: "adminPublish_conflictModified", missing: "adminPublish_conflictMissing",
};

export const publishItemKey = (i: { type: string; sourceId: string }) => `${i.type}:${i.sourceId}`;

// Human-readable key for the flattened "data sent" table.
const FIELD_LABELS: Record<string, string> = {
  name: "Name", stateCode: "State code", stateName: "State", district: "District", block: "Block",
  villageSourceId: "Village", farmerSourceId: "Farmer", farmSourceId: "Farm",
  firstName: "First name", lastName: "Last name", phone: "Phone", careOf: "Care of",
  lat: "Latitude", lng: "Longitude", boundary: "Boundary", areaAcres: "Area (acres)", code: "Code",
};
export const publishFieldLabel = (key: string) =>
  FIELD_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

/** Flattens `data` (one level into `attributes`) into label/value rows. */
export function publishDataRows(data: Record<string, any> | undefined | null): { key: string; value: string }[] {
  if (!data) return [];
  const rows: { key: string; value: string }[] = [];
  const fmt = (k: string, v: any): string => {
    if (v === null || v === undefined || v === "") return "—";
    if (k === "boundary" && Array.isArray(v)) return `${v.length} GPS point(s)`;
    if (typeof v === "number") return String(Math.round(v * 1e6) / 1e6);
    if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") || "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };
  for (const [k, v] of Object.entries(data)) {
    if (k === "attributes" && v && typeof v === "object") {
      for (const [ak, av] of Object.entries(v)) rows.push({ key: publishFieldLabel(ak), value: fmt(ak, av) });
    } else {
      rows.push({ key: publishFieldLabel(k), value: fmt(k, v) });
    }
  }
  return rows;
}
