"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Center, Loader } from "@mantine/core";
import { currentUser, type AuthUser } from "@/lib/auth";
import { getCurrentLocation, saveLastLocation, getLastLocation } from "@/lib/location";
import type { SessionLocation } from "@/lib/types";

interface SessionCtx {
  user: AuthUser;
  location: SessionLocation | null;          // best-effort; may be null (captured on demand)
  refreshLocation: () => Promise<SessionLocation>;
}
const Ctx = createContext<SessionCtx | null>(null);
export const useSession = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be inside SessionGate");
  return v;
};

// Auth-only gate. Location is NOT required up front (it was looping on
// page changes / when offline). Geolocation is captured on demand where it
// matters — adding a farm or plot. We still keep a best-effort background fix
// for display, but it never blocks navigation.
export default function SessionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [loc, setLoc] = useState<SessionLocation | null>(() => getLastLocation());

  const refreshLocation = useCallback(async () => {
    const l = await getCurrentLocation();
    saveLastLocation(l);
    setLoc(l);
    return l;
  }, []);

  useEffect(() => {
    const u = currentUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);
    setChecked(true);
    // best-effort, non-blocking — never gates the UI
    getCurrentLocation().then((l) => { saveLastLocation(l); setLoc(l); }).catch(() => {});
  }, [router]);

  if (!checked || !user) {
    return (
      <Center h="100dvh">
        <Loader color="green" />
      </Center>
    );
  }

  return (
    <Ctx.Provider value={{ user, location: loc, refreshLocation }}>
      {children}
    </Ctx.Provider>
  );
}
