import { apiAllocate } from "./api";

export interface Block { start: number; end: number; }
export interface Session {
  token: string;
  username: string;
  blockSize: number;
  blocks: Block[];
  used: number;        // how many IDs consumed from the blocks (persisted locally)
}

const KEY = "fo_session_v1";

export function getSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
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

// Proactively claim the next ID block while ONLINE, before the current one runs
// dry — so a surveyor never hits "Out of offline IDs" mid-survey in the field.
// Called from the background sync tick; silent and best-effort.
let refilling = false;
export async function ensureIdHeadroom(threshold = 20): Promise<void> {
  const s = getSession();
  if (!s || refilling) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (capacity(s.blocks) - s.used > threshold) return;   // plenty left
  refilling = true;
  try {
    const r = await apiAllocate(s.token);
    // Re-read the session: `used` may have advanced while the request ran.
    const cur = getSession();
    if (!cur) return;
    cur.blocks.push(r.allocated);
    setSession(cur);
  } catch {
    // Offline/flaky — fine, we'll retry on a later sync tick.
  } finally {
    refilling = false;
  }
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
