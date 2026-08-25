"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon, Autocomplete, Badge, Box, Button, Card, Center, Divider, Group, Image, Loader, MultiSelect, NumberInput, Paper,
  SegmentedControl, Select, SimpleGrid, Stack, Text, Textarea, TextInput, ThemeIcon, Timeline, UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  Plus, MapPinLine, Crosshair, Plant, Tree, CheckCircle, Path, Polygon, MapPin, Trash,
  Flask, ClockCounterClockwise, PencilSimple, CalendarBlank, DeviceMobile, Users, Drop,
  Warning, PawPrint, Tractor, TrendUp, Sun, Shield,
} from "@phosphor-icons/react";
import { useLiveQuery } from "dexie-react-hooks";
import { notifications } from "@mantine/notifications";
import { db } from "@/lib/db";
import { nextFarmId, nextPlotId, uid } from "@/lib/ids";
import { getBestLocation, getLastLocation, fmtCoord } from "@/lib/location";
import { boundsAroundPoint, downloadTiles } from "@/lib/offlineTiles";
import { looksLikeFarmerCode, looksLikeSoilCode } from "@/lib/qr";
import { useSession } from "@/providers/SessionGate";
import { getSession } from "@/lib/session";
import { apiElevation, type ElevationPoint } from "@/lib/api";
import type {
  Farmer, Farm, Plot, SessionLocation, BoundaryPoint, SoilSample, SoilTextureTest, WaterTDSTest,
  MobileCoverage, FarmShape, FarmerFocus, WaterSource, IrrigationAvailable, Season, KnownIssue,
  AnimalPressure, Accessibility, BenchmarkComparison, PreviousCropProduction,
  Gradient, WaterloggingProbability, SunlightAvailability, FencingAvailability,
} from "@/lib/types";
import { softDeletePlot } from "@/lib/softDelete";
import { CROPS, PREVIOUS_CROPS } from "@/lib/crops";
import { useMediaUrl } from "@/lib/useMediaUrl";
import PhotoInput from "./PhotoInput";
import AppModal from "./AppModal";
import QrScanner from "./QrScanner";
import MapErrorBoundary from "./MapErrorBoundary";

// ---- Option lists for the new data-collection fields (grouped by who fills them in) ----
const MOBILE_COVERAGE_OPTS = [
  { value: "good", label: "Good" }, { value: "weak", label: "Weak" }, { value: "none", label: "None" },
];
const SHAPE_OPTS = [
  { value: "rectangle", label: "Rectangle" }, { value: "square", label: "Square" },
  { value: "trapezoid", label: "Trapezoid" }, { value: "irregular", label: "Irregular" },
];
const SHAPE_LABEL: Record<string, string> = Object.fromEntries(SHAPE_OPTS.map((o) => [o.value, o.label]));

// Familiar, direct frequency labels — this is the SUPERVISOR's required
// visit cadence for this farm, not how often the farmer themselves works it.
const FARMER_FOCUS_OPTS = [
  { value: "daily", label: "Daily" }, { value: "twice_weekly", label: "Twice a week" }, { value: "weekly_plus", label: "Weekly or less" },
];
const FARMER_FOCUS_DESCRIPTIONS: Record<FarmerFocus, string> = {
  daily: "Daily — supervisor should check in on this farm every day.",
  twice_weekly: "Twice a week — supervisor should check in on this farm a couple of times a week.",
  weekly_plus: "Weekly or less — supervisor can check in on this farm about once a week or less often.",
};
const WATER_SOURCE_OPTS = [
  { value: "rainfed", label: "Rainfed" }, { value: "borewell", label: "Borewell" },
  { value: "open_well", label: "Open well" }, { value: "farm_pond", label: "Farm pond" },
  { value: "anicut_river", label: "Anicut / River" },
];
// Water Source used to be a single value — tolerate farms saved under that
// old shape (a bare string) as well as the current array shape, since JSONB
// rows from before this change aren't retroactively migrated.
function asWaterSourceArray(v: unknown): WaterSource[] {
  if (Array.isArray(v)) return v as WaterSource[];
  return v ? [v as WaterSource] : [];
}
const IRRIGATION_OPTS = [
  { value: "none", label: "None" }, { value: "flood", label: "Flood" },
  { value: "sprinkler", label: "Sprinkler" }, { value: "drip", label: "Drip" },
];
// Irrigation Available used to be a single value — tolerate farms saved under
// that old shape (a bare string) as well as the current array shape, since
// JSONB rows from before this change aren't retroactively migrated.
function asIrrigationArray(v: unknown): IrrigationAvailable[] {
  if (Array.isArray(v)) return v as IrrigationAvailable[];
  return v ? [v as IrrigationAvailable] : [];
}
const SEASON_OPTS = [
  { value: "kharif", label: "Kharif" }, { value: "rabi", label: "Rabi" }, { value: "zaid", label: "Zaid" },
];
const KNOWN_ISSUE_OPTS = [
  { value: "termites", label: "Termites" }, { value: "nematodes", label: "Nematodes" },
  { value: "frost", label: "Frost" }, { value: "flooding", label: "Flooding" }, { value: "other", label: "Other" },
];
const ANIMAL_PRESSURE_OPTS = [
  { value: "nilgai", label: "Nilgai" }, { value: "boar", label: "Boar" }, { value: "monkey", label: "Monkey" },
  { value: "rabbit", label: "Rabbit" }, { value: "birds", label: "Birds" }, { value: "other", label: "Other" },
];
const ACCESSIBILITY_OPTS = [
  { value: "tractor", label: "Tractor" }, { value: "small_machinery", label: "Small machinery" },
  { value: "hand_tools", label: "Hand tools only" },
];
// Spelled-out meaning shown under the control as the fieldworker picks —
// mirrors the FARMER_FOCUS_DESCRIPTIONS pattern (short label, clear meaning).
const ACCESSIBILITY_DESCRIPTIONS: Record<Accessibility, string> = {
  tractor: "Full-size tractor can reach the plot — clear access road, no obstructions",
  small_machinery: "Only smaller machinery fits — power tiller, mini tractor, etc.",
  hand_tools: "No machinery access — hand tools only",
};
const BENCHMARK_OPTS = [
  { value: "above", label: "Above average" }, { value: "at", label: "About average" }, { value: "below", label: "Below average" },
];
const GRADIENT_OPTS = [
  { value: "flat", label: "Flat" }, { value: "slight", label: "Slight slope (<5%)" },
  { value: "significant", label: "Significant slope (>10%)" },
];
const WATERLOGGING_OPTS = [
  { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" },
];
const SUNLIGHT_OPTS = [
  { value: "unobstructed", label: "Unobstructed" }, { value: "partial", label: "Partial (>80%)" }, { value: "low", label: "Low (<75%)" },
];
const FENCING_OPTS = [
  { value: "none", label: "None" }, { value: "natural", label: "Natural" }, { value: "stone_pitch", label: "Stone pitch" },
  { value: "wire_fence", label: "Wire fence" }, { value: "boundary_wall", label: "Boundary wall" },
];
const labelOf = (opts: { value: string; label: string }[], v?: string | null) => opts.find((o) => o.value === v)?.label || null;

// ---- Derived shape/size from a walked boundary (flat-earth approximation, fine at plot scale) ----
function toLocalXY(points: BoundaryPoint[]) {
  const R = 6378137;
  const lat0 = (points[0].lat * Math.PI) / 180;
  const lng0 = (points[0].lng * Math.PI) / 180;
  return points.map((p) => {
    const lat = (p.lat * Math.PI) / 180;
    const lng = (p.lng * Math.PI) / 180;
    return { x: R * (lng - lng0) * Math.cos(lat0), y: R * (lat - lat0) };
  });
}

function polygonAreaSqM(points: BoundaryPoint[]): number | null {
  if (points.length < 3) return null;
  const xy = toLocalXY(points);
  let sum = 0;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i], b = xy[(i + 1) % xy.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function classifyShape(points: BoundaryPoint[]): FarmShape | null {
  if (points.length < 3) return null;
  if (points.length !== 4) return points.length === 3 ? "trapezoid" : "irregular";
  const xy = toLocalXY(points);
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const [p0, p1, p2, p3] = xy;
  const s0 = dist(p0, p1), s1 = dist(p1, p2), s2 = dist(p2, p3), s3 = dist(p3, p0);
  const closeEnough = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b, 0.01) < 0.12;
  if (closeEnough(s0, s2) && closeEnough(s1, s3)) return closeEnough(s0, s1) ? "square" : "rectangle";
  return "trapezoid";
}

const SQM_TO_SQFT = 10.7639;
const SQM_TO_ACRE = 0.000247105;
// Plot size briefly stored hectares — for the handful of farms saved during
// that window, convert back to sq ft on read (not retroactively migrated,
// just read-tolerated).
const SQFT_PER_HECTARE = 107639.1;
const legacyHectToSqFt = (hect: number) => Math.round(hect * SQFT_PER_HECTARE);

// ---- Gradient estimate from the boundary walk's GPS altitude readings ----
// Rough and offline: phone GPS altitude is typically 2-3x noisier than the
// horizontal fix, so this is a *suggestion* the supervisor can override, not
// an authoritative reading. Needs at least 2 points with an altitude value
// and enough horizontal separation between the highest/lowest to be meaningful.
interface GradientEstimate { gradient: Gradient; percent: number; }

function estimateGradientFromBoundary(points: BoundaryPoint[]): GradientEstimate | null {
  const withAlt = points.filter((p) => p.alt != null);
  if (withAlt.length < 2) return null;

  const xy = toLocalXY(points);
  const altIndexed = points
    .map((p, i) => ({ alt: p.alt as number, x: xy[i].x, y: xy[i].y }))
    .filter((p) => p.alt != null);

  let hi = altIndexed[0], lo = altIndexed[0];
  for (const p of altIndexed) {
    if (p.alt > hi.alt) hi = p;
    if (p.alt < lo.alt) lo = p;
  }
  const rise = Math.abs(hi.alt - lo.alt);
  const run = Math.hypot(hi.x - lo.x, hi.y - lo.y);
  if (run < 3) return null;   // too close together to estimate reliably

  const percent = (rise / run) * 100;
  const gradient: Gradient = percent < 2 ? "flat" : percent <= 10 ? "slight" : "significant";
  return { gradient, percent: Math.round(percent * 10) / 10 };
}

const MapLoading = ({ height = 320 }: { height?: number }) => (
  <Box style={{ height, width: "100%", borderRadius: 8, overflow: "hidden" }}>
    <Center h="100%" bg="gray.1"><Loader color="green" size="sm" /></Center>
  </Box>
);

const BoundaryDrawMap = dynamic(() => import("./BoundaryDrawMap"), {
  ssr: false,
  loading: () => <MapLoading height={320} />,
});
const FarmBoundaryPreview = dynamic(() => import("./FarmBoundaryPreview"), {
  ssr: false,
  loading: () => <MapLoading height={180} />,
});

export default function FarmsStep({ farmer }: { farmer: Farmer }) {
  const farms = useLiveQuery(async () => (await db.farms.where("farmerId").equals(farmer.id).toArray()).filter((x) => !x.deleted), [farmer.id]);
  const plots = useLiveQuery(async () => (await db.plots.where("farmerId").equals(farmer.id).toArray()).filter((x) => !x.deleted), [farmer.id]);
  const [farmOpen, farmModal] = useDisclosure(false);

  return (
    <Stack gap="md">
      {(farms || []).length === 0 ? (
        <Paper withBorder radius="md" p="lg" ta="center">
          <ThemeIcon size={48} radius="xl" variant="light" color="green" mx="auto" mb="sm">
            <Tree size={28} weight="duotone" />
          </ThemeIcon>
          <Text c="dimmed" mb="md">No farms added yet</Text>
          <Button leftSection={<Plus size={18} />} onClick={farmModal.open}>Add farm</Button>
        </Paper>
      ) : (
        <>
          {(farms || []).map((farm) => (
            <FarmCard key={farm.id} farm={farm} plots={(plots || []).filter((p) => p.farmId === farm.id)} />
          ))}
          <Button variant="light" leftSection={<Plus size={18} />} onClick={farmModal.open}>Add another farm</Button>
        </>
      )}

      <AddFarmModal opened={farmOpen} onClose={farmModal.close} farmer={farmer} />
    </Stack>
  );
}

function FarmCard({ farm, plots }: { farm: Farm; plots: any[] }) {
  const { syncNow } = useSession();
  const [plotOpen, plotModal] = useDisclosure(false);
  const [editPlot, setEditPlot] = useState<Plot | null>(null);
  const [scanOpen, scanModal] = useDisclosure(false);
  const [samplesOpen, samplesModal] = useDisclosure(false);
  const [editOpen, editModal] = useDisclosure(false);
  const [detailOpen, detailModal] = useDisclosure(false);
  const [manualOpen, manualModal] = useDisclosure(false);
  const [cropOpen, cropModal] = useDisclosure(false);
  // Soil type (clay/sand/silt) history — a repeatable record per plot, so
  // tracked per-plot rather than as a single disclosure like the modals above.
  const [soilTestsPlot, setSoilTestsPlot] = useState<Plot | null>(null);
  const [addSoilTestPlot, setAddSoilTestPlot] = useState<Plot | null>(null);
  // Water TDS history — same repeatable-per-plot pattern as soil type tests.
  const [waterTestsPlot, setWaterTestsPlot] = useState<Plot | null>(null);
  const [addWaterTestPlot, setAddWaterTestPlot] = useState<Plot | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const url = useMediaUrl(farm.photoId);
  const soilSamples = useLiveQuery(
    async () => (await db.soilSamples.where("farmId").equals(farm.id).toArray()).filter((x) => !x.deleted),
    [farm.id]
  );

  // Step 1 — scan/type a soil-sample code → validate → open the past-crops form.
  const onScanSample = async (raw: string) => {
    const code = (raw || "").trim();
    scanModal.close();
    manualModal.close();
    if (!code) return;
    if (looksLikeFarmerCode(code)) {
      notifications.show({ color: "red", message: `${code} is a farmer QR — not a soil sample` });
      return;
    }
    if (!looksLikeSoilCode(code)) {
      notifications.show({ color: "red", message: `Invalid soil code: ${code} (expected e.g. RJ-AMOD-SA001)` });
      return;
    }
    const allSamples = await db.soilSamples.toArray();
    const dup = allSamples.find((s) => !s.deleted && s.code.toUpperCase() === code.toUpperCase());
    if (dup) {
      notifications.show({ color: "blue", message: `Sample ${code} is already added` });
      return;
    }
    setPendingCode(code.toUpperCase());
    cropModal.open();
  };

  // Step 2 — SAVE IMMEDIATELY with past crops + a backup location (farm coords →
  // last known GPS), then improve the location in the background when a fresh
  // fix arrives. Never waits on GPS or network — works fully offline.
  const saveSample = async (pastCrops: string) => {
    const code = pendingCode;
    cropModal.close();
    setPendingCode(null);
    if (!code) return;
    try {
      const last = getLastLocation();
      const backup = farm.lat != null && farm.lng != null
        ? { lat: farm.lat, lng: farm.lng, accuracy: farm.accuracy ?? null }
        : last ? { lat: last.lat, lng: last.lng, accuracy: last.accuracy } : null;
      const now = Date.now();
      const sampleId = uid();
      await db.soilSamples.add({
        id: sampleId, code, farmId: farm.id, farmerId: farm.farmerId, villageCode: farm.villageCode,
        pastCrops: pastCrops.trim() || undefined,
        lat: backup?.lat ?? null, lng: backup?.lng ?? null, accuracy: backup?.accuracy ?? null,
        createdAt: now, updatedAt: now, synced: false,
      });
      await db.farmers.update(farm.farmerId, { updatedAt: now, synced: false });
      notifications.show({ color: "green", message: `Soil sample ${code} added` });
      syncNow().catch(() => {});

      getBestLocation({ targetAccuracy: 10, maxWait: 20000 })
        .then(async (best) => {
          const cur = await db.soilSamples.get(sampleId);
          if (!cur) return;
          if (cur.accuracy == null || best.accuracy < cur.accuracy) {
            await db.soilSamples.update(sampleId, {
              lat: best.lat, lng: best.lng, accuracy: best.accuracy,
              updatedAt: Date.now(), synced: false,
            });
            syncNow().catch(() => {});
          }
        })
        .catch(() => {});
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not save soil sample" });
    }
  };

  return (
    <Card withBorder radius="md" p="sm">
      <Group justify="space-between" mb="xs">
        <Badge variant="light" color="green" leftSection={<Tree size={13} />}>{farm.id}</Badge>
        <Group gap={6}>
          <Text size="xs" c="dimmed">{plots.length} plot{plots.length === 1 ? "" : "s"}</Text>
          <ActionIcon size="sm" variant="subtle" color="gray" onClick={editModal.open} aria-label="Edit farm">
            <PencilSimple size={15} />
          </ActionIcon>
        </Group>
      </Group>
      {/* Tapping the card body opens the farm's detail view */}
      <UnstyledButton w="100%" onClick={detailModal.open} aria-label="Farm details">
        {url && <Image src={url} h={120} radius="sm" mb="xs" fit="cover" alt="farm" />}
        <Group gap={6} mb="sm">
          <MapPinLine size={15} color="var(--mantine-color-green-7)" />
          <Text size="sm" c="dimmed">{fmtCoord(farm.lat)}, {fmtCoord(farm.lng)}</Text>
          {farm.boundary && farm.boundary.length > 0 && (
            <Badge variant="light" color="green" size="sm" leftSection={<Polygon size={11} weight="fill" />}>
              {farm.boundary.length}-pt boundary
            </Badge>
          )}
          {(soilSamples?.length ?? 0) > 0 && (
            <Badge variant="light" color="orange" size="sm" leftSection={<Flask size={11} weight="fill" />}>
              {soilSamples!.length} soil
            </Badge>
          )}
        </Group>
      </UnstyledButton>

      <Stack gap={6}>
        {plots.map((p) => (
          <PlotRow
            key={p.id} plot={p}
            onEdit={() => setEditPlot(p)}
            onOpenSoilTests={() => setSoilTestsPlot(p)}
            onOpenWaterTests={() => setWaterTestsPlot(p)}
          />
        ))}
      </Stack>

      <Group mt="sm" gap={6} grow wrap="nowrap">
        <Button size="xs" variant="light" leftSection={<Plus size={14} />} onClick={plotModal.open}
          styles={{ section: { marginRight: 4 }, label: { fontSize: 11 } }}>
          Add plot
        </Button>
        <Button size="xs" variant="light" color="orange" leftSection={<Flask size={14} />} onClick={scanModal.open}
          styles={{ section: { marginRight: 4 }, label: { fontSize: 11 } }}>
          Soil sample
        </Button>
        <Button size="xs" variant="light" color="gray" leftSection={<ClockCounterClockwise size={14} />} onClick={samplesModal.open}
          styles={{ section: { marginRight: 4 }, label: { fontSize: 11 } }}>
          Samples
        </Button>
      </Group>

      <AddPlotModal opened={plotOpen} onClose={plotModal.close} farm={farm} />
      <AddPlotModal opened={!!editPlot} onClose={() => setEditPlot(null)} farm={farm} editPlot={editPlot} />
      <QrScanner opened={scanOpen} onClose={scanModal.close} onScan={onScanSample} onManual={manualModal.open} />
      <ManualSampleModal opened={manualOpen} onClose={manualModal.close} onSubmit={onScanSample} />
      <SoilCropModal opened={cropOpen} onClose={() => { cropModal.close(); setPendingCode(null); }} code={pendingCode} onSave={saveSample} />
      <SoilSamplesModal opened={samplesOpen} onClose={samplesModal.close} farm={farm} samples={soilSamples || []} onScanMore={scanModal.open} onManual={manualModal.open} />
      <AddFarmModal opened={editOpen} onClose={editModal.close} editFarm={farm} />
      <FarmDetailModal opened={detailOpen} onClose={detailModal.close} farm={farm} plots={plots} samples={soilSamples || []} photoUrl={url} onEdit={() => { detailModal.close(); editModal.open(); }} />
      <SoilTextureTestsModal
        opened={!!soilTestsPlot} onClose={() => setSoilTestsPlot(null)} plot={soilTestsPlot}
        onAddTest={() => { const p = soilTestsPlot; setSoilTestsPlot(null); setAddSoilTestPlot(p); }}
      />
      <AddSoilTextureTestModal opened={!!addSoilTestPlot} onClose={() => setAddSoilTestPlot(null)} plot={addSoilTestPlot} />
      <WaterTDSTestsModal
        opened={!!waterTestsPlot} onClose={() => setWaterTestsPlot(null)} plot={waterTestsPlot}
        onAddTest={() => { const p = waterTestsPlot; setWaterTestsPlot(null); setAddWaterTestPlot(p); }}
      />
      <AddWaterTDSTestModal opened={!!addWaterTestPlot} onClose={() => setAddWaterTestPlot(null)} plot={addWaterTestPlot} />
    </Card>
  );
}

// ---- One plot row in a farm's plot list — its own component so the
// soil-type-test count can be live-queried per plot without breaking the
// rules of hooks inside a .map(). ----
function PlotRow(
  { plot, onEdit, onOpenSoilTests, onOpenWaterTests }:
  { plot: Plot; onEdit: () => void; onOpenSoilTests: () => void; onOpenWaterTests: () => void }
) {
  const soilTests = useLiveQuery(
    async (): Promise<SoilTextureTest[]> => (await db.soilTextureTests.where("plotId").equals(plot.id).toArray()).filter((x) => !x.deleted),
    [plot.id]
  );
  const waterTests = useLiveQuery(
    async (): Promise<WaterTDSTest[]> => (await db.waterTDSTests.where("plotId").equals(plot.id).toArray()).filter((x) => !x.deleted),
    [plot.id]
  );
  const soilTestCount = soilTests?.length ?? 0;
  const waterTestCount = waterTests?.length ?? 0;
  return (
    <Paper withBorder radius="sm" p={8} bg="gray.0">
      <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
        <UnstyledButton onClick={onEdit} aria-label={`Edit plot ${plot.seq}`} style={{ flex: 1, minWidth: 0 }}>
          <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
            <ThemeIcon variant="light" color="green" size="md" radius="sm"><Plant size={16} /></ThemeIcon>
            <div style={{ minWidth: 0, flex: 1 }}>
              <Text size="sm" fw={600} truncate>{plot.crop || "—"}</Text>
              {(waterTestCount > 0 || soilTestCount > 0) && (
                <Group gap={4} wrap="wrap" mt={2}>
                  {waterTestCount > 0 && (
                    <Badge size="xs" variant="light" color="teal" leftSection={<Drop size={10} weight="fill" />}>
                      {waterTestCount} water
                    </Badge>
                  )}
                  {soilTestCount > 0 && (
                    <Badge size="xs" variant="light" color="orange" leftSection={<Flask size={10} weight="fill" />}>
                      {soilTestCount} soil
                    </Badge>
                  )}
                </Group>
              )}
              <Text size="xs" c="dimmed" mt={2} truncate>Plot {plot.seq}{plot.sowingDate ? ` · sown ${plot.sowingDate}` : ""} · {fmtCoord(plot.lat)}, {fmtCoord(plot.lng)}</Text>
            </div>
            <PencilSimple size={14} color="var(--mantine-color-gray-5)" />
          </Group>
        </UnstyledButton>
        <ActionIcon variant="subtle" color="teal" size="md" onClick={onOpenWaterTests} aria-label={`Water TDS tests for plot ${plot.seq}`}>
          <Drop size={15} />
        </ActionIcon>
        <ActionIcon variant="subtle" color="orange" size="md" onClick={onOpenSoilTests} aria-label={`Soil type tests for plot ${plot.seq}`}>
          <Flask size={15} />
        </ActionIcon>
      </Group>
    </Paper>
  );
}

// ---- Timeline of soil samples taken from a farm ----
function SoilSamplesModal(
  { opened, onClose, farm, samples, onScanMore, onManual }:
  {
    opened: boolean;
    onClose: () => void;
    farm: Farm;
    samples: SoilSample[];
    onScanMore: () => void;
    onManual: () => void;
  }
) {
  const sorted = [...samples].sort((a, b) => b.createdAt - a.createdAt);
  const fmtWhen = (n: number) =>
    new Date(n).toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  // "Today", "Yesterday", or the date — friendlier for surveyors.
  const dayLabel = (n: number) => {
    const d = new Date(n), t = new Date();
    const y = new Date(); y.setDate(t.getDate() - 1);
    const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    return same(d, t) ? "Today" : same(d, y) ? "Yesterday" : d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <AppModal opened={opened} onClose={onClose}
      title={`Soil samples · ${farm.id}${sorted.length ? ` (${sorted.length})` : ""}`}>
      <Stack gap="md">
        {sorted.length === 0 ? (
          <Stack align="center" gap={6} py="lg">
            <ThemeIcon size={44} radius="xl" variant="light" color="orange"><Flask size={24} weight="duotone" /></ThemeIcon>
            <Text c="dimmed" ta="center">No soil samples yet for this farm</Text>
            <Text c="dimmed" size="sm">Scan a sample QR or type the printed code to add one</Text>
          </Stack>
        ) : (
          <Timeline active={sorted.length} bulletSize={24} lineWidth={2} color="orange">
            {sorted.map((s) => (
              <Timeline.Item key={s.id} bullet={<Flask size={13} weight="fill" />}
                title={<Group gap={6}><Text fw={700} size="sm">{s.code}</Text>
                  {!s.synced && <Badge size="xs" variant="light" color="orange">not synced</Badge>}</Group>}>
                <Text size="xs" c="dimmed">{dayLabel(s.createdAt)} · {fmtWhen(s.createdAt)}</Text>
                <Text size="xs" c="dimmed">
                  {s.lat != null && s.lng != null
                    ? <Group gap={4} component="span"><MapPin size={11} /> {fmtCoord(s.lat)}, {fmtCoord(s.lng)}{s.accuracy != null ? ` (±${Math.round(s.accuracy)}m)` : ""}</Group>
                    : "No location recorded"}
                </Text>
                {s.pastCrops && <Text size="xs" c="dimmed"><Group gap={4} component="span"><Plant size={11} /> Previous crop: {s.pastCrops}</Group></Text>}
              </Timeline.Item>
            ))}
          </Timeline>
        )}
        <Group grow gap="sm">
          <Button variant="light" color="orange" leftSection={<Flask size={16} />}
            onClick={() => { onClose(); onScanMore(); }}>
            Scan QR
          </Button>
          <Button variant="light" color="gray" leftSection={<PencilSimple size={16} />}
            onClick={() => { onClose(); onManual(); }}>
            Type code
          </Button>
        </Group>
      </Stack>
    </AppModal>
  );
}

// ---- Timeline of soil type (clay/sand/silt) tests taken from a plot ----
// Soil type keeps full history — like Water TDS (see WaterTDSTestsModal below)
// — because it's normal to re-test a plot's soil composition over time and
// each reading should stay on record rather than overwrite the last.
function SoilTextureTestsModal(
  { opened, onClose, plot, onAddTest }:
  { opened: boolean; onClose: () => void; plot: Plot | null; onAddTest: () => void }
) {
  const tests = useLiveQuery(
    async (): Promise<SoilTextureTest[]> => plot ? (await db.soilTextureTests.where("plotId").equals(plot.id).toArray()).filter((x) => !x.deleted) : [],
    [plot?.id]
  );
  const sorted = [...(tests || [])].sort((a, b) => b.createdAt - a.createdAt);
  const fmtWhen = (n: number) =>
    new Date(n).toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const dayLabel = (n: number) => {
    const d = new Date(n), t = new Date();
    const y = new Date(); y.setDate(t.getDate() - 1);
    const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    return same(d, t) ? "Today" : same(d, y) ? "Yesterday" : d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <AppModal opened={opened} onClose={onClose}
      title={plot ? `Soil type tests · Plot ${plot.seq}${sorted.length ? ` (${sorted.length})` : ""}` : "Soil type tests"}>
      <Stack gap="md">
        {sorted.length === 0 ? (
          <Stack align="center" gap={6} py="lg">
            <ThemeIcon size={44} radius="xl" variant="light" color="orange"><Flask size={24} weight="duotone" /></ThemeIcon>
            <Text c="dimmed" ta="center">No soil type tests yet for this plot</Text>
            <Text c="dimmed" size="sm">Record clay/sand/silt % each time this plot is tested</Text>
          </Stack>
        ) : (
          <Timeline active={sorted.length} bulletSize={24} lineWidth={2} color="orange">
            {sorted.map((t) => (
              <Timeline.Item key={t.id} bullet={<Flask size={13} weight="fill" />}
                title={<Group gap={6}>
                  <Text fw={700} size="sm">
                    {t.soilTexture.clayPct ?? "—"}/{t.soilTexture.sandPct ?? "—"}/{t.soilTexture.siltPct ?? "—"}
                  </Text>
                  {!t.synced && <Badge size="xs" variant="light" color="orange">not synced</Badge>}
                </Group>}>
                <Text size="xs" c="dimmed">{dayLabel(t.createdAt)} · {fmtWhen(t.createdAt)}</Text>
                <Text size="xs" c="dimmed">Clay {t.soilTexture.clayPct ?? "—"}% · Sand {t.soilTexture.sandPct ?? "—"}% · Silt {t.soilTexture.siltPct ?? "—"}%</Text>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
        <Button variant="light" color="orange" leftSection={<Flask size={16} />} onClick={onAddTest} disabled={!plot}>
          Add test
        </Button>
      </Stack>
    </AppModal>
  );
}

// ---- Form to record one new soil type (clay/sand/silt) reading for a plot ----
function AddSoilTextureTestModal(
  { opened, onClose, plot }:
  { opened: boolean; onClose: () => void; plot: Plot | null }
) {
  const { syncNow } = useSession();
  const [clayPct, setClayPct] = useState<number | "">("");
  const [sandPct, setSandPct] = useState<number | "">("");
  const [siltPct, setSiltPct] = useState<number | "">("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  const textureTotal = [clayPct, sandPct, siltPct].reduce((sum: number, v) => sum + (v === "" ? 0 : Number(v)), 0);
  const anyTexture = clayPct !== "" || sandPct !== "" || siltPct !== "";

  useEffect(() => {
    if (!opened) return;
    setClayPct(""); setSandPct(""); setSiltPct(""); setPhoto(null);
  }, [opened]);

  const save = async () => {
    if (!plot || !anyTexture) return;
    setSaving(true);
    try {
      const now = Date.now();
      let testReportMediaId: string | null = null;
      if (photo) { testReportMediaId = uid(); await db.media.add({ id: testReportMediaId, blob: photo, createdAt: now, synced: false }); }
      await db.soilTextureTests.add({
        id: uid(), plotId: plot.id, farmId: plot.farmId, farmerId: plot.farmerId,
        soilTexture: {
          clayPct: clayPct === "" ? null : Number(clayPct),
          sandPct: sandPct === "" ? null : Number(sandPct),
          siltPct: siltPct === "" ? null : Number(siltPct),
        },
        testReportMediaId,
        createdAt: now, updatedAt: now, synced: false,
      });
      await db.farmers.update(plot.farmerId, { updatedAt: now, synced: false });
      notifications.show({ color: "green", message: "Soil type test added" });
      onClose();
      syncNow().catch(() => {});
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not save soil type test" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal opened={opened} onClose={onClose} title={plot ? `Add soil type test · Plot ${plot.seq}` : "Add soil type test"}>
      <Stack gap="md">
        <div>
          <Text size="sm" fw={500} mb={6}>Soil type</Text>
          <SimpleGrid cols={3} spacing="xs">
            <NumberInput label="Clay %" min={0} max={100} value={clayPct} onChange={(v) => setClayPct(v as number | "")} />
            <NumberInput label="Sand %" min={0} max={100} value={sandPct} onChange={(v) => setSandPct(v as number | "")} />
            <NumberInput label="Silt %" min={0} max={100} value={siltPct} onChange={(v) => setSiltPct(v as number | "")} />
          </SimpleGrid>
          {anyTexture && (
            <Text size="xs" c={textureTotal === 100 ? "dimmed" : "orange"} mt={4}>
              Total: {textureTotal}% {textureTotal !== 100 ? "(should add up to 100%)" : ""}
            </Text>
          )}
        </div>
        <PhotoInput label="Test report (photo/scan, optional)" value={photo} onChange={setPhoto} height={140} />
        <Button color="orange" leftSection={<Flask size={16} />} onClick={save} loading={saving} disabled={!anyTexture}>
          Save test
        </Button>
      </Stack>
    </AppModal>
  );
}

// ---- Timeline of water TDS (ppm) tests taken from a plot ----
// Water TDS keeps full history — like soil type (see SoilTextureTestsModal
// above) — because it's normal to re-test a plot's water over time and each
// reading should stay on record rather than overwrite the last.
function WaterTDSTestsModal(
  { opened, onClose, plot, onAddTest }:
  { opened: boolean; onClose: () => void; plot: Plot | null; onAddTest: () => void }
) {
  const tests = useLiveQuery(
    async (): Promise<WaterTDSTest[]> => plot ? (await db.waterTDSTests.where("plotId").equals(plot.id).toArray()).filter((x) => !x.deleted) : [],
    [plot?.id]
  );
  const sorted = [...(tests || [])].sort((a, b) => b.createdAt - a.createdAt);
  const fmtWhen = (n: number) =>
    new Date(n).toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const dayLabel = (n: number) => {
    const d = new Date(n), t = new Date();
    const y = new Date(); y.setDate(t.getDate() - 1);
    const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    return same(d, t) ? "Today" : same(d, y) ? "Yesterday" : d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <AppModal opened={opened} onClose={onClose}
      title={plot ? `Water TDS tests · Plot ${plot.seq}${sorted.length ? ` (${sorted.length})` : ""}` : "Water TDS tests"}>
      <Stack gap="md">
        {sorted.length === 0 ? (
          <Stack align="center" gap={6} py="lg">
            <ThemeIcon size={44} radius="xl" variant="light" color="teal"><Drop size={24} weight="duotone" /></ThemeIcon>
            <Text c="dimmed" ta="center">No water TDS tests yet for this plot</Text>
            <Text c="dimmed" size="sm">Record a TDS (ppm) reading each time this plot's water is tested</Text>
          </Stack>
        ) : (
          <Timeline active={sorted.length} bulletSize={24} lineWidth={2} color="teal">
            {sorted.map((t) => (
              <Timeline.Item key={t.id} bullet={<Drop size={13} weight="fill" />}
                title={<Group gap={6}>
                  <Text fw={700} size="sm">{t.waterTDS ?? "—"} ppm</Text>
                  {!t.synced && <Badge size="xs" variant="light" color="orange">not synced</Badge>}
                </Group>}>
                <Text size="xs" c="dimmed">{dayLabel(t.createdAt)} · {fmtWhen(t.createdAt)}</Text>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
        <Button variant="light" color="teal" leftSection={<Drop size={16} />} onClick={onAddTest} disabled={!plot}>
          Add test
        </Button>
      </Stack>
    </AppModal>
  );
}

// ---- Form to record one new water TDS (ppm) reading for a plot ----
function AddWaterTDSTestModal(
  { opened, onClose, plot }:
  { opened: boolean; onClose: () => void; plot: Plot | null }
) {
  const { syncNow } = useSession();
  const [waterTDS, setWaterTDS] = useState<number | "">("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setWaterTDS(""); setPhoto(null);
  }, [opened]);

  const save = async () => {
    if (!plot || waterTDS === "") return;
    setSaving(true);
    try {
      const now = Date.now();
      let testReportMediaId: string | null = null;
      if (photo) { testReportMediaId = uid(); await db.media.add({ id: testReportMediaId, blob: photo, createdAt: now, synced: false }); }
      await db.waterTDSTests.add({
        id: uid(), plotId: plot.id, farmId: plot.farmId, farmerId: plot.farmerId,
        waterTDS: Number(waterTDS),
        testReportMediaId,
        createdAt: now, updatedAt: now, synced: false,
      });
      await db.farmers.update(plot.farmerId, { updatedAt: now, synced: false });
      notifications.show({ color: "green", message: "Water TDS test added" });
      onClose();
      syncNow().catch(() => {});
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not save water TDS test" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal opened={opened} onClose={onClose} title={plot ? `Add water TDS test · Plot ${plot.seq}` : "Add water TDS test"}>
      <Stack gap="md">
        <NumberInput label="Water TDS (ppm)" placeholder="Enter TDS reading" min={0}
          leftSection={<Drop size={16} />} value={waterTDS} onChange={(v) => setWaterTDS(v as number | "")} data-autofocus />
        <PhotoInput label="Test report (photo/scan, optional)" value={photo} onChange={setPhoto} height={140} />
        <Button color="teal" leftSection={<Drop size={16} />} onClick={save} loading={saving} disabled={waterTDS === ""}>
          Save test
        </Button>
      </Stack>
    </AppModal>
  );
}

// ---- Manual entry fallback when a QR won't scan (damaged / poor light) ----
function ManualSampleModal(
  { opened, onClose, onSubmit }:
  { opened: boolean; onClose: () => void; onSubmit: (code: string) => void }
) {
  const [code, setCode] = useState("");
  useEffect(() => { if (opened) setCode(""); }, [opened]);
  const submit = () => { const c = code.trim(); if (c) onSubmit(c); };
  return (
    <AppModal opened={opened} onClose={onClose} title="Enter sample code">
      <Stack gap="md">
        <TextInput
          label="Soil sample code" placeholder="Code printed under the QR"
          value={code} onChange={(e) => setCode(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          autoCapitalize="characters" data-autofocus
        />
        <Button leftSection={<Flask size={16} />} color="orange" onClick={submit} disabled={!code.trim()}>
          Add sample
        </Button>
      </Stack>
    </AppModal>
  );
}

// ---- Previous crop for a soil sample — shown after a valid code ----
function SoilCropModal(
  { opened, onClose, code, onSave }:
  { opened: boolean; onClose: () => void; code: string | null; onSave: (pastCrops: string) => void }
) {
  const [crop, setCrop] = useState("");
  useEffect(() => { if (opened) setCrop(""); }, [opened]);
  return (
    <AppModal opened={opened} onClose={onClose} title="Soil sample — previous crop">
      <Stack gap="md">
        <Group gap={6}>
          <ThemeIcon variant="light" color="orange" radius="xl"><Flask size={16} weight="fill" /></ThemeIcon>
          <Text fw={700}>{code}</Text>
        </Group>
        <Autocomplete
          label="Previous crop"
          description="Pick from the list, or type a crop that isn't listed"
          placeholder="Select or type previous crop"
          data={PREVIOUS_CROPS}
          value={crop}
          onChange={setCrop}
          comboboxProps={{ withinPortal: true }}
          data-autofocus
          required
        />
        <Button color="orange" leftSection={<Flask size={16} />} onClick={() => crop.trim() && onSave(crop.trim())} disabled={!crop.trim()}>
          Save soil sample
        </Button>
      </Stack>
    </AppModal>
  );
}

// One read-only plot summary line — its own component (like PlotRow above)
// so the soil-type-test count can be live-queried per plot.
function PlotSummaryLine({ plot: p }: { plot: any }) {
  const soilTests = useLiveQuery(
    async (): Promise<SoilTextureTest[]> => (await db.soilTextureTests.where("plotId").equals(p.id).toArray()).filter((x) => !x.deleted),
    [p.id]
  );
  const waterTests = useLiveQuery(
    async (): Promise<WaterTDSTest[]> => (await db.waterTDSTests.where("plotId").equals(p.id).toArray()).filter((x) => !x.deleted),
    [p.id]
  );
  const soilTestCount = soilTests?.length ?? 0;
  const waterTestCount = waterTests?.length ?? 0;
  return (
    <Text size="xs" c="dimmed">
      Plot {p.seq} · {p.crop || "—"}{p.sowingDate ? ` · sown ${p.sowingDate}` : ""} · {fmtCoord(p.lat)}, {fmtCoord(p.lng)}
      {waterTestCount > 0 ? ` · ${waterTestCount} water test${waterTestCount === 1 ? "" : "s"}` : ""}
      {soilTestCount > 0 ? ` · ${soilTestCount} soil test${soilTestCount === 1 ? "" : "s"}` : ""}
    </Text>
  );
}

// ---- Read-only farm detail view (tap the farm card) ----
function FarmDetailModal(
  { opened, onClose, farm, plots, samples, photoUrl, onEdit }:
  { opened: boolean; onClose: () => void; farm: Farm; plots: any[]; samples: SoilSample[]; photoUrl: string | null; onEdit: () => void }
) {
  const fmtWhen = (n: number) =>
    new Date(n).toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  return (
    <AppModal opened={opened} onClose={onClose} title={`Farm · ${farm.id}`}>
      <Stack gap="md">
        {photoUrl && <Image src={photoUrl} h={180} radius="md" fit="cover" alt="farm" />}

        <Paper withBorder radius="md" p="sm">
          <Group gap={8}>
            <ThemeIcon variant="light" color="green" radius="xl"><MapPinLine size={18} /></ThemeIcon>
            <div>
              <Text size="sm" fw={500}>Location</Text>
              <Text size="xs" c="dimmed">
                {farm.lat != null ? `${fmtCoord(farm.lat)}, ${fmtCoord(farm.lng)}${farm.accuracy != null ? ` (±${Math.round(farm.accuracy)}m)` : ""}` : "Not captured"}
              </Text>
            </div>
          </Group>
        </Paper>

        {((farm.boundary && farm.boundary.length > 0) || (farm.lat != null && farm.lng != null)) && (
          <Paper withBorder radius="md" p="sm">
            <Text size="sm" fw={500} mb={6}>
              <Group gap={6} component="span"><Polygon size={16} /> Boundary · {farm.boundary?.length ?? 0} points</Group>
            </Text>
            <MapErrorBoundary fallback={
              <Text size="xs" c="dimmed">Map preview unavailable.</Text>
            }>
              <FarmBoundaryPreview boundary={farm.boundary} markerLat={farm.lat} markerLng={farm.lng} height={180} />
            </MapErrorBoundary>
            {farm.boundary && farm.boundary.length > 0 && (
              <Box mah={120} mt="xs" style={{ overflowY: "auto" }}>
                <Stack gap={4}>
                  {farm.boundary.map((p, i) => (
                    <Text key={p.at} size="xs" c="dimmed">#{i + 1} · {fmtCoord(p.lat)}, {fmtCoord(p.lng)} (±{Math.round(p.accuracy)}m)</Text>
                  ))}
                </Stack>
              </Box>
            )}
          </Paper>
        )}

        <Paper withBorder radius="md" p="sm">
          <Text size="sm" fw={500} mb={6}>
            <Group gap={6} component="span"><Plant size={16} /> Plots · {plots.length}</Group>
          </Text>
          {plots.length === 0 ? (
            <Text size="xs" c="dimmed">No plots yet</Text>
          ) : (
            <Stack gap={4}>
              {plots.map((p) => (
                <PlotSummaryLine key={p.id} plot={p} />
              ))}
            </Stack>
          )}
        </Paper>

        {(farm.treeCountBig != null || farm.treeCountSmall != null || farm.mobileCoverage || farm.shapeOverride || farm.plotSizeHectOverride != null || farm.plotSizeSqFtOverride != null) && (
          <Paper withBorder radius="md" p="sm">
            <Text size="sm" fw={500} mb={6}><Group gap={6} component="span"><MapPinLine size={16} /> Physical fieldwork</Group></Text>
            <Stack gap={2}>
              {(farm.treeCountBig != null || farm.treeCountSmall != null) && (
                <Text size="xs" c="dimmed">Trees: {farm.treeCountBig ?? 0} big · {farm.treeCountSmall ?? 0} small</Text>
              )}
              {farm.mobileCoverage && <Text size="xs" c="dimmed">Mobile coverage: {labelOf(MOBILE_COVERAGE_OPTS, farm.mobileCoverage)}</Text>}
              {farm.shapeOverride && <Text size="xs" c="dimmed">Shape: {SHAPE_LABEL[farm.shapeOverride]}</Text>}
              {(farm.plotSizeSqFtOverride != null || farm.plotSizeHectOverride != null) && (
                <Text size="xs" c="dimmed">
                  Plot size: {(farm.plotSizeSqFtOverride ?? legacyHectToSqFt(farm.plotSizeHectOverride!)).toLocaleString()} sq ft
                </Text>
              )}
            </Stack>
          </Paper>
        )}

        {(farm.farmerFocus || asWaterSourceArray(farm.waterSource).length || asIrrigationArray(farm.irrigationAvailable).length || (farm.seasonsPossible?.length) || (farm.knownIssues?.length) ||
          farm.previousCrop || farm.previousCropProduction || (farm.animalPressure?.length) || farm.accessibility) && (
          <Paper withBorder radius="md" p="sm">
            <Text size="sm" fw={500} mb={6}><Group gap={6} component="span"><Users size={16} /> From farmer</Group></Text>
            <Stack gap={2}>
              {farm.farmerFocus && <Text size="xs" c="dimmed">{FARMER_FOCUS_DESCRIPTIONS[farm.farmerFocus]}</Text>}
              {!!asWaterSourceArray(farm.waterSource).length && <Text size="xs" c="dimmed">Water source: {asWaterSourceArray(farm.waterSource).map((s) => labelOf(WATER_SOURCE_OPTS, s)).join(", ")}</Text>}
              {!!asIrrigationArray(farm.irrigationAvailable).length && <Text size="xs" c="dimmed">Irrigation: {asIrrigationArray(farm.irrigationAvailable).map((s) => labelOf(IRRIGATION_OPTS, s)).join(", ")}</Text>}
              {!!farm.seasonsPossible?.length && <Text size="xs" c="dimmed">Seasons: {farm.seasonsPossible.map((s) => labelOf(SEASON_OPTS, s)).join(", ")}</Text>}
              {!!farm.knownIssues?.length && (
                <Text size="xs" c="dimmed">
                  Known issues: {farm.knownIssues.map((s) => labelOf(KNOWN_ISSUE_OPTS, s)).join(", ")}
                  {farm.knownIssues.includes("other") && farm.knownIssuesOther ? ` (${farm.knownIssuesOther})` : ""}
                </Text>
              )}
              {!!farm.animalPressure?.length && (
                <Text size="xs" c="dimmed">
                  Animal pressure: {farm.animalPressure.map((s) => labelOf(ANIMAL_PRESSURE_OPTS, s)).join(", ")}
                  {farm.animalPressure.includes("other") && farm.animalPressureOther ? ` (${farm.animalPressureOther})` : ""}
                </Text>
              )}
              {farm.accessibility && <Text size="xs" c="dimmed">{ACCESSIBILITY_DESCRIPTIONS[farm.accessibility]}</Text>}
              {farm.previousCrop && <Text size="xs" c="dimmed">Previous crop: {farm.previousCrop}</Text>}
              {farm.previousCropProduction && (
                <Text size="xs" c="dimmed">
                  Previous yield: {farm.previousCropProduction.quintals ?? "—"} quintals
                  {farm.previousCropProduction.vsBenchmark ? ` (${labelOf(BENCHMARK_OPTS, farm.previousCropProduction.vsBenchmark)})` : ""}
                </Text>
              )}
            </Stack>
          </Paper>
        )}

        {(farm.gradient || farm.waterloggingProbability || farm.sunlightAvailability || farm.fencingAvailability) && (
          <Paper withBorder radius="md" p="sm">
            <Text size="sm" fw={500} mb={6}><Group gap={6} component="span"><TrendUp size={16} /> Supervisor observation</Group></Text>
            <Stack gap={2}>
              {farm.gradient && <Text size="xs" c="dimmed">Gradient: {labelOf(GRADIENT_OPTS, farm.gradient)}</Text>}
              {farm.waterloggingProbability && <Text size="xs" c="dimmed">Waterlogging probability: {labelOf(WATERLOGGING_OPTS, farm.waterloggingProbability)}</Text>}
              {farm.sunlightAvailability && <Text size="xs" c="dimmed">Sunlight: {labelOf(SUNLIGHT_OPTS, farm.sunlightAvailability)}</Text>}
              {farm.fencingAvailability && <Text size="xs" c="dimmed">Fencing: {labelOf(FENCING_OPTS, farm.fencingAvailability)}</Text>}
            </Stack>
          </Paper>
        )}


        <Paper withBorder radius="md" p="sm">
          <Text size="sm" fw={500} mb={6}>
            <Group gap={6} component="span"><Flask size={16} /> Soil samples · {samples.length}</Group>
          </Text>
          {samples.length === 0 ? (
            <Text size="xs" c="dimmed">No samples yet</Text>
          ) : (
            <Stack gap={4}>
              {[...samples].sort((a, b) => b.createdAt - a.createdAt).map((s) => (
                <Text key={s.id} size="xs" c="dimmed">
                  {s.code} · {fmtWhen(s.createdAt)}{s.pastCrops ? ` · previous: ${s.pastCrops}` : ""}
                </Text>
              ))}
            </Stack>
          )}
        </Paper>

        {farm.note && farm.note.trim() && (
          <Paper withBorder radius="md" p="sm">
            <Text size="sm" fw={500} mb={4}>
              <Group gap={6} component="span"><PencilSimple size={16} /> Note</Group>
            </Text>
            <Text size="sm" c="dimmed" style={{ whiteSpace: "pre-wrap" }}>{farm.note}</Text>
          </Paper>
        )}

        <Button variant="light" leftSection={<PencilSimple size={16} />} onClick={onEdit}>
          Edit farm
        </Button>
      </Stack>
    </AppModal>
  );
}

// ---- Reusable location capture row ----
// Waits for an accurate GPS lock (watchPosition), showing the fix tightening
// live, instead of grabbing the first coarse (±100m) reading.
function LocationCapture({ loc, onCapture }: { loc: SessionLocation | null; onCapture: (l: SessionLocation) => void }) {
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<number | null>(null);   // live accuracy while locking

  const capture = async () => {
    setBusy(true);
    setLive(null);
    try {
      const best = await getBestLocation({
        targetAccuracy: 10, maxWait: 20000,
        onProgress: (l) => setLive(Math.round(l.accuracy)),
      });
      onCapture(best);
    } catch (e: any) {
      // GPS failed (indoors / blocked) → fall back to the last known good fix
      // so the surveyor is never stuck without a location.
      const last = getLastLocation();
      if (last) {
        onCapture(last);
        notifications.show({ color: "yellow", message: `GPS unavailable — used last known location (±${Math.round(last.accuracy)}m)` });
      } else {
        notifications.show({ color: "red", message: e?.message || "Could not get location" });
      }
    } finally {
      setBusy(false);
      setLive(null);
    }
  };

  return (
    <Paper withBorder radius="md" p="sm">
      <Group justify="space-between">
        <Group gap={8}>
          <ThemeIcon variant="light" color={busy ? "yellow" : loc ? "teal" : "gray"} radius="xl">
            {loc && !busy ? <CheckCircle size={18} weight="fill" /> : <Crosshair size={18} />}
          </ThemeIcon>
          <div>
            <Text size="sm" fw={500}>{busy ? "Locating…" : loc ? "Location captured" : "Geolocation"}</Text>
            <Text size="xs" c="dimmed">
              {busy
                ? (live != null ? `±${live}m — hold still…` : "Getting a GPS lock…")
                : loc ? `${fmtCoord(loc.lat)}, ${fmtCoord(loc.lng)} (±${Math.round(loc.accuracy)}m)` : "Not captured yet"}
            </Text>
          </div>
        </Group>
        <Button size="xs" variant={loc ? "light" : "filled"} loading={busy} onClick={capture}>
          {loc ? "Recapture" : "Capture"}
        </Button>
      </Group>
    </Paper>
  );
}

type BoundaryMode = "manual" | "map";

// ---- Boundary capture: reliable GPS walk-points, with optional map drawing ----
function BoundaryCapture({
  points, onChange, centerHint,
}: {
  points: BoundaryPoint[];
  onChange: (p: BoundaryPoint[]) => void;
  centerHint?: { lat: number; lng: number } | null;
}) {
  const [mode, setMode] = useState<BoundaryMode>("manual");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<number | null>(null);
  const [tileProgress, setTileProgress] = useState<{ done: number; total: number } | null>(null);
  const [cachingTiles, setCachingTiles] = useState(false);

  const addPoint = async () => {
    setBusy(true);
    setLive(null);
    try {
      // Wait for an accurate lock at this corner (not the first coarse reading).
      const l = await getBestLocation({
        targetAccuracy: 10, maxWait: 20000,
        onProgress: (p) => setLive(Math.round(p.accuracy)),
      });
      onChange([...points, { lat: l.lat, lng: l.lng, accuracy: l.accuracy, at: l.at, alt: l.alt ?? null, altAccuracy: l.altAccuracy ?? null }]);
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not get location" });
    } finally {
      setBusy(false);
      setLive(null);
    }
  };
  const removePoint = (i: number) => onChange(points.filter((_, idx) => idx !== i));
  const cacheCenter = centerHint ?? (points[0] ? { lat: points[0].lat, lng: points[0].lng } : null);
  const cacheNearbyTiles = async () => {
    if (!cacheCenter) {
      notifications.show({ color: "yellow", message: "Capture farm location first to cache nearby map tiles" });
      return;
    }
    setCachingTiles(true);
    setTileProgress({ done: 0, total: 0 });
    try {
      const bounds = boundsAroundPoint(cacheCenter.lat, cacheCenter.lng, 1);
      const result = await downloadTiles(bounds, {
        minZoom: 14,
        maxZoom: 18,
        onProgress: (done, total) => setTileProgress({ done, total }),
      });
      notifications.show({ color: "green", message: `Cached ${result.total} map tiles nearby` });
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not cache map tiles" });
    } finally {
      setCachingTiles(false);
    }
  };

  return (
    <Paper withBorder radius="md" p="sm">
      <Group justify="space-between" mb="xs" align="flex-start">
        <Group gap={8}>
          <ThemeIcon variant="light" color={points.length ? "teal" : "gray"} radius="xl">
            <Polygon size={18} weight={points.length ? "fill" : "regular"} />
          </ThemeIcon>
          <div>
            <Text size="sm" fw={500}>Farm boundary <Text span size="xs" c="dimmed">(optional)</Text></Text>
            <Text size="xs" c="dimmed">
              {busy
                ? (live != null ? `±${live}m — hold still…` : "Getting a GPS lock…")
                : points.length ? `${points.length} point${points.length === 1 ? "" : "s"} captured` : "Stand at each corner and add a point"}
            </Text>
          </div>
        </Group>
        {mode === "manual" && (
          <Button size="xs" variant="filled" leftSection={<Plus size={14} />} loading={busy} onClick={addPoint}>
            Add point
          </Button>
        )}
      </Group>

      <SegmentedControl
        fullWidth
        size="xs"
        mb="sm"
        value={mode}
        onChange={(value) => setMode(value as BoundaryMode)}
        data={[
          { label: "Walk points", value: "manual" },
          { label: "Draw map", value: "map" },
        ]}
      />

      {mode === "map" ? (
        <Stack gap="xs">
          <MapErrorBoundary onError={() => setMode("manual")}>
            <BoundaryDrawMap points={points} onChange={onChange} centerHint={centerHint} />
          </MapErrorBoundary>
          <Group justify="space-between" gap="xs" wrap="nowrap">
            <Text size="xs" c="dimmed">
              {tileProgress?.total ? `${tileProgress.done}/${tileProgress.total} tiles cached` : "Cache nearby tiles before working with weak signal"}
            </Text>
            <Button size="xs" variant="light" color="gray" loading={cachingTiles} onClick={cacheNearbyTiles}>
              Cache map
            </Button>
          </Group>
        </Stack>
      ) : (
        points.length > 0 && (
          // Cap the list so a long boundary never pushes "Save farm" off-screen —
          // the points scroll internally instead.
          <Box mah={170} style={{ overflowY: "auto" }}>
            <Stack gap={6}>
              {points.map((p, i) => (
                <Paper key={p.at} withBorder radius="sm" p={6} bg="gray.0">
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                      <ThemeIcon variant="light" color="green" size="sm" radius="xl"><MapPin size={12} /></ThemeIcon>
                      <Text size="xs" truncate>
                        #{i + 1} · {fmtCoord(p.lat)}, {fmtCoord(p.lng)} (±{Math.round(p.accuracy)}m)
                      </Text>
                    </Group>
                    <ActionIcon variant="subtle" color="red" size="sm" onClick={() => removePoint(i)} aria-label="Remove point">
                      <Trash size={14} />
                    </ActionIcon>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Box>
        )
      )}
    </Paper>
  );
}

// Add OR edit a farm. Pass `editFarm` to edit an existing one (prefilled);
// otherwise `farmer` is used to create a new farm.
function AddFarmModal(
  { opened, onClose, farmer, editFarm }:
  { opened: boolean; onClose: () => void; farmer?: Farmer; editFarm?: Farm }
) {
  const { syncNow } = useSession();
  const villageCode = editFarm?.villageCode ?? farmer?.villageCode ?? "";
  const farmerId = editFarm?.farmerId ?? farmer?.id ?? "";

  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoDirty, setPhotoDirty] = useState(false);
  const [loc, setLoc] = useState<SessionLocation | null>(null);
  const [boundary, setBoundary] = useState<BoundaryPoint[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // ---- Physical Fieldwork ----
  const [treeCountBig, setTreeCountBig] = useState<number | "">("");
  const [treeCountSmall, setTreeCountSmall] = useState<number | "">("");
  const [mobileCoverage, setMobileCoverage] = useState<MobileCoverage | "">("");
  const [shapeOverride, setShapeOverride] = useState<FarmShape | "">("");
  const [plotSizeOverride, setPlotSizeOverride] = useState<number | "">("");

  // ---- From Farmer ----
  const [farmerFocus, setFarmerFocus] = useState<FarmerFocus | "">("");
  const [waterSource, setWaterSource] = useState<WaterSource[]>([]);
  const [irrigationAvailable, setIrrigationAvailable] = useState<IrrigationAvailable[]>([]);
  const [seasonsPossible, setSeasonsPossible] = useState<Season[]>([]);
  const [knownIssues, setKnownIssues] = useState<KnownIssue[]>([]);
  const [knownIssuesOther, setKnownIssuesOther] = useState("");
  const [previousCrop, setPreviousCrop] = useState("");
  const [prevCropQuintals, setPrevCropQuintals] = useState<number | "">("");
  const [prevCropBenchmark, setPrevCropBenchmark] = useState<BenchmarkComparison | "">("");
  const [animalPressure, setAnimalPressure] = useState<AnimalPressure[]>([]);
  const [animalPressureOther, setAnimalPressureOther] = useState("");
  const [accessibility, setAccessibility] = useState<Accessibility | "">("");

  // ---- Supervisor Observation ----
  const [gradient, setGradient] = useState<Gradient | "">("");
  const [waterloggingProbability, setWaterloggingProbability] = useState<WaterloggingProbability | "">("");
  const [sunlightAvailability, setSunlightAvailability] = useState<SunlightAvailability | "">("");
  const [fencingAvailability, setFencingAvailability] = useState<FencingAvailability | "">("");

  const existingPhoto = useLiveQuery(
    () => (editFarm?.photoId ? db.media.get(editFarm.photoId) : undefined),
    [editFarm?.photoId]
  );
  // Derived shape/size from the walked boundary — auto-fills once there's a
  // boundary to compute from, but the field always stays enabled and
  // editable so a supervisor can fill it in by hand when no boundary was
  // walked (or override the auto-detected value).
  const derivedShape = classifyShape(boundary);
  const shapeTouched = useRef(false);
  useEffect(() => {
    if (!opened) return;
    shapeTouched.current = !!editFarm?.shapeOverride;
  }, [opened, editFarm]);
  useEffect(() => {
    if (boundary.length < 3 || shapeTouched.current) return;
    setShapeOverride(derivedShape ?? "");
  }, [boundary, derivedShape]);
  const derivedAreaSqM = polygonAreaSqM(boundary);
  const derivedSqFt = derivedAreaSqM != null ? Math.round(derivedAreaSqM * SQM_TO_SQFT) : null;
  const derivedAcres = derivedAreaSqM != null ? +(derivedAreaSqM * SQM_TO_ACRE).toFixed(2) : null;
  // Plot size auto-fills from the boundary's computed area (same "suggest,
  // don't lock" pattern as Shape/Gradient) but stays editable — a supervisor
  // can type it directly when no boundary was walked, or override the
  // computed value once they've touched the field.
  const plotSizeTouched = useRef(false);
  useEffect(() => {
    if (!opened) return;
    plotSizeTouched.current = editFarm?.plotSizeSqFtOverride != null || editFarm?.plotSizeHectOverride != null;
  }, [opened, editFarm]);
  useEffect(() => {
    if (plotSizeTouched.current) return;
    setPlotSizeOverride(derivedSqFt ?? "");
  }, [derivedSqFt]);

  // Gradient suggestion from the boundary walk. We try real elevation data
  // from Google's Elevation API first (far more accurate than phone GPS
  // altitude) the moment the boundary has 3+ points, and silently fall back
  // to the GPS-altitude estimate if we're offline or the lookup fails — the
  // supervisor never sees an error, just a slightly less precise suggestion.
  const [apiElevations, setApiElevations] = useState<ElevationPoint[] | null>(null);
  const [elevationLoading, setElevationLoading] = useState(false);
  const elevationBoundaryKey = useMemo(
    () => boundary.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join("|"),
    [boundary]
  );
  useEffect(() => {
    if (boundary.length < 3) { setApiElevations(null); return; }
    let cancelled = false;
    setElevationLoading(true);
    const session = getSession();
    if (!session) { setElevationLoading(false); return; }
    apiElevation(session.token, boundary.map((p) => ({ lat: p.lat, lng: p.lng })))
      .then((r) => { if (!cancelled) setApiElevations(r.elevations ?? null); })
      .catch(() => { if (!cancelled) setApiElevations(null); })   // offline/flaky — GPS fallback below covers it
      .finally(() => { if (!cancelled) setElevationLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elevationBoundaryKey]);

  // Overlay live elevation onto the boundary (matched by request order — the
  // Elevation API returns one result per input point, same order) so the
  // existing altitude-spread math works unchanged with the better data.
  const boundaryForGradient = useMemo<BoundaryPoint[]>(() => {
    if (!apiElevations || apiElevations.length !== boundary.length) return boundary;
    return boundary.map((p, i) => ({ ...p, alt: apiElevations[i].elevation }));
  }, [boundary, apiElevations]);
  const usingApiElevation = !!apiElevations && apiElevations.length === boundary.length;

  const gradientTouched = useRef(false);
  const gradientEstimate = useMemo(() => estimateGradientFromBoundary(boundaryForGradient), [boundaryForGradient]);
  useEffect(() => {
    if (!opened) return;
    // A farm being edited that already has a saved gradient counts as
    // "touched" — don't silently overwrite a value someone already confirmed.
    gradientTouched.current = !!editFarm?.gradient;
  }, [opened, editFarm]);
  useEffect(() => {
    if (gradientTouched.current || !gradientEstimate) return;
    setGradient(gradientEstimate.gradient);
  }, [gradientEstimate]);

  // Prefill (edit) or clear (add) whenever the modal opens.
  useEffect(() => {
    if (!opened) return;
    setPhotoDirty(false);
    if (editFarm) {
      setLoc(editFarm.lat != null && editFarm.lng != null
        ? { lat: editFarm.lat, lng: editFarm.lng, accuracy: editFarm.accuracy ?? 0, at: editFarm.updatedAt }
        : null);
      setBoundary(editFarm.boundary ?? []);
      setNote(editFarm.note ?? "");
      setTreeCountBig(editFarm.treeCountBig ?? "");
      setTreeCountSmall(editFarm.treeCountSmall ?? "");
      setMobileCoverage(editFarm.mobileCoverage ?? "");
      setShapeOverride(editFarm.shapeOverride ?? "");
      setPlotSizeOverride(editFarm.plotSizeSqFtOverride ?? (editFarm.plotSizeHectOverride != null ? legacyHectToSqFt(editFarm.plotSizeHectOverride) : ""));
      setFarmerFocus(editFarm.farmerFocus ?? "");
      setWaterSource(asWaterSourceArray(editFarm.waterSource));
      setIrrigationAvailable(asIrrigationArray(editFarm.irrigationAvailable));
      setSeasonsPossible(editFarm.seasonsPossible ?? []);
      setKnownIssues(editFarm.knownIssues ?? []);
      setKnownIssuesOther(editFarm.knownIssuesOther ?? "");
      setPreviousCrop(editFarm.previousCrop ?? "");
      setPrevCropQuintals(editFarm.previousCropProduction?.quintals ?? "");
      setPrevCropBenchmark(editFarm.previousCropProduction?.vsBenchmark ?? "");
      setAnimalPressure(editFarm.animalPressure ?? []);
      setAnimalPressureOther(editFarm.animalPressureOther ?? "");
      setAccessibility(editFarm.accessibility ?? "");
      setGradient(editFarm.gradient ?? "");
      setWaterloggingProbability(editFarm.waterloggingProbability ?? "");
      setSunlightAvailability(editFarm.sunlightAvailability ?? "");
      setFencingAvailability(editFarm.fencingAvailability ?? "");
    } else {
      setPhoto(null); setLoc(null); setBoundary([]); setNote("");
      setTreeCountBig(""); setTreeCountSmall(""); setMobileCoverage("");
      setShapeOverride(""); setPlotSizeOverride("");
      setFarmerFocus(""); setWaterSource([]); setIrrigationAvailable([]);
      setSeasonsPossible([]); setKnownIssues([]); setKnownIssuesOther(""); setPreviousCrop("");
      setPrevCropQuintals(""); setPrevCropBenchmark(""); setAnimalPressure([]); setAnimalPressureOther(""); setAccessibility("");
      setGradient(""); setWaterloggingProbability(""); setSunlightAvailability(""); setFencingAvailability("");
    }
  }, [opened, editFarm]);

  // Load the existing farm photo (edit mode), unless the user picked a new one.
  useEffect(() => {
    if (opened && editFarm && !photoDirty && existingPhoto?.blob) setPhoto(existingPhoto.blob);
  }, [opened, editFarm, existingPhoto, photoDirty]);

  const save = async () => {
    setSaving(true);
    try {
      const now = Date.now();

      const previousCropProduction: PreviousCropProduction | null =
        prevCropQuintals !== "" || prevCropBenchmark !== ""
          ? { quintals: prevCropQuintals === "" ? null : Number(prevCropQuintals), vsBenchmark: prevCropBenchmark || null }
          : null;

      // Fields shared by the From Farmer / Supervisor Observation / Physical
      // Fieldwork sections — spread into both the add and edit payloads below.
      const attrFields = {
        treeCountBig: treeCountBig === "" ? null : Number(treeCountBig),
        treeCountSmall: treeCountSmall === "" ? null : Number(treeCountSmall),
        mobileCoverage: (mobileCoverage || null) as MobileCoverage | null,
        shapeOverride: (shapeOverride || null) as FarmShape | null,
        plotSizeSqFtOverride: plotSizeOverride === "" ? null : Number(plotSizeOverride),
        farmerFocus: (farmerFocus || null) as FarmerFocus | null,
        waterSource,
        irrigationAvailable,
        seasonsPossible,
        knownIssues,
        knownIssuesOther: knownIssues.includes("other") ? (knownIssuesOther.trim() || undefined) : undefined,
        previousCrop: previousCrop.trim() || undefined,
        previousCropProduction,
        animalPressure,
        animalPressureOther: animalPressure.includes("other") ? (animalPressureOther.trim() || undefined) : undefined,
        accessibility: (accessibility || null) as Accessibility | null,
        gradient: (gradient || null) as Gradient | null,
        waterloggingProbability: (waterloggingProbability || null) as WaterloggingProbability | null,
        sunlightAvailability: (sunlightAvailability || null) as SunlightAvailability | null,
        fencingAvailability: (fencingAvailability || null) as FencingAvailability | null,
      };

      if (editFarm) {
        let photoId = editFarm.photoId;
        if (photoDirty) {
          if (photoId) await db.media.delete(photoId).catch(() => {});
          if (photo) { photoId = uid(); await db.media.add({ id: photoId, blob: photo, createdAt: now, synced: false }); }
          else photoId = null;
        }
        await db.farms.update(editFarm.id, {
          photoId, lat: loc?.lat ?? null, lng: loc?.lng ?? null, accuracy: loc?.accuracy ?? null,
          boundary: boundary.length ? boundary : undefined, note: note.trim() || undefined,
          ...attrFields,
          updatedAt: now, synced: false,
        });
        await db.farmers.update(farmerId, { updatedAt: now, synced: false });
        notifications.show({ color: "green", message: `Farm ${editFarm.id} updated` });
      } else {
        const id = await nextFarmId(villageCode);
        let photoId: string | null = null;
        if (photo) { photoId = uid(); await db.media.add({ id: photoId, blob: photo, createdAt: now, synced: false }); }
        await db.farms.add({
          id, farmerId, villageCode, photoId,
          lat: loc?.lat ?? null, lng: loc?.lng ?? null, accuracy: loc?.accuracy ?? null,
          boundary: boundary.length ? boundary : undefined, note: note.trim() || undefined,
          ...attrFields,
          createdAt: now, updatedAt: now, synced: false,
        });
        await db.farmers.update(farmerId, { updatedAt: now, synced: false });
        notifications.show({ color: "green", message: `Farm ${id} added` });
      }
      setPhotoDirty(false);
      onClose();
      syncNow().catch(() => {});
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not save farm" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal opened={opened} onClose={onClose} title={editFarm ? `Edit farm · ${editFarm.id}` : "Add farm"}>
      <Stack gap="xl">
        {/* Save stays pinned at the top so the map (Draw mode) never buries it. */}
        <Box
          style={{
            position: "sticky", top: 0, zIndex: 5,
            background: "var(--mantine-color-body)",
            paddingBottom: 8,
          }}
        >
          <Button fullWidth size="md" leftSection={<Tree size={18} />} onClick={save} loading={saving}>
            {editFarm ? "Update farm" : "Save farm"}
          </Button>
        </Box>
        <PhotoInput label="Farm photo" value={photo} onChange={(b) => { setPhoto(b); setPhotoDirty(true); }} height={160} />

        <Stack gap="sm">
          <SectionDivider icon={<MapPinLine size={14} />} label="Physical fieldwork" />
          <LocationCapture loc={loc} onCapture={setLoc} />
          <BoundaryCapture points={boundary} onChange={setBoundary} centerHint={loc} />
          <SimpleGridTwo>
            <NumberInput label="Big trees" min={0} leftSection={<Tree size={16} />}
              value={treeCountBig} onChange={(v) => setTreeCountBig(v as number | "")} />
            <NumberInput label="Small trees" min={0} leftSection={<Tree size={16} />}
              value={treeCountSmall} onChange={(v) => setTreeCountSmall(v as number | "")} />
          </SimpleGridTwo>
          <div>
            <Text size="sm" fw={500} mb={6}><Group gap={6} component="span"><DeviceMobile size={16} /> Mobile network coverage</Group></Text>
            <SegmentedControl fullWidth value={mobileCoverage} onChange={(v) => setMobileCoverage(v as MobileCoverage)} data={MOBILE_COVERAGE_OPTS} />
          </div>

          {/* Auto-computed from the boundary walk — grouped in its own card so it
              reads as "the system filled this in", distinct from the fields above. */}
          <Paper withBorder radius="md" p="sm" bg="gray.0">
            <Stack gap="sm">
              <div>
                <Select
                  label="Shape" clearable
                  placeholder="Select, or walk 3+ boundary points to auto-detect"
                  data={SHAPE_OPTS}
                  value={shapeOverride || null}
                  onChange={(v) => { shapeTouched.current = true; setShapeOverride((v as FarmShape) || ""); }}
                  comboboxProps={{ withinPortal: true }}
                />
                {boundary.length >= 3 && !shapeTouched.current && derivedShape && (
                  <Text size="xs" c="dimmed" mt={4}>Auto-detected from boundary — tap to override</Text>
                )}
              </div>
              <div>
                <NumberInput
                  label="Plot size (sq ft)" min={0}
                  placeholder="Enter size, or walk 3+ boundary points to auto-fill"
                  value={plotSizeOverride}
                  onChange={(v) => { plotSizeTouched.current = true; setPlotSizeOverride(v as number | ""); }}
                />
                {derivedAcres != null && !plotSizeTouched.current && (
                  <Text size="xs" c="dimmed" mt={4}>≈ {derivedAcres} acre — auto-filled from boundary, tap to override</Text>
                )}
              </div>
            </Stack>
          </Paper>
        </Stack>

        <Stack gap="sm">
          <SectionDivider icon={<Users size={14} />} label="From farmer" />
          <div>
            <Text size="sm" fw={500} mb={6}>Supervisor visit frequency</Text>
            <SegmentedControl fullWidth value={farmerFocus} onChange={(v) => setFarmerFocus(v as FarmerFocus)} data={FARMER_FOCUS_OPTS} />
            <Text size="xs" c="dimmed" mt={4}>
              {farmerFocus ? FARMER_FOCUS_DESCRIPTIONS[farmerFocus] : "How often does the supervisor need to check in on this farm?"}
            </Text>
          </div>
          <div>
            <Group justify="space-between" mb={6} wrap="nowrap" align="baseline">
              <Text size="sm" fw={500}><Group gap={6} component="span"><Drop size={16} /> Water source</Group></Text>
              <SelectAllToggle options={WATER_SOURCE_OPTS.map((o) => o.value as WaterSource)} value={waterSource} onChange={setWaterSource} />
            </Group>
            <MultiSelect placeholder="Select all that apply"
              data={WATER_SOURCE_OPTS} value={waterSource} onChange={(v) => setWaterSource(v as WaterSource[])} comboboxProps={{ withinPortal: true }} />
          </div>
          <div>
            <Group justify="space-between" mb={6} wrap="nowrap" align="baseline">
              <Text size="sm" fw={500}><Group gap={6} component="span"><Drop size={16} /> Irrigation available</Group></Text>
              <SelectAllToggle options={IRRIGATION_OPTS.map((o) => o.value as IrrigationAvailable)} value={irrigationAvailable} onChange={setIrrigationAvailable} />
            </Group>
            <MultiSelect placeholder="Select all that apply"
              data={IRRIGATION_OPTS} value={irrigationAvailable} onChange={(v) => setIrrigationAvailable(v as IrrigationAvailable[])} comboboxProps={{ withinPortal: true }} />
          </div>
          <MultiSelect label="Seasons possible" placeholder="Select all that apply" leftSection={<CalendarBlank size={16} />}
            data={SEASON_OPTS} value={seasonsPossible} onChange={(v) => setSeasonsPossible(v as Season[])} comboboxProps={{ withinPortal: true }} />
          <div>
            <MultiSelect label="Known issues" placeholder="Select all that apply" leftSection={<Warning size={16} />}
              data={KNOWN_ISSUE_OPTS} value={knownIssues} onChange={(v) => setKnownIssues(v as KnownIssue[])} comboboxProps={{ withinPortal: true }} />
            {knownIssues.includes("other") && (
              <TextInput mt={6} placeholder="Please specify" value={knownIssuesOther} onChange={(e) => setKnownIssuesOther(e.currentTarget.value)} />
            )}
          </div>
          <div>
            <Group justify="space-between" mb={6} wrap="nowrap" align="baseline">
              <Text size="sm" fw={500}><Group gap={6} component="span"><PawPrint size={16} /> Animal pressure</Group></Text>
              <SelectAllToggle options={ANIMAL_PRESSURE_OPTS.map((o) => o.value as AnimalPressure)} value={animalPressure} onChange={setAnimalPressure} />
            </Group>
            <MultiSelect placeholder="Select all that apply"
              data={ANIMAL_PRESSURE_OPTS} value={animalPressure} onChange={(v) => setAnimalPressure(v as AnimalPressure[])} comboboxProps={{ withinPortal: true }} />
            {animalPressure.includes("other") && (
              <TextInput mt={6} placeholder="Please specify" value={animalPressureOther} onChange={(e) => setAnimalPressureOther(e.currentTarget.value)} />
            )}
          </div>
          <div>
            <Text size="sm" fw={500} mb={6}><Group gap={6} component="span"><Tractor size={16} /> Accessibility</Group></Text>
            <SegmentedControl fullWidth value={accessibility} onChange={(v) => setAccessibility(v as Accessibility)} data={ACCESSIBILITY_OPTS} />
            <Text size="xs" c="dimmed" mt={4}>
              {accessibility ? ACCESSIBILITY_DESCRIPTIONS[accessibility] : "What can physically get onto this plot?"}
            </Text>
          </div>
          <Autocomplete
            label="Previous crop" placeholder="Select or type previous crop" leftSection={<Plant size={16} />}
            data={PREVIOUS_CROPS} value={previousCrop} onChange={setPreviousCrop} comboboxProps={{ withinPortal: true }}
          />
          <SimpleGridTwo>
            <NumberInput label="Yield (quintals)" min={0} value={prevCropQuintals} onChange={(v) => setPrevCropQuintals(v as number | "")} />
            <Select label="vs. benchmark" placeholder="Select" clearable data={BENCHMARK_OPTS}
              value={prevCropBenchmark || null} onChange={(v) => setPrevCropBenchmark((v as BenchmarkComparison) || "")} comboboxProps={{ withinPortal: true }} />
          </SimpleGridTwo>
        </Stack>

        <Stack gap="sm">
          <SectionDivider icon={<PencilSimple size={14} />} label="Supervisor observation" />
          <SimpleGridTwo>
            <div>
              <Select
                label="Gradient" leftSection={<TrendUp size={16} />}
                clearable
                placeholder="Select, or walk 3+ boundary points to auto-detect"
                data={GRADIENT_OPTS} value={gradient || null}
                onChange={(v) => { gradientTouched.current = true; setGradient((v as Gradient) || ""); }}
                comboboxProps={{ withinPortal: true }} />
              {!gradientTouched.current && elevationLoading && boundary.length >= 3 && !gradientEstimate && (
                <Text size="xs" c="dimmed" mt={4}>Fetching elevation data…</Text>
              )}
              {boundary.length >= 3 && !gradientTouched.current && gradientEstimate && (
                <Text size="xs" c="dimmed" mt={4}>
                  Auto-filled ~{gradientEstimate.percent}% from {usingApiElevation ? "Google elevation data" : "boundary GPS altitude"} — tap to override
                </Text>
              )}
            </div>
            <Select label="Waterlogging risk" placeholder="Select" leftSection={<Drop size={16} />} clearable
              data={WATERLOGGING_OPTS} value={waterloggingProbability || null} onChange={(v) => setWaterloggingProbability((v as WaterloggingProbability) || "")} comboboxProps={{ withinPortal: true }} />
          </SimpleGridTwo>
          <SimpleGridTwo>
            <Select label="Sunlight availability" placeholder="Select" leftSection={<Sun size={16} />} clearable
              data={SUNLIGHT_OPTS} value={sunlightAvailability || null} onChange={(v) => setSunlightAvailability((v as SunlightAvailability) || "")} comboboxProps={{ withinPortal: true }} />
            <Select label="Fencing availability" placeholder="Select" leftSection={<Shield size={16} />} clearable
              data={FENCING_OPTS} value={fencingAvailability || null} onChange={(v) => setFencingAvailability((v as FencingAvailability) || "")} comboboxProps={{ withinPortal: true }} />
          </SimpleGridTwo>
        </Stack>

        <Stack gap="sm">
          <Divider />
          <Textarea
            label="Note (optional)" placeholder="Any note about this farm…"
            value={note} onChange={(e) => setNote(e.currentTarget.value)}
            autosize minRows={2} maxRows={5}
          />
        </Stack>

        {/* Also available at the bottom so saving never means scrolling back
            up — same action as the pinned button at the top. */}
        <Button fullWidth size="md" leftSection={<Tree size={18} />} onClick={save} loading={saving}>
          {editFarm ? "Update farm" : "Save farm"}
        </Button>
      </Stack>
    </AppModal>
  );
}

// Two-column layout for paired fields — a thin wrapper so the sections above
// stay readable without repeating the SimpleGrid props each time.
function SimpleGridTwo({ children }: { children: ReactNode }) {
  return <SimpleGrid cols={2} spacing="sm">{children}</SimpleGrid>;
}

// Section heading for a group of related fields — a small icon badge + an
// uppercase label gives each block a clear visual anchor, so the eye can
// scan section-to-section instead of field-to-field.
function SectionDivider({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <Divider
      label={
        <Group gap={8} wrap="nowrap">
          <ThemeIcon size={22} radius="xl" variant="light" color="green">{icon}</ThemeIcon>
          <Text size="sm" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: 0.4 }}>{label}</Text>
        </Group>
      }
      labelPosition="left"
    />
  );
}

// "Select all" as a small text toggle next to a MultiSelect's label — reads
// clearly as an action (unlike a bare Checkbox, which at this size renders
// as an unlabeled dot). Flips to "Clear" once everything is selected.
function SelectAllToggle<T extends string>(
  { options, value, onChange }: { options: T[]; value: T[]; onChange: (v: T[]) => void }
) {
  const allSelected = options.length > 0 && value.length === options.length;
  return (
    <UnstyledButton onClick={() => onChange(allSelected ? [] : options)}>
      <Text size="xs" fw={600} c={allSelected ? "gray.6" : "green.7"}
        style={{ textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 2 }}>
        {allSelected ? "Clear" : "Select all"}
      </Text>
    </UnstyledButton>
  );
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Add OR edit a plot. Pass `editPlot` to edit an existing one (prefilled + delete).
function AddPlotModal(
  { opened, onClose, farm, editPlot }:
  { opened: boolean; onClose: () => void; farm: Farm; editPlot?: Plot | null }
) {
  const { syncNow } = useSession();
  const [crop, setCrop] = useState("");
  const [sowingDate, setSowingDate] = useState(todayISO());
  const [loc, setLoc] = useState<SessionLocation | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ---- Tests ----
  // Neither Water TDS nor Soil type (clay/sand/silt) lives on the plot form
  // itself — both keep full history as repeatable records instead (WaterTDSTest
  // / SoilTextureTest), recorded via the Drop / Flask icons on each plot row.

  // Prefill (edit) or reset (add) each time the modal opens.
  useEffect(() => {
    if (!opened) return;
    if (editPlot) {
      setCrop(editPlot.crop || "");
      setSowingDate(editPlot.sowingDate || todayISO());
      setLoc(editPlot.lat != null && editPlot.lng != null
        ? { lat: editPlot.lat, lng: editPlot.lng, accuracy: editPlot.accuracy ?? 0, at: editPlot.updatedAt }
        : null);
    } else {
      setCrop(""); setSowingDate(todayISO()); setLoc(null);
    }
  }, [opened, editPlot]);

  const save = async () => {
    setSaving(true);
    try {
      const now = Date.now();
      if (editPlot) {
        await db.plots.update(editPlot.id, {
          crop: crop.trim(), sowingDate: sowingDate || undefined,
          lat: loc?.lat ?? null, lng: loc?.lng ?? null, accuracy: loc?.accuracy ?? null,
          updatedAt: now, synced: false,
        });
        await db.farmers.update(farm.farmerId, { updatedAt: now, synced: false });
        notifications.show({ color: "green", message: `Plot ${editPlot.seq} updated` });
      } else {
        const { id, seq } = await nextPlotId(farm.id);
        await db.plots.add({
          id, farmId: farm.id, farmerId: farm.farmerId, seq, crop: crop.trim(),
          sowingDate: sowingDate || undefined,
          lat: loc?.lat ?? null, lng: loc?.lng ?? null, accuracy: loc?.accuracy ?? null,
          createdAt: now, updatedAt: now, synced: false,
        });
        await db.farmers.update(farm.farmerId, { updatedAt: now, synced: false });
        notifications.show({ color: "green", message: `Plot ${seq} added` });
      }
      onClose();
      syncNow().catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editPlot) return;
    setDeleting(true);
    try {
      await softDeletePlot(editPlot.id);
      notifications.show({ color: "green", message: `Plot ${editPlot.seq} removed` });
      onClose();
      syncNow().catch(() => {});
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppModal opened={opened} onClose={onClose} title={editPlot ? `Edit plot ${editPlot.seq}` : `Add plot to ${farm.id}`}>
      <Stack gap="md">
        <LocationCapture loc={loc} onCapture={setLoc} />
        <Select label="Crop" placeholder="Select crop" data={CROPS} value={crop || null}
          onChange={(v) => setCrop(v || "")} leftSection={<Plant size={16} />}
          checkIconPosition="right" comboboxProps={{ withinPortal: true }} />
        <TextInput
          type="date" label="Sowing date" value={sowingDate}
          onChange={(e) => setSowingDate(e.currentTarget.value)}
          leftSection={<CalendarBlank size={16} />}
        />

        <Divider label={<Group gap={6}><Flask size={14} /> Tests</Group>} labelPosition="left" />
        <Text size="xs" c="dimmed">
          Water TDS and soil type (clay/sand/silt) are recorded separately, since a plot can be
          tested more than once — tap the <Drop size={11} weight="fill" style={{ verticalAlign: "middle" }} /> icon on the
          plot's row for water TDS test history, or the <Flask size={11} weight="fill" style={{ verticalAlign: "middle" }} /> icon
          for soil type test history — and add a new reading from either.
        </Text>

        <Button size="md" leftSection={<Path size={18} />} onClick={save} loading={saving}>
          {editPlot ? "Update plot" : "Save plot"}
        </Button>
        {editPlot && (
          <Button size="sm" variant="subtle" color="red" leftSection={<Trash size={16} />} onClick={remove} loading={deleting}>
            Remove plot
          </Button>
        )}
      </Stack>
    </AppModal>
  );
}
