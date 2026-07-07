"use client";

import { useEffect, useState } from "react";
import {
  Avatar, Badge, Box, Button, Collapse, Divider, Group, SegmentedControl, SimpleGrid,
  Stack, Switch, Text, Textarea, TextInput,
} from "@mantine/core";
import {
  PencilSimple, FloppyDisk, CheckCircle, DeviceMobile, NotePencil, ArrowRight, Plant,
} from "@phosphor-icons/react";
import { useLiveQuery } from "dexie-react-hooks";
import { notifications } from "@mantine/notifications";
import { db } from "@/lib/db";
import { uid } from "@/lib/ids";
import { seedLabel } from "@/lib/seeds";
import { useMediaUrl } from "@/lib/useMediaUrl";
import type { Farmer, SeedPackage } from "@/lib/types";
import PhotoInput from "./PhotoInput";
import SeedsInput from "./SeedsInput";
import { blurOnEnter } from "@/lib/ui";

const RELATIONS = ["S/o", "W/o", "D/o", "C/o"];

export default function BioStep({
  farmer, onSaved, onContinue,
}: {
  farmer: Farmer;
  onSaved: () => void;
  onContinue: () => void;
}) {
  const [editing, setEditing] = useState(!farmer.bioComplete);
  const [first, setFirst] = useState(farmer.firstName);
  const [last, setLast] = useState(farmer.lastName);
  const [coOn, setCoOn] = useState(!!(farmer.coFirstName || farmer.coLastName));
  const [coFirst, setCoFirst] = useState(farmer.coFirstName);
  const [coLast, setCoLast] = useState(farmer.coLastName);
  const [relation, setRelation] = useState(farmer.coRelation || "S/o");
  const [phone, setPhone] = useState(farmer.phone);
  const [smartphone, setSmartphone] = useState<string>(
    farmer.hasSmartphone == null ? "" : farmer.hasSmartphone ? "yes" : "no"
  );
  const [note, setNote] = useState(farmer.note || "");
  const [seeds, setSeeds] = useState<SeedPackage[]>(farmer.seeds || []);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoDirty, setPhotoDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const existingPhoto = useLiveQuery(
    () => (farmer.photoId ? db.media.get(farmer.photoId) : undefined),
    [farmer.photoId]
  );

  useEffect(() => {
    if (!photoDirty && existingPhoto?.blob) setPhoto(existingPhoto.blob);
  }, [existingPhoto, photoDirty]);

  // Auto-revoked preview URL for the read-only view (no per-render leak).
  const savedPhotoUrl = useMediaUrl(farmer.photoId);

  const canSave = first.trim() && last.trim();

  const save = async () => {
    if (!canSave) {
      notifications.show({ color: "red", message: "First and last name are required" });
      return;
    }
    setSaving(true);
    try {
      let photoId = farmer.photoId;
      if (photoDirty) {
        if (photoId) await db.media.delete(photoId).catch(() => {});
        if (photo) {
          photoId = uid();
          await db.media.add({ id: photoId, blob: photo, createdAt: Date.now(), synced: false });
        } else {
          photoId = null;
        }
      }
      await db.farmers.update(farmer.id, {
        firstName: first.trim(), lastName: last.trim(),
        coFirstName: coOn ? coFirst.trim() : "", coLastName: coOn ? coLast.trim() : "",
        coRelation: coOn ? relation : "",
        phone: phone.trim(), hasSmartphone: smartphone === "" ? null : smartphone === "yes",
        note: note.trim(),
        seeds: seeds.map((s) => ({ seed: s.seed, qty: s.qty })),
        photoId, bioComplete: true, updatedAt: Date.now(), synced: false,
      });
      setPhotoDirty(false);
      setEditing(false);
      notifications.show({ color: "green", message: "Bio data saved" });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  // ---- Read-only view ----
  if (!editing) {
    const co = [coFirst, coLast].filter(Boolean).join(" ");
    const photoUrl = savedPhotoUrl;
    return (
      <Stack gap="md">
        <Group justify="space-between">
          <Badge color="teal" variant="light" leftSection={<CheckCircle size={14} weight="fill" />}>
            Saved
          </Badge>
          <Button size="xs" variant="light" leftSection={<PencilSimple size={14} />} onClick={() => setEditing(true)}>
            Edit
          </Button>
        </Group>
        <Group>
          <Avatar src={photoUrl} size={72} radius="md" color="green">
            {first?.[0]}{last?.[0]}
          </Avatar>
          <div>
            <Text fw={700} size="lg">{first} {last}</Text>
            {co && <Text c="dimmed">{relation} {co}</Text>}
            <Text size="sm" c="dimmed">{farmer.id}</Text>
          </div>
        </Group>
        <Divider />
        <SimpleGrid cols={2} spacing="sm">
          <Field label="Phone" value={phone || "—"} />
          <Field label="Smartphone" value={smartphone === "yes" ? "Yes" : smartphone === "no" ? "No" : "—"} />
        </SimpleGrid>
        {seeds.length > 0 && (
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>Seed packages</Text>
            <Group gap={6}>
              {seeds.map((s) => (
                <Badge key={s.seed} variant="light" color="green" leftSection={<Plant size={12} />}>
                  {seedLabel(s.seed, s.qty)}
                </Badge>
              ))}
            </Group>
          </div>
        )}
        {note.trim() && <Field label="Note" value={note} />}

        <Button fullWidth size="md" color="green" rightSection={<ArrowRight size={18} weight="bold" />} onClick={onContinue}>
          Continue to Farms &amp; Plots
        </Button>
      </Stack>
    );
  }

  // ---- Editing view ----
  return (
    <Stack gap="md">
      <Group align="flex-start" wrap="nowrap" gap="sm">
        <PhotoInput
          compact label="Photo"
          value={photo}
          onChange={(b) => { setPhoto(b); setPhotoDirty(true); }}
        />
        <Box style={{ flex: 1, minWidth: 0 }}>
          <TextInput label="First name" value={first} onChange={(e) => setFirst(e.currentTarget.value)} onKeyDown={blurOnEnter} enterKeyHint="next" required mb={6} />
          <TextInput label="Last name" value={last} onChange={(e) => setLast(e.currentTarget.value)} onKeyDown={blurOnEnter} enterKeyHint="next" required />
        </Box>
      </Group>

      <Switch
        checked={coOn} onChange={(e) => setCoOn(e.currentTarget.checked)}
        label="Add care-of (C/o)" color="green"
      />
      <Collapse in={coOn}>
        <Stack gap="sm">
          <SegmentedControl
            fullWidth data={RELATIONS.map((r) => ({ label: r, value: r }))} value={relation} onChange={setRelation}
          />
          <SimpleGrid cols={2} spacing="sm">
            <TextInput label="C/o first name" value={coFirst} onChange={(e) => setCoFirst(e.currentTarget.value)} onKeyDown={blurOnEnter} enterKeyHint="next" />
            <TextInput label="C/o last name" value={coLast} onChange={(e) => setCoLast(e.currentTarget.value)} onKeyDown={blurOnEnter} enterKeyHint="done" />
          </SimpleGrid>
        </Stack>
      </Collapse>

      <Divider />
      <SimpleGrid cols={2} spacing="sm">
        <TextInput
          label="Phone number" type="tel" inputMode="numeric" value={phone}
          onChange={(e) => setPhone(e.currentTarget.value)} onKeyDown={blurOnEnter} enterKeyHint="done" placeholder="10-digit mobile"
        />
        <div>
          <Text size="sm" fw={500} mb={6}>
            <Group gap={6} component="span"><DeviceMobile size={16} /> Smartphone?</Group>
          </Text>
          <SegmentedControl
            fullWidth value={smartphone} onChange={setSmartphone}
            data={[{ label: "Yes", value: "yes" }, { label: "No", value: "no" }]}
          />
        </div>
      </SimpleGrid>

      <Divider />
      <SeedsInput value={seeds} onChange={setSeeds} />

      <Textarea
        label={<Group gap={6} component="span"><NotePencil size={16} /> Note (optional)</Group>}
        placeholder="Any note from the onboarding team…"
        value={note} onChange={(e) => setNote(e.currentTarget.value)}
        autosize minRows={2} maxRows={5}
      />

      <Group grow>
        <Button size="md" leftSection={<FloppyDisk size={18} />} onClick={save} loading={saving} disabled={!canSave}>
          Save bio data
        </Button>
        {farmer.bioComplete && (
          <Button size="md" variant="light" color="green" rightSection={<ArrowRight size={18} weight="bold" />} onClick={onContinue}>
            Continue
          </Button>
        )}
      </Group>
    </Stack>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{label}</Text>
      <Text fw={500}>{value}</Text>
    </div>
  );
}
