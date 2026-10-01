"use client";

import { useEffect, useState } from "react";
import { Button, Divider, Group, Select, Stack, Switch, Text, TextInput, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppModal from "@/components/AppModal";
import SeedsInput from "@/components/SeedsInput";
import { apiAdminUpdateRecord } from "@/lib/api";
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

// Admin direct-edit for a farmer: identity (name, care-of, phone, note) and
// the bio-data fields. Applies immediately — no approval step for admin edits.
// ID and village aren't editable (IDs are built from them).
export default function EditFarmerModal({ farmer, opened, onClose, onSaved }: Props) {
  const { t, language } = useLanguage();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [coRelation, setCoRelation] = useState("");
  const [coFirstName, setCoFirstName] = useState("");
  const [coLastName, setCoLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [hasSmartphone, setHasSmartphone] = useState(false);
  const [note, setNote] = useState("");
  const [financialCapacity, setFinancialCapacity] = useState<FinancialCapacity | "">("");
  const [landholding, setLandholding] = useState<Landholding | "">("");
  const [adoptionLevel, setAdoptionLevel] = useState<AdoptionLevel | "">("");
  const [seeds, setSeeds] = useState<SeedPackage[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!farmer) return;
    setFirstName(farmer.firstName || "");
    setLastName(farmer.lastName || "");
    setCoRelation(farmer.coRelation || "");
    setCoFirstName(farmer.coFirstName || "");
    setCoLastName(farmer.coLastName || "");
    setPhone(farmer.phone || "");
    setHasSmartphone(!!farmer.hasSmartphone);
    setNote(farmer.note || "");
    setFinancialCapacity(farmer.financialCapacity || "");
    setLandholding(farmer.landholding || "");
    setAdoptionLevel(farmer.adoptionLevel || "");
    setSeeds(farmer.seeds || []);
  }, [farmer]);

  const save = async () => {
    if (!farmer) return;
    if (!firstName.trim()) {
      notifications.show({ color: "red", message: t("admin_firstNameRequired") });
      return;
    }
    const session = getSession();
    if (!session) return;
    setSaving(true);
    try {
      await apiAdminUpdateRecord(session.token, "farmer", farmer.id, {
        firstName: firstName.trim(), lastName: lastName.trim() || null,
        coRelation: coRelation.trim() || null, coFirstName: coFirstName.trim() || null, coLastName: coLastName.trim() || null,
        phone: phone.trim() || null, hasSmartphone, note: note.trim() || null,
        seeds,
        financialCapacity: financialCapacity || null,
        landholding: landholding || null,
        adoptionLevel: adoptionLevel || null,
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
          <Group grow>
            <TextInput label={t("admin_firstName")} required value={firstName} onChange={(e) => setFirstName(e.currentTarget.value)} />
            <TextInput label={t("admin_lastName")} value={lastName} onChange={(e) => setLastName(e.currentTarget.value)} />
          </Group>
          <Group grow>
            <TextInput label={t("admin_coRelation")} placeholder="S/o, W/o, D/o" value={coRelation} onChange={(e) => setCoRelation(e.currentTarget.value)} />
            <TextInput label={t("admin_coFirstName")} value={coFirstName} onChange={(e) => setCoFirstName(e.currentTarget.value)} />
            <TextInput label={t("admin_coLastName")} value={coLastName} onChange={(e) => setCoLastName(e.currentTarget.value)} />
          </Group>
          <Group grow align="flex-end">
            <TextInput label={t("admin_phone")} inputMode="tel" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
            <Switch label={t("admin_hasSmartphone")} checked={hasSmartphone} onChange={(e) => setHasSmartphone(e.currentTarget.checked)} />
          </Group>
          <Textarea label={t("admin_note")} autosize minRows={1} maxRows={4} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
          <Divider label={t("admin_bioData")} labelPosition="left" />
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
