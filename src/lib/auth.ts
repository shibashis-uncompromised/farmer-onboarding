// Auth backed by the server. First sign-in must be online (to authenticate and
// receive the device's ID block); afterwards the stored session lets the app
// open and work fully offline.

import { apiLogin, apiAllocate } from "./api";
import type { Role } from "./api";
import { getSession, setSession, clearSession } from "./session";

export interface AuthUser { username: string; role: Role; }

export async function login(username: string, password: string): Promise<AuthUser> {
  const data = await apiLogin(username, password);
  // Admins manage users, they don't do offline farmer onboarding, so skip
  // claiming an id block for them (that's only meaningful for poc/reviewer flows).
  if (data.role === "admin") {
    setSession({
      token: data.token,
      username: data.username,
      role: data.role,
      blockSize: 0,
      blocks: [],
      used: 0,
    });
    return { username: data.username, role: data.role };
  }
  // Claim a FRESH id block dedicated to this device, so two devices signed in
  // with the same credentials never mint the same ids.
  const alloc = await apiAllocate(data.token);   // { allocated: {start,end}, blocks: [...] }
  setSession({
    token: data.token,
    username: data.username,
    role: data.role,
    blockSize: data.blockSize,
    blocks: [alloc.allocated],
    used: 0,
  });
  return { username: data.username, role: data.role };
}

export function currentUser(): AuthUser | null {
  const s = getSession();
  return s ? { username: s.username, role: s.role } : null;
}

export function logout() {
  clearSession();
}
