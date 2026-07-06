"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ActionIcon, Badge, Box, Center, Container, Group, Loader, Paper, SegmentedControl, Stack,
  Switch, Text, TextInput, Title,
} from "@mantine/core";
import { ArrowLeft, MagnifyingGlass, Trash, ArrowCounterClockwise } from "@phosphor-icons/react";
import { notifications } from "@mantine/notifications";
import SessionGate, { useSession } from "@/providers/SessionGate";
import { apiAdminListTable, apiAdminSetActive, type AdminRow, type AdminTable } from "@/lib/api";
import { villageByCode } from "@/lib/villages";
import { getSession } from "@/lib/session";

const TABS: { value: AdminTable; label: string }[] = [
  { value: "farmers", label: "Farmers" },
  { value: "farms", label: "Farms" },
  { value: "plots", label: "Plots" },
  { value: "soilSamples", label: "Soil samples" },
  { value: "media", label: "Media" },
];

// What to show as the row's title/subtitle for each table — they each carry
// their JSON payload in `data` with different shapes (media doesn't have one
// at all; it comes back with its own columns instead).
function describeRow(table: AdminTable, row: AdminRow): { title: string; subtitle: string } {
  const d = row.data || {};
  switch (table) {
    case "farmers": {
      const name = [d.firstName, d.lastName].filter(Boolean).join(" ") || "(no name)";
      const village = villageByCode(d.villageCode || "")?.name || d.villageCode || "";
      return { title: name, subtitle: [row.id, village].filter(Boolean).join(" · ") };
    }
    case "farms":
      return { title: d.name || row.id, subtitle: `${row.id} · farmer ${d.farmerId || "—"}` };
    case "plots":
      return { title: d.crop || "(no crop)", subtitle: `${row.id} · farm ${d.farmId || "—"}` };
    case "soilSamples":
      return { title: d.code || row.id, subtitle: `${row.id} · farm ${d.farmId || "—"}` };
    case "media":
      return { title: row.id, subtitle: row.mime_type || "" };
    default:
      return { title: row.id, subtitle: "" };
  }
}

function AdminInner() {
  const router = useRouter();
  const { isAdmin } = useSession();
  const [table, setTable] = useState<AdminTable>("farmers");
  const [rows, setRows] = useState<AdminRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Admin-only route — bounce anyone else straight back to /home.
  useEffect(() => {
    if (!isAdmin) router.replace("/home");
  }, [isAdmin, router]);

  const load = async () => {
    // FIX: bail out immediately for non-admins instead of calling the admin
    // API and getting a 403 — this is what was spamming "Admin access
    // required" toasts before the redirect above finished.
    if (!isAdmin) return;
    const s = getSession();
    if (!s) return;
    setRows(null);
    try {
      const data = await apiAdminListTable(s.token, table);
      setRows(data);
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not load records" });
      setRows([]);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [table, isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !rows) return rows || [];
    return rows.filter((r) => {
      const { title, subtitle } = describeRow(table, r);
      return `${title} ${subtitle} ${r.id}`.toLowerCase().includes(q);
    });
  }, [rows, search, table]);

  const toggleActive = async (row: AdminRow) => {
    // FIX: same guard as load() above.
    if (!isAdmin) return;
    const s = getSession();
    if (!s) return;
    const next = !row.is_active;
    setBusyId(row.id);
    try {
      await apiAdminSetActive(s.token, table, row.id, next);
      setRows((prev) => (prev ? prev.map((r) => (r.id === row.id ? { ...r, is_active: next } : r)) : prev));
      notifications.show({
        color: next ? "green" : "red",
        message: next ? `${row.id} restored` : `${row.id} deleted (soft — recoverable here anytime)`,
      });
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not update record" });
    } finally {
      setBusyId(null);
    }
  };

  if (!isAdmin) return null; // redirect effect above is already firing

  return (
    <Box mih="100dvh" style={{ background: "var(--mantine-color-gray-0)" }}>
      <Box
        style={{
          background: "linear-gradient(135deg,#06854f,#013a24)", color: "#fff",
          paddingTop: "max(16px, env(safe-area-inset-top))",
          position: "sticky", top: 0, zIndex: 20,
        }}
      >
        <Container size="sm" pb="md" pt="xs">
          <Group wrap="nowrap" gap="xs" mb="sm">
            <ActionIcon variant="subtle" color="gray.0" size="lg" onClick={() => router.push("/home")} aria-label="Back">
              <ArrowLeft size={22} />
            </ActionIcon>
            <Title order={4}>Admin</Title>
          </Group>
          <SegmentedControl
            fullWidth size="xs" data={TABS.map((t) => ({ value: t.value, label: t.label }))}
            value={table} onChange={(v) => setTable(v as AdminTable)}
          />
        </Container>
      </Box>

      <Container size="sm" py="md">
        <TextInput
          placeholder="Search…" value={search} onChange={(e) => setSearch(e.currentTarget.value)}
          size="md" radius="md" mb="md" leftSection={<MagnifyingGlass size={18} />}
        />

        {rows === null ? (
          <Center mih={200}><Loader color="green" /></Center>
        ) : filtered.length === 0 ? (
          <Center mih={200}><Text c="dimmed">No records</Text></Center>
        ) : (
          <Stack gap="xs" pb={40}>
            {filtered.map((row) => {
              const { title, subtitle } = describeRow(table, row);
              return (
                <Paper key={row.id} withBorder radius="md" p="sm" shadow="xs">
                  <Group justify="space-between" wrap="nowrap">
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Group gap={6} wrap="nowrap">
                        <Text fw={600} truncate>{title}</Text>
                        {!row.is_active && (
                          <Badge size="xs" color="red" variant="light">Deleted</Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed" truncate>{subtitle}</Text>
                    </Box>
                    <Group gap={6} wrap="nowrap">
                      {busyId === row.id ? (
                        <Loader size="xs" />
                      ) : (
                        <Switch
                          checked={row.is_active}
                          onChange={() => toggleActive(row)}
                          color="green"
                          onLabel={<Trash size={11} weight="bold" />}
                          offLabel={<ArrowCounterClockwise size={11} weight="bold" />}
                          aria-label={row.is_active ? "Delete" : "Restore"}
                        />
                      )}
                    </Group>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Container>
    </Box>
  );
}

export default function AdminPage() {
  return (
    <SessionGate>
      <AdminInner />
    </SessionGate>
  );
}