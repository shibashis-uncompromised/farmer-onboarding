import { API_BASE } from "./config";

// fetch() never times out on its own — a stalled connection would hang sync
// forever (infinite "syncing" spinner). Abort after `timeoutMs` so the caller
// rejects, the sync guard resets, and the next tick retries cleanly.
export async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function req(path: string, opts: RequestInit = {}, timeoutMs = 8000) {
  let res: Response;
  try {
    res = await fetchWithTimeout(API_BASE + path, {
      ...opts,
      headers: { "content-type": "application/json", ...(opts.headers || {}) },
    }, timeoutMs);
  } catch (e: any) {
    throw new Error(e?.name === "AbortError" ? "Request timed out" : (e?.message || "Network error"));
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export interface LoginResp {
  token: string;
  username: string;
  blockSize: number;
  blocks: { start: number; end: number }[];
}

export const apiLogin = (username: string, password: string): Promise<LoginResp> =>
  req("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });

// NOTE: the token is sent in the BODY (not just the Authorization header)
// because CloudFront strips Authorization but always forwards the POST body.
export const apiAllocate = (token: string) =>
  req("/api/id-blocks/allocate", { method: "POST", body: JSON.stringify({ token }) });

export const apiSync = (token: string, payload: object) =>
  req("/api/sync", { method: "POST", body: JSON.stringify({ token, ...payload }) });

export const apiPull = (token: string): Promise<{ farmers: any[]; farms: any[]; plots: any[]; media?: any[]; soilSamples?: any[]; soilTextureTests?: any[]; waterTDSTests?: any[]; villages?: any[] }> =>
  req("/api/pull", { method: "POST", body: JSON.stringify({ token }) });

export const apiPresignMedia = (
  token: string,
  mediaId: string,
  mimeType: string
): Promise<{ uploadUrl: string; s3Key: string }> =>
  req("/api/media/presign", { method: "POST", body: JSON.stringify({ token, mediaId, mimeType }) });

// Elevation lookup — proxied through our backend so the Google Maps API key
// never ships to the client. Used to auto-fetch real elevation data for a
// farm boundary's corners (falls back to GPS altitude if this fails/offline).
export interface ElevationPoint {
  lat: number;
  lng: number;
  elevation: number;
  resolution?: number | null;
}
export const apiElevation = (
  token: string,
  points: { lat: number; lng: number }[]
): Promise<{ elevations: ElevationPoint[] }> =>
  req("/api/elevation", { method: "POST", body: JSON.stringify({ token, points }) }, 8000);
