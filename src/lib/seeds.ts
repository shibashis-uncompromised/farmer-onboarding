// Seed types a farmer can receive. Edit to change the list.
export const SEEDS = ["Groundnut", "Sesamum", "Sunflower", "Paddy", "Rice", "Urad"];

export const SEED_QTY_MAX = 99;

// Normalise a seed name coming from a QR payload / older record to a known
// SEED label (case-insensitive). Falls back to Title Case if unknown.
export function normalizeSeedName(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return s;
  const hit = SEEDS.find((x) => x.toLowerCase() === s.toLowerCase());
  return hit || s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export const seedsTotal = (seeds?: { qty: number }[]) =>
  (seeds || []).reduce((sum, x) => sum + (x.qty || 0), 0);
