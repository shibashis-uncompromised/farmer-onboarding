import { API_BASE } from "./config";
import { fetchWithTimeout } from "./api";
import { getSession } from "./session";

// Neoperk has one project per state, and each project enforces its own crop
// enum. Rajasthan (US00) accepts English slugs; Madhya Pradesh (US01) only
// accepts the exact Hindi strings returned by its own reference endpoint.
// Values confirmed live against each project's GET /ext-api-plotdata response.

/** Rajasthan (US00) — English crop slugs */
const CROP_API_VALUE_RJ: Record<string, string> = {
  Groundnut: "groundnut",
  Sesamum:   "sesame",
  Sunflower: "sunflower",
  Paddy:     "rice",
  Rice:      "rice",
  Urad:      "urad",
  Turmeric:  "turmeric",
};

/** Madhya Pradesh (US01) — Hindi crop strings (exact Neoperk enum values) */
const CROP_API_VALUE_MP: Record<string, string> = {
  Groundnut: "मूंगफली",
  Sesamum:   "तिल",
  Sunflower: "सूरजमुखी",
  Paddy:     "धान",
  Rice:      "धान",
  Urad:      "उड़द",
  Turmeric:  "हल्दी",
  Soybean:   "सोयाबीन",
  Maize:     "मक्का",
  Wheat:     "गेहूँ",
  Gram:      "चना",
  Sorghum:   "ज्वार",
  Cotton:    "कपास",
};

/** Gujarat (US02) — English slugs (same project shape as RJ; extend if needed) */
const CROP_API_VALUE_GJ: Record<string, string> = {
  ...CROP_API_VALUE_RJ,
};

/** Return the correct crop API value for the given state, or undefined if unmapped. */
export function cropApiValue(crop: string, state: string): string | undefined {
  const map =
    state === "Madhya Pradesh" ? CROP_API_VALUE_MP :
    state === "Gujarat"        ? CROP_API_VALUE_GJ :
    CROP_API_VALUE_RJ;
  return map[crop];
}

// Keep the old export as the RJ map so existing callers don't break.
export const CROP_API_VALUE = CROP_API_VALUE_RJ;

// Fixed value on every submission (org contact number). state/district/village/
// block are now selected per sample and drive which Neoperk project the backend
// routes to (each state = a different project token, resolved server-side).
export const FIXED = { mobile_number: "9602840151" };

// operator_note: just the soil sample id.
export function operatorNote(sampleCode: string): string {
  return (sampleCode || "").trim();
}

// farmer_name: "Farmer Name (Care-of Name)". Falls back to the RJ code if the
// name is missing, so the API's required farmer_name is never empty.
export function neoperkFarmerName(name: string, coName: string, rjCode: string): string {
  const n = (name || "").trim();
  const co = (coName || "").trim();
  let s = n;
  if (co) s += `${s ? " " : ""}(${co})`;
  return s || (rjCode || "").trim();
}

export interface PlotSubmission {
  farmer_name: string;   // "Farmer Name (Care-of Name)"
  state: string;         // exact Neoperk state — selects the project token server-side
  district: string;      // exact Neoperk district enum value for that state
  village: string;
  block: string;
  upcoming_crop_cycle: string;   // already API-mapped value
  operator_note: string;
}

export interface PlotResult {
  success: boolean;
  message?: string;
  sample_id?: string;
  errors?: string[];
  reference?: string;
  httpStatus?: number;
  token?: string;
  requestPayload?: Record<string, any>;
  rawResponse?: any;
}

// Submit through our backend proxy (keeps the token server-side, avoids CORS).
export async function submitPlotData(sub: PlotSubmission): Promise<PlotResult> {
  const s = getSession();
  if (!s) return { success: false, message: "Not signed in" };
  const fullPayload = { token: s.token, ...FIXED, ...sub };
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/plotdata/submit`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${s.token}` },
      body: JSON.stringify(fullPayload),
    }, 20000);
    const data = await res.json().catch(() => ({}));
    if (!data || typeof data.success === "undefined") {
      const errMsg = (data && (data.error || data.message)) || `Unexpected response (${res.status})`;
      return {
        success: false,
        message: errMsg,
        httpStatus: res.status,
        token: s.token,
        requestPayload: fullPayload,
        rawResponse: data,
      };
    }
    return {
      ...(data as PlotResult),
      httpStatus: res.status,
      token: s.token,
      requestPayload: fullPayload,
      rawResponse: data,
    };
  } catch (e: any) {
    return {
      success: false,
      message: e?.name === "AbortError" ? "Request timed out — check your connection" : (e?.message || "Network error"),
      token: s.token,
      requestPayload: fullPayload,
    };
  }
}
