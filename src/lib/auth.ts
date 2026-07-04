// Auth backed by the server. First sign-in must be online (to authenticate and
// receive the device's ID block); afterwards the stored session lets the app
// open and work fully offline.

import { apiLogin, apiAllocate } from "./api";
import { getSession, setSession, clearSession, type Role } from "./session";

export interface AuthUser { username: string; role: Role; }

export async function login(username: string, password: string): Promise<AuthUser> {
  const data = await apiLogin(username, password);
  // Claim a FRESH id block dedicated to this device, so two devices signed in
  // with the same credentials never mint the same ids.
  const alloc = await apiAllocate(data.token);   // { allocated: {start,end}, blocks: [...] }
  // NEW: the login response now includes `role` (added in the backend Step 1
  // change) — fall back to "user" if it's ever missing so this never breaks.
  const role: Role = (data as any).role === "admin" ? "admin" : "user";
  setSession({
    token: data.token,
    username: data.username,
    role,
    blockSize: data.blockSize,
    blocks: [alloc.allocated],
    used: 0,
  });
  return { username: data.username, role };
}

export function currentUser(): AuthUser | null {
  const s = getSession();
  return s ? { username: s.username, role: s.role } : null;
}

export function logout() {
  clearSession();
}