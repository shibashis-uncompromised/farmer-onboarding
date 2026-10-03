// Crop choices for plots. Edit to change the list.
//
// The English string here is also the VALUE stored/sent to the backend, so
// it must never change once farms are already using it — only the display
// LABEL is translated, via cropLabel()/cropOpts()/previousCropOpts() below.
// Hindi labels live in src/lib/i18n/static/hi.ts (the "static entity data
// label" dictionary, separate from src/lib/i18n/en.ts + hi.ts) — add an
// entry under `crops` there whenever a crop is added here.

import type { Language } from "./i18n/LanguageContext";
import { getCropLabel } from "./dataLabels";

export const CROPS = [
  "Groundnut", "Sesamum", "Sunflower", "Paddy", "Rice", "Urad", "Turmeric",
  // 2026 onboarding portfolio (trials included)
  "Ajwain (TRIAL)",
  "Ashwagandha (TRIAL)",
  "Barley (jau)",
  "Black Chana",
  "Kabuli Chana",
  "Chia",
  "Coriander (seed)",
  "Cumin",
  "Dried Spinach (palak)",
  "Fennel (saunf)",
  "Field Pea (protein/PoV)",
  "Flaxseed (linseed)",
  "Garlic",
  "Isabgol (psyllium)",
  "Kasuri methi (dried)",
  "Methi (fenugreek) seed",
  "Black Mustard",
  "Yellow Mustard",
  "Oats",
  "Potato (semi-perishable)",
  "Quinoa (TRIAL)",
  "Red chilli (dry)",
  "Safflower (oil)",
  "Sugarbeet (TRIAL, industrial)",
  "Sun-dried Tomato",
  "Masoor",
  "Wheat - Black (trial)",
  "Wheat - Khapli (emmer)",
  "Wheat - Sona-Moti (trial)",
  "Wheat - Sharbati",
];

// Appends any current-season crop missing from the previous-crop list, so a
// crop added to CROPS is always selectable as a previous crop too.
function withNewCrops(list: string[]): string[] {
  return [...list, ...CROPS.filter((c) => !list.includes(c))];
}

export const PREVIOUS_CROPS = withNewCrops([
  "NA",
  "Paddy",
  "Wheat",
  "Maize",
  "Bajra (Pearl millet)",
  "Jowar (Sorghum)",
  "Ragi",
  "Groundnut",
  "Soybean",
  "Mustard",
  "Sesamum",
  "Cotton",
  "Sugarcane",
  "Gram (Chickpea)",
  "Arhar/Tur",
  "Moong",
  "Urad",
  "Masoor",
  "Pea",
  "Potato",
  "Onion",
  "Tomato",
  "Chilli",
  "Coriander",
  "Cumin",
  "Fennel",
  "Turmeric",
  "Vegetables/Mixed",
  "Fodder",
  "Fallow",
]);

// Translated display label for a raw crop value — falls back to the raw
// value itself when it isn't one of the known crops (e.g. legacy free text
// typed before this list existed, or a value from an unrelated field).
export function cropLabel(raw: string | null | undefined, language: Language): string {
  return getCropLabel(raw, language);
}

// {value, label} pairs for Select/Autocomplete `data` props — value stays
// the English string (sent to/stored via the backend); label is the current
// language's translation.
export const cropOpts = (language: Language) => CROPS.map((value) => ({ value, label: cropLabel(value, language) }));
export const previousCropOpts = (language: Language) => PREVIOUS_CROPS.map((value) => ({ value, label: cropLabel(value, language) }));
