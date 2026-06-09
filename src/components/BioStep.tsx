"use client";

import { useEffect, useState } from "react";
import {
  Avatar, Badge, Button, Divider, Group, SegmentedControl, SimpleGrid, Stack,
  Text, TextInput,
} from "@mantine/core";
import { PencilSimple, FloppyDisk, CheckCircle, DeviceMobile } from "@phosphor-icons/react";
import { useLiveQuery } from "dexie-react-hooks";
import { notifications } from "@mantine/notifications";
import { db } from "@/lib/db";
import { uid } from "@/lib/ids";
import type { Farmer } from "@/lib/types";
import PhotoInput from "./PhotoInput";
import { blurOnEnter } from "@/lib/ui";

const RELATIONS = ["S/o", "W/o", "D/o", "C/o"];

export default function BioStep({ farmer, onSaved }: { farmer: Farmer; onSaved: () => void }) {
  const [editing, setEditing] = useState(!farmer.bioComplete);
  const [first, setFirst] = useState(farmer.firstName);
  const [last, setLast] = useState(farmer.lastName);
  const [coFirst, setCoFirst] = useState(farmer.coFirstName);
  const [coLast, setCoLast] = useState(farmer.coLastName);
  const [relation, setRelation] = useState(farmer.coRelation || "S/o");
  const [phone, setPhone] = useState(farmer.phone);
  const [smartphone, setSmartphone] = useState<string>(
    farmer.hasSmartphone == null ? "" : farmer.hasSmartphone ? "yes" : "no"
  );
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
          await db.media.add({ id: photoId, blob: photo, createdAt: Date.now() });
        } else {
          photoId = null;
        }
      }
      await db.farmers.update(farmer.id, {
        firstName: first.trim(), lastName: last.trim(),
        coFirstName: coFirst.trim(), coLastName: coLast.trim(), coRelation: relation,
        phone: phone.trim(), hasSmartphone: smartphone === "" ? null : smartphone === "yes",
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

  if (!editing) {
    const co = [coFirst, coLast].filter(Boolean).join(" ");
    const photoUrl = existingPhoto?.blob ? URL.createObjectURL(existingPhoto.blob) : null;
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
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <PhotoInput
        label="Farmer photo"
        value={photo}
        onChange={(b) => { setPhoto(b); setPhotoDirty(true); }}
      />
      <SimpleGrid cols={2} spacing="sm">
        <TextInput label="First name" value={first} onChange={(e) => setFirst(e.currentTarget.value)} onKeyDown={blurOnEnter} enterKeyHint="next" required />
        <TextInput label="Last name" value={last} onChange={(e) => setLast(e.currentTarget.value)} onKeyDown={blurOnEnter} enterKeyHint="next" required />
      </SimpleGrid>

      <Divider label="Care of (guardian / spouse)" labelPosition="left" />
      <Group grow align="flex-end">
        <SegmentedControl
          data={RELATIONS.map((r) => ({ label: r, value: r }))} value={relation} onChange={setRelation}
        />
      </Group>
      <SimpleGrid cols={2} spacing="sm">
        <TextInput label="C/o first name" value={coFirst} onChange={(e) => setCoFirst(e.currentTarget.value)} onKeyDown={blurOnEnter} enterKeyHint="next" />
        <TextInput label="C/o last name" value={coLast} onChange={(e) => setCoLast(e.currentTarget.value)} onKeyDown={blurOnEnter} enterKeyHint="done" />
      </SimpleGrid>

      <Divider />
      <TextInput
        label="Phone number" type="tel" inputMode="numeric" value={phone}
        onChange={(e) => setPhone(e.currentTarget.value)} onKeyDown={blurOnEnter} enterKeyHint="done" placeholder="10-digit mobile"
      />
      <div>
        <Text size="sm" fw={500} mb={6}>
          <Group gap={6} component="span"><DeviceMobile size={16} /> Has a smartphone?</Group>
        </Text>
        <SegmentedControl
          fullWidth value={smartphone} onChange={setSmartphone}
          data={[{ label: "Yes", value: "yes" }, { label: "No", value: "no" }]}
        />
      </div>

      <Button size="md" leftSection={<FloppyDisk size={18} />} onClick={save} loading={saving} disabled={!canSave}>
        Save bio data
      </Button>
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
