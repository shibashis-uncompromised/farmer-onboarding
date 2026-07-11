import { API_BASE } from "./config";
import { fetchWithTimeout } from "./api";
import { getSession } from "./session";

// Map our crop labels to the value the Neoperk Ext Plot Data API accepts.
// (Confirmed against the live reference endpoint's crop list.)
export const CROP_API_VALUE: Record<string, string> = {
  Groundnut: "groundnut",
  Sesamum: "sesame",
  Sunflower: "sunflower",
  Paddy: "rice",
  Rice: "rice",
  Urad: "urad",
  Turmeric: "turmeric",
};

// Fixed values for every Rajasthan submission (per the integration spec).
export const FIXED = { mobile_number: "9602840151", district: "Udaipur", state: "Rajasthan" };

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
}

// Submit through our backend proxy (keeps the token server-side, avoids CORS).
export async function submitPlotData(sub: PlotSubmission): Promise<PlotResult> {
  const s = getSession();
  if (!s) return { success: false, message: "Not signed in" };
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/plotdata/submit`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${s.token}` },
      body: JSON.stringify({ token: s.token, ...FIXED, ...sub }),
    }, 20000);
    const data = await res.json().catch(() => ({}));
    if (!data || typeof data.success === "undefined") {
      return { success: false, message: `Unexpected response (${res.status})` };
    }
    return data as PlotResult;
  } catch (e: any) {
    return { success: false, message: e?.name === "AbortError" ? "Request timed out — check your connection" : (e?.message || "Network error") };
  }
}
