import { VILLAGES } from "./villages";
import { normalizeSeedName } from "./seeds";

export interface ParsedQr {
  code: string;        // farmer code, e.g. "RJ-VELA-U001"
  seed: string | null; // optional seed from the payload (usually absent)
}

// Field QR codes carry just the farmer code ("RJ-VELA-U001"). Some older
// batches used a pipe/colon payload ("U:RJ-VELA-U001|SEED:groundnut"), so we
// parse that defensively too.
export function parseQr(raw: string): ParsedQr {
  const s = (raw || "").trim();
  let code = s;
  let seed: string | null = null;

  if (s.includes("|") || /\b(U|SEED)\s*:/i.test(s)) {
    for (const part of s.split("|")) {
      const idx = part.indexOf(":");
      if (idx === -1) continue;
      const key = part.slice(0, idx).trim().toUpperCase();
      const val = part.slice(idx + 1).trim();
      if (key === "U" && val) code = val;
      else if (key === "SEED" && val) seed = normalizeSeedName(val);
    }
  }

  // Pull out an embedded RJ-XXXX-U### style code if there's surrounding text.
  const m = code.toUpperCase().match(/[A-Z]{2,}-[A-Z0-9]+-[UF]\d+/);
  if (m) code = m[0];

  return { code: code.trim(), seed };
}

// "RJ-VELA-U001" -> village code "001" (first village whose idCode matches).
// idCodes can be shared (Belua 1 & 2 → BELU); we return the first match and let
// the user adjust the village if needed.
export function villageCodeFromId(id: string): string | null {
  const m = (id || "").toUpperCase().match(/-([A-Z0-9]+)-[UF]?\d+/);
  const ab = m?.[1];
  if (!ab) return null;
  const v = VILLAGES.find((x) => x.idCode.toUpperCase() === ab);
  return v?.code ?? null;
}

// Basic shape check so a random QR doesn't get treated as a farmer code.
export function looksLikeFarmerCode(code: string): boolean {
  return /^[A-Z]{2,}-[A-Z0-9]+-[UF]\d+$/i.test((code || "").trim());
}

export function isReservedImportedFarmerCode(code: string): boolean {
  const m = /^RJ-(AMOD|VELA|FTHP)-U(\d{3})$/i.exec((code || "").trim());
  if (!m) return false;
  const seq = Number(m[2]);
  const maxByVillage: Record<string, number> = { AMOD: 22, VELA: 19, FTHP: 16 };
  return seq >= 1 && seq <= (maxByVillage[m[1].toUpperCase()] || 0);
}

// Soil-sample codes look like RJ-AMOD-SA001 / RJ-VELA-SB034:
//   <REGION>-<VILLAGE>-S<letter><digits>
export function looksLikeSoilCode(code: string): boolean {
  return /^[A-Z]{2,}-[A-Z0-9]+-S[A-Z]\d+$/i.test((code || "").trim());
}
