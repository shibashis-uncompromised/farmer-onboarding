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

export type Role = "admin" | "reviewer" | "poc";

export interface LoginResp {
  token: string;
  username: string;
  role: Role;
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

// ---- Admin: user management ----
export interface AdminUser {
  id: number;
  username: string;
  role: Role;
  created_at: string;
}

// NOTE: the token rides in the JSON body (not just the Authorization header),
// same reason apiSync/apiPull/apiAllocate do it — CloudFront strips the
// Authorization header but always forwards the body. Listing uses the POST
// alias (not the plain GET) because a body isn't reliably forwarded on GET.
export const apiListUsers = (token: string): Promise<{ users: AdminUser[] }> =>
  req("/api/admin/users/list", { method: "POST", body: JSON.stringify({ token }) });

export const apiCreateUser = (
  token: string,
  body: { username: string; password: string; role: Role }
): Promise<{ user: AdminUser }> =>
  req("/api/admin/users", { method: "POST", body: JSON.stringify({ token, ...body }) });

export const apiUpdateUser = (
  token: string,
  id: number,
  body: { username?: string; password?: string; role?: Role }
): Promise<{ user: AdminUser }> =>
  req(`/api/admin/users/${id}`, { method: "PUT", body: JSON.stringify({ token, ...body }) });

export const apiDeleteUser = (token: string, id: number): Promise<{ ok: true }> =>
  req(`/api/admin/users/${id}`, { method: "DELETE", body: JSON.stringify({ token }) });

// ---- Admin: dynamic-field version history (read-only) ----
export type EntityType = "farmer" | "farm" | "plot";
export type VersionStatus = "pending" | "current" | "rejected" | "retired";

export interface EntityVersion {
  id: number;
  entity_type: EntityType;
  entity_id: string;
  version_no: number;
  status: VersionStatus;
  data: Record<string, any>;
  submitted_by: string | null;
  submitted_at: number | null;
  reviewed_by: string | null;
  reviewed_at: number | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntityVersionFilters {
  status?: VersionStatus | "all";
  entityType?: EntityType | "all";
  entityId?: string;
  submittedBy?: string;
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
}

// Read-only history across every farmer/farm/plot dynamic-field version —
// no edit/approve/reject affordance here, that lives on the review queue.
export const apiListEntityVersions = (
  token: string,
  filters: EntityVersionFilters = {}
): Promise<{ versions: EntityVersion[]; total: number }> =>
  req("/api/admin/entity-versions/list", { method: "POST", body: JSON.stringify({ token, ...filters }) });

// Admin's own direct edit to an entity's dynamic fields — skips the pending
// queue entirely and becomes the current version immediately (see the
// direct: true path of submitEntityVersion on the backend).
export interface DirectUpdatePayload {
  entityType: EntityType;
  entityId: string;
  dynamicData: Record<string, any>;
}
export const apiDirectUpdateEntityVersion = (
  token: string,
  payload: DirectUpdatePayload
): Promise<{ ok: true }> =>
  req("/api/admin/entity-versions/direct-update", { method: "POST", body: JSON.stringify({ token, ...payload }) });
