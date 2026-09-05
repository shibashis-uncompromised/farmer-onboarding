"use client";

import { useEffect, useState } from "react";
import { Button, Group, Select, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppModal from "@/components/AppModal";
import SeedsInput from "@/components/SeedsInput";
import { apiDirectUpdateEntityVersion } from "@/lib/api";
import { getSession } from "@/lib/session";
import { financialCapacityOpts, landholdingOpts, adoptionLevelOpts } from "@/lib/dynamicFieldMeta";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { displayName } from "@/lib/transliterate";
import type { Farmer, FinancialCapacity, Landholding, AdoptionLevel, SeedPackage } from "@/lib/types";

interface Props {
  farmer: Farmer | null;
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// Admin direct-edit for a farmer's dynamic (seasonally re-examined) fields.
// Static identity fields (name, phone, village…) aren't editable here — they
// don't go through versioning at all. Saving applies immediately as the new
// `current` version; there's no pending step for admin's own edits.
export default function EditFarmerModal({ farmer, opened, onClose, onSaved }: Props) {
  const { t, language } = useLanguage();
  const [financialCapacity, setFinancialCapacity] = useState<FinancialCapacity | "">("");
  const [landholding, setLandholding] = useState<Landholding | "">("");
  const [adoptionLevel, setAdoptionLevel] = useState<AdoptionLevel | "">("");
  const [seeds, setSeeds] = useState<SeedPackage[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!farmer) return;
    setFinancialCapacity(farmer.financialCapacity || "");
    setLandholding(farmer.landholding || "");
    setAdoptionLevel(farmer.adoptionLevel || "");
    setSeeds(farmer.seeds || []);
  }, [farmer]);

  const save = async () => {
    if (!farmer) return;
    const session = getSession();
    if (!session) return;
    setSaving(true);
    try {
      await apiDirectUpdateEntityVersion(session.token, {
        entityType: "farmer",
        entityId: farmer.id,
        dynamicData: {
          seeds,
          financialCapacity: financialCapacity || null,
          landholding: landholding || null,
          adoptionLevel: adoptionLevel || null,
        },
      });
      notifications.show({ color: "green", message: t("editFarmer_savedToast", { name: displayName(`${farmer.firstName} ${farmer.lastName}`, language) }) });
      onSaved();
      onClose();
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || t("editFarmer_saveError") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal opened={opened} onClose={onClose} title={farmer ? t("editFarmer_titleWithName", { name: displayName(`${farmer.firstName} ${farmer.lastName}`, language) }) : t("editFarmer_title")} size="md">
      {farmer && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">{t("editFarmer_metaLine", { id: farmer.id, village: farmer.villageCode })}</Text>
          <Select
            label={t("field_financialCapacity")} placeholder={t("editFarmer_notSet")} clearable
            data={financialCapacityOpts(t)} value={financialCapacity || null}
            onChange={(v) => setFinancialCapacity((v as FinancialCapacity) || "")}
          />
          <Select
            label={t("field_landholding")} placeholder={t("editFarmer_notSet")} clearable
            data={landholdingOpts(t)} value={landholding || null}
            onChange={(v) => setLandholding((v as Landholding) || "")}
          />
          <Select
            label={t("field_adoptionLevel")} placeholder={t("editFarmer_notSet")} clearable
            data={adoptionLevelOpts(t)} value={adoptionLevel || null}
            onChange={(v) => setAdoptionLevel((v as AdoptionLevel) || "")}
          />
          <SeedsInput value={seeds} onChange={setSeeds} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>{t("common_cancel")}</Button>
            <Button onClick={save} loading={saving}>{t("common_save")}</Button>
          </Group>
        </Stack>
      )}
    </AppModal>
  );
}
