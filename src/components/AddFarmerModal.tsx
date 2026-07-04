"use client";

import { useEffect, useState } from "react";
import { Button, Group, Select, Stack, TextInput } from "@mantine/core";
import AppModal from "./AppModal";
import { UserPlus } from "@phosphor-icons/react";
import { notifications } from "@mantine/notifications";
import { db } from "@/lib/db";
import { nextFarmerId } from "@/lib/ids";
import { villageCodeFromId } from "@/lib/qr";
import { villagesForUser } from "@/lib/villages";
import { getSession } from "@/lib/session";
import { blurOnEnter } from "@/lib/ui";
import type { Farmer } from "@/lib/types";

interface Props {
  opened: boolean;
  onClose: () => void;
  defaultVillage: string;
  onCreated: (id: string) => void;
  scannedCode?: string | null;   // when set, use this exact code as the id
}

export default function AddFarmerModal({ opened, onClose, defaultVillage, onCreated, scannedCode }: Props) {
  const [village, setVillage] = useState(defaultVillage);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened) {
      // For a scanned code, default the village to the one encoded in the code.
      setVillage((scannedCode && villageCodeFromId(scannedCode)) || defaultVillage);
      setFirst("");
      setLast("");
    }
  }, [opened, defaultVillage, scannedCode]);

  const canSave = first.trim().length > 0 && last.trim().length > 0 && !!village;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      // Scanned codes are authoritative ids; otherwise allocate from the block.
      const id = scannedCode ? scannedCode : await nextFarmerId(village);

      // If a scanned farmer already exists, just open it instead of duplicating.
      if (scannedCode) {
        const existing = await db.farmers.get(id);
        if (existing) {
          if (existing.deleted) {
            notifications.show({ color: "yellow", message: `${id} is hidden/deleted` });
            onClose();
            return;
          }
          notifications.show({ color: "blue", message: `${id} already exists — opening` });
          onCreated(id);
          onClose();
          return;
        }
      }

      const now = Date.now();
      const farmer: Farmer = {
        id, villageCode: village,
        firstName: first.trim(), lastName: last.trim(),
        coFirstName: "", coLastName: "", coRelation: "", phone: "",
        hasSmartphone: null, note: "", photoId: null, seeds: [], bioComplete: false,
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
    <AppModal opened={opened} onClose={onClose} title={scannedCode ? "New farmer (scanned)" : "Add farmer"}>
      <Stack gap="md">
        {scannedCode && (
          <TextInput label="Scanned code" value={scannedCode} readOnly variant="filled" styles={{ input: { fontWeight: 700 } }} />
        )}
        <Select
          label="Village" data={villagesForUser(getSession()?.username).map((v) => ({ value: v.code, label: `${v.name} (${v.block})` }))}
          value={village} onChange={(v) => setVillage(v || "")} allowDeselect={false} checkIconPosition="right"
        />
        <TextInput label="First name" placeholder="e.g. Motilal" value={first}
          onChange={(e) => setFirst(e.currentTarget.value)} onKeyDown={blurOnEnter} enterKeyHint="next" required data-autofocus />
        <TextInput label="Last name" placeholder="e.g. Prathaji" value={last}
          onChange={(e) => setLast(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (canSave) save(); } }}
          enterKeyHint="done" required />
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving} disabled={!canSave} leftSection={<UserPlus size={18} />}>
            Create
          </Button>
        </Group>
      </Stack>
    </AppModal>
  );
}
