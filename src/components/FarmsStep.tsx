"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  ActionIcon, Badge, Box, Button, Card, Center, Group, Image, Loader, Paper, SegmentedControl, Select, Stack, Text,
  TextInput, ThemeIcon, Timeline, UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  Plus, MapPinLine, Crosshair, Plant, Tree, CheckCircle, Path, Polygon, MapPin, Trash,
  Flask, ClockCounterClockwise, PencilSimple,
} from "@phosphor-icons/react";
import { useLiveQuery } from "dexie-react-hooks";
import { notifications } from "@mantine/notifications";
import { db } from "@/lib/db";
import { nextFarmId, nextPlotId, uid } from "@/lib/ids";
import { getBestLocation, getLastLocation, fmtCoord } from "@/lib/location";
import { boundsAroundPoint, downloadTiles } from "@/lib/offlineTiles";
import { looksLikeFarmerCode, looksLikeSoilCode } from "@/lib/qr";
import { useSession } from "@/providers/SessionGate";
import type { Farmer, Farm, SessionLocation, BoundaryPoint, SoilSample } from "@/lib/types";
import { CROPS } from "@/lib/crops";
import { useBlobUrl } from "@/lib/useBlobUrl";
import PhotoInput from "./PhotoInput";
import AppModal from "./AppModal";
import QrScanner from "./QrScanner";
import MapErrorBoundary from "./MapErrorBoundary";

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
  const [scanOpen, scanModal] = useDisclosure(false);
  const [samplesOpen, samplesModal] = useDisclosure(false);
  const [editOpen, editModal] = useDisclosure(false);
  const [detailOpen, detailModal] = useDisclosure(false);
  const [manualOpen, manualModal] = useDisclosure(false);
  const [cropOpen, cropModal] = useDisclosure(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const photo = useLiveQuery(() => (farm.photoId ? db.media.get(farm.photoId) : undefined), [farm.photoId]);
  const url = useBlobUrl(photo?.blob);
  const soilSamples = useLiveQuery(
    async () => (await db.soilSamples.where("farmId").equals(farm.id).toArray()).filter((x) => !x.deleted),
    [farm.id]
  );

  // Step 1 — scan/type a soil-sample code → validate → open the past-crops form.
  const onScanSample = (raw: string) => {
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
    const dup = (soilSamples || []).find((s) => s.code.toUpperCase() === code.toUpperCase());
    if (dup) {
      notifications.show({ color: "blue", message: `Sample ${code} is already added to this farm` });
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
          <Paper key={p.id} withBorder radius="sm" p={8} bg="gray.0">
              <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                <ThemeIcon variant="light" color="green" size="md" radius="sm"><Plant size={16} /></ThemeIcon>
                <div style={{ minWidth: 0 }}>
                  <Text size="sm" fw={600} truncate>{p.crop || "—"}</Text>
                  <Text size="xs" c="dimmed">Plot {p.seq} · {fmtCoord(p.lat)}, {fmtCoord(p.lng)}</Text>
                </div>
              </Group>
            </Paper>
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
          View samples
        </Button>
      </Group>

      <AddPlotModal opened={plotOpen} onClose={plotModal.close} farm={farm} />
      <QrScanner opened={scanOpen} onClose={scanModal.close} onScan={onScanSample} onManual={manualModal.open} />
      <ManualSampleModal opened={manualOpen} onClose={manualModal.close} onSubmit={onScanSample} />
      <SoilCropModal opened={cropOpen} onClose={() => { cropModal.close(); setPendingCode(null); }} code={pendingCode} onSave={saveSample} />
      <SoilSamplesModal opened={samplesOpen} onClose={samplesModal.close} farm={farm} samples={soilSamples || []} onScanMore={scanModal.open} onManual={manualModal.open} />
      <AddFarmModal opened={editOpen} onClose={editModal.close} editFarm={farm} />
      <FarmDetailModal opened={detailOpen} onClose={detailModal.close} farm={farm} plots={plots} samples={soilSamples || []} photoUrl={url} onEdit={() => { detailModal.close(); editModal.open(); }} />
    </Card>
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
                {s.pastCrops && <Text size="xs" c="dimmed"><Group gap={4} component="span"><Plant size={11} /> Past crops: {s.pastCrops}</Group></Text>}
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

// ---- Past crops for a soil sample (research) — shown after a valid code ----
function SoilCropModal(
  { opened, onClose, code, onSave }:
  { opened: boolean; onClose: () => void; code: string | null; onSave: (pastCrops: string) => void }
) {
  const [crops, setCrops] = useState("");
  useEffect(() => { if (opened) setCrops(""); }, [opened]);
  return (
    <AppModal opened={opened} onClose={onClose} title="Soil sample — past crops">
      <Stack gap="md">
        <Group gap={6}>
          <ThemeIcon variant="light" color="orange" radius="xl"><Flask size={16} weight="fill" /></ThemeIcon>
          <Text fw={700}>{code}</Text>
        </Group>
        <TextInput
          label="Past / previous crops"
          description="What was grown on this plot before (for research). Optional."
          placeholder="e.g. Wheat, Cotton (last 1–2 seasons)"
          value={crops} onChange={(e) => setCrops(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSave(crops); } }}
          data-autofocus
        />
        <Button color="orange" leftSection={<Flask size={16} />} onClick={() => onSave(crops)}>
          Save soil sample
        </Button>
      </Stack>
    </AppModal>
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
                <Text key={p.id} size="xs" c="dimmed">Plot {p.seq} · {p.crop || "—"} · {fmtCoord(p.lat)}, {fmtCoord(p.lng)}</Text>
              ))}
            </Stack>
          )}
        </Paper>

        <Paper withBorder radius="md" p="sm">
          <Text size="sm" fw={500} mb={6}>
            <Group gap={6} component="span"><Flask size={16} /> Soil samples · {samples.length}</Group>
          </Text>
          {samples.length === 0 ? (
            <Text size="xs" c="dimmed">No samples yet</Text>
          ) : (
            <Stack gap={4}>
              {[...samples].sort((a, b) => b.createdAt - a.createdAt).map((s) => (
                <Text key={s.id} size="xs" c="dimmed">{s.code} · {fmtWhen(s.createdAt)}{s.pastCrops ? ` · past: ${s.pastCrops}` : ""}</Text>
              ))}
            </Stack>
          )}
        </Paper>

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
      onChange([...points, { lat: l.lat, lng: l.lng, accuracy: l.accuracy, at: l.at }]);
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
  const [saving, setSaving] = useState(false);

  const existingPhoto = useLiveQuery(
    () => (editFarm?.photoId ? db.media.get(editFarm.photoId) : undefined),
    [editFarm?.photoId]
  );

  // Prefill (edit) or clear (add) whenever the modal opens.
  useEffect(() => {
    if (!opened) return;
    setPhotoDirty(false);
    if (editFarm) {
      setLoc(editFarm.lat != null && editFarm.lng != null
        ? { lat: editFarm.lat, lng: editFarm.lng, accuracy: editFarm.accuracy ?? 0, at: editFarm.updatedAt }
        : null);
      setBoundary(editFarm.boundary ?? []);
    } else {
      setPhoto(null); setLoc(null); setBoundary([]);
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
      if (editFarm) {
        let photoId = editFarm.photoId;
        if (photoDirty) {
          if (photoId) await db.media.delete(photoId).catch(() => {});
          if (photo) { photoId = uid(); await db.media.add({ id: photoId, blob: photo, createdAt: now, synced: false }); }
          else photoId = null;
        }
        await db.farms.update(editFarm.id, {
          photoId, lat: loc?.lat ?? null, lng: loc?.lng ?? null, accuracy: loc?.accuracy ?? null,
          boundary: boundary.length ? boundary : undefined, updatedAt: now, synced: false,
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
          boundary: boundary.length ? boundary : undefined,
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
      <Stack gap="md">
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
        <LocationCapture loc={loc} onCapture={setLoc} />
        <BoundaryCapture points={boundary} onChange={setBoundary} centerHint={loc} />
      </Stack>
    </AppModal>
  );
}

function AddPlotModal({ opened, onClose, farm }: { opened: boolean; onClose: () => void; farm: Farm }) {
  const { syncNow } = useSession();
  const [crop, setCrop] = useState("");
  const [loc, setLoc] = useState<SessionLocation | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { id, seq } = await nextPlotId(farm.id);
      const now = Date.now();
      await db.plots.add({
        id, farmId: farm.id, farmerId: farm.farmerId, seq, crop: crop.trim(),
        lat: loc?.lat ?? null, lng: loc?.lng ?? null, accuracy: loc?.accuracy ?? null,
        createdAt: now, updatedAt: now, synced: false,
      });
      await db.farmers.update(farm.farmerId, { updatedAt: now, synced: false });
      notifications.show({ color: "green", message: `Plot ${seq} added` });
      setCrop(""); setLoc(null);
      onClose();
      syncNow().catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal opened={opened} onClose={onClose} title={`Add plot to ${farm.id}`}>
      <Stack gap="md">
        <LocationCapture loc={loc} onCapture={setLoc} />
        <Select label="Crop" placeholder="Select crop" data={CROPS} value={crop || null}
          onChange={(v) => setCrop(v || "")} leftSection={<Plant size={16} />}
          checkIconPosition="right" searchable data-autofocus />
        <Button size="md" leftSection={<Path size={18} />} onClick={save} loading={saving}>Save plot</Button>
      </Stack>
    </AppModal>
  );
}
