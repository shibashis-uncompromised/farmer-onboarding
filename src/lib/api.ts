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

export const apiPull = (token: string): Promise<{ farmers: any[]; farms: any[]; plots: any[]; media?: any[]; soilSamples?: any[] }> =>
  req("/api/pull", { method: "POST", body: JSON.stringify({ token }) });

export const apiPresignMedia = (
  token: string,
  mediaId: string,
  mimeType: string
): Promise<{ uploadUrl: string; s3Key: string }> =>
  req("/api/media/presign", { method: "POST", body: JSON.stringify({ token, mediaId, mimeType }) });

export type AdminTable = "farmers" | "farms" | "plots" | "soilSamples" | "media";

export interface AdminRow {
  id: string;
  username: string;
  data?: any;
  mime_type?: string;
  s3_key?: string;
  created_at?: number;
  is_active: boolean;
  synced_at: string;
}

export const apiAdminListTable = (token: string, table: AdminTable): Promise<AdminRow[]> =>
  req(`/api/admin/${table}?token=${encodeURIComponent(token)}`, { method: "GET" });

export const apiAdminSetActive = (
  token: string,
  table: AdminTable,
  id: string,
  isActive: boolean
): Promise<{ id: string; is_active: boolean }> =>
  req(`/api/admin/${table}/${encodeURIComponent(id)}/active`, {
    method: "PATCH",
    body: JSON.stringify({ token, isActive }),
  });

// ---- NEW: Villages (matches the /api/villages route from Step 7, which
// you already verified with curl) ----
export interface ServerVillage {
  code: string;
  name: string;
  block: string;
  idCode: string;
  region: string;
}

// GET requests can't carry a body in the browser fetch API, so the token
// rides as a query param — same reasoning as the admin routes above.
export const apiVillages = (token: string): Promise<ServerVillage[]> =>
  req(`/api/villages?token=${encodeURIComponent(token)}`, { method: "GET" });