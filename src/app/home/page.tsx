"use client";
import OfflineMapDownloader from "@/components/OfflineMapDownloader";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ActionIcon, Affix, Box, Button, Center, Container, Group, Image, Loader, Menu, Paper,
  ScrollArea, Select, Stack, Text, TextInput, Title, UnstyledButton,
} from "@mantine/core";
import {
  MagnifyingGlass, Plus, DotsThreeVertical, DownloadSimple, SignOut,
  CaretRight, UsersThree, MapPin, CloudArrowUp, ArrowsClockwise, CloudCheck, CloudSlash, WarningCircle,
  QrCode, Trash,CloudArrowDown,
} from "@phosphor-icons/react";
import { useLiveQuery } from "dexie-react-hooks";
import { notifications } from "@mantine/notifications";
import SessionGate, { useSession } from "@/providers/SessionGate";
import { db } from "@/lib/db";
import { villageByCode, villagesForUser } from "@/lib/villages";
import { computeStatus } from "@/lib/status";
import { StatusIcon } from "@/components/StatusBadge";
import AddFarmerModal from "@/components/AddFarmerModal";
import AppModal from "@/components/AppModal";
import QrScanner from "@/components/QrScanner";
import { parseQr, looksLikeFarmerCode } from "@/lib/qr";
import { exportAllZip } from "@/lib/export";
import { logout } from "@/lib/auth";

function HomeInner() {
  const router = useRouter();
  const [offlineMapsOpen, setOfflineMapsOpen] = useState(false);
  const { user, location, syncState, syncNow } = useSession();
  // Villages this user may see (RJ users see RJ villages, mpfield sees MP).
  const villages = useMemo(() => villagesForUser(user.username), [user.username]);
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
    () => db.farmers.where("villageCode").equals(village).reverse().sortBy("updatedAt"),
    [village]
  );
  const farms = useLiveQuery(() => db.farms.toArray(), []);
  const plots = useLiveQuery(() => db.plots.toArray(), []);

  const unsynced = useLiveQuery(async () => {
    const [f, fm, p] = await Promise.all([db.farmers.toArray(), db.farms.toArray(), db.plots.toArray()]);
    return f.filter((x) => !x.synced).length + fm.filter((x) => !x.synced).length + p.filter((x) => !x.synced).length;
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
    return (farmers || []).filter((f) => {
      if (!q) return true;
      return (
        `${f.firstName} ${f.lastName}`.toLowerCase().includes(q) ||
        `${f.coFirstName} ${f.coLastName}`.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q) ||
        f.phone.includes(q)
      );
    });
  }, [farmers, search]);

  const doExport = async () => {
    setExporting(true);
    try {
      const { farmers: n } = await exportAllZip();
      notifications.show({ color: "green", message: `Exported ${n} farmer record(s)` });
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Export failed" });
    } finally {
      setExporting(false);
    }
  };

  const doSync = async () => {
    const r = await syncNow();
    if (r) notifications.show({ color: "green", message: `Synced ✓  ↑ ${r.pushed} · ↓ ${r.pulled}` });
    else if (typeof navigator !== "undefined" && !navigator.onLine) notifications.show({ color: "red", message: "You're offline" });
  };

  // Wipe ALL local data on this device (farmers/farms/plots/photos). The server
  // copy is untouched — this only clears IndexedDB on this phone/laptop.
  const CLEAR_PW = "admin123";
  const doClear = async () => {
    if (clearPw !== CLEAR_PW) {
      notifications.show({ color: "red", message: "Incorrect password" });
      return;
    }
    setClearing(true);
    try {
      await db.transaction("rw", db.farmers, db.farms, db.plots, db.media, async () => {
        await Promise.all([db.farmers.clear(), db.farms.clear(), db.plots.clear(), db.media.clear()]);
      });
      notifications.show({ color: "green", message: "Local data cleared on this device" });
      setClearOpen(false);
      setClearPw("");
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not clear data" });
    } finally {
      setClearing(false);
    }
  };

  // Scanned QR → if the farmer exists, open them; otherwise open the new-farmer
  // dialog prefilled with the scanned code (fully offline — local lookup only).
  const onScan = async (raw: string) => {
    const { code } = parseQr(raw);
    if (!looksLikeFarmerCode(code)) {
      notifications.show({ color: "red", message: `Not a farmer QR: ${code || "empty"}` });
      setScanOpen(false);
      return;
    }
    setScanOpen(false);
    const existing = await db.farmers.get(code);
    if (existing) {
      router.push(`/farmer?id=${code}`);
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
                <Text fw={700} fz={9} style={{ letterSpacing: 1, opacity: 0.85 }}>UNCOMPROMISED</Text>
                <Title order={4} lh={1.1}>Farmer Onboarding</Title>
              </div>
            </Group>
            <Group gap={2}>
              {appVersion && (
                <Text size="xs" c="green.1" fw={600} mr={2} title="App version">{appVersion}</Text>
              )}
              <ActionIcon
                variant="subtle" color="gray.0" size="lg" onClick={doSync} aria-label="Sync"
                title={syncState === "offline" ? "Offline" : syncState === "error" ? "Sync issue — tap to retry" : syncState === "syncing" ? "Syncing…" : "Synced"}
              >
                {syncState === "syncing" ? <ArrowsClockwise size={20} className="fo-spin" />
                  : syncState === "offline" ? <CloudSlash size={20} />
                  : syncState === "error" ? <WarningCircle size={20} />
                  : <CloudCheck size={20} />}
              </ActionIcon>
              <Menu position="bottom-end" withArrow shadow="md">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray.0" size="lg" aria-label="Menu">
                  <DotsThreeVertical size={24} weight="bold" />
                </ActionIcon>
              </Menu.Target>


              <Menu.Dropdown>
                <Menu.Item leftSection={<CloudArrowUp size={16} />} onClick={doSync} disabled={syncState === "syncing"}
                  rightSection={unsynced > 0 ? <Text size="xs" c="orange.7" fw={700}>{unsynced}</Text> : null}>
                  {syncState === "syncing" ? "Syncing…" : "Sync now"}
                </Menu.Item>
                <Menu.Item leftSection={<DownloadSimple size={16} />} onClick={doExport} disabled={exporting}>
                  {exporting ? "Exporting…" : "Export all (ZIP)"}
                </Menu.Item>
                  <Menu.Item leftSection={<CloudArrowDown size={16} />} onClick={() => setOfflineMapsOpen(true)}>
                    Offline maps
                  </Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<Trash size={16} />} onClick={() => { setClearPw(""); setClearOpen(true); }}>
                  Clear local data
                </Menu.Item>
                <Menu.Item color="red" leftSection={<SignOut size={16} />} onClick={() => { logout(); router.replace("/login"); }}>
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>



              </Menu>
            </Group>
          </Group>

          <Select
            data={villages.map((v) => ({ value: v.code, label: `${v.name} · ${v.block}` }))}
            value={village || null} onChange={(v) => v && setVillage(v)} allowDeselect={false}
            checkIconPosition="right" size="md" radius="md"
            leftSection={<MapPin size={18} />}
            styles={{ input: { fontWeight: 600 } }}
          />
          {location && (
            <Group gap={6} mt={6} c="green.1">
              <MapPin size={13} />
              <Text size="xs">Location · {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</Text>
            </Group>
          )}
        </Container>
      </Box>

      <Container size="sm" py="md">
        <TextInput
          placeholder="Search by name, C/o, ID or phone" value={search}
          onChange={(e) => setSearch(e.currentTarget.value)} size="md" radius="md" mb="md"
          leftSection={<MagnifyingGlass size={18} />}
        />

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
                {search ? "No farmers match your search" : "No farmers yet in this village"}
              </Text>
              {!search && <Text c="dimmed" size="sm">Tap the + button to add one</Text>}
            </Stack>
          </Center>
        ) : (
          <Stack gap="xs" pb={90}>
            {filtered.map((f) => {
              const status = computeStatus(f, counts.fc.get(f.id) || 0, counts.pc.get(f.id) || 0);
              const co = [f.coFirstName, f.coLastName].filter(Boolean).join(" ");
              return (
                <Paper key={f.id} withBorder radius="md" p="sm" shadow="xs">
                  <UnstyledButton w="100%" onClick={() => router.push(`/farmer?id=${f.id}`)}>
                    <Group wrap="nowrap" gap="sm">
                      <StatusIcon status={status} />
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text fw={600} truncate>{f.firstName} {f.lastName}</Text>
                        <Text size="sm" c="dimmed" truncate>
                          {co ? `C/o ${co}` : f.id}
                        </Text>
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
            Scan
          </Button>
          <Button radius="xl" size="md" leftSection={<Plus size={20} weight="bold" />} onClick={() => { setScannedCode(null); setAddOpen(true); }}
            styles={{ root: { boxShadow: "0 8px 24px rgba(6,133,79,0.4)" } }}>
            Add farmer
          </Button>
        </Group>
      </Affix>

      <QrScanner opened={scanOpen} onClose={() => setScanOpen(false)} onScan={onScan} />

      <AddFarmerModal
        opened={addOpen} onClose={() => { setAddOpen(false); setScannedCode(null); }} defaultVillage={village}
        scannedCode={scannedCode}
        onCreated={(id) => router.push(`/farmer?id=${id}`)}
      />

      <AppModal opened={clearOpen} onClose={() => setClearOpen(false)} title="Clear local data">
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            This erases all farmers, farms, plots and photos stored <b>on this device</b>.
            The server copy is not affected. Anything not yet synced will be lost.
          </Text>
          <TextInput
            label="Admin password" type="password" value={clearPw} placeholder="Enter admin password"
            onChange={(e) => setClearPw(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter") doClear(); }} data-autofocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setClearOpen(false)}>Cancel</Button>
            <Button color="red" leftSection={<Trash size={16} />} onClick={doClear} loading={clearing} disabled={!clearPw}>
              Clear everything
            </Button>
          </Group>
        </Stack>
      </AppModal>
      <OfflineMapDownloader opened={offlineMapsOpen} onClose={() => setOfflineMapsOpen(false)} />
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
