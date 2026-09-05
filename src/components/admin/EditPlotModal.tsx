"use client";

import { useEffect, useState } from "react";
import { Button, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppModal from "@/components/AppModal";
import { apiDirectUpdateEntityVersion } from "@/lib/api";
import { getSession } from "@/lib/session";
import { CROPS } from "@/lib/crops";
import type { Plot } from "@/lib/types";

interface Props {
  plot: Plot | null;
  contextLabel?: string;
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// Admin direct-edit for a plot's dynamic fields — crop and sowing date are
// the two fields re-examined each season; everything else on Plot is static.
// Saving applies immediately as the new `current` version.
export default function EditPlotModal({ plot, contextLabel, opened, onClose, onSaved }: Props) {
  const [crop, setCrop] = useState("");
  const [sowingDate, setSowingDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!plot) return;
    setCrop(plot.crop || "");
    setSowingDate(plot.sowingDate || "");
  }, [plot]);

  const save = async () => {
    if (!plot) return;
    const session = getSession();
    if (!session) return;
    setSaving(true);
    try {
      await apiDirectUpdateEntityVersion(session.token, {
        entityType: "plot",
        entityId: plot.id,
        dynamicData: { crop: crop || null, sowingDate: sowingDate || null },
      });
      notifications.show({ color: "green", message: `Saved — applied immediately for plot ${plot.id}` });
      onSaved();
      onClose();
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not save changes" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal opened={opened} onClose={onClose} title={plot ? `Edit plot ${plot.id}` : "Edit plot"} size="sm">
      {plot && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">{contextLabel ? `${contextLabel} — ` : ""}no approval needed, this saves directly.</Text>
          <Select label="Crop" data={CROPS} value={crop || null} searchable clearable onChange={(v) => setCrop(v || "")} />
          <TextInput label="Sowing date" type="date" value={sowingDate} onChange={(e) => setSowingDate(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save</Button>
          </Group>
        </Stack>
      )}
    </AppModal>
  );
}
