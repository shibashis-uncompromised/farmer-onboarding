"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { MapPinPlus } from "@phosphor-icons/react";
import { notifications } from "@mantine/notifications";
import AppModal from "./AppModal";
import { db } from "@/lib/db";
import { uid } from "@/lib/ids";
import { getSession } from "@/lib/session";
import { NEOPERK_STATES, DISTRICTS_BY_STATE } from "@/lib/villages";
import type { CustomVillage } from "@/lib/types";

const REGION_OF: Record<string, string> = {
  "Rajasthan": "RJ", "Madhya Pradesh": "MP", "Gujarat": "GJ",
};

// A short ID abbreviation from the name: letters only, uppercased, ≤5 chars.
const abbrev = (name: string) =>
  (name || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5) || "VLG";

export default function CreateVillageModal({
  opened, onClose, onCreated,
}: {
  opened: boolean;
  onClose: () => void;
  onCreated: (code: string) => void;
}) {
  const [name, setName] = useState("");
  const [state, setState] = useState<string>("");
  const [district, setDistrict] = useState<string>("");
  const [block, setBlock] = useState("");
  const [idCode, setIdCode] = useState("");
  const [idCodeTouched, setIdCodeTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened) {
      setName(""); setState(""); setDistrict(""); setBlock("");
      setIdCode(""); setIdCodeTouched(false);
    }
  }, [opened]);

  // Auto-fill the ID code from the name until the user edits it directly.
  useEffect(() => {
    if (!idCodeTouched) setIdCode(abbrev(name));
  }, [name, idCodeTouched]);

  const districts = useMemo(() => (state ? DISTRICTS_BY_STATE[state] || [] : []), [state]);
  const region = REGION_OF[state] || "";
  const canSave = !!(name.trim() && state && district && block.trim() && idCode.trim());

  const save = async () => {
    if (!canSave) {
      notifications.show({ color: "red", message: "Name, state, district and block are required" });
      return;
    }
    setSaving(true);
    try {
      const now = Date.now();
      const code = "v_" + uid().replace(/[^a-z0-9]/gi, "").slice(-10);
      const village: CustomVillage = {
        code,
        name: name.trim(),
        block: block.trim(),
        idCode: idCode.trim().toUpperCase(),
        region,
        state,
        district,
        createdBy: (getSession()?.username || "").toLowerCase(),
        createdAt: now,
        updatedAt: now,
        synced: false,
      };
      await db.villages.add(village);
      notifications.show({ color: "green", message: `Village "${village.name}" created` });
      onCreated(code);
      onClose();
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not create village" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal opened={opened} onClose={onClose} title="Create a new village">
      <Stack gap="md">
        <Text size="sm" c="dimmed">New villages you create are visible to you and the admin.</Text>
        <TextInput
          label="Village name" placeholder="e.g. Rampura" value={name} required data-autofocus
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <Select
          label="State" placeholder="Select state" required
          data={NEOPERK_STATES.map((s) => ({ value: s, label: s }))}
          value={state || null}
          onChange={(v) => { setState(v || ""); setDistrict(""); }}
          comboboxProps={{ withinPortal: true }} checkIconPosition="right"
        />
        <Select
          label="District" placeholder={state ? "Select district" : "Pick state first"} required
          data={districts.map((d) => ({ value: d, label: d }))}
          value={district || null} onChange={(v) => setDistrict(v || "")}
          disabled={!state} searchable
          comboboxProps={{ withinPortal: true }} checkIconPosition="right"
        />
        <TextInput
          label="Block / Tehsil" placeholder="e.g. Sarada" value={block} required
          onChange={(e) => setBlock(e.currentTarget.value)}
        />
        <TextInput
          label="ID code" value={idCode}
          onChange={(e) => { setIdCodeTouched(true); setIdCode(e.currentTarget.value.toUpperCase()); }}
          description={region ? `Used in farmer IDs, e.g. ${region}-${idCode || "VLG"}-U001` : undefined}
        />
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving} disabled={!canSave} leftSection={<MapPinPlus size={18} />}>
            Create village
          </Button>
        </Group>
      </Stack>
    </AppModal>
  );
}
