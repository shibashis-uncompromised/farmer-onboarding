// Seed types a farmer can receive. Edit to change the list.
export const SEEDS = ["Groundnut", "Sesamum", "Sunflower", "Paddy", "Rice", "Urad", "Turmeric"];

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

// Kg per packet, by seed. Packets are handed out as fixed-weight bags.
export const KG_PER_PACKET: Record<string, number> = { Groundnut: 20 };

// Human label for a seed line, showing packets and their kg weight when known:
//   Groundnut ×2 (40 kg)   ·   Paddy ×1   (unknown weight → packets only)
export function seedLabel(seed: string, qty: number): string {
  const kg = KG_PER_PACKET[seed];
  return kg ? `${seed} ×${qty} (${qty * kg} kg)` : `${seed} ×${qty}`;
}
