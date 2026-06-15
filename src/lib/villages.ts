// Preset village list. Edit this file to change available villages.
// `code` is the unique internal key (also used for selection/filtering).
// `idCode` is the abbreviation used in human IDs: RJ-{idCode}-U### / -F###.
// Note: villages can share an idCode (e.g. Belua 1 & 2 → BELU) — they then
// share a single numbering sequence.

export interface Village {
  code: string;     // unique key, e.g. "001"
  name: string;
  block: string;
  idCode: string;   // ID abbreviation, e.g. "VELA"
  region: string;   // state/region — also the ID prefix: "RJ" (Rajasthan) | "MP" (Madhya Pradesh)
}

// Default region prefix (kept for back-compat; villages now carry their own).
export const REGION_PREFIX = "RJ";

// Order here drives the village dropdown order. Udai & Belua 1/2 are kept on
// top for the active onboarding push; codes stay fixed so existing IDs match.
export const VILLAGES: Village[] = [
  { code: "004", name: "Udai", block: "Sarada", idCode: "UDAI", region: "RJ" },
  { code: "005", name: "Belua 1", block: "Sarada", idCode: "BELU", region: "RJ" },
  { code: "006", name: "Belua 2", block: "Sarada", idCode: "BELU", region: "RJ" },
  { code: "001", name: "Velua", block: "Jhadol", idCode: "VELA", region: "RJ" },
  { code: "002", name: "Aamod", block: "Jhadol", idCode: "AMOD", region: "RJ" },
  { code: "003", name: "Fatehpur", block: "Khamnor", idCode: "FTHP", region: "RJ" },
  // Madhya Pradesh villages — IDs use the MP prefix (e.g. MP-SUND-U001).
  { code: "007", name: "Sundrel", block: "Madhya Pradesh", idCode: "SUND", region: "MP" },
  { code: "008", name: "Ajjini", block: "Madhya Pradesh", idCode: "AJNI", region: "MP" },
];

export const villageByCode = (code: string) => VILLAGES.find((v) => v.code === code);

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
  return VILLAGES.filter((v) => regions.includes(v.region));
}
