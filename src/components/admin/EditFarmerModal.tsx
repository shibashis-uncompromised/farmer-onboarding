"use client";

import { useEffect, useState } from "react";
import { Button, Group, Select, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppModal from "@/components/AppModal";
import SeedsInput from "@/components/SeedsInput";
import { apiDirectUpdateEntityVersion } from "@/lib/api";
import { getSession } from "@/lib/session";
import type { Farmer, FinancialCapacity, Landholding, AdoptionLevel, SeedPackage } from "@/lib/types";

// Same option lists as the field app's BioStep, kept in sync by hand since
// this is a separate (admin-only) editor for the same dynamic fields.
const FINANCIAL_CAPACITY_OPTS = [
  { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" },
];
const LANDHOLDING_OPTS = [
  { value: "lt_2_5", label: "< 2.5 acres" }, { value: "between_2_5_10", label: "2.5–10 acres" }, { value: "gt_10", label: "> 10 acres" },
];
const ADOPTION_LEVEL_OPTS = [
  { value: "basic", label: "Basic" }, { value: "improved", label: "Improved" },
  { value: "progressive", label: "Progressive" }, { value: "advanced", label: "Advanced" },
];

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
      notifications.show({ color: "green", message: `Saved — applied immediately for ${farmer.firstName} ${farmer.lastName}` });
      onSaved();
      onClose();
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not save changes" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal opened={opened} onClose={onClose} title={farmer ? `Edit ${farmer.firstName} ${farmer.lastName}` : "Edit farmer"} size="md">
      {farmer && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">{farmer.id} · village {farmer.villageCode} — no approval needed, this saves directly.</Text>
          <Select
            label="Financial capacity" placeholder="Not set" clearable
            data={FINANCIAL_CAPACITY_OPTS} value={financialCapacity || null}
            onChange={(v) => setFinancialCapacity((v as FinancialCapacity) || "")}
          />
          <Select
            label="Landholding" placeholder="Not set" clearable
            data={LANDHOLDING_OPTS} value={landholding || null}
            onChange={(v) => setLandholding((v as Landholding) || "")}
          />
          <Select
            label="Adoption level" placeholder="Not set" clearable
            data={ADOPTION_LEVEL_OPTS} value={adoptionLevel || null}
            onChange={(v) => setAdoptionLevel((v as AdoptionLevel) || "")}
          />
          <SeedsInput value={seeds} onChange={setSeeds} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save</Button>
          </Group>
        </Stack>
      )}
    </AppModal>
  );
}
