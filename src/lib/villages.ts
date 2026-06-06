// Preset village list. Edit this file to change available villages.
// `code` is the 3-digit segment used in IDs: RJ{code}U### / RJ{code}F###

export interface Village {
  code: string;   // "001"
  name: string;
  block: string;
}

export const REGION_PREFIX = "RJ";

export const VILLAGES: Village[] = [
  { code: "001", name: "Velua", block: "Jhadol" },
  { code: "002", name: "Aamod", block: "Jhadol" },
  { code: "003", name: "Fatehpur", block: "Khamnor" },
  { code: "004", name: "Udai", block: "Sarada" },
  { code: "005", name: "Belua 1", block: "Sarada" },
  { code: "006", name: "Belua 2", block: "Sarada" },
];

export const villageByCode = (code: string) => VILLAGES.find((v) => v.code === code);
