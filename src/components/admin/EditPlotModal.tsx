"use client";

import { useEffect, useState } from "react";
import { Button, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppModal from "@/components/AppModal";
import { apiDirectUpdateEntityVersion } from "@/lib/api";
import { getSession } from "@/lib/session";
import { CROPS, cropLabel } from "@/lib/crops";
import type { Plot } from "@/lib/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

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
  const { t, language } = useLanguage();
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
      notifications.show({ color: "green", message: t("editPlot_savedToast", { id: plot.id }) });
      onSaved();
      onClose();
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || t("editPlot_saveError") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal opened={opened} onClose={onClose} title={plot ? t("editPlot_titleWithId", { id: plot.id }) : t("editPlot_title")} size="sm">
      {plot && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">{t("editPlot_metaLine", { prefix: contextLabel ? `${contextLabel} — ` : "" })}</Text>
          <Select label={t("field_crop")} data={CROPS.map((c) => ({ value: c, label: cropLabel(c, language) }))} value={crop || null} searchable clearable onChange={(v) => setCrop(v || "")} />
          <TextInput label={t("field_sowingDate")} type="date" value={sowingDate} onChange={(e) => setSowingDate(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>{t("common_cancel")}</Button>
            <Button onClick={save} loading={saving}>{t("common_save")}</Button>
          </Group>
        </Stack>
      )}
    </AppModal>
  );
}
