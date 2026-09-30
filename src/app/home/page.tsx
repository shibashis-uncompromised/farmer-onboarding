"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ActionIcon, Affix, Badge, Box, Button, Center, Container, Group, Image, Loader, Menu, Paper,
  ScrollArea, Select, Stack, Text, TextInput, Title, UnstyledButton,
} from "@mantine/core";
import {
  MagnifyingGlass, Plus, DotsThreeVertical, DownloadSimple, SignOut,
  CaretRight, UsersThree, MapPin, MapPinPlus, CloudArrowUp, ArrowsClockwise, CloudCheck, CloudSlash, WarningCircle,
  QrCode, Trash, Flask, Clock, ShieldCheck,
} from "@phosphor-icons/react";
import { useLiveQuery } from "dexie-react-hooks";
import { notifications } from "@mantine/notifications";
import SessionGate, { useSession } from "@/providers/SessionGate";
import { db } from "@/lib/db";
import { villageByCode, villagesForUser, setDynamicVillages, villageNameLabel, villageBlockLabel } from "@/lib/villages";
import { computeStatus } from "@/lib/status";
import { StatusIcon } from "@/components/StatusBadge";
import AddFarmerModal from "@/components/AddFarmerModal";
import CreateVillageModal from "@/components/CreateVillageModal";
import AppModal from "@/components/AppModal";
import QrScanner from "@/components/QrScanner";
import { parseQr, looksLikeFarmerCode, isReservedImportedFarmerCode } from "@/lib/qr";
import { exportAllZip } from "@/lib/export";
import { logout } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TFunc } from "@/lib/dynamicFieldMeta";
import { displayName } from "@/lib/transliterate";
import LanguageToggle from "@/components/LanguageToggle";

// Short "time ago" label for the farmer tile's last-updated stamp.
function timeAgo(ts: number | undefined, t: TFunc): string {
  if (!ts) return "";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return t("home_timeJustNow");
  const m = Math.floor(s / 60);
  if (m < 60) return t("home_timeMinutesAgo", { m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("home_timeHoursAgo", { h });
  const d = Math.floor(h / 24);
  if (d < 7) return t("home_timeDaysAgo", { d });
  return new Date(ts).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

function HomeInner() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { user, location, syncState, syncNow } = useSession();
  const [createVillageOpen, setCreateVillageOpen] = useState(false);
  // Villages this user may see: preset (region/allowlist) + user-created ones
  // (own + admin). The live query keeps the dropdown reactive as villages are
  // created or synced, and refreshes the shared cache the rest of the app reads.
  const dynVillages = useLiveQuery(async () => (await db.villages.toArray()).filter((v) => !v.deleted), []);
  const villages = useMemo(() => {
    if (dynVillages) setDynamicVillages(dynVillages as any);
    return villagesForUser(user.username);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.username, dynVillages]);
  // Persist the selected village so it survives navigation/reload (and offline).
  const [village, setVillageState] = useState<string>(() => {
    try { return localStorage.getItem("fo_selected_village") || ""; }
    catch { return ""; }
  });
  const setVillage = (v: string) => {
    setVillageState(v);
    try { localStorage.setItem("fo_selected_village", v); } catch {}
  };
  // Keep the selection valid for this user (e.g. a stale RJ village for an MP
  // user, or first load with nothing saved) — fall back to their first village.
  useEffect(() => {
    if (!villages.some((v) => v.code === village)) {
      setVillage(villages[0]?.code || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villages, village]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "lead" | "existing">("all");
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "name">("recent");
  const [addOpen, setAddOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearPw, setClearPw] = useState("");
  const [clearing, setClearing] = useState(false);

  // Live app version — read from the active service-worker cache name
  // (farmer-onboarding-vNN), so it always reflects what's actually running.
  const [appVersion, setAppVersion] = useState("");
  useEffect(() => {
    if (typeof caches === "undefined") return;
    caches.keys()
      .then((keys) => {
        const k = keys.filter((x) => /^farmer-onboarding-v\d+$/.test(x)).sort().pop();
        if (k) setAppVersion(k.replace("farmer-onboarding-", ""));
      })
      .catch(() => {});
  }, []);

  const farmers = useLiveQuery(
    async () => (await db.farmers.where("villageCode").equals(village).reverse().sortBy("updatedAt")).filter((f) => !f.deleted),
    [village]
  );
  const farms = useLiveQuery(async () => (await db.farms.toArray()).filter((x) => !x.deleted), []);
  const plots = useLiveQuery(async () => (await db.plots.toArray()).filter((x) => !x.deleted), []);

  const unsynced = useLiveQuery(async () => {
    const [f, fm, p, ss] = await Promise.all([db.farmers.toArray(), db.farms.toArray(), db.plots.toArray(), db.soilSamples.toArray()]);
    return f.filter((x) => !x.synced).length + fm.filter((x) => !x.synced).length + p.filter((x) => !x.synced).length + ss.filter((x) => !x.synced).length;
  }, []) ?? 0;

  const counts = useMemo(() => {
    const fc = new Map<string, number>();
    const pc = new Map<string, number>();
    (farms || []).forEach((f) => fc.set(f.farmerId, (fc.get(f.farmerId) || 0) + 1));
    (plots || []).forEach((p) => pc.set(p.farmerId, (pc.get(p.farmerId) || 0) + 1));
    return { fc, pc };
  }, [farms, plots]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (farmers || []).filter((f) => {
      // Type filter: treat a missing farmerType as "existing" (the default).
      if (typeFilter !== "all" && (f.farmerType || "existing") !== typeFilter) return false;
      if (!q) return true;
      return (
        `${f.firstName} ${f.lastName}`.toLowerCase().includes(q) ||
        `${f.coFirstName} ${f.coLastName}`.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q) ||
        f.phone.includes(q)
      );
    });
    const sorted = [...list];
    if (sortBy === "name") {
      sorted.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
    } else if (sortBy === "oldest") {
      sorted.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
    } else {
      sorted.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));   // recent first
    }
    return sorted;
  }, [farmers, search, typeFilter, sortBy]);

  const doExport = async () => {
    setExporting(true);
    try {
      const { farmers: n } = await exportAllZip();
      notifications.show({ color: "green", message: t("home_exportedRecords", { n }) });
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || t("home_exportFailed") });
    } finally {
      setExporting(false);
    }
  };

  const doSync = async () => {
    const r = await syncNow();
    if (r) notifications.show({ color: "green", message: t("home_syncedMessage", { pushed: r.pushed, pulled: r.pulled }) });
    else if (typeof navigator !== "undefined" && !navigator.onLine) notifications.show({ color: "red", message: t("home_offline") });
  };

  // Wipe ALL local data on this device (farmers/farms/plots/photos/samples). The server
  // copy is untouched — this only clears IndexedDB on this phone/laptop.
  const CLEAR_PW = "admin123";
  const doClear = async () => {
    if (clearPw !== CLEAR_PW) {
      notifications.show({ color: "red", message: t("home_incorrectPassword") });
      return;
    }
    setClearing(true);
    try {
      await db.delete();
      try {
        localStorage.removeItem("fo_selected_village");
        Object.keys(sessionStorage)
          .filter((key) => key.startsWith("fo_farmer_step_"))
          .forEach((key) => sessionStorage.removeItem(key));
      } catch {}
      notifications.show({ color: "green", message: t("home_localDataCleared") });
      setClearOpen(false);
      setClearPw("");
      setTimeout(() => window.location.reload(), 250);
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || t("home_couldNotClear") });
    } finally {
      setClearing(false);
    }
  };

  // Scanned QR → if the farmer exists, open them; otherwise open the new-farmer
  // dialog prefilled with the scanned code (fully offline — local lookup only).
  const onScan = async (raw: string) => {
    const { code } = parseQr(raw);
    if (!looksLikeFarmerCode(code)) {
      notifications.show({ color: "red", message: t("home_notFarmerQr", { code: code || t("home_empty") }) });
      setScanOpen(false);
      return;
    }
    setScanOpen(false);
    const existing = await db.farmers.get(code);
    if (existing?.deleted) {
      notifications.show({ color: "yellow", message: t("home_hiddenDeleted", { code }) });
    } else if (existing) {
      router.push(`/farmer/?id=${encodeURIComponent(code)}`);
    } else if (isReservedImportedFarmerCode(code)) {
      const r = await syncNow();
      const pulled = await db.farmers.get(code);
      if (pulled && !pulled.deleted) {
        router.push(`/farmer/?id=${encodeURIComponent(code)}`);
      } else {
        notifications.show({
          color: r ? "yellow" : "red",
          message: r ? t("home_notAvailableSync", { code }) : t("home_preRegistered", { code }),
        });
      }
    } else {
      setScannedCode(code);
      setAddOpen(true);
    }
  };

  return (
    <Box mih="100dvh" style={{ background: "var(--mantine-color-gray-0)" }}>
      {/* Header */}
      <Box
        style={{
          background: "linear-gradient(135deg,#06854f,#013a24)", color: "#fff",
          paddingTop: "max(16px, env(safe-area-inset-top))",
          position: "sticky", top: 0, zIndex: 20,
        }}
      >
        <Container size="sm" pb="md" pt="xs">
          <Group justify="space-between" align="center" mb="sm">
            <Group gap={10}>
              <Image src="/icons/logo.png" alt="Uncompromised" w={38} h={38} radius="md" />
              <div>
                <Text fw={700} fz={9} style={{ letterSpacing: 1, opacity: 0.85 }}>{t("common_brand")}</Text>
                <Title order={4} lh={1.1}>{t("common_appName")}</Title>
              </div>
            </Group>
            <Group gap={2}>
              {appVersion && (
                <Text size="xs" c="green.1" fw={600} mr={2} title={t("home_appVersionTitle")}>{appVersion}</Text>
              )}
              <ActionIcon
                variant="subtle" color="gray.0" size="lg" onClick={doSync} aria-label={t("home_syncAriaLabel")}
                title={syncState === "offline" ? t("home_syncOffline") : syncState === "error" ? t("home_syncIssue") : syncState === "syncing" ? t("home_syncing") : t("home_synced")}
              >
                {syncState === "syncing" ? <ArrowsClockwise size={20} className="fo-spin" />
                  : syncState === "offline" ? <CloudSlash size={20} />
                  : syncState === "error" ? <WarningCircle size={20} />
                  : <CloudCheck size={20} />}
              </ActionIcon>
              <Menu position="bottom-end" withArrow shadow="md">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray.0" size="lg" aria-label={t("home_menuAriaLabel")}>
                  <DotsThreeVertical size={24} weight="bold" />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Box px="sm" py={6}>
                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Text size="xs" c="dimmed">{t("common_language")}</Text>
                    <LanguageToggle size="xs" />
                  </Group>
                </Box>
                <Menu.Divider />
                {user.role === "admin" && (
                  <>
                    <Menu.Item leftSection={<ShieldCheck size={16} />} onClick={() => router.push("/admin/")}>
                      {t("home_adminView")}
                    </Menu.Item>
                    <Menu.Divider />
                  </>
                )}
                <Menu.Item leftSection={<Flask size={16} />} onClick={() => router.push("/scan-sample/")}>
                  {t("home_scanSample")}
                </Menu.Item>
                <Menu.Item leftSection={<MapPinPlus size={16} />} onClick={() => setCreateVillageOpen(true)}>
                  {t("home_newVillage")}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<CloudArrowUp size={16} />} onClick={doSync} disabled={syncState === "syncing"}
                  rightSection={unsynced > 0 ? <Text size="xs" c="orange.7" fw={700}>{unsynced}</Text> : null}>
                  {syncState === "syncing" ? t("home_syncing") : t("home_syncNow")}
                </Menu.Item>
                <Menu.Item leftSection={<DownloadSimple size={16} />} onClick={doExport} disabled={exporting}>
                  {exporting ? t("home_exporting") : t("home_exportAll")}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<Trash size={16} />} onClick={() => { setClearPw(""); setClearOpen(true); }}>
                  {t("home_clearLocalData")}
                </Menu.Item>
                <Menu.Item color="red" leftSection={<SignOut size={16} />} onClick={() => { logout(); router.replace("/login/"); }}>
                  {t("common_signOut")}
                </Menu.Item>
              </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>

          <Group gap="xs" wrap="nowrap" align="center">
            <Select
              data={villages.map((v) => ({ value: v.code, label: `${villageNameLabel(v, language)} · ${villageBlockLabel(v, language)}` }))}
              value={village || null} onChange={(v) => v && setVillage(v)} allowDeselect={false}
              checkIconPosition="right" size="md" radius="md" style={{ flex: 1 }}
              leftSection={<MapPin size={18} />}
              styles={{ input: { fontWeight: 600 } }}
            />
            <Button variant="white" color="dark" size="md" radius="md" px="sm"
              leftSection={<MapPinPlus size={18} />} onClick={() => setCreateVillageOpen(true)}
              styles={{ label: { fontSize: 13 } }}>
              {t("home_newVillage")}
            </Button>
          </Group>
          {location && (
            <Group gap={6} mt={6} c="green.1">
              <MapPin size={13} />
              <Text size="xs">{t("home_location", { lat: location.lat.toFixed(4), lng: location.lng.toFixed(4) })}</Text>
            </Group>
          )}
        </Container>
      </Box>

      <Container size="sm" py="md">
        <TextInput
          placeholder={t("home_searchPlaceholder")} value={search}
          onChange={(e) => setSearch(e.currentTarget.value)} size="md" radius="md" mb="sm"
          leftSection={<MagnifyingGlass size={18} />}
        />
        <Group gap="sm" mb="md" wrap="nowrap" align="flex-start">
          <Select
            value={typeFilter} onChange={(v) => setTypeFilter((v as "all" | "lead" | "existing") || "all")}
            data={[{ value: "all", label: t("home_filterAll") }, { value: "lead", label: t("home_filterLeads") }, { value: "existing", label: t("home_filterExisting") }]}
            allowDeselect={false} checkIconPosition="right" size="md" radius="md" style={{ flex: 1 }}
            leftSection={<UsersThree size={16} />} aria-label={t("home_filterTypeAriaLabel")}
          />
          <Select
            value={sortBy} onChange={(v) => setSortBy((v as "recent" | "oldest" | "name") || "recent")}
            data={[
              { value: "recent", label: t("home_sortRecent") },
              { value: "oldest", label: t("home_sortOldest") },
              { value: "name", label: t("home_sortName") },
            ]}
            allowDeselect={false} checkIconPosition="right" size="md" radius="md" style={{ flex: 1 }}
            leftSection={<Clock size={16} />} aria-label={t("home_sortByAriaLabel")}
          />
        </Group>

        {farmers === undefined ? (
          // Local DB read only (milliseconds) — NOT tied to sync/network at all.
          <Center mih={260}><Loader color="green" /></Center>
        ) : filtered.length === 0 ? (
          // Always instant from local data. Sync status lives in the header icon,
          // never here — an empty village just says so, regardless of network.
          <Center mih={260}>
            <Stack align="center" gap={6}>
              <UsersThree size={48} weight="duotone" color="var(--mantine-color-gray-4)" />
              <Text c="dimmed" ta="center">
                {search ? t("home_noFarmersSearch") : t("home_noFarmersVillage")}
              </Text>
              {!search && <Text c="dimmed" size="sm">{t("home_tapToAdd")}</Text>}
            </Stack>
          </Center>
        ) : (
          <Stack gap="xs" pb={90}>
            {filtered.map((f) => {
              const status = computeStatus(f, counts.fc.get(f.id) || 0, counts.pc.get(f.id) || 0);
              const co = [f.coFirstName, f.coLastName].filter(Boolean).join(" ");
              return (
                <Paper key={f.id} withBorder radius="md" p="sm" shadow="xs">
                  <UnstyledButton w="100%" onClick={() => router.push(`/farmer/?id=${encodeURIComponent(f.id)}`)}>
                    <Group wrap="nowrap" gap="sm">
                      <StatusIcon status={status} />
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Group gap={6} wrap="nowrap">
                          <Text fw={600} truncate>{displayName(`${f.firstName} ${f.lastName}`, language)}</Text>
                          <Badge size="xs" variant="light" color={(f.farmerType || "existing") === "existing" ? "grape" : "blue"} style={{ flexShrink: 0 }}>
                            {(f.farmerType || "existing") === "existing" ? t("home_filterExisting") : t("home_lead")}
                          </Badge>
                        </Group>
                        <Text size="sm" c="dimmed" truncate>
                          {co ? t("home_coPrefix", { name: displayName(co, language) }) : f.id}
                        </Text>
                        {f.updatedAt && (
                          <Group gap={4} mt={2} wrap="nowrap" c="dimmed">
                            <Clock size={12} />
                            <Text size="xs">{t("home_updatedAgo", { time: timeAgo(f.updatedAt, t) })}</Text>
                          </Group>
                        )}
                      </Box>
                      <CaretRight size={18} color="var(--mantine-color-gray-5)" />
                    </Group>
                  </UnstyledButton>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Container>

      <Affix position={{ bottom: "calc(20px + env(safe-area-inset-bottom))", right: 20 }}>
        <Group gap="sm">
          <Button radius="xl" size="md" variant="white" color="dark" onClick={() => setScanOpen(true)}
            leftSection={<QrCode size={20} weight="bold" />}
            styles={{ root: { boxShadow: "0 8px 24px rgba(0,0,0,0.25)" } }}>
            {t("home_scan")}
          </Button>
          <Button radius="xl" size="md" leftSection={<Plus size={20} weight="bold" />} onClick={() => { setScannedCode(null); setAddOpen(true); }}
            styles={{ root: { boxShadow: "0 8px 24px rgba(6,133,79,0.4)" } }}>
            {t("home_addFarmer")}
          </Button>
        </Group>
      </Affix>

      <QrScanner opened={scanOpen} onClose={() => setScanOpen(false)} onScan={onScan} />

      <AddFarmerModal
        opened={addOpen} onClose={() => { setAddOpen(false); setScannedCode(null); }} defaultVillage={village}
        scannedCode={scannedCode}
        onCreated={(id) => router.push(`/farmer/?id=${encodeURIComponent(id)}`)}
      />

      <CreateVillageModal
        opened={createVillageOpen} onClose={() => setCreateVillageOpen(false)}
        onCreated={(code) => { setVillage(code); syncNow().catch(() => {}); }}
      />

      <AppModal opened={clearOpen} onClose={() => setClearOpen(false)} title={t("home_clearLocalData")}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t("home_clearDataWarning")}
          </Text>
          <TextInput
            label={t("home_adminPasswordLabel")} type="password" value={clearPw} placeholder={t("home_adminPasswordPlaceholder")}
            onChange={(e) => setClearPw(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter") doClear(); }} data-autofocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setClearOpen(false)}>{t("common_cancel")}</Button>
            <Button color="red" leftSection={<Trash size={16} />} onClick={doClear} loading={clearing} disabled={!clearPw}>
              {t("home_clearEverything")}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Box>
  );
}

export default function HomePage() {
  return (
    <SessionGate>
      <HomeInner />
    </SessionGate>
  );
}
