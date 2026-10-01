// Preset village list. Edit this file to change available villages.
// `code` is the unique internal key (also used for selection/filtering).
// `idCode` is the abbreviation used in human IDs: RJ-{idCode}-U### / -F###.
// Note: villages can share an idCode (e.g. Belua 1 & 2 → BELU) — they then
// share a single numbering sequence.

import type { Language } from "./i18n/LanguageContext";
import { getStateLabel, getDistrictLabel, getVillageLabel, getBlockLabel } from "./dataLabels";
import { getSession } from "./session";

export interface Village {
  code: string;     // unique key, e.g. "001"
  name: string;
  block: string;
  idCode: string;   // ID abbreviation, e.g. "VELA"
  region: string;   // state/region — also the ID prefix: "RJ" (Rajasthan) | "MP" (Madhya Pradesh)
  state: string;    // Neoperk state (exact enum): "Rajasthan" | "Madhya Pradesh" | "Gujarat"
  district: string; // Neoperk district (exact enum spelling for that state's project)
  createdBy?: string; // set on user-created villages (preset villages leave this undefined)
  presetOverride?: boolean; // admin edit of a preset village (name/block/district/state)
}

// Default region prefix (kept for back-compat; villages now carry their own).
export const REGION_PREFIX = "RJ";

// Order here drives the village dropdown order. Udai & Belua 1/2 are kept on
// top for the active onboarding push; codes stay fixed so existing IDs match.
export const VILLAGES: Village[] = [
  { code: "004", name: "Udai", block: "Sarada", idCode: "UDAI", region: "RJ", state: "Rajasthan", district: "Udaipur" },
  { code: "005", name: "Belua 1", block: "Sarada", idCode: "BELU", region: "RJ", state: "Rajasthan", district: "Udaipur" },
  { code: "006", name: "Belua 2", block: "Sarada", idCode: "BELU", region: "RJ", state: "Rajasthan", district: "Udaipur" },
  { code: "001", name: "Velua", block: "Jhadol", idCode: "VELA", region: "RJ", state: "Rajasthan", district: "Udaipur" },
  { code: "002", name: "Aamod", block: "Jhadol", idCode: "AMOD", region: "RJ", state: "Rajasthan", district: "Udaipur" },
  { code: "003", name: "Fatehpur", block: "Khamnor", idCode: "FTHP", region: "RJ", state: "Rajasthan", district: "Udaipur" },
  // Madhya Pradesh villages — IDs use the MP prefix (e.g. MP-SUND-U001).
  // block is free-text on Neoperk (not validated); confirm exact tehsil with the field team.
  { code: "007", name: "Sundrel", block: "Sundrel", idCode: "SUND", region: "MP", state: "Madhya Pradesh", district: "Dhar" },
  { code: "008", name: "Ajjini", block: "Ajjini", idCode: "AJNI", region: "MP", state: "Madhya Pradesh", district: "Barwani" },
  // Gujarat village — IDs use the GJ prefix (e.g. GJ-JUNA-U001).
  { code: "009", name: "Junagadh", block: "Junagadh", idCode: "JUNA", region: "GJ", state: "Gujarat", district: "Junagadh" },
];

// Neoperk district enums per state (exact spellings from each project's reference
// endpoint). Used to populate the district dropdown; district IS validated by the API.
export const NEOPERK_STATES = ["Rajasthan", "Madhya Pradesh", "Gujarat"] as const;
export const DISTRICTS_BY_STATE: Record<string, string[]> = {
  "Rajasthan": ["Ajmer","Alwar","Banswara","Baran","Barmer","Bharatpur","Bhilwara","Bikaner","Bundi","Chittaurgarh","Churu","Dausa","Dhaulpur","Dungarpur","Jaipur","Jaisalmer","Jalor","Jhalawar","Jhunjhunun","Jodhpur","Karauli","Kota","Nagaur","Pali","Pratapgarh","Rajsamand","Sawai Madhopur","Sikar","Sirohi","Tonk","Udaipur"],
  "Madhya Pradesh": ["Alirajpur","Anuppur","Ashoknagar","Balaghat","Barwani","Betul","Bhind","Bhopal","Burhanpur","Chhatarpur","Chhindwara","Damoh","Datia","Dewas","Dhar","Dindori","Guna","Gwalior","Harda","Hoshangabad","Indore","Jabalpur","Jhabua","Katni","Khandwa","Khargone","Mandla","Mandsaur","Morena","Narsimhapur","Neemuch","Panna","Raisen","Rajgarh","Ratlam","Rewa","Sagar","Satna","Sehore","Seoni","Shahdol","Shajapur","Sheopur","Shivpuri","Sidhi","Singrauli","Tikamgarh","Ujjain","Umaria","Vidisha"],
  "Gujarat": ["Ahmadabad","Amreli","Anand","Banas Kantha","Bharuch","Bhavnagar","Dohad","Gandhinagar","Jamnagar","Junagadh","Kachchh","Kheda","Mahesana","Narmada","Navsari","Panch Mahals","Patan","Porbandar","Rajkot","Sabar Kantha","Surat","Surendranagar","Tapi","The Dangs","Vadodara","Valsad"],
};

// ---- Translated display labels ----
// Neoperk-facing values above stay in English (state/district enums, village
// `name`/`block` fields) — only what's rendered on screen changes with the
// language toggle. Backed by src/lib/dataLabels.ts + src/lib/i18n/static/hi.ts.

export function stateLabel(raw: string | null | undefined, language: Language): string {
  return getStateLabel(raw, language);
}
export const stateOpts = (language: Language) => NEOPERK_STATES.map((value) => ({ value, label: stateLabel(value, language) }));

export function districtLabel(raw: string | null | undefined, language: Language): string {
  return getDistrictLabel(raw, language);
}
export const districtOpts = (state: string, language: Language) =>
  (DISTRICTS_BY_STATE[state] || []).map((value) => ({ value, label: districtLabel(value, language) }));

// Preset villages only — field-created villages have no translation on file
// (there's no way to know a name typed in the field ahead of time), so
// they're shown exactly as the field staff typed them, same as any other
// free text in this app (getVillageLabel/getBlockLabel fall back to the raw
// value unchanged when it isn't in the static dictionary).
export function villageNameLabel(v: Village, language: Language): string {
  return getVillageLabel(v.name, language);
}
export function villageBlockLabel(v: Village, language: Language): string {
  return getBlockLabel(v.block, language);
}

// ---- User-created villages (dynamic) ----
// Preset villages above are static; villages created in the field are held in a
// module-level cache so the many SYNCHRONOUS callers (villageByCode, dropdowns,
// exports) keep working. The cache is refreshed from IndexedDB by <VillageCache/>
// (mounted in Providers) whenever the local villages table changes.
// The same table also carries admin edits of preset villages (presetOverride
// rows); those are applied on top of VILLAGES rather than listed separately.
let dynamicVillages: Village[] = [];
let presetVillages: Village[] = VILLAGES;
export function setDynamicVillages(list: Village[]) {
  const overrides = new Map(list.filter((v) => v.presetOverride).map((v) => [v.code, v]));
  presetVillages = VILLAGES.map((v) => {
    const o = overrides.get(v.code);
    // Region and idCode are locked — IDs are built from them.
    return o ? { ...v, name: o.name || v.name, block: o.block ?? v.block, district: o.district ?? v.district, state: o.state ?? v.state } : v;
  });
  dynamicVillages = list.filter((v) => !v.presetOverride);
}
export function getDynamicVillages(): Village[] { return dynamicVillages; }
export const getPresetVillages = (): Village[] => presetVillages;

// All villages the app knows about right now (preset + user-created).
export const allVillages = (): Village[] => [...presetVillages, ...dynamicVillages];

export const villageByCode = (code: string): Village | undefined =>
  presetVillages.find((v) => v.code === code) || dynamicVillages.find((v) => v.code === code);

// ---- Per-user village scoping (UI-only) ----
// Which region(s) each user may see. Unlisted users default to RJ, so existing
// accounts (field/demo) keep seeing exactly the RJ villages they do today.
const USER_REGIONS: Record<string, string[]> = {
  mpfield: ["MP"],
  admin: ["RJ", "MP", "GJ"],   // admin sees every active region
};

// Per-user village allowlist (by village code) — takes precedence over region
// scoping. Use this when a user should see only specific villages, not a whole
// region. Keys must be lowercase (login lowercases the username).
const USER_VILLAGES: Record<string, string[]> = {
  "9001509839": ["002", "001"],   // Aamod (002) + Velua (001) only
};

// Any admin account (by role, not just the "admin" username) sees everything.
const isAdminUser = (username: string | null | undefined, role?: string | null) => {
  const uname = (username || "").toLowerCase();
  if (uname === "admin" || role === "admin") return true;
  const s = getSession();
  return !!s && s.role === "admin" && (s.username || "").toLowerCase() === uname;
};

export function regionsForUser(username: string | null | undefined, role?: string | null): string[] {
  if (isAdminUser(username, role)) return USER_REGIONS.admin;
  return USER_REGIONS[(username || "").toLowerCase()] || ["RJ"];
}

export function villagesForUser(username: string | null | undefined, role?: string | null): Village[] {
  const uname = (username || "").toLowerCase();
  const isAdmin = isAdminUser(username, role);
  // Preset villages: per-user allowlist wins, else region scoping.
  const allow = isAdmin ? undefined : USER_VILLAGES[uname];
  const preset = allow
    ? presetVillages.filter((v) => allow.includes(v.code))
    : presetVillages.filter((v) => regionsForUser(username, role).includes(v.region));
  // User-created villages: admin sees all; supervisors see every village in
  // their region (whoever created it) plus their own. Users on a village
  // allowlist only get the ones they created themselves.
  const regions = regionsForUser(username, role);
  const custom = dynamicVillages.filter((v) =>
    isAdmin || (v.createdBy || "").toLowerCase() === uname || (!allow && regions.includes(v.region)));
  return [...preset, ...custom];
}
