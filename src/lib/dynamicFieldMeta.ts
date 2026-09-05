// Central metadata for every dynamic (seasonally re-versioned) field across
// farmers, farms and plots: labels and select/multiselect option lists. Kept
// in one place so the admin edit forms (components/admin/Edit*Modal) and the
// version-history viewer (app/admin/versions) never drift out of sync on
// what a raw field/value actually means.

export interface FieldOption { value: string; label: string }

export const FINANCIAL_CAPACITY_OPTS: FieldOption[] = [
  { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" },
];
export const LANDHOLDING_OPTS: FieldOption[] = [
  { value: "lt_2_5", label: "< 2.5 acres" }, { value: "between_2_5_10", label: "2.5–10 acres" }, { value: "gt_10", label: "> 10 acres" },
];
export const ADOPTION_LEVEL_OPTS: FieldOption[] = [
  { value: "basic", label: "Basic" }, { value: "improved", label: "Improved" },
  { value: "progressive", label: "Progressive" }, { value: "advanced", label: "Advanced" },
];
export const MOBILE_COVERAGE_OPTS: FieldOption[] = [
  { value: "good", label: "Good" }, { value: "weak", label: "Weak" }, { value: "none", label: "None" },
];
export const SHAPE_OPTS: FieldOption[] = [
  { value: "rectangle", label: "Rectangle" }, { value: "square", label: "Square" },
  { value: "trapezoid", label: "Trapezoid" }, { value: "irregular", label: "Irregular" },
];
export const FARMER_FOCUS_OPTS: FieldOption[] = [
  { value: "daily", label: "Daily" }, { value: "twice_weekly", label: "Twice a week" }, { value: "weekly_plus", label: "Weekly or less" },
];
export const WATER_SOURCE_OPTS: FieldOption[] = [
  { value: "rainfed", label: "Rainfed" }, { value: "borewell", label: "Borewell" },
  { value: "open_well", label: "Open well" }, { value: "farm_pond", label: "Farm pond" },
  { value: "anicut_river", label: "Anicut / River" },
];
export const IRRIGATION_OPTS: FieldOption[] = [
  { value: "none", label: "None" }, { value: "flood", label: "Flood" },
  { value: "sprinkler", label: "Sprinkler" }, { value: "drip", label: "Drip" },
];
export const SEASON_OPTS: FieldOption[] = [
  { value: "kharif", label: "Kharif" }, { value: "rabi", label: "Rabi" }, { value: "zaid", label: "Zaid" }, { value: "other", label: "Other" },
];
export const KNOWN_ISSUE_OPTS: FieldOption[] = [
  { value: "termites", label: "Termites" }, { value: "nematodes", label: "Nematodes" },
  { value: "frost", label: "Frost" }, { value: "flooding", label: "Flooding" }, { value: "other", label: "Other" },
];
export const ANIMAL_PRESSURE_OPTS: FieldOption[] = [
  { value: "nilgai", label: "Nilgai" }, { value: "boar", label: "Boar" }, { value: "monkey", label: "Monkey" },
  { value: "rabbit", label: "Rabbit" }, { value: "birds", label: "Birds" }, { value: "other", label: "Other" },
];
export const ACCESSIBILITY_OPTS: FieldOption[] = [
  { value: "tractor", label: "Tractor" }, { value: "small_machinery", label: "Small machinery" },
  { value: "hand_tools", label: "Hand tools only" },
];
export const TOOL_OPTS: FieldOption[] = [
  { value: "tractor", label: "Tractor" }, { value: "power_tiller", label: "Power tiller" },
  { value: "pump_set", label: "Pump set" }, { value: "sprayer", label: "Sprayer" },
  { value: "thresher", label: "Thresher" }, { value: "plough", label: "Plough" },
  { value: "hand_tools", label: "Hand tools" }, { value: "other", label: "Other" },
];
export const BENCHMARK_OPTS: FieldOption[] = [
  { value: "above", label: "Above average" }, { value: "at", label: "About average" }, { value: "below", label: "Below average" },
];
export const GRADIENT_OPTS: FieldOption[] = [
  { value: "lt_5", label: "<5%" }, { value: "5_10", label: "5%–10%" },
  { value: "10_30", label: "10%–30%" }, { value: "gt_30", label: ">30%" },
];
export const WATERLOGGING_OPTS: FieldOption[] = [
  { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" },
];
export const SUNLIGHT_OPTS: FieldOption[] = [
  { value: "lt_5", label: "<5%" }, { value: "5_10", label: "5%–10%" }, { value: "10_30", label: "10%–30%" },
  { value: "30_50", label: "30%–50%" }, { value: "gt_50", label: ">50%" },
];
export const FENCING_OPTS: FieldOption[] = [
  { value: "none", label: "None" }, { value: "natural", label: "Natural" }, { value: "stone_pitch", label: "Stone pitch" },
  { value: "wire_fence", label: "Wire fence" }, { value: "boundary_wall", label: "Boundary wall" },
];

// Human label for each raw dynamic-field key (as it appears in a version's
// `data` snapshot / the merged farmer/farm/plot object).
export const FIELD_LABELS: Record<string, string> = {
  seeds: "Seed packages",
  financialCapacity: "Financial capacity",
  landholding: "Landholding",
  adoptionLevel: "Adoption level",
  treeCountBig: "Big trees",
  treeCountSmall: "Small trees",
  mobileCoverage: "Mobile coverage",
  shapeOverride: "Farm shape",
  plotSizeSqFtOverride: "Plot size override (sq ft)",
  plotSizeHectOverride: "Plot size override (hectares, legacy)",
  farmerFocus: "Farmer's visit frequency",
  waterSource: "Water source",
  irrigationAvailable: "Irrigation available",
  seasonsPossible: "Seasons possible",
  seasonsPossibleOther: "Seasons — other",
  knownIssues: "Known issues",
  knownIssuesOther: "Known issues — other",
  previousCrop: "Previous crop",
  previousCropProduction: "Previous crop production",
  animalPressure: "Animal pressure",
  animalPressureOther: "Animal pressure — other",
  accessibility: "Accessibility",
  toolsAvailable: "Tools available",
  toolsAvailableOther: "Tools — other",
  gradient: "Gradient",
  waterloggingProbability: "Waterlogging probability",
  sunlightAvailability: "Sunlight availability",
  fencingAvailability: "Fencing availability",
  crop: "Crop",
  sowingDate: "Sowing date",
};

const VALUE_LABELS: Record<string, Record<string, string>> = Object.fromEntries(
  (
    [
      ["financialCapacity", FINANCIAL_CAPACITY_OPTS], ["landholding", LANDHOLDING_OPTS], ["adoptionLevel", ADOPTION_LEVEL_OPTS],
      ["mobileCoverage", MOBILE_COVERAGE_OPTS], ["shapeOverride", SHAPE_OPTS], ["farmerFocus", FARMER_FOCUS_OPTS],
      ["waterSource", WATER_SOURCE_OPTS], ["irrigationAvailable", IRRIGATION_OPTS], ["seasonsPossible", SEASON_OPTS],
      ["knownIssues", KNOWN_ISSUE_OPTS], ["animalPressure", ANIMAL_PRESSURE_OPTS], ["accessibility", ACCESSIBILITY_OPTS],
      ["toolsAvailable", TOOL_OPTS], ["vsBenchmark", BENCHMARK_OPTS], ["gradient", GRADIENT_OPTS],
      ["waterloggingProbability", WATERLOGGING_OPTS], ["sunlightAvailability", SUNLIGHT_OPTS], ["fencingAvailability", FENCING_OPTS],
    ] as [string, FieldOption[]][]
  ).map(([key, opts]) => [key, Object.fromEntries(opts.map((o) => [o.value, o.label]))])
);

function humanize(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] || humanize(key);
}

function valueLabel(fieldKey: string, raw: string): string {
  return VALUE_LABELS[fieldKey]?.[raw] || raw;
}

// Renders one dynamic-field's value as plain, human-readable text — used by
// both the compact "what changed" table preview and the full version
// snapshot view, so a reviewer never has to decode a raw enum code or JSON.
export function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (key === "seeds") {
      return (value as { seed: string; qty: number }[]).map((s) => `${s.seed} ×${s.qty}`).join(", ");
    }
    return value.map((v) => valueLabel(key, String(v))).join(", ");
  }
  if (typeof value === "object") {
    if (key === "previousCropProduction") {
      const v = value as { quintals?: number | null; vsBenchmark?: string | null };
      const parts: string[] = [];
      if (v.quintals !== null && v.quintals !== undefined) parts.push(`${v.quintals} quintals`);
      if (v.vsBenchmark) parts.push(valueLabel("vsBenchmark", v.vsBenchmark));
      return parts.length ? parts.join(", ") : "—";
    }
    return JSON.stringify(value);
  }
  return valueLabel(key, String(value));
}

// Non-empty [key, value] pairs from a dynamic-field snapshot, in a stable
// display order (falls back to insertion order for keys not listed here).
const DISPLAY_ORDER = Object.keys(FIELD_LABELS);
export function dynamicFieldRows(data: Record<string, unknown> | null | undefined): [string, unknown][] {
  const entries = Object.entries(data || {}).filter(([, v]) => {
    if (v === null || v === undefined || v === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });
  entries.sort(([a], [b]) => {
    const ia = DISPLAY_ORDER.indexOf(a), ib = DISPLAY_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  return entries;
}

function isEmptyValue(v: unknown): boolean {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

export interface DynamicFieldDiffRow {
  key: string;
  before: unknown;
  after: unknown;
}

// Fields that actually changed between one version's data and the version
// immediately before it (`previous`, from the API's previous_data — null for
// the very first version, in which case every non-empty field on `current`
// counts as newly set rather than "changed").
export function diffDynamicFields(
  current: Record<string, unknown> | null | undefined,
  previous: Record<string, unknown> | null | undefined
): DynamicFieldDiffRow[] {
  const cur = current || {};
  const prev = previous || {};
  const keys = new Set([...Object.keys(cur), ...Object.keys(prev)]);
  const rows: DynamicFieldDiffRow[] = [];
  for (const key of keys) {
    const after = (cur as Record<string, unknown>)[key];
    const before = (prev as Record<string, unknown>)[key];
    if (isEmptyValue(after) && isEmptyValue(before)) continue;
    if (JSON.stringify(after ?? null) === JSON.stringify(before ?? null)) continue;
    rows.push({ key, before, after });
  }
  rows.sort((a, b) => {
    const ia = DISPLAY_ORDER.indexOf(a.key), ib = DISPLAY_ORDER.indexOf(b.key);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  return rows;
}
