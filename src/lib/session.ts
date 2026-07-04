import { apiAllocate } from "./api";

export interface Block { start: number; end: number; }
export type Role = "user" | "admin";

export interface Session {
  token: string;
  username: string;
  role: Role;           // NEW
  blockSize: number;
  blocks: Block[];
  used: number;        // how many IDs consumed from the blocks (persisted locally)
}

const KEY = "fo_session_v1";

export function getSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    // Back-compat: a session saved before this field existed just won't have
    // it — treat that as a plain "user" instead of leaving it undefined.
    if (s && !s.role) s.role = "user";
    return s;
  } catch { return null; }
}
export function setSession(s: Session) { localStorage.setItem(KEY, JSON.stringify(s)); }
export function clearSession() { localStorage.removeItem(KEY); }

const capacity = (blocks: Block[]) => blocks.reduce((s, b) => s + (b.end - b.start + 1), 0);

// The k-th (0-based) number across the (possibly non-contiguous) blocks.
function nth(blocks: Block[], k: number): number | null {
  let rem = k;
  for (const b of [...blocks].sort((a, b) => a.start - b.start)) {
    const size = b.end - b.start + 1;
    if (rem < size) return b.start + rem;
    rem -= size;
  }
  return null;
}

export function remainingIds(): number {
  const s = getSession();
  return s ? capacity(s.blocks) - s.used : 0;
}

// Allocate the next globally-unique ID number from this user's block(s).
// If the block is exhausted, fetch a new one (online). Throws if offline & dry.
export async function allocateNumber(): Promise<number> {
  const s = getSession();
  if (!s) throw new Error("Not signed in");

  if (s.used >= capacity(s.blocks)) {
    if (!navigator.onLine) throw new Error("Out of offline IDs — connect to the internet to get more.");
    const r = await apiAllocate(s.token);   // claim ANOTHER dedicated block for this device
    s.blocks.push(r.allocated);
    setSession(s);
  }

  const n = nth(s.blocks, s.used);
  if (n == null) throw new Error("No IDs available");
  s.used += 1;
  setSession(s);
  return n;
}