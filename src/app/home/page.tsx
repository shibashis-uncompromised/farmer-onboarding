"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ActionIcon, Affix, Box, Button, Center, Container, Group, Image, Menu, Paper,
  ScrollArea, Select, Stack, Text, TextInput, Title, UnstyledButton,
} from "@mantine/core";
import {
  MagnifyingGlass, Plus, DotsThreeVertical, DownloadSimple, SignOut,
  CaretRight, UsersThree, MapPin, CloudArrowUp,
} from "@phosphor-icons/react";
import { useLiveQuery } from "dexie-react-hooks";
import { notifications } from "@mantine/notifications";
import SessionGate, { useSession } from "@/providers/SessionGate";
import { db } from "@/lib/db";
import { VILLAGES, villageByCode } from "@/lib/villages";
import { computeStatus } from "@/lib/status";
import { StatusIcon } from "@/components/StatusBadge";
import AddFarmerModal from "@/components/AddFarmerModal";
import { exportAllZip } from "@/lib/export";
import { logout } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { apiSync } from "@/lib/api";

function HomeInner() {
  const router = useRouter();
  const { location } = useSession();
  // Persist the selected village so it survives navigation/reload (and offline).
  const [village, setVillageState] = useState<string>(() => {
    try { return localStorage.getItem("fo_selected_village") || VILLAGES[0].code; }
    catch { return VILLAGES[0].code; }
  });
  const setVillage = (v: string) => {
    setVillageState(v);
    try { localStorage.setItem("fo_selected_village", v); } catch {}
  };
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(false);

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
    const s = getSession();
    if (!s) { notifications.show({ color: "red", message: "Not signed in" }); return; }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      notifications.show({ color: "red", message: "You're offline — connect to sync" }); return;
    }
    setSyncing(true);
    try {
      const [f, fm, p] = await Promise.all([db.farmers.toArray(), db.farms.toArray(), db.plots.toArray()]);
      const uf = f.filter((x) => !x.synced), um = fm.filter((x) => !x.synced), up = p.filter((x) => !x.synced);
      if (!uf.length && !um.length && !up.length) {
        notifications.show({ message: "Everything is already synced" }); return;
      }
      await apiSync(s.token, { farmers: uf, farms: um, plots: up });
      await db.transaction("rw", db.farmers, db.farms, db.plots, async () => {
        for (const x of uf) await db.farmers.update(x.id, { synced: true });
        for (const x of um) await db.farms.update(x.id, { synced: true });
        for (const x of up) await db.plots.update(x.id, { synced: true });
      });
      notifications.show({ color: "green", message: `Synced ${uf.length} farmers · ${um.length} farms · ${up.length} plots` });
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Sync failed" });
    } finally {
      setSyncing(false);
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
            <Menu position="bottom-end" withArrow shadow="md">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray.0" size="lg" aria-label="Menu">
                  <DotsThreeVertical size={24} weight="bold" />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<CloudArrowUp size={16} />} onClick={doSync} disabled={syncing}
                  rightSection={unsynced > 0 ? <Text size="xs" c="orange.7" fw={700}>{unsynced}</Text> : null}>
                  {syncing ? "Syncing…" : "Sync to server"}
                </Menu.Item>
                <Menu.Item leftSection={<DownloadSimple size={16} />} onClick={doExport} disabled={exporting}>
                  {exporting ? "Exporting…" : "Export all (ZIP)"}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<SignOut size={16} />} onClick={() => { logout(); router.replace("/login"); }}>
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>

          <Select
            data={VILLAGES.map((v) => ({ value: v.code, label: `${v.name} · ${v.block}` }))}
            value={village} onChange={(v) => v && setVillage(v)} allowDeselect={false}
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

        {filtered.length === 0 ? (
          <Center mih={260}>
            <Stack align="center" gap={6}>
              <UsersThree size={48} weight="duotone" color="var(--mantine-color-gray-4)" />
              <Text c="dimmed" ta="center">
                {search ? "No farmers match your search" : "No farmers yet in this village"}
              </Text>
              <Text c="dimmed" size="sm">Tap the + button to add one</Text>
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
        <Button radius="xl" size="md" leftSection={<Plus size={20} weight="bold" />} onClick={() => setAddOpen(true)}
          styles={{ root: { boxShadow: "0 8px 24px rgba(6,133,79,0.4)" } }}>
          Add farmer
        </Button>
      </Affix>

      <AddFarmerModal
        opened={addOpen} onClose={() => setAddOpen(false)} defaultVillage={village}
        onCreated={(id) => router.push(`/farmer?id=${id}`)}
      />
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
