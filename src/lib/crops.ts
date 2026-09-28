// Crop choices for plots. Edit to change the list.

// Crops in the 2026 onboarding portfolio (trials included). Kept in one place
// so both the current-crop and previous-crop pickers stay in sync.
const ONBOARDING_CROPS_2026 = [
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

// Append any onboarding crop not already in the base list (exact match).
const withNewCrops = (base: string[]) => [
  ...base,
  ...ONBOARDING_CROPS_2026.filter((c) => !base.includes(c)),
];

export const CROPS = withNewCrops(["Groundnut", "Sesamum", "Sunflower", "Paddy", "Rice", "Urad", "Turmeric"]);

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
