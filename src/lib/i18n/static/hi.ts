// Hindi labels for "static entity data" — closed-vocabulary reference data
// (crop names, state/district names, preset village names) that the backend
// stores and expects back in English, but which we want to *display* in the
// user's chosen language.
//
// This is intentionally a separate layer from src/lib/i18n/en.ts + hi.ts
// (the "common" UI-string dictionary keyed by TranslationKey enum). Static
// data labels are instead keyed by the *raw English value itself* — the same
// value that's stored/sent to the backend — so a new crop/district/village
// only needs one new entry here, not a new enum key threaded through the
// rest of the app. See src/lib/i18n/dataLabels.ts for the lookup logic
// (exact match -> case-insensitive match -> original value unchanged).
//
// Field-created ("dynamic") villages have no entry here on purpose — there's
// no way to know a name typed in the field ahead of time, so those are shown
// exactly as typed, in every language, same as any other free text field.

export type DataLabelCategory = "crops" | "states" | "districts" | "villages" | "blocks";

export const staticHi: Record<DataLabelCategory, Record<string, string>> = {
  crops: {
    "Groundnut": "मूंगफली",
    "Sesamum": "तिल",
    "Sunflower": "सूरजमुखी",
    "Paddy": "धान",
    "Rice": "चावल",
    "Urad": "उड़द",
    "Turmeric": "हल्दी",
    "NA": "लागू नहीं",
    "Wheat": "गेहूं",
    "Maize": "मक्का",
    "Bajra (Pearl millet)": "बाजरा (पर्ल मिलेट)",
    "Jowar (Sorghum)": "ज्वार (सोरघम)",
    "Ragi": "रागी",
    "Soybean": "सोयाबीन",
    "Mustard": "सरसों",
    "Cotton": "कपास",
    "Sugarcane": "गन्ना",
    "Gram (Chickpea)": "चना",
    "Arhar/Tur": "अरहर/तूर",
    "Moong": "मूंग",
    "Masoor": "मसूर",
    "Pea": "मटर",
    "Potato": "आलू",
    "Onion": "प्याज",
    "Tomato": "टमाटर",
    "Chilli": "मिर्च",
    "Coriander": "धनिया",
    "Cumin": "जीरा",
    "Fennel": "सौंफ",
    "Vegetables/Mixed": "सब्ज़ियां/मिश्रित",
    "Fodder": "चारा",
    "Fallow": "परती (खाली भूमि)",
    // 2026 onboarding portfolio (trials included)
    "Ajwain (TRIAL)": "अजवायन (ट्रायल)",
    "Ashwagandha (TRIAL)": "अश्वगंधा (ट्रायल)",
    "Barley (jau)": "जौ",
    "Black Chana": "काला चना",
    "Kabuli Chana": "काबुली चना",
    "Chia": "चिया",
    "Coriander (seed)": "धनिया (बीज)",
    "Dried Spinach (palak)": "सूखी पालक",
    "Fennel (saunf)": "सौंफ",
    "Field Pea (protein/PoV)": "फील्ड मटर (प्रोटीन/PoV)",
    "Flaxseed (linseed)": "अलसी",
    "Garlic": "लहसुन",
    "Isabgol (psyllium)": "इसबगोल",
    "Kasuri methi (dried)": "कसूरी मेथी (सूखी)",
    "Methi (fenugreek) seed": "मेथी (बीज)",
    "Black Mustard": "काली सरसों",
    "Yellow Mustard": "पीली सरसों",
    "Oats": "जई",
    "Potato (semi-perishable)": "आलू (अर्ध-नाशवान)",
    "Quinoa (TRIAL)": "क्विनोआ (ट्रायल)",
    "Red chilli (dry)": "लाल मिर्च (सूखी)",
    "Safflower (oil)": "कुसुम (तेल)",
    "Sugarbeet (TRIAL, industrial)": "चुकंदर (ट्रायल, औद्योगिक)",
    "Sun-dried Tomato": "धूप में सुखाया टमाटर",
    "Wheat - Black (trial)": "गेहूं - काला (ट्रायल)",
    "Wheat - Khapli (emmer)": "गेहूं - खपली (एमर)",
    "Wheat - Sona-Moti (trial)": "गेहूं - सोना-मोती (ट्रायल)",
    "Wheat - Sharbati": "गेहूं - शरबती",
  },
  states: {
    "Rajasthan": "राजस्थान",
    "Madhya Pradesh": "मध्य प्रदेश",
    "Gujarat": "गुजरात",
  },
  districts: {
    // Rajasthan
    "Ajmer": "अजमेर", "Alwar": "अलवर", "Banswara": "बांसवाड़ा", "Baran": "बारां",
    "Barmer": "बाड़मेर", "Bharatpur": "भरतपुर", "Bhilwara": "भीलवाड़ा", "Bikaner": "बीकानेर",
    "Bundi": "बूंदी", "Chittaurgarh": "चित्तौड़गढ़", "Churu": "चूरू", "Dausa": "दौसा",
    "Dhaulpur": "धौलपुर", "Dungarpur": "डूंगरपुर", "Jaipur": "जयपुर", "Jaisalmer": "जैसलमेर",
    "Jalor": "जालोर", "Jhalawar": "झालावाड़", "Jhunjhunun": "झुंझुनू", "Jodhpur": "जोधपुर",
    "Karauli": "करौली", "Kota": "कोटा", "Nagaur": "नागौर", "Pali": "पाली",
    "Pratapgarh": "प्रतापगढ़", "Rajsamand": "राजसमंद", "Sawai Madhopur": "सवाई माधोपुर",
    "Sikar": "सीकर", "Sirohi": "सिरोही", "Tonk": "टोंक", "Udaipur": "उदयपुर",
    // Madhya Pradesh
    "Alirajpur": "अलीराजपुर", "Anuppur": "अनूपपुर", "Ashoknagar": "अशोकनगर",
    "Balaghat": "बालाघाट", "Barwani": "बड़वानी", "Betul": "बैतूल", "Bhind": "भिंड",
    "Bhopal": "भोपाल", "Burhanpur": "बुरहानपुर", "Chhatarpur": "छतरपुर",
    "Chhindwara": "छिंदवाड़ा", "Damoh": "दमोह", "Datia": "दतिया", "Dewas": "देवास",
    "Dhar": "धार", "Dindori": "डिंडोरी", "Guna": "गुना", "Gwalior": "ग्वालियर",
    "Harda": "हरदा", "Hoshangabad": "होशंगाबाद", "Indore": "इंदौर", "Jabalpur": "जबलपुर",
    "Jhabua": "झाबुआ", "Katni": "कटनी", "Khandwa": "खंडवा", "Khargone": "खरगोन",
    "Mandla": "मंडला", "Mandsaur": "मंदसौर", "Morena": "मुरैना",
    "Narsimhapur": "नरसिंहपुर", "Neemuch": "नीमच", "Panna": "पन्ना",
    "Raisen": "रायसेन", "Rajgarh": "राजगढ़", "Ratlam": "रतलाम", "Rewa": "रीवा",
    "Sagar": "सागर", "Satna": "सतना", "Sehore": "सीहोर", "Seoni": "सिवनी",
    "Shahdol": "शहडोल", "Shajapur": "शाजापुर", "Sheopur": "श्योपुर",
    "Shivpuri": "शिवपुरी", "Sidhi": "सीधी", "Singrauli": "सिंगरौली",
    "Tikamgarh": "टीकमगढ़", "Ujjain": "उज्जैन", "Umaria": "उमरिया", "Vidisha": "विदिशा",
    // Gujarat
    "Ahmadabad": "अहमदाबाद", "Amreli": "अमरेली", "Anand": "आणंद",
    "Banas Kantha": "बनासकांठा", "Bharuch": "भरूच", "Bhavnagar": "भावनगर",
    "Dohad": "दाहोद", "Gandhinagar": "गांधीनगर", "Jamnagar": "जामनगर",
    "Junagadh": "जूनागढ़", "Kachchh": "कच्छ", "Kheda": "खेड़ा",
    "Mahesana": "मेहसाणा", "Narmada": "नर्मदा", "Navsari": "नवसारी",
    "Panch Mahals": "पंचमहाल", "Patan": "पाटन", "Porbandar": "पोरबंदर",
    "Rajkot": "राजकोट", "Sabar Kantha": "साबरकांठा", "Surat": "सूरत",
    "Surendranagar": "सुरेंद्रनगर", "Tapi": "तापी", "The Dangs": "डांग",
    "Vadodara": "वडोदरा", "Valsad": "वलसाड",
  },
  // Preset villages only — keyed by name. Field-created villages fall
  // through to the raw name unchanged (see dataLabels.ts).
  villages: {
    "Udai": "उदय",
    "Belua 1": "बेलुआ 1",
    "Belua 2": "बेलुआ 2",
    "Velua": "वेलुआ",
    "Aamod": "आमोद",
    "Fatehpur": "फतेहपुर",
    "Sundrel": "सुंदरेल",
    "Ajjini": "अज्जिनी",
    "Junagadh": "जूनागढ़",
  },
  // Blocks/tehsils for the preset villages above (free text on Neoperk, not
  // validated by the API — still worth translating for display).
  blocks: {
    "Sarada": "सराड़ा",
    "Jhadol": "झाडोल",
    "Khamnor": "खमनोर",
    "Sundrel": "सुंदरेल",
    "Ajjini": "अज्जिनी",
    "Junagadh": "जूनागढ़",
  },
};
