"use client";

import { useState } from "react";
import {
  ActionIcon, Badge, Box, Button, Card, Group, Image, Paper, Select, Stack, Text,
  ThemeIcon,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  Plus, MapPinLine, Crosshair, Plant, Tree, CheckCircle, Path, Polygon, MapPin, Trash,
} from "@phosphor-icons/react";
import { useLiveQuery } from "dexie-react-hooks";
import { notifications } from "@mantine/notifications";
import { db } from "@/lib/db";
import { nextFarmId, nextPlotId, uid } from "@/lib/ids";
import { getCurrentLocation, fmtCoord } from "@/lib/location";
import type { Farmer, Farm, SessionLocation, BoundaryPoint } from "@/lib/types";
import { CROPS } from "@/lib/crops";
import PhotoInput from "./PhotoInput";
import AppModal from "./AppModal";

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
  const photo = useLiveQuery(() => (farm.photoId ? db.media.get(farm.photoId) : undefined), [farm.photoId]);
  const url = photo?.blob ? URL.createObjectURL(photo.blob) : null;

  return (
    <Card withBorder radius="md" p="sm">
      <Group justify="space-between" mb="xs">
        <Badge variant="light" color="green" leftSection={<Tree size={13} />}>{farm.id}</Badge>
        <Text size="xs" c="dimmed">{plots.length} plot{plots.length === 1 ? "" : "s"}</Text>
      </Group>
      {url && <Image src={url} h={120} radius="sm" mb="xs" fit="cover" alt="farm" />}
      <Group gap={6} mb="sm">
        <MapPinLine size={15} color="var(--mantine-color-green-7)" />
        <Text size="sm" c="dimmed">{fmtCoord(farm.lat)}, {fmtCoord(farm.lng)}</Text>
        {farm.boundary && farm.boundary.length > 0 && (
          <Badge variant="light" color="green" size="sm" leftSection={<Polygon size={11} weight="fill" />}>
            {farm.boundary.length}-pt boundary
          </Badge>
        )}
      </Group>

      <Stack gap={6}>
        {plots.map((p) => (
          <Paper key={p.id} withBorder radius="sm" p={8} bg="gray.0">
            <Group justify="space-between" wrap="nowrap">
              <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                <ThemeIcon variant="light" color="green" size="md" radius="sm"><Plant size={16} /></ThemeIcon>
                <div style={{ minWidth: 0 }}>
                  <Text size="sm" fw={600} truncate>{p.crop || "—"}</Text>
                  <Text size="xs" c="dimmed">Plot {p.seq} · {fmtCoord(p.lat)}, {fmtCoord(p.lng)}</Text>
                </div>
              </Group>
            </Group>
          </Paper>
        ))}
      </Stack>

      <Button mt="sm" size="xs" variant="subtle" leftSection={<Plus size={14} />} onClick={plotModal.open}>
        Add plot
      </Button>
      <AddPlotModal opened={plotOpen} onClose={plotModal.close} farm={farm} />
    </Card>
  );
}

// ---- Reusable location capture row ----
function LocationCapture({ loc, onCapture }: { loc: SessionLocation | null; onCapture: (l: SessionLocation) => void }) {
  const [busy, setBusy] = useState(false);
  const capture = async () => {
    setBusy(true);
    try {
      // maximumAge: 0 forces a fresh GPS reading each tap, so two plots captured
      // in quick succession never reuse a stale (cached) position.
      onCapture(await getCurrentLocation({ maximumAge: 0 }));
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not get location" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Paper withBorder radius="md" p="sm">
      <Group justify="space-between">
        <Group gap={8}>
          <ThemeIcon variant="light" color={loc ? "teal" : "gray"} radius="xl">
            {loc ? <CheckCircle size={18} weight="fill" /> : <Crosshair size={18} />}
          </ThemeIcon>
          <div>
            <Text size="sm" fw={500}>{loc ? "Location captured" : "Geolocation"}</Text>
            <Text size="xs" c="dimmed">
              {loc ? `${fmtCoord(loc.lat)}, ${fmtCoord(loc.lng)} (±${Math.round(loc.accuracy)}m)` : "Not captured yet"}
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

// ---- Boundary capture: stand at each corner / deviation point and add it ----
function BoundaryCapture({ points, onChange }: { points: BoundaryPoint[]; onChange: (p: BoundaryPoint[]) => void }) {
  const [busy, setBusy] = useState(false);
  const addPoint = async () => {
    setBusy(true);
    try {
      const l = await getCurrentLocation({ maximumAge: 0 });   // fresh fix per corner
      onChange([...points, { lat: l.lat, lng: l.lng, accuracy: l.accuracy, at: l.at }]);
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not get location" });
    } finally {
      setBusy(false);
    }
  };
  const removePoint = (i: number) => onChange(points.filter((_, idx) => idx !== i));

  return (
    <Paper withBorder radius="md" p="sm">
      <Group justify="space-between" mb={points.length ? "xs" : 0}>
        <Group gap={8}>
          <ThemeIcon variant="light" color={points.length ? "teal" : "gray"} radius="xl">
            <Polygon size={18} weight={points.length ? "fill" : "regular"} />
          </ThemeIcon>
          <div>
            <Text size="sm" fw={500}>Farm boundary <Text span size="xs" c="dimmed">(optional)</Text></Text>
            <Text size="xs" c="dimmed">
              {points.length ? `${points.length} point${points.length === 1 ? "" : "s"} captured` : "Stand at each corner and add a point"}
            </Text>
          </div>
        </Group>
        <Button size="xs" variant="filled" leftSection={<Plus size={14} />} loading={busy} onClick={addPoint}>
          Add point
        </Button>
      </Group>
      {points.length > 0 && (
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
      )}
    </Paper>
  );
}

function AddFarmModal({ opened, onClose, farmer }: { opened: boolean; onClose: () => void; farmer: Farmer }) {
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [loc, setLoc] = useState<SessionLocation | null>(null);
  const [boundary, setBoundary] = useState<BoundaryPoint[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => { setPhoto(null); setLoc(null); setBoundary([]); };

  const save = async () => {
    setSaving(true);
    try {
      const id = await nextFarmId(farmer.villageCode);
      let photoId: string | null = null;
      if (photo) { photoId = uid(); await db.media.add({ id: photoId, blob: photo, createdAt: Date.now(), synced: false }); }
      const now = Date.now();
      await db.farms.add({
        id, farmerId: farmer.id, villageCode: farmer.villageCode, photoId,
        lat: loc?.lat ?? null, lng: loc?.lng ?? null, accuracy: loc?.accuracy ?? null,
        boundary: boundary.length ? boundary : undefined,
        createdAt: now, updatedAt: now, synced: false,
      });
      await db.farmers.update(farmer.id, { updatedAt: now, synced: false });
      notifications.show({ color: "green", message: `Farm ${id} added` });
      reset();
      onClose();
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not add farm" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal opened={opened} onClose={onClose} title="Add farm">
      <Stack gap="md">
        <PhotoInput label="Farm photo" value={photo} onChange={setPhoto} height={160} />
        <LocationCapture loc={loc} onCapture={setLoc} />
        <BoundaryCapture points={boundary} onChange={setBoundary} />
        <Button size="md" leftSection={<Tree size={18} />} onClick={save} loading={saving}>Save farm</Button>
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
