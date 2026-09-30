// Best-effort English -> Devanagari (Hindi script) NAME transliteration —
// deliberately separate from src/lib/dataLabels.ts's closed-vocabulary
// static labels (crops/states/districts/villages). A person's name isn't a
// closed list, so there's nothing to pre-translate exhaustively; instead
// this converts the SAME name by sound into Devanagari script.
//
// Two layers, in order:
//  1. NAME_DICTIONARY — common Indian first names & surnames, spelled
//     correctly by hand. Casual English spelling collapses vowel-length
//     distinctions Devanagari makes explicit (e.g. "Sagar" -> सागर, not
//     the "सगर" a naive letter-by-letter pass would produce), so this is
//     what makes the common cases actually right rather than approximate.
//  2. A phonetic fallback for anything not in the dictionary — a simple
//     consonant/vowel transliteration engine. It gets the general shape of
//     a name right, but can't recover vowel-length or dental/retroflex
//     distinctions that plain English spelling doesn't mark, so unusual
//     names may come out slightly off. Extend NAME_DICTIONARY below with
//     any name that needs a correction — that always wins over the
//     algorithm.
//
// Used for DISPLAY ONLY. Never call this on a value that gets stored,
// searched against, exported, or sent to the backend — those must keep the
// name exactly as the person typed it (same rule as crops/villages).

export const NAME_DICTIONARY: Record<string, string> = {
  // ---- Common male first names ----
  "ram": "राम", "shyam": "श्याम", "mohan": "मोहन", "sohan": "सोहन", "suresh": "सुरेश",
  "ramesh": "रमेश", "mahesh": "महेश", "rajesh": "राजेश", "rakesh": "राकेश", "naresh": "नरेश",
  "dinesh": "दिनेश", "mukesh": "मुकेश", "umesh": "उमेश", "yogesh": "योगेश", "ganesh": "गणेश",
  "hitesh": "हितेश", "nilesh": "नीलेश", "jitesh": "जितेश", "ritesh": "रितेश", "amit": "अमित",
  "sumit": "सुमित", "rohit": "रोहित", "mohit": "मोहित", "ankit": "अंकित", "vikas": "विकास",
  "vikram": "विक्रम", "vijay": "विजय", "ajay": "अजय", "sanjay": "संजय", "manoj": "मनोज",
  "anil": "अनिल", "sunil": "सुनील", "kapil": "कपिल", "nikhil": "निखिल", "rahul": "राहुल",
  "rohan": "रोहन", "kishan": "किशन", "krishan": "कृष्ण", "krishna": "कृष्ण", "kanhaiya": "कन्हैया",
  "gopal": "गोपाल", "shankar": "शंकर", "shiv": "शिव", "shivraj": "शिवराज", "raj": "राज",
  "rajendra": "राजेन्द्र", "surendra": "सुरेन्द्र", "mahendra": "महेन्द्र", "narendra": "नरेन्द्र",
  "devendra": "देवेन्द्र", "bhupendra": "भूपेन्द्र", "jitendra": "जितेन्द्र", "virendra": "वीरेन्द्र",
  "yogendra": "योगेन्द्र", "dharmendra": "धर्मेन्द्र", "upendra": "उपेन्द्र", "ravindra": "रविन्द्र",
  "ravi": "रवि", "om": "ॐ", "omprakash": "ओमप्रकाश", "prakash": "प्रकाश", "vinod": "विनोद",
  "pramod": "प्रमोद", "subhash": "सुभाष", "vishnu": "विष्णु", "vishal": "विशाल", "pankaj": "पंकज",
  "deepak": "दीपक", "pradeep": "प्रदीप", "sandeep": "संदीप", "sudhir": "सुधीर", "ashok": "अशोक",
  "arun": "अरुण", "varun": "वरुण", "tarun": "तरुण", "bharat": "भरत", "prem": "प्रेम", "kamal": "कमल",
  "vimal": "विमल", "nirmal": "निर्मल", "kamlesh": "कमलेश", "kailash": "कैलाश", "chandra": "चन्द्र",
  "shekhar": "शेखर", "chandan": "चंदन", "madan": "मदन", "roshan": "रोशन", "kishore": "किशोर",
  "manohar": "मनोहर", "balram": "बलराम", "balwant": "बलवंत", "balbir": "बलबीर", "basant": "बसंत",
  "vasant": "वसंत", "girish": "गिरीश", "manish": "मनीष", "naveen": "नवीन", "praveen": "प्रवीण",
  "sachin": "सचिन", "nitin": "नितिन", "vinay": "विनय", "ajit": "अजीत", "amar": "अमर",
  "amarjeet": "अमरजीत", "uday": "उदय", "veer": "वीर", "veerendra": "वीरेन्द्र", "bahadur": "बहादुर",
  "fateh": "फतेह", "karan": "करण", "devraj": "देवराज", "devilal": "देवीलाल", "ramlal": "रामलाल",
  "shyamlal": "श्यामलाल", "mohanlal": "मोहनलाल", "sohanlal": "सोहनलाल", "bherulal": "भेरूलाल",
  "bheru": "भेरू", "nathulal": "नाथूलाल", "nathu": "नाथू", "chunnilal": "चुन्नीलाल", "mangilal": "मांगीलाल",
  "mangal": "मंगल", "girdhari": "गिरधारी", "hariram": "हरिराम", "hari": "हरि", "harish": "हरीश",
  "harilal": "हरिलाल", "ishwar": "ईश्वर", "ishwarlal": "ईश्वरलाल", "jagdish": "जगदीश", "jagat": "जगत",
  "jagatram": "जगतराम", "jaswant": "जसवंत", "kalu": "कालू", "kaluram": "कालूराम", "khem": "खेम",
  "khemraj": "खेमराज", "lal": "लाल", "laluram": "लालूराम", "madho": "माधो", "madholal": "माधोलाल",
  "mangu": "मांगू", "narayan": "नारायण", "narayanlal": "नारायणलाल", "onkar": "ओंकार", "onkarlal": "ओंकारलाल",
  "panna": "पन्ना", "pannalal": "पन्नालाल", "prithvi": "पृथ्वी", "prithviraj": "पृथ्वीराज", "rup": "रूप",
  "ruplal": "रूपलाल", "sagar": "सागर", "sajjan": "सज्जन", "sampat": "सम्पत", "sultan": "सुल्तान",
  "tej": "तेज", "tejram": "तेजराम", "tejsingh": "तेजसिंह", "bhoora": "भूरा", "bhura": "भूरा",
  "kesharam": "केसाराम", "kesha": "केसा", "deva": "देवा", "devji": "देवजी", "punja": "पूंजा",
  "gokul": "गोकुल", "bheema": "भीमा", "ghisa": "घीसा", "roopa": "रूपा", "hiralal": "हीरालाल",
  "hira": "हीरा", "mana": "माना", "gopi": "गोपी", "kalya": "कल्या", "bhagwan": "भगवान",
  "bhagirath": "भागीरथ", "amra": "अमरा", "amru": "अमरू", "vaju": "वाजू", "rama": "रामा",
  "ramji": "रामजी", "patel": "पटेल", "amrutlal": "अमृतलाल", "ratanlal": "रतनलाल", "ratanji": "रतनजी",
  "jivraj": "जीवराज", "jiva": "जीवा", "rambhai": "रामभाई", "kantilal": "कांतिलाल", "bhikha": "भीखा",
  "bhikhabhai": "भीखाभाई", "nathubhai": "नाथूभाई", "dahyabhai": "दहयाभाई", "manubhai": "मनुभाई",
  "vinubhai": "विनुभाई", "rasikbhai": "रसिकभाई",
  // ---- Common female first names ----
  "sita": "सीता", "gita": "गीता", "geeta": "गीता", "radha": "राधा", "rekha": "रेखा", "meena": "मीना",
  "meera": "मीरा", "kavita": "कविता", "savita": "सविता", "lalita": "ललिता", "sunita": "सुनीता",
  "sarita": "सरिता", "anita": "अनीता", "vanita": "वनिता", "kanta": "कांता", "shanta": "शांता",
  "kamla": "कमला", "vimla": "विमला", "nirmala": "निर्मला", "pushpa": "पुष्पा", "sushma": "सुषमा",
  "usha": "उषा", "asha": "आशा", "nisha": "निशा", "manisha": "मनीषा", "rukmani": "रुक्मणी",
  "sundari": "सुंदरी", "devi": "देवी", "durga": "दुर्गा", "parvati": "पार्वती", "lakshmi": "लक्ष्मी",
  "laxmi": "लक्ष्मी", "saraswati": "सरस्वती", "mamta": "ममता", "sheela": "शीला", "shanti": "शांति",
  "kaveri": "कावेरी", "champa": "चंपा", "chameli": "चमेली", "jamuna": "जमुना", "kesar": "केसर",
  "kesarbai": "केसरबाई", "bhagwati": "भगवती", "sona": "सोना", "sonabai": "सोनाबाई", "gori": "गोरी",
  "gaura": "गौरा", "tulsi": "तुलसी", "tulsibai": "तुलसीबाई", "mangibai": "मांगीबाई", "kali": "काली",
  "kalibai": "कालीबाई", "amba": "अंबा", "ambika": "अंबिका", "uma": "उमा", "gauri": "गौरी",
  // ---- Common surnames ----
  "chaudhary": "चौधरी", "chowdhary": "चौधरी", "meghwal": "मेघवाल", "bhil": "भील", "garasia": "गरासिया",
  "damor": "डामोर", "ninama": "निनामा", "katara": "कटारा", "rawat": "रावत", "rathore": "राठौड़",
  "rathod": "राठौड़", "solanki": "सोलंकी", "sisodia": "सिसोदिया", "chundawat": "चूण्डावत",
  "chouhan": "चौहान", "chauhan": "चौहान", "panwar": "पंवार", "parmar": "परमार", "gehlot": "गहलोत",
  "bhati": "भाटी", "bhandari": "भंडारी", "jat": "जाट", "gurjar": "गुर्जर", "gujjar": "गुज्जर",
  "mali": "माली", "kumhar": "कुम्हार", "suthar": "सुथार", "nai": "नाई", "regar": "रेगर",
  "balai": "बलाई", "jogi": "जोगी", "yogi": "योगी", "charan": "चारण", "bhat": "भाट",
  "pandit": "पंडित", "pandey": "पांडे", "sharma": "शर्मा", "verma": "वर्मा", "gupta": "गुप्ता",
  "agarwal": "अग्रवाल", "singh": "सिंह", "yadav": "यादव", "kushwaha": "कुशवाहा", "prajapati": "प्रजापति",
  "vaishnav": "वैष्णव", "jain": "जैन", "mahajan": "महाजन", "rajput": "राजपूत", "modi": "मोदी",
  "shah": "शाह", "mehta": "मेहता", "desai": "देसाई", "trivedi": "त्रिवेदी", "joshi": "जोशी",
  "dave": "दवे", "pandya": "पंड्या", "vyas": "व्यास", "thakur": "ठाकुर", "raut": "राउत",
  "barot": "बारोट", "rabari": "रबारी", "bharwad": "भरवाड़", "koli": "कोली", "baraiya": "बारैया",
  // ---- Relation words used in the C/o (care-of) field ----
  "farmer": "किसान", "demo": "डेमो",
};

// ---- Phonetic fallback for anything not in the dictionary above ----

// Multi-letter consonants, longest match first.
const CONSONANTS: [string, string][] = [
  ["ksh", "क्ष"], ["chh", "छ"], ["gya", "ज्ञ"], ["shr", "श्र"],
  ["kh", "ख"], ["gh", "घ"], ["ch", "च"], ["jh", "झ"], ["ny", "ञ"],
  ["th", "थ"], ["dh", "ध"], ["ph", "फ"], ["bh", "भ"], ["sh", "श"], ["ng", "ङ"],
  ["b", "ब"], ["c", "क"], ["d", "द"], ["f", "फ़"], ["g", "ग"], ["h", "ह"],
  ["j", "ज"], ["k", "क"], ["l", "ल"], ["m", "म"], ["n", "न"], ["p", "प"],
  ["q", "क़"], ["r", "र"], ["s", "स"], ["t", "त"], ["v", "व"], ["w", "व"],
  ["x", "क्स"], ["y", "य"], ["z", "ज़"],
];

// Vowels, longest match first. `indep` = standalone letter (word start /
// after another vowel); `matra` = the sign attached to a preceding
// consonant ("" for the plain "a" sound, which is Devanagari's default).
const VOWELS: [string, { indep: string; matra: string }][] = [
  ["aa", { indep: "आ", matra: "ा" }], ["ee", { indep: "ई", matra: "ी" }],
  ["ii", { indep: "ई", matra: "ी" }], ["oo", { indep: "ऊ", matra: "ू" }],
  ["uu", { indep: "ऊ", matra: "ू" }], ["ai", { indep: "ऐ", matra: "ै" }],
  ["au", { indep: "औ", matra: "ौ" }],
  ["a", { indep: "अ", matra: "" }], ["i", { indep: "इ", matra: "ि" }],
  ["u", { indep: "उ", matra: "ु" }], ["e", { indep: "ए", matra: "े" }],
  ["o", { indep: "ओ", matra: "ो" }],
];

function phoneticConvert(raw: string): string {
  const w = raw.toLowerCase();
  let out = "";
  let lastWasConsonant = false;
  let i = 0;
  while (i < w.length) {
    const cons = CONSONANTS.find(([latin]) => w.startsWith(latin, i));
    if (cons) {
      if (lastWasConsonant) out += "्"; // virama joins a consonant cluster
      out += cons[1];
      i += cons[0].length;
      lastWasConsonant = true;
      continue;
    }
    const vow = VOWELS.find(([latin]) => w.startsWith(latin, i));
    if (vow) {
      out += lastWasConsonant ? vow[1].matra : vow[1].indep;
      i += vow[0].length;
      lastWasConsonant = false;
      continue;
    }
    // Punctuation, digits, spaces — pass through unchanged.
    out += w[i];
    i += 1;
    lastWasConsonant = false;
  }
  return out;
}

/** Transliterates one word (dictionary first, phonetic fallback second). */
export function transliterateWord(word: string): string {
  if (!word) return word;
  const key = word.toLowerCase().replace(/[^a-z]/g, "");
  if (key && NAME_DICTIONARY[key]) return NAME_DICTIONARY[key];
  return phoneticConvert(word);
}

/**
 * Transliterates a full name (possibly several words) word-by-word, so
 * "Sagar Chaudhary" becomes "सागर चौधरी". Never throws; passes through
 * empty/null/undefined unchanged.
 */
export function transliterateName(fullName: string | null | undefined): string {
  if (!fullName) return fullName ?? "";
  return fullName
    .split(/(\s+)/) // keep whitespace runs as their own tokens so spacing is preserved
    .map((part) => (/\s/.test(part) ? part : transliterateWord(part)))
    .join("");
}

/**
 * Convenience: only transliterates when `language` is "hi" — English stays
 * exactly as typed either way, matching the crops/villages translateName()
 * convention in src/lib/dataLabels.ts.
 */
export function displayName(fullName: string | null | undefined, language: "en" | "hi"): string {
  if (language === "en") return fullName ?? "";
  return transliterateName(fullName);
}
