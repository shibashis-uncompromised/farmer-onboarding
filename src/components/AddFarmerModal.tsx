"use client";

import { useEffect, useState } from "react";
import { Button, Group, Modal, Select, Stack, TextInput } from "@mantine/core";
import { UserPlus } from "@phosphor-icons/react";
import { notifications } from "@mantine/notifications";
import { db } from "@/lib/db";
import { nextFarmerId } from "@/lib/ids";
import { VILLAGES } from "@/lib/villages";
import { blurOnEnter } from "@/lib/ui";
import type { Farmer } from "@/lib/types";

interface Props {
  opened: boolean;
  onClose: () => void;
  defaultVillage: string;
  onCreated: (id: string) => void;
}

export default function AddFarmerModal({ opened, onClose, defaultVillage, onCreated }: Props) {
  const [village, setVillage] = useState(defaultVillage);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened) {
      setVillage(defaultVillage);
      setFirst("");
      setLast("");
    }
  }, [opened, defaultVillage]);

  const canSave = first.trim().length > 0 && last.trim().length > 0 && !!village;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const id = await nextFarmerId(village);
      const now = Date.now();
      const farmer: Farmer = {
        id, villageCode: village,
        firstName: first.trim(), lastName: last.trim(),
        coFirstName: "", coLastName: "", coRelation: "", phone: "",
        hasSmartphone: null, note: "", photoId: null, bioComplete: false,
        createdAt: now, updatedAt: now, synced: false,
      };
      await db.farmers.add(farmer);
      notifications.show({ color: "green", message: `Farmer ${id} created` });
      onCreated(id);
      onClose();
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not create farmer" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Add farmer" centered radius="lg">
      <Stack gap="md">
        <Select
          label="Village" data={VILLAGES.map((v) => ({ value: v.code, label: `${v.name} (${v.block})` }))}
          value={village} onChange={(v) => setVillage(v || "")} allowDeselect={false} checkIconPosition="right"
        />
        <TextInput label="First name" placeholder="e.g. Motilal" value={first}
          onChange={(e) => setFirst(e.currentTarget.value)} onKeyDown={blurOnEnter} enterKeyHint="next" required data-autofocus />
        <TextInput label="Last name" placeholder="e.g. Prathaji" value={last}
          onChange={(e) => setLast(e.currentTarget.value)} onKeyDown={blurOnEnter} enterKeyHint="done" required />
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving} disabled={!canSave} leftSection={<UserPlus size={18} />}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
