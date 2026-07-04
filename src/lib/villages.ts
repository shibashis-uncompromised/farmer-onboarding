// Village list. Used to be a hardcoded array only. Now it's backed by the
// server (`/api/villages`, added in Step 7) — the array below is kept ONLY
// as a fallback for:
//   (a) the very first app launch, before any successful server fetch, and
//   (b) an offline session on a device that has never synced before.
// Once refreshVillages() succeeds at least once, its result is cached in
// localStorage and takes over — including across future offline restarts.

import { apiVillages } from "./api";

export interface Village {
  code: string;     // unique key, e.g. "001"
  name: string;
  block: string;
  idCode: string;   // ID abbreviation, e.g. "VELA"
  region: string;   // state/region — also the ID prefix: "RJ" (Rajasthan) | "MP" (Madhya Pradesh)
}

// Default region prefix (kept for back-compat; villages now carry their own).
export const REGION_PREFIX = "RJ";

// First-launch / never-synced-yet fallback only — the server copy (seeded
// with these same values in Step 7) is the source of truth from then on.
const FALLBACK_VILLAGES: Village[] = [
  { code: "004", name: "Udai", block: "Sarada", idCode: "UDAI", region: "RJ" },
  { code: "005", name: "Belua 1", block: "Sarada", idCode: "BELU", region: "RJ" },
  { code: "006", name: "Belua 2", block: "Sarada", idCode: "BELU", region: "RJ" },
  { code: "001", name: "Velua", block: "Jhadol", idCode: "VELA", region: "RJ" },
  { code: "002", name: "Aamod", block: "Jhadol", idCode: "AMOD", region: "RJ" },
  { code: "003", name: "Fatehpur", block: "Khamnor", idCode: "FTHP", region: "RJ" },
  { code: "007", name: "Sundrel", block: "Madhya Pradesh", idCode: "SUND", region: "MP" },
  { code: "008", name: "Ajjini", block: "Madhya Pradesh", idCode: "AJNI", region: "MP" },
];

// @deprecated static snapshot for any code that still does
// `import { VILLAGES } from "./villages"` expecting a plain array. Prefer
// getVillages() / villageByCode() everywhere else — this one never updates.
export const VILLAGES = FALLBACK_VILLAGES;

const CACHE_KEY = "fo_villages_cache_v1";

function loadCache(): Village[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch {
    return null;
  }
}
function saveCache(list: Village[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

// Read the cache once at module load (not on every call).
let cached: Village[] | null = typeof window !== "undefined" ? loadCache() : null;

export function getVillages(): Village[] {
  return cached && cached.length ? cached : FALLBACK_VILLAGES;
}

// Pull the latest village list from the server and cache it. Silent/best-
// effort — a failed or offline call just leaves the existing cache/fallback
// in place. Not wired to auto-run anywhere yet — see SessionGate.tsx.
export async function refreshVillages(token: string): Promise<void> {
  try {
    const server = await apiVillages(token);
    if (Array.isArray(server) && server.length) {
      cached = server;
      saveCache(server);
    }
  } catch {
    // offline or request failed — keep using whatever's cached/fallback
  }
}

export const villageByCode = (code: string) => getVillages().find((v) => v.code === code);

// ---- Per-user village scoping (UI-only) ----
// Which region(s) each user may see. Unlisted users default to RJ, so existing
// accounts (admin/field/demo) keep seeing exactly the RJ villages they do today.
const USER_REGIONS: Record<string, string[]> = {
  mpfield: ["MP"],
};

export function regionsForUser(username: string | null | undefined): string[] {
  return USER_REGIONS[(username || "").toLowerCase()] || ["RJ"];
}

export function villagesForUser(username: string | null | undefined): Village[] {
  const regions = regionsForUser(username);
  return getVillages().filter((v) => regions.includes(v.region));
}