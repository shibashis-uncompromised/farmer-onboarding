// Central metadata for every dynamic (seasonally re-versioned) field across
// farmers, farms and plots: labels and select/multiselect option lists. Kept
// in one place so the admin edit forms (components/admin/Edit*Modal) and the
// version-history/approvals viewers (app/admin/versions, app/admin/approvals)
// never drift out of sync on what a raw field/value actually means.
//
// Labels are language-reactive: every label here is looked up from a
// translation key at call time via a `t` function (see src/lib/i18n), rather
// than baked in as a plain string, so this metadata renders correctly in
// whichever language the user has selected.

import type { EntityType, VersionStatus } from "./api";
import type { TranslationKey } from "./i18n/en";
import type { Language } from "./i18n/LanguageContext";
import { cropLabel } from "./crops";

export interface FieldOption { value: string; label: string }
export type TFunc = (key: TranslationKey, vars?: Record<string, string | number>) => string;

// Shared entity/status display metadata — one definition used by both the
// read-only Version History page and the approve/reject queue, so their
// badges and labels can never quietly diverge from each other.
export const ENTITY_LABEL_KEY: Record<EntityType, TranslationKey> = {
  farmer: "entity_farmer", farm: "entity_farm", plot: "entity_plot",
};
export const ENTITY_COLOR: Record<EntityType, string> = { farmer: "grape", farm: "blue", plot: "teal" };
export const STATUS_LABEL_KEY: Record<VersionStatus, TranslationKey> = {
  pending: "status_pending", current: "status_current", rejected: "status_rejected", retired: "status_retired",
};
export const STATUS_COLOR: Record<VersionStatus, string> = {
  pending: "yellow", current: "green", rejected: "red", retired: "gray",
};

// submitted_at/reviewed_at are BIGINT columns in Postgres, which node-postgres
// returns as strings (not numbers) — new Date("1756...") tries to parse that
// as a date STRING and fails ("Invalid Date"), rather than treating it as an
// epoch. Coerce defensively, same fix already used for soil_samples elsewhere
// in this app's backend.
export function fmtVersionDate(ms: number | string | null | undefined): string {
  if (ms === null || ms === undefined || ms === "") return "—";
  const n = typeof ms === "number" ? ms : Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Date(n).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

// Builds a `(t) => FieldOption[]` for one option category: `category` and
// each value combine into the translation key `opt_<category>_<value>` (see
// src/lib/i18n/en.ts). Called at render time — e.g. `waterSourceOpts(t)` —
// so option labels stay in sync with the current language.
function buildOpts<V extends string>(category: string, values: readonly V[]): (t: TFunc) => FieldOption[] {
  return (t: TFunc) => values.map((value) => ({ value, label: t(`opt_${category}_${value}` as TranslationKey) }));
}

export const FINANCIAL_CAPACITY_VALUES = ["low", "medium", "high"] as const;
export const LANDHOLDING_VALUES = ["lt_2_5", "between_2_5_10", "gt_10"] as const;
export const ADOPTION_LEVEL_VALUES = ["basic", "improved", "progressive", "advanced"] as const;
export const MOBILE_COVERAGE_VALUES = ["good", "weak", "none"] as const;
export const SHAPE_VALUES = ["rectangle", "square", "trapezoid", "irregular"] as const;
export const FARMER_FOCUS_VALUES = ["daily", "twice_weekly", "weekly_plus"] as const;
export const WATER_SOURCE_VALUES = ["rainfed", "borewell", "open_well", "farm_pond", "anicut_river"] as const;
export const IRRIGATION_VALUES = ["none", "flood", "sprinkler", "drip"] as const;
export const SEASON_VALUES = ["kharif", "rabi", "zaid", "other"] as const;
export const KNOWN_ISSUE_VALUES = ["termites", "nematodes", "frost", "flooding", "other"] as const;
export const ANIMAL_PRESSURE_VALUES = ["nilgai", "boar", "monkey", "rabbit", "birds", "other"] as const;
export const ACCESSIBILITY_VALUES = ["tractor", "small_machinery", "hand_tools"] as const;
export const TOOL_VALUES = ["tractor", "power_tiller", "pump_set", "sprayer", "thresher", "plough", "hand_tools", "other"] as const;
export const BENCHMARK_VALUES = ["above", "at", "below"] as const;
export const GRADIENT_VALUES = ["lt_5", "5_10", "10_30", "gt_30"] as const;
export const WATERLOGGING_VALUES = ["low", "medium", "high"] as const;
export const SUNLIGHT_VALUES = ["lt_5", "5_10", "10_30", "30_50", "gt_50"] as const;
export const FENCING_VALUES = ["none", "natural", "stone_pitch", "wire_fence", "boundary_wall"] as const;

export const financialCapacityOpts = buildOpts("financialCapacity", FINANCIAL_CAPACITY_VALUES);
export const landholdingOpts = buildOpts("landholding", LANDHOLDING_VALUES);
export const adoptionLevelOpts = buildOpts("adoptionLevel", ADOPTION_LEVEL_VALUES);
export const mobileCoverageOpts = buildOpts("mobileCoverage", MOBILE_COVERAGE_VALUES);
export const shapeOpts = buildOpts("shapeOverride", SHAPE_VALUES);
export const farmerFocusOpts = buildOpts("farmerFocus", FARMER_FOCUS_VALUES);
export const waterSourceOpts = buildOpts("waterSource", WATER_SOURCE_VALUES);
export const irrigationOpts = buildOpts("irrigationAvailable", IRRIGATION_VALUES);
export const seasonOpts = buildOpts("seasonsPossible", SEASON_VALUES);
export const knownIssueOpts = buildOpts("knownIssues", KNOWN_ISSUE_VALUES);
export const animalPressureOpts = buildOpts("animalPressure", ANIMAL_PRESSURE_VALUES);
export const accessibilityOpts = buildOpts("accessibility", ACCESSIBILITY_VALUES);
export const toolOpts = buildOpts("toolsAvailable", TOOL_VALUES);
export const benchmarkOpts = buildOpts("vsBenchmark", BENCHMARK_VALUES);
export const gradientOpts = buildOpts("gradient", GRADIENT_VALUES);
export const waterloggingOpts = buildOpts("waterloggingProbability", WATERLOGGING_VALUES);
export const sunlightOpts = buildOpts("sunlightAvailability", SUNLIGHT_VALUES);
export const fencingOpts = buildOpts("fencingAvailability", FENCING_VALUES);

// Categories keyed the same way a raw dynamic-field's value is looked up
// (fieldKey -> its values) — used to build OPTION_LABEL_KEYS below. Kept as
// plain value lists (not FieldOption[]) since only the value matters here.
const OPTION_CATEGORIES: [string, readonly string[]][] = [
  ["financialCapacity", FINANCIAL_CAPACITY_VALUES], ["landholding", LANDHOLDING_VALUES], ["adoptionLevel", ADOPTION_LEVEL_VALUES],
  ["mobileCoverage", MOBILE_COVERAGE_VALUES], ["shapeOverride", SHAPE_VALUES], ["farmerFocus", FARMER_FOCUS_VALUES],
  ["waterSource", WATER_SOURCE_VALUES], ["irrigationAvailable", IRRIGATION_VALUES], ["seasonsPossible", SEASON_VALUES],
  ["knownIssues", KNOWN_ISSUE_VALUES], ["animalPressure", ANIMAL_PRESSURE_VALUES], ["accessibility", ACCESSIBILITY_VALUES],
  ["toolsAvailable", TOOL_VALUES], ["vsBenchmark", BENCHMARK_VALUES], ["gradient", GRADIENT_VALUES],
  ["waterloggingProbability", WATERLOGGING_VALUES], ["sunlightAvailability", SUNLIGHT_VALUES], ["fencingAvailability", FENCING_VALUES],
];

// fieldKey -> raw value -> translation key for that value's label.
const OPTION_LABEL_KEYS: Record<string, Record<string, TranslationKey>> = Object.fromEntries(
  OPTION_CATEGORIES.map(([category, values]) => [
    category,
    Object.fromEntries(values.map((v) => [v, `opt_${category}_${v}` as TranslationKey])),
  ])
);

// Translation key for each raw dynamic-field key (as it appears in a
// version's `data` snapshot / the merged farmer/farm/plot object).
export const FIELD_LABEL_KEYS: Record<string, TranslationKey> = {
  seeds: "field_seeds",
  financialCapacity: "field_financialCapacity",
  landholding: "field_landholding",
  adoptionLevel: "field_adoptionLevel",
  treeCountBig: "field_treeCountBig",
  treeCountSmall: "field_treeCountSmall",
  mobileCoverage: "field_mobileCoverage",
  shapeOverride: "field_shapeOverride",
  plotSizeSqFtOverride: "field_plotSizeSqFtOverride",
  plotSizeHectOverride: "field_plotSizeHectOverride",
  farmerFocus: "field_farmerFocus",
  waterSource: "field_waterSource",
  irrigationAvailable: "field_irrigationAvailable",
  seasonsPossible: "field_seasonsPossible",
  seasonsPossibleOther: "field_seasonsPossibleOther",
  knownIssues: "field_knownIssues",
  knownIssuesOther: "field_knownIssuesOther",
  previousCrop: "field_previousCrop",
  previousCropProduction: "field_previousCropProduction",
  animalPressure: "field_animalPressure",
  animalPressureOther: "field_animalPressureOther",
  accessibility: "field_accessibility",
  toolsAvailable: "field_toolsAvailable",
  toolsAvailableOther: "field_toolsAvailableOther",
  gradient: "field_gradient",
  waterloggingProbability: "field_waterloggingProbability",
  sunlightAvailability: "field_sunlightAvailability",
  fencingAvailability: "field_fencingAvailability",
  crop: "field_crop",
  sowingDate: "field_sowingDate",
};

function humanize(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

export function fieldLabel(key: string, t: TFunc): string {
  const tk = FIELD_LABEL_KEYS[key];
  return tk ? t(tk) : humanize(key);
}

function valueLabel(fieldKey: string, raw: string, t: TFunc, language: Language = "en"): string {
  // "crop"/"previousCrop" are static entity data (closed crop vocabulary,
  // shared with the onboarding crop pickers) — translated via cropLabel(),
  // not the OPTION_LABEL_KEYS enum-option mechanism used by everything else.
  if (fieldKey === "crop" || fieldKey === "previousCrop") return cropLabel(raw, language);
  const tk = OPTION_LABEL_KEYS[fieldKey]?.[raw];
  return tk ? t(tk) : raw;
}

// Renders one dynamic-field's value as plain, human-readable text — used by
// both the compact "what changed" table preview and the full version
// snapshot view, so a reviewer never has to decode a raw enum code or JSON.
export function formatFieldValue(key: string, value: unknown, t: TFunc, language: Language = "en"): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (key === "seeds") {
      return (value as { seed: string; qty: number }[]).map((s) => `${s.seed} ×${s.qty}`).join(", ");
    }
    return value.map((v) => valueLabel(key, String(v), t, language)).join(", ");
  }
  if (typeof value === "object") {
    if (key === "previousCropProduction") {
      const v = value as { quintals?: number | null; vsBenchmark?: string | null };
      const parts: string[] = [];
      if (v.quintals !== null && v.quintals !== undefined) parts.push(`${v.quintals} ${t("unit_quintals")}`);
      if (v.vsBenchmark) parts.push(valueLabel("vsBenchmark", v.vsBenchmark, t));
      return parts.length ? parts.join(", ") : "—";
    }
    return JSON.stringify(value);
  }
  return valueLabel(key, String(value), t, language);
}

// Non-empty [key, value] pairs from a dynamic-field snapshot, in a stable
// display order (falls back to insertion order for keys not listed here).
const DISPLAY_ORDER = Object.keys(FIELD_LABEL_KEYS);
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
