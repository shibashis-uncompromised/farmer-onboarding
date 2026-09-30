"use client";

import { useEffect, useState } from "react";
import {
  Avatar, Badge, Box, Button, Collapse, Divider, Group, Select, SegmentedControl, SimpleGrid,
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
import type { Farmer, SeedPackage, FinancialCapacity, Landholding, AdoptionLevel } from "@/lib/types";
import PhotoInput from "./PhotoInput";
import SeedsInput from "./SeedsInput";
import { blurOnEnter } from "@/lib/ui";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { financialCapacityOpts, landholdingOpts, adoptionLevelOpts } from "@/lib/dynamicFieldMeta";

const RELATIONS = ["S/o", "W/o", "D/o", "C/o"];

const labelOf = (opts: { value: string; label: string }[], v?: string | null) => opts.find((o) => o.value === v)?.label || null;

export default function BioStep({
  farmer, onSaved, onContinue,
}: {
  farmer: Farmer;
  onSaved: () => void;
  onContinue: () => void;
}) {
  const { t } = useLanguage();
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
  const [farmerType, setFarmerType] = useState<"lead" | "existing">(farmer.farmerType || "existing");
  const [financialCapacity, setFinancialCapacity] = useState<FinancialCapacity | "">(farmer.financialCapacity || "");
  const [landholding, setLandholding] = useState<Landholding | "">(farmer.landholding || "");
  const [adoptionLevel, setAdoptionLevel] = useState<AdoptionLevel | "">(farmer.adoptionLevel || "");
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
      notifications.show({ color: "red", message: t("bio_nameRequired") });
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
        farmerType, note: note.trim(),
        financialCapacity: (financialCapacity || null) as FinancialCapacity | null,
        landholding: (landholding || null) as Landholding | null,
        adoptionLevel: (adoptionLevel || null) as AdoptionLevel | null,
        seeds: seeds.map((s) => ({ seed: s.seed, qty: s.qty })),
        photoId, bioComplete: true, updatedAt: Date.now(), synced: false,
      });
      setPhotoDirty(false);
      setEditing(false);
      notifications.show({ color: "green", message: t("bio_savedToast") });
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
            {t("bio_saved")}
          </Badge>
          <Button size="xs" variant="light" leftSection={<PencilSimple size={14} />} onClick={() => setEditing(true)}>
            {t("common_edit")}
          </Button>
        </Group>
        <Group>
          <Avatar src={photoUrl} size={72} radius="md" color="green">
            {first?.[0]}{last?.[0]}
          </Avatar>
          <div>
            <Group gap={8} align="center">
              <Text fw={700} size="lg">{first} {last}</Text>
              <Badge size="sm" variant="light" color={farmerType === "existing" ? "grape" : "blue"}>
                {farmerType === "existing" ? t("bio_existing") : t("bio_lead")}
              </Badge>
            </Group>
            {co && <Text c="dimmed">{relation} {co}</Text>}
            <Text size="sm" c="dimmed">{farmer.id}</Text>
          </div>
        </Group>
        <Divider />
        <SimpleGrid cols={2} spacing="sm">
          <Field label={t("bio_phone")} value={phone || "—"} />
          <Field label={t("bio_smartphone")} value={smartphone === "yes" ? t("common_yes") : smartphone === "no" ? t("common_no") : "—"} />
        </SimpleGrid>
        <SimpleGrid cols={2} spacing="sm">
          <Field label={t("field_financialCapacity")} value={labelOf(financialCapacityOpts(t), financialCapacity) || "—"} />
          <Field label={t("field_landholding")} value={labelOf(landholdingOpts(t), landholding) || "—"} />
        </SimpleGrid>
        <Field label={t("field_adoptionLevel")} value={labelOf(adoptionLevelOpts(t), adoptionLevel) || "—"} />
        {seeds.length > 0 && (
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>{t("field_seeds")}</Text>
            <Group gap={6}>
              {seeds.map((s) => (
                <Badge key={s.seed} variant="light" color="green" leftSection={<Plant size={12} />}>
                  {seedLabel(s.seed, s.qty)}
                </Badge>
              ))}
            </Group>
          </div>
        )}
        {note.trim() && <Field label={t("bio_note")} value={note} />}

        <Button fullWidth size="md" color="green" rightSection={<ArrowRight size={18} weight="bold" />} onClick={onContinue}>
          {t("bio_continueToFarms")}
        </Button>
      </Stack>
    );
  }

  // ---- Editing view ----
  return (
    <Stack gap="md">
      <Group align="flex-start" wrap="nowrap" gap="sm">
        <PhotoInput
          compact label={t("bio_photo")}
          value={photo}
          onChange={(b) => { setPhoto(b); setPhotoDirty(true); }}
        />
        <Box style={{ flex: 1, minWidth: 0 }}>
          <TextInput label={t("bio_firstName")} value={first} onChange={(e) => setFirst(e.currentTarget.value)} onKeyDown={blurOnEnter} enterKeyHint="next" required mb={6} />
          <TextInput label={t("bio_lastName")} value={last} onChange={(e) => setLast(e.currentTarget.value)} onKeyDown={blurOnEnter} enterKeyHint="next" required />
        </Box>
      </Group>

      <div>
        <Text size="sm" fw={500} mb={6}>{t("bio_type")}</Text>
        <SegmentedControl
          fullWidth value={farmerType} onChange={(v) => setFarmerType(v as "lead" | "existing")}
          data={[{ label: t("bio_lead"), value: "lead" }, { label: t("bio_existing"), value: "existing" }]}
        />
      </div>

      <Switch
        checked={coOn} onChange={(e) => setCoOn(e.currentTarget.checked)}
        label={t("bio_addCareOf")} color="green"
      />
      <Collapse in={coOn}>
        <Stack gap="sm">
          <SegmentedControl
            fullWidth data={RELATIONS.map((r) => ({ label: r, value: r }))} value={relation} onChange={setRelation}
          />
          <SimpleGrid cols={2} spacing="sm">
            <TextInput label={t("bio_coFirstName")} value={coFirst} onChange={(e) => setCoFirst(e.currentTarget.value)} onKeyDown={blurOnEnter} enterKeyHint="next" />
            <TextInput label={t("bio_coLastName")} value={coLast} onChange={(e) => setCoLast(e.currentTarget.value)} onKeyDown={blurOnEnter} enterKeyHint="done" />
          </SimpleGrid>
        </Stack>
      </Collapse>

      <Divider />
      <SimpleGrid cols={2} spacing="sm">
        <TextInput
          label={t("bio_phoneNumber")} type="tel" inputMode="numeric" value={phone}
          onChange={(e) => setPhone(e.currentTarget.value)} onKeyDown={blurOnEnter} enterKeyHint="done" placeholder={t("bio_phonePlaceholder")}
        />
        <div>
          <Text size="sm" fw={500} mb={6}>
            <Group gap={6} component="span"><DeviceMobile size={16} /> {t("bio_smartphoneQuestion")}</Group>
          </Text>
          <SegmentedControl
            fullWidth value={smartphone} onChange={setSmartphone}
            data={[{ label: t("common_yes"), value: "yes" }, { label: t("common_no"), value: "no" }]}
          />
        </div>
      </SimpleGrid>

      <Divider />
      <div>
        <Text size="sm" fw={500} mb={6}>{t("field_financialCapacity")}</Text>
        <SegmentedControl
          fullWidth value={financialCapacity} onChange={(v) => setFinancialCapacity(v as FinancialCapacity)}
          data={financialCapacityOpts(t)}
        />
      </div>
      <div>
        <Text size="sm" fw={500} mb={6}>{t("field_landholding")}</Text>
        <SegmentedControl
          fullWidth value={landholding} onChange={(v) => setLandholding(v as Landholding)}
          data={landholdingOpts(t)}
        />
      </div>
      <Select
        label={t("field_adoptionLevel")} placeholder={t("bio_selectPlaceholder")} clearable
        data={adoptionLevelOpts(t)} value={adoptionLevel || null}
        onChange={(v) => setAdoptionLevel((v as AdoptionLevel) || "")}
        comboboxProps={{ withinPortal: true }}
      />

      <Divider />
      <SeedsInput value={seeds} onChange={setSeeds} />

      <Textarea
        label={<Group gap={6} component="span"><NotePencil size={16} /> {t("bio_noteLabel")}</Group>}
        placeholder={t("bio_notePlaceholder")}
        value={note} onChange={(e) => setNote(e.currentTarget.value)}
        autosize minRows={2} maxRows={5}
      />

      <Group grow>
        <Button size="md" leftSection={<FloppyDisk size={18} />} onClick={save} loading={saving} disabled={!canSave}>
          {t("bio_saveBioData")}
        </Button>
        {farmer.bioComplete && (
          <Button size="md" variant="light" color="green" rightSection={<ArrowRight size={18} weight="bold" />} onClick={onContinue}>
            {t("common_continue")}
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
