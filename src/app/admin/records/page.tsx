"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon, Anchor, Badge, Center, Group, Loader, Paper, Stack, Table, Tabs,
  Text, TextInput, Title, Tooltip,
} from "@mantine/core";
import { MagnifyingGlass, MapTrifold, PencilSimple, Plant, UsersThree, WarningCircle } from "@phosphor-icons/react";
import { apiPull } from "@/lib/api";
import { getSession } from "@/lib/session";
import type { Farmer, Farm, Plot } from "@/lib/types";
import EditFarmerModal from "@/components/admin/EditFarmerModal";
import EditFarmModal from "@/components/admin/EditFarmModal";
import EditPlotModal from "@/components/admin/EditPlotModal";

// Browse every farmer, farm and plot and edit their dynamic (seasonally
// re-examined) fields directly — admin edits skip the pending-review queue
// entirely and apply immediately. Read-only static fields are shown for
// context but aren't editable from here.
export default function AdminRecordsPage() {
  const [farmers, setFarmers] = useState<Farmer[] | null>(null);
  const [farms, setFarms] = useState<Farm[] | null>(null);
  const [plots, setPlots] = useState<Plot[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<string | null>("farmers");
  const [query, setQuery] = useState("");

  const [editFarmer, setEditFarmer] = useState<Farmer | null>(null);
  const [editFarm, setEditFarm] = useState<Farm | null>(null);
  const [editPlot, setEditPlot] = useState<Plot | null>(null);

  const load = async () => {
    const session = getSession();
    if (!session) return;
    setError("");
    try {
      const { farmers, farms, plots } = await apiPull(session.token);
      setFarmers((farmers as Farmer[]).filter((f) => !f.deleted));
      setFarms((farms as Farm[]).filter((f) => !f.deleted));
      setPlots((plots as Plot[]).filter((p) => !p.deleted));
    } catch (e: any) {
      setError(e?.message || "Could not load records");
    }
  };
  useEffect(() => { load(); }, []);

  const farmerLabel = (id: string) => {
    const f = farmers?.find((x) => x.id === id);
    return f ? `${f.firstName} ${f.lastName}`.trim() || id : id;
  };
  const jumpTo = (nextTab: string, id: string) => { setTab(nextTab); setQuery(id); };

  const farmCountByFarmer = useMemo(() => {
    const m: Record<string, number> = {};
    for (const fm of farms || []) m[fm.farmerId] = (m[fm.farmerId] || 0) + 1;
    return m;
  }, [farms]);
  const plotCountByFarm = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of plots || []) m[p.farmId] = (m[p.farmId] || 0) + 1;
    return m;
  }, [plots]);

  const q = query.trim().toLowerCase();
  const filteredFarmers = useMemo(() => {
    if (!farmers) return [];
    if (!q) return farmers;
    return farmers.filter((f) =>
      f.id.toLowerCase().includes(q) || `${f.firstName} ${f.lastName}`.toLowerCase().includes(q) || f.villageCode.toLowerCase().includes(q)
    );
  }, [farmers, q]);
  const filteredFarms = useMemo(() => {
    if (!farms) return [];
    if (!q) return farms;
    return farms.filter((f) =>
      f.id.toLowerCase().includes(q) || f.farmerId.toLowerCase().includes(q) ||
      f.villageCode.toLowerCase().includes(q) || farmerLabel(f.farmerId).toLowerCase().includes(q)
    );
  }, [farms, q, farmers]);
  const filteredPlots = useMemo(() => {
    if (!plots) return [];
    if (!q) return plots;
    return plots.filter((p) =>
      p.id.toLowerCase().includes(q) || p.farmId.toLowerCase().includes(q) ||
      p.farmerId.toLowerCase().includes(q) || (p.crop || "").toLowerCase().includes(q)
    );
  }, [plots, q]);

  const loading = !farmers && !farms && !plots && !error;

  return (
    <Stack gap="lg">
      <div>
        <Title order={3}>Farm Records</Title>
        <Text c="dimmed" size="sm">
          Every farmer, farm and plot. Edits here apply immediately — no approval queue.
        </Text>
      </div>

      <TextInput
        placeholder="Search by id, name, village or crop"
        leftSection={<MagnifyingGlass size={16} />}
        value={query} onChange={(e) => setQuery(e.currentTarget.value)}
        maw={360}
      />

      {loading && <Center p="xl"><Loader color="green" /></Center>}
      {error && (
        <Center p="xl">
          <Stack align="center" gap={6}>
            <WarningCircle size={28} color="var(--mantine-color-red-6)" />
            <Text c="red" size="sm">{error}</Text>
          </Stack>
        </Center>
      )}

      {!loading && !error && (
        <Tabs value={tab} onChange={setTab} color="green">
          <Tabs.List>
            <Tabs.Tab value="farmers" leftSection={<UsersThree size={16} />}>Farmers ({farmers?.length ?? 0})</Tabs.Tab>
            <Tabs.Tab value="farms" leftSection={<Plant size={16} />}>Farms ({farms?.length ?? 0})</Tabs.Tab>
            <Tabs.Tab value="plots" leftSection={<MapTrifold size={16} />}>Plots ({plots?.length ?? 0})</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="farmers" pt="md">
            <Paper withBorder radius="lg" p={0}>
              {filteredFarmers.length === 0 ? (
                <Center p="xl"><Text c="dimmed" size="sm">No farmers match your search</Text></Center>
              ) : (
                <Table.ScrollContainer minWidth={760}>
                  <Table verticalSpacing="sm" highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Farmer</Table.Th>
                        <Table.Th>Village</Table.Th>
                        <Table.Th>Financial capacity</Table.Th>
                        <Table.Th>Landholding</Table.Th>
                        <Table.Th>Adoption level</Table.Th>
                        <Table.Th>Farms</Table.Th>
                        <Table.Th w={50} />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredFarmers.map((f) => (
                        <Table.Tr key={f.id}>
                          <Table.Td>
                            <Text size="sm" fw={500}>{f.firstName} {f.lastName}</Text>
                            <Text size="xs" c="dimmed">{f.id}</Text>
                          </Table.Td>
                          <Table.Td><Text size="sm">{f.villageCode}</Text></Table.Td>
                          <Table.Td><Text size="sm" c="dimmed">{f.financialCapacity || "—"}</Text></Table.Td>
                          <Table.Td><Text size="sm" c="dimmed">{f.landholding || "—"}</Text></Table.Td>
                          <Table.Td><Text size="sm" c="dimmed">{f.adoptionLevel || "—"}</Text></Table.Td>
                          <Table.Td>
                            <Anchor size="sm" onClick={() => jumpTo("farms", f.id)}>
                              {farmCountByFarmer[f.id] || 0}
                            </Anchor>
                          </Table.Td>
                          <Table.Td>
                            <Tooltip label="Edit dynamic fields">
                              <ActionIcon variant="subtle" color="gray" onClick={() => setEditFarmer(f)}>
                                <PencilSimple size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="farms" pt="md">
            <Paper withBorder radius="lg" p={0}>
              {filteredFarms.length === 0 ? (
                <Center p="xl"><Text c="dimmed" size="sm">No farms match your search</Text></Center>
              ) : (
                <Table.ScrollContainer minWidth={760}>
                  <Table verticalSpacing="sm" highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Farm</Table.Th>
                        <Table.Th>Farmer</Table.Th>
                        <Table.Th>Village</Table.Th>
                        <Table.Th>Trees (big/small)</Table.Th>
                        <Table.Th>Water source</Table.Th>
                        <Table.Th>Plots</Table.Th>
                        <Table.Th w={50} />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredFarms.map((fm) => (
                        <Table.Tr key={fm.id}>
                          <Table.Td><Text size="sm" fw={500}>{fm.alias || fm.id}</Text></Table.Td>
                          <Table.Td>
                            <Anchor size="sm" onClick={() => jumpTo("farmers", fm.farmerId)}>
                              {farmerLabel(fm.farmerId)}
                            </Anchor>
                          </Table.Td>
                          <Table.Td><Text size="sm">{fm.villageCode}</Text></Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">{fm.treeCountBig ?? "—"} / {fm.treeCountSmall ?? "—"}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4}>
                              {(fm.waterSource || []).length === 0
                                ? <Text size="sm" c="dimmed">—</Text>
                                : fm.waterSource!.map((w) => <Badge key={w} size="xs" variant="light">{w}</Badge>)}
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Anchor size="sm" onClick={() => jumpTo("plots", fm.id)}>
                              {plotCountByFarm[fm.id] || 0}
                            </Anchor>
                          </Table.Td>
                          <Table.Td>
                            <Tooltip label="Edit dynamic fields">
                              <ActionIcon variant="subtle" color="gray" onClick={() => setEditFarm(fm)}>
                                <PencilSimple size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="plots" pt="md">
            <Paper withBorder radius="lg" p={0}>
              {filteredPlots.length === 0 ? (
                <Center p="xl"><Text c="dimmed" size="sm">No plots match your search</Text></Center>
              ) : (
                <Table.ScrollContainer minWidth={640}>
                  <Table verticalSpacing="sm" highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Plot</Table.Th>
                        <Table.Th>Farm</Table.Th>
                        <Table.Th>Farmer</Table.Th>
                        <Table.Th>Crop</Table.Th>
                        <Table.Th>Sowing date</Table.Th>
                        <Table.Th w={50} />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredPlots.map((p) => (
                        <Table.Tr key={p.id}>
                          <Table.Td><Text size="sm" fw={500}>{p.id}</Text></Table.Td>
                          <Table.Td>
                            <Anchor size="sm" onClick={() => jumpTo("farms", p.farmId)}>{p.farmId}</Anchor>
                          </Table.Td>
                          <Table.Td>
                            <Anchor size="sm" onClick={() => jumpTo("farmers", p.farmerId)}>{farmerLabel(p.farmerId)}</Anchor>
                          </Table.Td>
                          <Table.Td><Text size="sm">{p.crop || "—"}</Text></Table.Td>
                          <Table.Td><Text size="sm" c="dimmed">{p.sowingDate || "—"}</Text></Table.Td>
                          <Table.Td>
                            <Tooltip label="Edit dynamic fields">
                              <ActionIcon variant="subtle" color="gray" onClick={() => setEditPlot(p)}>
                                <PencilSimple size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Paper>
          </Tabs.Panel>
        </Tabs>
      )}

      <EditFarmerModal farmer={editFarmer} opened={!!editFarmer} onClose={() => setEditFarmer(null)} onSaved={load} />
      <EditFarmModal
        farm={editFarm} farmerLabel={editFarm ? farmerLabel(editFarm.farmerId) : undefined}
        opened={!!editFarm} onClose={() => setEditFarm(null)} onSaved={load}
      />
      <EditPlotModal
        plot={editPlot} contextLabel={editPlot ? `farm ${editPlot.farmId}` : undefined}
        opened={!!editPlot} onClose={() => setEditPlot(null)} onSaved={load}
      />
    </Stack>
  );
}
