"use client";

import { useEffect } from "react";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { theme } from "@/lib/theme";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { setDynamicVillages } from "@/lib/villages";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

// Mirrors user-created villages from IndexedDB into the villages.ts cache, so
// the app's synchronous village lookups include them. Renders nothing.
function VillageCache() {
  useLiveQuery(async () => {
    const rows = (await db.villages.toArray()).filter((v) => !v.deleted);
    setDynamicVillages(rows as any);
    return rows.length;
  }, []);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Auto-update: when a new service worker is deployed, reload once so the
    // user lands on the latest version — but NEVER mid-work. If a modal is open
    // or a field is focused (surveyor typing), defer the reload until the app
    // is backgrounded, so unsaved form input is never wiped by an update.
    let reloaded = false;
    let pending = false;
    const userIsBusy = () =>
      !!document.querySelector('[role="dialog"]') ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName || "");
    const applyUpdate = () => {
      if (reloaded) return;
      if (userIsBusy()) {
        pending = true;                       // reload later, invisibly
        return;
      }
      reloaded = true;
      window.location.reload();
    };
    document.addEventListener("visibilitychange", () => {
      // App went to background with an update pending → reload now (invisible).
      if (pending && document.hidden && !reloaded) {
        reloaded = true;
        window.location.reload();
      }
    });
    navigator.serviceWorker.addEventListener("controllerchange", applyUpdate);

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      reg.update().catch(() => {});
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          // a NEW worker activated while a controller already existed = an update
          if (nw.state === "activated" && navigator.serviceWorker.controller) {
            applyUpdate();
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
      <LanguageProvider>
        <VillageCache />
        {children}
      </LanguageProvider>
    </MantineProvider>
  );
}
