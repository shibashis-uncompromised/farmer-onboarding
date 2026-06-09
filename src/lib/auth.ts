// Auth backed by the server. First sign-in must be online (to authenticate and
// receive the device's ID block); afterwards the stored session lets the app
// open and work fully offline.

import { apiLogin } from "./api";
import { getSession, setSession, clearSession } from "./session";

export interface AuthUser { username: string; }

export async function login(username: string, password: string): Promise<AuthUser> {
  const data = await apiLogin(username, password);
  const prev = getSession();
  // keep the local "used" cursor when the same user signs in again on this device
  const used = prev && prev.username === data.username ? prev.used : 0;
  setSession({
    token: data.token,
    username: data.username,
    blockSize: data.blockSize,
    blocks: data.blocks,
    used,
  });
  return { username: data.username };
}

export function currentUser(): AuthUser | null {
  const s = getSession();
  return s ? { username: s.username } : null;
}

export function logout() {
  clearSession();
}
