"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Accordion, ActionIcon, Avatar, Badge, Button, Center, Group, Loader, Paper, Select, Stack, Table,
  Text, TextInput, Title, Tooltip,
} from "@mantine/core";
import {
  ArrowsClockwise, CalendarBlank, MagnifyingGlass, PencilSimple, Plant, Phone, Tree, WarningCircle,
} from "@phosphor-icons/react";
import { apiListCropPlans, apiListCultivations, apiPull, type CropPlan, type Cultivation } from "@/lib/api";
import { getSession } from "@/lib/session";
import type { Farmer, Farm, Plot } from "@/lib/types";
import EditFarmerModal from "@/components/admin/EditFarmerModal";
import EditFarmModal from "@/components/admin/EditFarmModal";
import EditPlotModal from "@/components/admin/EditPlotModal";
import CultivationsModal from "@/components/admin/CultivationsModal";
import CropPlansModal from "@/components/admin/CropPlansModal";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { displayName } from "@/lib/transliterate";
import { cropLabel } from "@/lib/crops";
import { VILLAGES } from "@/lib/villages";

// One simple tree: Farmer → their Farms → each farm's Plots. Every level has
// an edit button (all fields, applied immediately), and each plot has its
// cultivations (admin-only: crop, variety, crop plan per season).
export default function AdminRecordsPage() {
  const { t, language } = useLanguage();
  const [farmers, setFarmers] = useState<Farmer[] | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [cultivations, setCultivations] = useState<Cultivation[]>([]);
  const [cropPlans, setCropPlans] = useState<CropPlan[]>([]);
  const [villageNames, setVillageNames] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [village, setVillage] = useState<string | null>(null);
  const [open, setOpen] = useState<string[]>([]);

  const [editFarmer, setEditFarmer] = useState<Farmer | null>(null);
  const [editFarm, setEditFarm] = useState<Farm | null>(null);
  const [editPlot, setEditPlot] = useState<Plot | null>(null);
  const [cultPlot, setCultPlot] = useState<Plot | null>(null);
  const [planFarm, setPlanFarm] = useState<Farm | null>(null);

  const load = async () => {
    const session = getSession();
    if (!session) return;
    setError("");
    setLoading(true);
    try {
      const [pulled, cult, plans] = await Promise.all([
        apiPull(session.token), apiListCultivations(session.token), apiListCropPlans(session.token),
      ]);
      setCropPlans(plans.cropPlans);
      setFarmers((pulled.farmers as Farmer[]).filter((f) => !f.deleted));
      setFarms((pulled.farms as Farm[]).filter((f) => !f.deleted));
      setPlots((pulled.plots as Plot[]).filter((p) => !p.deleted));
      setCultivations(cult.cultivations);
      const names: Record<string, string> = {};
      for (const v of VILLAGES) names[v.code] = v.name;
      for (const v of (pulled.villages || []) as { code: string; name: string; deleted?: boolean }[]) if (!v.deleted) names[v.code] = v.name;
      setVillageNames(names);
    } catch (e: any) {
      setError(e?.message || t("adminRecords_couldNotLoad"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const farmsByFarmer = useMemo(() => groupBy(farms, (f) => f.farmerId), [farms]);
  const plotsByFarm = useMemo(() => groupBy(plots, (p) => p.farmId), [plots]);
  const cultByPlot = useMemo(() => groupBy(cultivations, (c) => c.plotId), [cultivations]);
  const plansByFarm = useMemo(() => groupBy(cropPlans, (p) => p.farmId), [cropPlans]);

  const nameOf = (f: Farmer) => displayName(`${f.firstName || ""} ${f.lastName || ""}`.trim() || f.id, language);
  const farmName = (f: Farm) => f.name || f.alias || f.id;
  const plotName = (p: Plot) => p.name || t("farms_plotN", { seq: p.seq });

  // A farmer matches if they, or any of their farms / plots / cultivations, match.
  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!farmers) return [];
    const has = (...xs: (string | undefined | null)[]) => xs.some((x) => (x || "").toLowerCase().includes(q));
    return farmers
      .filter((f) => !village || f.villageCode === village)
      .filter((f) => {
        if (!q) return true;
        if (has(f.id, f.firstName, f.lastName, f.phone, villageNames[f.villageCode])) return true;
        return (farmsByFarmer[f.id] || []).some((fm) =>
          has(fm.id, fm.name, fm.alias) ||
          (plotsByFarm[fm.id] || []).some((p) =>
            has(p.id, p.name, p.crop) || (cultByPlot[p.id] || []).some((c) => has(c.crop, c.variety, c.cropPlan))));
      })
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  }, [farmers, q, village, farmsByFarmer, plotsByFarm, cultByPlot, villageNames, language]);

  // While searching, open every matching farmer so the hit is visible.
  const opened = q ? visible.map((f) => f.id) : open;

  const villageOptions = useMemo(() => {
    const codes = [...new Set((farmers || []).map((f) => f.villageCode))];
    return codes.map((c) => ({ value: c, label: villageNames[c] || c })).sort((a, b) => a.label.localeCompare(b.label));
  }, [farmers, villageNames]);

  const currentCultivation = (plotId: string) =>
    (cultByPlot[plotId] || []).filter((c) => !c.endDate).sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Title order={3}>{t("adminRecords_title")}</Title>
          <Text c="dimmed" size="sm">{t("adminRecords_treeSubtitle")}</Text>
        </div>
        <Button variant="default" leftSection={<ArrowsClockwise size={16} />} onClick={load} loading={loading}>
          {t("adminRecords_refresh")}
        </Button>
      </Group>

      <Group gap="sm" align="flex-end" wrap="wrap">
        <TextInput
          placeholder={t("adminRecords_treeSearch")}
          leftSection={<MagnifyingGlass size={16} />}
          value={query} onChange={(e) => setQuery(e.currentTarget.value)}
          w={340}
        />
        <Select
          placeholder={t("adminRecords_allVillages")} data={villageOptions} value={village}
          onChange={setVillage} clearable searchable w={220}
        />
        {farmers && (
          <Text size="sm" c="dimmed">
            {t("adminRecords_counts", { farmers: visible.length, farms: farms.length, plots: plots.length })}
          </Text>
        )}
      </Group>

      {!farmers && !error && <Center p="xl"><Loader color="green" /></Center>}
      {error && (
        <Center p="xl">
          <Stack align="center" gap={6}>
            <WarningCircle size={28} color="var(--mantine-color-red-6)" />
            <Text c="red" size="sm">{error}</Text>
          </Stack>
        </Center>
      )}
      {farmers && !error && visible.length === 0 && (
        <Center p="xl"><Text c="dimmed" size="sm">{t("adminRecords_noFarmersMatch")}</Text></Center>
      )}

      {farmers && visible.length > 0 && (
        <Accordion multiple value={opened} onChange={(v) => !q && setOpen(v)} variant="separated" radius="md" chevronPosition="left">
          {visible.map((f) => {
            const fFarms = farmsByFarmer[f.id] || [];
            const plotCount = fFarms.reduce((n, fm) => n + (plotsByFarm[fm.id]?.length || 0), 0);
            return (
              <Accordion.Item key={f.id} value={f.id}>
                <Group wrap="nowrap" gap={0} pr="sm">
                  <Accordion.Control>
                    <Group gap="sm" wrap="nowrap">
                      <Avatar color="green" radius="xl" size={36}>{(f.firstName || "?").slice(0, 1).toUpperCase()}</Avatar>
                      <div style={{ minWidth: 0 }}>
                        <Text fw={600} truncate>{nameOf(f)}</Text>
                        <Text size="xs" c="dimmed" truncate>
                          {f.id} · {villageNames[f.villageCode] || f.villageCode}
                          {f.phone ? <> · <Phone size={11} /> {f.phone}</> : null}
                        </Text>
                      </div>
                      <Group gap={6} ml="auto" wrap="nowrap" visibleFrom="xs">
                        <Badge variant="light" color="green" leftSection={<Tree size={11} />}>{t("adminRecords_farmsN", { n: fFarms.length })}</Badge>
                        <Badge variant="light" color="teal" leftSection={<Plant size={11} />}>{t("adminRecords_plotsN", { n: plotCount })}</Badge>
                      </Group>
                    </Group>
                  </Accordion.Control>
                  <Tooltip label={t("adminRecords_editFarmer")}>
                    <ActionIcon variant="light" color="gray" onClick={() => setEditFarmer(f)} aria-label={t("adminRecords_editFarmer")}>
                      <PencilSimple size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>

                <Accordion.Panel>
                  {fFarms.length === 0 && <Text size="sm" c="dimmed">{t("adminRecords_noFarms")}</Text>}
                  <Stack gap="sm">
                    {fFarms.map((fm) => {
                      const fPlots = [...(plotsByFarm[fm.id] || [])].sort((a, b) => a.seq.localeCompare(b.seq));
                      return (
                        <Paper key={fm.id} withBorder radius="md" p="sm">
                          <Group justify="space-between" wrap="nowrap" mb={fPlots.length ? "xs" : 0}>
                            <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                              <Tree size={18} color="var(--mantine-color-green-7)" />
                              <div style={{ minWidth: 0 }}>
                                <Text fw={600} size="sm" truncate>{farmName(fm)}</Text>
                                <Text size="xs" c="dimmed" truncate>{fm.id} · {t("adminRecords_plotsN", { n: fPlots.length })}</Text>
                              </div>
                            </Group>
                            <Group gap={6} wrap="nowrap">
                              <Button size="xs" variant="light" color="green" leftSection={<CalendarBlank size={14} />} onClick={() => setPlanFarm(fm)}>
                                {t("adminRecords_cropPlans")}{plansByFarm[fm.id]?.length ? ` (${plansByFarm[fm.id].length})` : ""}
                              </Button>
                              <Button size="xs" variant="light" color="gray" leftSection={<PencilSimple size={14} />} onClick={() => setEditFarm(fm)}>
                                {t("adminRecords_editFarm")}
                              </Button>
                            </Group>
                          </Group>

                          {fPlots.length > 0 && (
                            <Table.ScrollContainer minWidth={560}>
                              <Table verticalSpacing={6} highlightOnHover>
                                <Table.Thead>
                                  <Table.Tr>
                                    <Table.Th>{t("adminRecords_colPlot")}</Table.Th>
                                    <Table.Th>{t("field_crop")}</Table.Th>
                                    <Table.Th>{t("adminRecords_colCultivation")}</Table.Th>
                                    <Table.Th w={210} />
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {fPlots.map((p) => {
                                    const cur = currentCultivation(p.id);
                                    const nCult = cultByPlot[p.id]?.length || 0;
                                    return (
                                      <Table.Tr key={p.id}>
                                        <Table.Td>
                                          <Text size="sm" fw={500}>{plotName(p)}</Text>
                                          <Text size="xs" c="dimmed">{p.id}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                          <Text size="sm">{p.crop ? cropLabel(p.crop, language) : "—"}</Text>
                                          {p.sowingDate && <Text size="xs" c="dimmed">{t("farms_sownOn", { date: p.sowingDate })}</Text>}
                                        </Table.Td>
                                        <Table.Td>
                                          {cur
                                            ? <Badge variant="light" color="green" style={{ textTransform: "none" }}>{cur.crop} · {cur.variety}</Badge>
                                            : <Text size="xs" c="dimmed">{t("adminRecords_noCultivation")}</Text>}
                                          {nCult > (cur ? 1 : 0) && (
                                            <Text size="xs" c="dimmed">{t("adminRecords_seasonsN", { n: nCult })}</Text>
                                          )}
                                        </Table.Td>
                                        <Table.Td>
                                          <Group gap={6} justify="flex-end" wrap="nowrap">
                                            {/* Cultivations need a crop plan — define one on the farm first. */}
                                            <Tooltip label={t("adminRecords_definePlanFirst")} disabled={!!plansByFarm[fm.id]?.length}>
                                              <span>
                                                <Button size="xs" variant="light" color="green" leftSection={<Plant size={14} />}
                                                  disabled={!plansByFarm[fm.id]?.length} onClick={() => setCultPlot(p)}>
                                                  {t("adminRecords_cultivations")}
                                                </Button>
                                              </span>
                                            </Tooltip>
                                            <Tooltip label={t("adminRecords_editPlot")}>
                                              <ActionIcon variant="light" color="gray" onClick={() => setEditPlot(p)} aria-label={t("adminRecords_editPlot")}>
                                                <PencilSimple size={15} />
                                              </ActionIcon>
                                            </Tooltip>
                                          </Group>
                                        </Table.Td>
                                      </Table.Tr>
                                    );
                                  })}
                                </Table.Tbody>
                              </Table>
                            </Table.ScrollContainer>
                          )}
                        </Paper>
                      );
                    })}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      )}

      <EditFarmerModal farmer={editFarmer} opened={!!editFarmer} onClose={() => setEditFarmer(null)} onSaved={load} />
      <EditFarmModal
        farm={editFarm} opened={!!editFarm} onClose={() => setEditFarm(null)} onSaved={load}
        farmerLabel={editFarm ? (farmers?.find((x) => x.id === editFarm.farmerId) ? nameOf(farmers.find((x) => x.id === editFarm.farmerId)!) : editFarm.farmerId) : undefined}
      />
      <EditPlotModal
        plot={editPlot} opened={!!editPlot} onClose={() => setEditPlot(null)} onSaved={load}
        contextLabel={editPlot ? t("adminRecords_farmContext", { id: editPlot.farmId }) : undefined}
      />
      <CropPlansModal
        farm={planFarm}
        farmLabel={planFarm ? (planFarm.name || planFarm.alias ? `${planFarm.name || planFarm.alias} · ${planFarm.id}` : planFarm.id) : ""}
        cropPlans={planFarm ? plansByFarm[planFarm.id] || [] : []}
        opened={!!planFarm}
        onClose={() => setPlanFarm(null)}
        onChanged={load}
      />
      <CultivationsModal
        plot={cultPlot}
        plotLabel={cultPlot ? `${plotName(cultPlot)} · ${cultPlot.id}` : ""}
        cultivations={cultPlot ? cultByPlot[cultPlot.id] || [] : []}
        allCultivations={cultivations}
        cropPlans={cultPlot ? plansByFarm[cultPlot.farmId] || [] : []}
        opened={!!cultPlot}
        onClose={() => setCultPlot(null)}
        onChanged={load}
      />
    </Stack>
  );
}

function groupBy<T>(xs: T[], key: (x: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const x of xs) (out[key(x)] ||= []).push(x);
  return out;
}
