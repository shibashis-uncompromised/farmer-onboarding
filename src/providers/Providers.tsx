"use client";

import { useEffect } from "react";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { theme } from "@/lib/theme";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Auto-update: when a new service worker is deployed, install it and reload
    // the page once so the user always lands on the latest version when online.
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      reg.update().catch(() => {});
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          // a NEW worker activated while a controller already existed = an update
          if (nw.state === "activated" && navigator.serviceWorker.controller && !reloaded) {
            reloaded = true;
            window.location.reload();
          }
        });
      });
      // re-check for a new version whenever the device comes online or refocuses
      const check = () => reg.update().catch(() => {});
      window.addEventListener("online", check);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
    }).catch(() => {});
  }, []);

  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-center" />
      {children}
    </MantineProvider>
  );
}
