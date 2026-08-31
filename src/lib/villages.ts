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
  state: string;    // Neoperk state (exact enum): "Rajasthan" | "Madhya Pradesh" | "Gujarat"
  district: string; // Neoperk district (exact enum spelling for that state's project)
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

export const villageByCode = (code: string) => VILLAGES.find((v) => v.code === code);

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

export function regionsForUser(username: string | null | undefined): string[] {
  return USER_REGIONS[(username || "").toLowerCase()] || ["RJ"];
}

export function villagesForUser(username: string | null | undefined): Village[] {
  const allow = USER_VILLAGES[(username || "").toLowerCase()];
  if (allow) return VILLAGES.filter((v) => allow.includes(v.code));
  const regions = regionsForUser(username);
  return VILLAGES.filter((v) => regions.includes(v.region));
}
