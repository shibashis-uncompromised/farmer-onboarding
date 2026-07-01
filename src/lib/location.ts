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

export interface BestLocationOpts {
  targetAccuracy?: number;   // stop early once accuracy (m) is at/under this
  maxWait?: number;          // give up waiting after this many ms, keep best so far
  onProgress?: (l: SessionLocation) => void;   // called as the fix tightens (live UI)
  signal?: AbortSignal;      // cancel (e.g. user closed the modal)
}

// Accurate GPS fix: instead of taking the first (often coarse ±100m) reading,
// WATCH the position and keep the tightest fix, resolving when accuracy reaches
// the target or maxWait elapses. GPS is satellite-based (works offline); the
// network only speeds up the initial lock. This mirrors how a maps blue-dot
// tightens over a few seconds.
export function getBestLocation(opts: BestLocationOpts = {}): Promise<SessionLocation> {
  const targetAccuracy = opts.targetAccuracy ?? 10;
  const maxWait = opts.maxWait ?? 20000;
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation not supported on this device"));
      return;
    }
    let best: SessionLocation | null = null;
    let done = false;
    const cleanup = () => {
      clearTimeout(timer);
      try { navigator.geolocation.clearWatch(id); } catch {}
      if (opts.signal) opts.signal.removeEventListener("abort", onAbort);
    };
    const finish = () => {
      if (done) return;
      done = true;
      cleanup();
      if (best) resolve(best);
      else reject(new Error("Couldn’t get a GPS fix — try open sky"));
    };
    const onAbort = () => { if (done) return; done = true; cleanup(); reject(new Error("cancelled")); };
    if (opts.signal) {
      if (opts.signal.aborted) { reject(new Error("cancelled")); return; }
      opts.signal.addEventListener("abort", onAbort);
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const l: SessionLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          at: Date.now(),
        };
        if (!best || l.accuracy < best.accuracy) {
          best = l;
          opts.onProgress?.(l);
        }
        if (l.accuracy <= targetAccuracy) finish();   // good enough → stop early
      },
      (err) => { if (!best) { done = true; cleanup(); reject(err); } },  // keep waiting if we already have a fix
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWait }
    );
    const timer = setTimeout(finish, maxWait);   // time's up → keep the best so far
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
