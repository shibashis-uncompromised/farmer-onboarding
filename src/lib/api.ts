import { API_BASE } from "./config";

async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
  });
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

export const apiAllocate = (token: string) =>
  req("/api/id-blocks/allocate", { method: "POST", headers: { authorization: `Bearer ${token}` } });

export const apiSync = (token: string, payload: unknown) =>
  req("/api/sync", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });

export const apiPull = (token: string): Promise<{ farmers: any[]; farms: any[]; plots: any[] }> =>
  req("/api/sync", { headers: { authorization: `Bearer ${token}` } });
