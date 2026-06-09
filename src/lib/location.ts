import type { SessionLocation } from "./types";

export function getCurrentLocation(opts?: PositionOptions): Promise<SessionLocation> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation not supported on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          at: Date.now(),
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000, ...opts }
    );
  });
}

export const fmtCoord = (n: number | null) => (n == null ? "—" : n.toFixed(6));

// Last successful location — lets the app proceed offline (e.g. on a laptop with
// no GPS, or a phone with GPS briefly unavailable) using the most recent fix.
const LAST_LOC_KEY = "fo_last_location";
export function saveLastLocation(l: SessionLocation) {
  try { localStorage.setItem(LAST_LOC_KEY, JSON.stringify(l)); } catch {}
}
export function getLastLocation(): SessionLocation | null {
  try { return JSON.parse(localStorage.getItem(LAST_LOC_KEY) || "null"); } catch { return null; }
}
