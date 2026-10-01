// Crop plan naming convention, shared by the admin cultivation screens:
// "<Season> <Year> <Farm ID>", e.g. "Kharif 2026 RJ-BELU-F2305" — so every
// farm's plans line up in TerraOS (which matches crop plans by name per farm).
// Stored values stay English; only the dropdown label is translated.

export const SEASONS = ["Kharif", "Rabi", "Zaid"] as const;
export type SeasonName = (typeof SEASONS)[number];

export const SEASON_LABEL_KEY = {
  Kharif: "cultivation_seasonKharif",
  Rabi: "cultivation_seasonRabi",
  Zaid: "cultivation_seasonZaid",
} as const;

export const planName = (season: SeasonName, year: number, farmId: string) => `${season} ${year} ${farmId}`;

// Local calendar date (not UTC — in India UTC is still "yesterday" before 05:30).
export const todayStr = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Indian cropping seasons by sowing month: Kharif Jun–Sep, Rabi Oct–Feb, Zaid Mar–May.
export function seasonFor(date: string): SeasonName {
  const m = Number(date.slice(5, 7));
  if (m >= 6 && m <= 9) return "Kharif";
  if (m >= 3 && m <= 5) return "Zaid";
  return "Rabi";
}

// Read season/year back from a plan name (falls back to the sowing date).
export function parsePlan(name: string, startDate: string): { season: SeasonName; year: number } {
  const m = /^(Kharif|Rabi|Zaid)\s+(\d{4})\b/i.exec(name.trim());
  if (m) {
    const season = SEASONS.find((x) => x.toLowerCase() === m[1].toLowerCase())!;
    return { season, year: Number(m[2]) };
  }
  return { season: seasonFor(startDate), year: Number((startDate || todayStr()).slice(0, 4)) };
}

export const validYear = (y: number) => Number.isInteger(y) && y >= 2000 && y <= 2100;
