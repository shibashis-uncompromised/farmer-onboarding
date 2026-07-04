"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Center, Loader } from "@mantine/core";
import { currentUser, type AuthUser } from "@/lib/auth";
import { getCurrentLocation, saveLastLocation, getLastLocation } from "@/lib/location";
import { syncAll } from "@/lib/sync";
import { sweepPreLaunch } from "@/lib/softDelete";
import type { SessionLocation } from "@/lib/types";

export type SyncState = "idle" | "syncing" | "offline" | "error";

interface SessionCtx {
  user: AuthUser;
  location: SessionLocation | null;          // best-effort; may be null (captured on demand)
  refreshLocation: () => Promise<SessionLocation>;
  syncState: SyncState;
  syncNow: () => Promise<{ pushed: number; pulled: number } | null>;
}
const Ctx = createContext<SessionCtx | null>(null);
export const useSession = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be inside SessionGate");
  return v;
};

const SYNC_INTERVAL_MS = 10000;

export default function SessionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [loc, setLoc] = useState<SessionLocation | null>(() => getLastLocation());
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const running = useRef(false);
  const queued = useRef(false);

  const refreshLocation = useCallback(async () => {
    const l = await getCurrentLocation();
    saveLastLocation(l);
    setLoc(l);
    return l;
  }, []);

  // One guarded sync pass. Never overlaps, never throws, never toasts.
  const syncNow = useCallback(async () => {
    if (running.current) {
      queued.current = true;
      return null;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) { setSyncState("offline"); return null; }
    running.current = true;
    setSyncState("syncing");
    try {
      const r = await syncAll();
      setSyncState("idle");
      return r;
    } catch {
      setSyncState("error");
      return null;
    } finally {
      running.current = false;
      if (queued.current && typeof navigator !== "undefined" && navigator.onLine) {
        queued.current = false;
        setTimeout(() => { syncNow(); }, 0);
      }
    }
  }, []);

  useEffect(() => {
    const u = currentUser();
    if (!u) {
      router.replace("/login/");
      return;
    }
    setUser(u);
    setChecked(true);
    getCurrentLocation().then((l) => { saveLastLocation(l); setLoc(l); }).catch(() => {});
    // Hide pre-launch test data (idempotent). Runs locally; the deletions sync.
    sweepPreLaunch().catch(() => {});
  }, [router]);

  // Auto-sync every 10s while signed in + visible. Safe: guarded against
  // overlap, silent on failure, paused when the tab is hidden or offline.
  useEffect(() => {
    if (!checked || !user) return;
    syncNow();
    const id = setInterval(() => { if (!document.hidden) syncNow(); }, SYNC_INTERVAL_MS);
    const onOnline = () => syncNow();
    window.addEventListener("online", onOnline);
    return () => { clearInterval(id); window.removeEventListener("online", onOnline); };
  }, [checked, user, syncNow]);

  if (!checked || !user) {
    return (
      <Center h="100dvh">
        <Loader color="green" />
      </Center>
    );
  }

  return (
    <Ctx.Provider value={{ user, location: loc, refreshLocation, syncState, syncNow }}>
      {children}
    </Ctx.Provider>
  );
}
