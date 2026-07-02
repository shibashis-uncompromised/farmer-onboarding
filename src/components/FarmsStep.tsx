"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  ActionIcon, Badge, Box, Button, Card, Group, Image, Paper, Select, Stack, Text,
  ThemeIcon, Timeline, UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  Plus, MapPinLine, Crosshair, Plant, Tree, CheckCircle, Path, Polygon as PolygonIcon, MapPin, Trash,
  Flask, ClockCounterClockwise, PencilSimple, CaretRight,
} from "@phosphor-icons/react";
import { useLiveQuery } from "dexie-react-hooks";
import { notifications } from "@mantine/notifications";
import { db } from "@/lib/db";
import { nextFarmId, nextPlotId, uid } from "@/lib/ids";
import { getBestLocation, fmtCoord } from "@/lib/location";
import type { Farmer, Farm, Plot, SessionLocation, BoundaryPoint, SoilSample } from "@/lib/types";
import { CROPS } from "@/lib/crops";
import { useBlobUrl } from "@/lib/useBlobUrl";
import PhotoInput from "./PhotoInput";
import AppModal from "./AppModal";
import QrScanner from "./QrScanner";
const BoundaryDrawMap = dynamic(() => import("./BoundaryDrawMap"), { ssr: false });
const FarmBoundaryPreview = dynamic(() => import("./FarmBoundaryPreview"), { ssr: false });
export default function FarmsStep({ farmer }: { farmer: Farmer }) {
  const farms = useLiveQuery(() => db.farms.where("farmerId").equals(farmer.id).toArray(), [farmer.id]);
  const plots = useLiveQuery(() => db.plots.where("farmerId").equals(farmer.id).toArray(), [farmer.id]);
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
  const [plotOpen, plotModal] = useDisclosure(false);
  const [scanOpen, scanModal] = useDisclosure(false);
  const [samplesOpen, samplesModal] = useDisclosure(false);
  const [editOpen, editModal] = useDisclosure(false);
  const [plotDetailOpen, plotDetailModal] = useDisclosure(false);
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [savingSample, setSavingSample] = useState(false);
  const photo = useLiveQuery(() => (farm.photoId ? db.media.get(farm.photoId) : undefined), [farm.photoId]);
  const url = useBlobUrl(photo?.blob);
  const soilSamples = useLiveQuery(
    () => db.soilSamples.where("farmId").equals(farm.id).toArray(),
    [farm.id]
  );

  // Scan a soil-sample QR → attach its code to this farm + farmer with a
  // best-effort location and the scan time. Fully offline (local write).
  const onScanSample = async (raw: string) => {
    const code = (raw || "").trim();
    scanModal.close();
    if (!code) return;
    setSavingSample(true);
    try {
      let loc: SessionLocation | null = null;
      try { loc = await getBestLocation({ targetAccuracy: 15, maxWait: 8000 }); } catch { /* location optional */ }
      const now = Date.now();
      const sample: SoilSample = {
        id: uid(), code, farmId: farm.id, farmerId: farm.farmerId, villageCode: farm.villageCode,
        lat: loc?.lat ?? null, lng: loc?.lng ?? null, accuracy: loc?.accuracy ?? null,
        createdAt: now, updatedAt: now, synced: false,
      };
      await db.soilSamples.add(sample);
      await db.farmers.update(farm.farmerId, { updatedAt: now, synced: false });
      notifications.show({ color: "green", message: `Soil sample ${code} added` });
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not save soil sample" });
    } finally {
      setSavingSample(false);
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
      {url && <Image src={url} h={120} radius="sm" mb="xs" fit="cover" alt="farm" />}
      <Group gap={6} mb="sm">
        <MapPinLine size={15} color="var(--mantine-color-green-7)" />
        <Text size="sm" c="dimmed">{fmtCoord(farm.lat)}, {fmtCoord(farm.lng)}</Text>
        {farm.boundary && farm.boundary.length > 0 && (
          <Badge variant="light" color="green" size="sm" leftSection={<PolygonIcon size={11} weight="fill" />}>
            {farm.boundary.length}-pt boundary
          </Badge>
        )}
        {(soilSamples?.length ?? 0) > 0 && (
          <Badge variant="light" color="orange" size="sm" leftSection={<Flask size={11} weight="fill" />}>
            {soilSamples!.length} soil
          </Badge>
        )}
      </Group>

      <Stack gap={6}>
        {plots.map((p) => (
          <UnstyledButton
            key={p.id}
            w="100%"
            onClick={() => { setSelectedPlot(p); plotDetailModal.open(); }}
          >
            <Paper withBorder radius="sm" p={8} bg="gray.0">
              <Group justify="space-between" wrap="nowrap">
                <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                  <ThemeIcon variant="light" color="green" size="md" radius="sm"><Plant size={16} /></ThemeIcon>
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={600} truncate>{p.crop || "—"}</Text>
                    <Text size="xs" c="dimmed">Plot {p.seq} · {fmtCoord(p.lat)}, {fmtCoord(p.lng)}</Text>
                  </div>
                </Group>
                <CaretRight size={16} color="var(--mantine-color-gray-5)" />
              </Group>
            </Paper>
          </UnstyledButton>
        ))}
      </Stack>

      <Group mt="sm" gap={6} grow wrap="nowrap">
        <Button size="xs" variant="light" leftSection={<Plus size={14} />} onClick={plotModal.open}
          styles={{ section: { marginRight: 4 }, label: { fontSize: 11 } }}>
          Add plot
        </Button>
        <Button size="xs" variant="light" color="orange" leftSection={<Flask size={14} />} onClick={scanModal.open} loading={savingSample}
          styles={{ section: { marginRight: 4 }, label: { fontSize: 11 } }}>
          Soil sample
        </Button>
        <Button size="xs" variant="light" color="gray" leftSection={<ClockCounterClockwise size={14} />} onClick={samplesModal.open}
          styles={{ section: { marginRight: 4 }, label: { fontSize: 11 } }}>
          View samples
        </Button>
      </Group>

      <AddPlotModal opened={plotOpen} onClose={plotModal.close} farm={farm} />
      <QrScanner opened={scanOpen} onClose={scanModal.close} onScan={onScanSample} />
      <SoilSamplesModal opened={samplesOpen} onClose={samplesModal.close} farm={farm} samples={soilSamples || []} />
      <AddFarmModal opened={editOpen} onClose={editModal.close} editFarm={farm} />
      <PlotDetailModal opened={plotDetailOpen} onClose={plotDetailModal.close} plot={selectedPlot} farm={farm} />
    </Card>
  );
}

// ---- Read-only plot detail — crop, location, and the parent farm's info ----
function PlotDetailModal({
  opened, onClose, plot, farm,
}: { opened: boolean; onClose: () => void; plot: Plot | null; farm: Farm }) {
  if (!plot) return null;

  return (
    <AppModal opened={opened} onClose={onClose} title={`Plot ${plot.seq}`}>
      <Stack gap="md">
        <Group gap={10}>
          <ThemeIcon variant="light" color="green" size={44} radius="md">
            <Plant size={22} weight="duotone" />
          </ThemeIcon>
          <div>
            <Text fw={700} size="lg">{plot.crop || "No crop set"}</Text>
            <Text size="xs" c="dimmed">Plot {plot.seq} · {plot.id}</Text>
          </div>
        </Group>

        <Paper withBorder radius="md" p="sm">
          <Text size="xs" fw={600} c="dimmed" mb={6}>PLOT LOCATION</Text>
          {plot.lat != null && plot.lng != null ? (
            <Group gap={6}>
              <MapPinLine size={15} color="var(--mantine-color-green-7)" />
              <Text size="sm">{fmtCoord(plot.lat)}, {fmtCoord(plot.lng)}</Text>
            </Group>
          ) : (
            <Text size="sm" c="dimmed">Not captured</Text>
          )}
        </Paper>

        <Paper withBorder radius="md" p="sm">
          <Text size="xs" fw={600} c="dimmed" mb={6}>PARENT FARM</Text>
          <Group gap={8} mb={6}>
            <Badge variant="light" color="green" leftSection={<Tree size={13} />}>{farm.id}</Badge>
            {farm.boundary && farm.boundary.length > 0 && (
              <Badge variant="light" color="green" size="sm" leftSection={<PolygonIcon size={11} weight="fill" />}>
                {farm.boundary.length}-pt boundary
              </Badge>
            )}
          </Group>
          <Group gap={6}>
            <MapPinLine size={15} color="var(--mantine-color-green-7)" />
            <Text size="sm" c="dimmed">
              {farm.lat != null && farm.lng != null
                ? `${fmtCoord(farm.lat)}, ${fmtCoord(farm.lng)}`
                : "Farm location not captured"}
            </Text>
          </Group>
        </Paper>

        {(farm.boundary && farm.boundary.length >= 3) || (farm.lat != null && farm.lng != null) ? (
          <Box>
            <Text size="xs" fw={600} c="dimmed" mb={6}>FARM BOUNDARY</Text>
            <FarmBoundaryPreview
              boundary={farm.boundary}
              markerLat={plot.lat}
              markerLng={plot.lng}
            />
          </Box>
        ) : null}
      </Stack>
    </AppModal>
  );
}

// ---- Timeline of soil samples taken from a farm ----
function SoilSamplesModal({ opened, onClose, farm, samples }: { opened: boolean; onClose: () => void; farm: Farm; samples: SoilSample[] }) {
  const sorted = [...samples].sort((a, b) => b.createdAt - a.createdAt);
  const fmtWhen = (n: number) =>
    new Date(n).toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <AppModal opened={opened} onClose={onClose} title={`Soil samples · ${farm.id}`}>
      {sorted.length === 0 ? (
        <Stack align="center" gap={6} py="lg">
          <ThemeIcon size={44} radius="xl" variant="light" color="orange"><Flask size={24} weight="duotone" /></ThemeIcon>
          <Text c="dimmed" ta="center">No soil samples yet for this farm</Text>
          <Text c="dimmed" size="sm">Tap “Soil sample” to scan one</Text>
        </Stack>
      ) : (
        <Timeline active={sorted.length} bulletSize={22} lineWidth={2} color="orange">
          {sorted.map((s) => (
            <Timeline.Item key={s.id} bullet={<Flask size={12} weight="fill" />} title={s.code}>
              <Text size="xs" c="dimmed">{fmtWhen(s.createdAt)}</Text>
              {s.lat != null && s.lng != null && (
                <Text size="xs" c="dimmed">
                  <Group gap={4} component="span"><MapPin size={11} /> {fmtCoord(s.lat)}, {fmtCoord(s.lng)}</Group>
                </Text>
              )}
            </Timeline.Item>
          ))}
        </Timeline>
      )}
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
      notifications.show({ color: "red", message: e?.message || "Could not get location" });
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

// ---- Boundary capture: draw the farm boundary directly on a map ----
function BoundaryCapture({
  points, onChange, centerHint,
}: {
  points: BoundaryPoint[];
  onChange: (p: BoundaryPoint[]) => void;
  centerHint?: { lat: number; lng: number } | null;
}) {
  return (
    <Paper withBorder radius="md" p="sm">
      <Group gap={8} mb="xs">
        <ThemeIcon variant="light" color={points.length ? "teal" : "gray"} radius="xl">
          <PolygonIcon size={18} weight={points.length ? "fill" : "regular"} />
        </ThemeIcon>
        <div>
          <Text size="sm" fw={500}>Farm boundary <Text span size="xs" c="dimmed">(optional)</Text></Text>
          <Text size="xs" c="dimmed">
            {points.length ? `${points.length}-point boundary drawn` : "Draw the boundary on the map below"}
          </Text>
        </div>
      </Group>
      <BoundaryDrawMap points={points} onChange={onChange} centerHint={centerHint} />
    </Paper>
  );
}

// Add OR edit a farm. Pass `editFarm` to edit an existing one (prefilled);
// otherwise `farmer` is used to create a new farm.
function AddFarmModal(
  { opened, onClose, farmer, editFarm }:
  { opened: boolean; onClose: () => void; farmer?: Farmer; editFarm?: Farm }
) {
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
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not save farm" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal opened={opened} onClose={onClose} title={editFarm ? `Edit farm · ${editFarm.id}` : "Add farm"}>
      <Stack gap="md">
        <PhotoInput label="Farm photo" value={photo} onChange={(b) => { setPhoto(b); setPhotoDirty(true); }} height={160} />
        <LocationCapture loc={loc} onCapture={setLoc} />
        <BoundaryCapture points={boundary} onChange={setBoundary} centerHint={loc} />
        <Button size="md" leftSection={<Tree size={18} />} onClick={save} loading={saving}>
          {editFarm ? "Update farm" : "Save farm"}
        </Button>
      </Stack>
    </AppModal>
  );
}

function AddPlotModal({ opened, onClose, farm }: { opened: boolean; onClose: () => void; farm: Farm }) {
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