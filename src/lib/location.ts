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
