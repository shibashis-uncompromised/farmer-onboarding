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
}

export const REGION_PREFIX = "RJ";

// Order here drives the village dropdown order. Udai & Belua 1/2 are kept on
// top for the active onboarding push; codes stay fixed so existing IDs match.
export const VILLAGES: Village[] = [
  { code: "004", name: "Udai", block: "Sarada", idCode: "UDAI" },
  { code: "005", name: "Belua 1", block: "Sarada", idCode: "BELU" },
  { code: "006", name: "Belua 2", block: "Sarada", idCode: "BELU" },
  { code: "001", name: "Velua", block: "Jhadol", idCode: "VELA" },
  { code: "002", name: "Aamod", block: "Jhadol", idCode: "AMOD" },
  { code: "003", name: "Fatehpur", block: "Khamnor", idCode: "FTHP" },
];

export const villageByCode = (code: string) => VILLAGES.find((v) => v.code === code);
