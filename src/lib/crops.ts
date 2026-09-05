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

export const CROPS = ["Groundnut", "Sesamum", "Sunflower", "Paddy", "Rice", "Urad", "Turmeric"];

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
];

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
