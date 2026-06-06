"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Button, Center, Group, Loader, Paper, Stack, Text, ThemeIcon, Title,
} from "@mantine/core";
import { MapPinLine, WarningCircle, Compass } from "@phosphor-icons/react";
import { currentUser, type AuthUser } from "@/lib/auth";
import { getCurrentLocation, fmtCoord } from "@/lib/location";
import type { SessionLocation } from "@/lib/types";

interface SessionCtx {
  user: AuthUser;
  location: SessionLocation;
  refreshLocation: () => Promise<SessionLocation>;
}
const Ctx = createContext<SessionCtx | null>(null);
export const useSession = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be inside SessionGate");
  return v;
};

export default function SessionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [loc, setLoc] = useState<SessionLocation | null>(null);
  const [locState, setLocState] = useState<"idle" | "loading" | "error">("idle");
  const [locErr, setLocErr] = useState("");

  const fetchLoc = useCallback(async () => {
    setLocState("loading");
    setLocErr("");
    try {
      const l = await getCurrentLocation();
      setLoc(l);
      setLocState("idle");
      return l;
    } catch (e: any) {
      const msg =
        e?.code === 1
          ? "Location permission denied. Please allow location access in your browser settings."
          : e?.message || "Could not get your location. Try again.";
      setLocErr(msg);
      setLocState("error");
      throw e;
    }
  }, []);

  useEffect(() => {
    const u = currentUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);
    setChecked(true);
    fetchLoc().catch(() => {});
  }, [router, fetchLoc]);

  if (!checked || !user) {
    return (
      <Center h="100dvh">
        <Loader color="green" />
      </Center>
    );
  }

  // Mandatory location gate
  if (!loc) {
    return (
      <Center h="100dvh" p="lg" style={{ background: "var(--mantine-color-gray-0)" }}>
        <Paper withBorder radius="lg" p="xl" shadow="sm" maw={380} w="100%">
          <Stack align="center" gap="md">
            <ThemeIcon size={72} radius="xl" variant="light" color={locState === "error" ? "red" : "green"}>
              {locState === "error" ? <WarningCircle size={40} /> : <MapPinLine size={40} weight="duotone" />}
            </ThemeIcon>
            <Title order={3} ta="center">Location required</Title>
            <Text c="dimmed" ta="center" size="sm">
              {locState === "error"
                ? locErr
                : "We need your current location to continue with field onboarding."}
            </Text>
            <Button
              fullWidth size="md" radius="md"
              loading={locState === "loading"}
              leftSection={<Compass size={18} />}
              onClick={() => fetchLoc().catch(() => {})}
            >
              {locState === "error" ? "Try again" : "Enable location"}
            </Button>
          </Stack>
        </Paper>
      </Center>
    );
  }

  return (
    <Ctx.Provider value={{ user, location: loc, refreshLocation: fetchLoc }}>
      {children}
    </Ctx.Provider>
  );
}
