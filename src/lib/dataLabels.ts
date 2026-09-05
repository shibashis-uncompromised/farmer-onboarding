// "Static entity data label" translation layer — separate from the "common"
// UI-string dictionary (src/lib/i18n/en.ts + hi.ts), mirroring the split used
// in the TerraOS frontend's src/composables/useDataLabels.ts.
//
// The idea: closed-vocabulary reference data (crop names, state/district
// names, preset village names) is looked up by its raw English value — the
// same value stored in the DB and sent to the backend — rather than by a
// minted enum key. That keeps the stored/sent value untouched while only the
// on-screen label changes with the language toggle, and it's cheap to extend
// (one new dictionary entry per new crop/district/village, no new
// TranslationKey to thread through every call site).
//
// Only Hindi needs a dictionary: for English the raw value already *is* the
// display label, so translateName() short-circuits and returns it unchanged.
//
// If this data ever needs to come from the backend instead of being baked in
// at build time (e.g. per-tenant crop lists), only this file's internals
// need to change — every call site keeps calling translateName()/the
// convenience wrappers/useDataLabels() exactly as it does today.

import { useLanguage, type Language } from "./i18n/LanguageContext";
import { staticHi, type DataLabelCategory } from "./i18n/static/hi";
import { transliterateName } from "./transliterate";

export type { DataLabelCategory };

/**
 * Translated display label for a raw static-entity value (a crop name, a
 * state, a district, a village name/block). Resolution order:
 *  1. Exact match in the static dictionary for that category.
 *  2. Case-insensitive match in the same dictionary.
 *  3. For villages/blocks only — these are free text a field user typed
 *     (unlike crops/states/districts, which only ever come from a fixed
 *     dropdown), so a village created after this dictionary was written has
 *     no entry on file. Rather than leave it in English, fall back to the
 *     same best-effort phonetic transliteration used for farmer names
 *     (src/lib/transliterate.ts) — same tradeoff: usually right, occasionally
 *     approximate for unusual spellings.
 *  4. English, or a value with no dictionary entry and not a village/block
 *     (e.g. a crop/district added to the app without a translation yet) —
 *     the raw value itself, unchanged.
 * Never throws — worst case, an untranslated or approximate value is shown.
 */
export function translateName(
  category: DataLabelCategory,
  name: string | null | undefined,
  language: Language,
): string {
  if (!name) return name ?? "";
  if (language === "en") return name;
  const dict = staticHi[category];
  if (dict[name]) return dict[name];
  const lower = name.toLowerCase();
  const hitKey = Object.keys(dict).find((k) => k.toLowerCase() === lower);
  if (hitKey) return dict[hitKey];
  if (category === "villages" || category === "blocks") return transliterateName(name);
  return name;
}

export function hasTranslation(category: DataLabelCategory, name: string | null | undefined, language: Language): boolean {
  if (!name || language === "en") return language === "en" && !!name;
  const dict = staticHi[category];
  if (dict[name]) return true;
  const lower = name.toLowerCase();
  return Object.keys(dict).some((k) => k.toLowerCase() === lower);
}

export function getAllTranslations(category: DataLabelCategory): Record<string, string> {
  return staticHi[category];
}

// ---- Convenience wrappers, one per category ----
export const getCropLabel = (name: string | null | undefined, language: Language) => translateName("crops", name, language);
export const getStateLabel = (name: string | null | undefined, language: Language) => translateName("states", name, language);
export const getDistrictLabel = (name: string | null | undefined, language: Language) => translateName("districts", name, language);
export const getVillageLabel = (name: string | null | undefined, language: Language) => translateName("villages", name, language);
export const getBlockLabel = (name: string | null | undefined, language: Language) => translateName("blocks", name, language);

/**
 * React-hook equivalent of TerraOS's `useDataLabels()` composable — reads the
 * current language off context so components don't have to thread it
 * through every call themselves.
 */
export function useDataLabels() {
  const { language } = useLanguage();
  return {
    language,
    translateName: (category: DataLabelCategory, name: string | null | undefined) => translateName(category, name, language),
    getCropLabel: (name: string | null | undefined) => getCropLabel(name, language),
    getStateLabel: (name: string | null | undefined) => getStateLabel(name, language),
    getDistrictLabel: (name: string | null | undefined) => getDistrictLabel(name, language),
    getVillageLabel: (name: string | null | undefined) => getVillageLabel(name, language),
    getBlockLabel: (name: string | null | undefined) => getBlockLabel(name, language),
  };
}
