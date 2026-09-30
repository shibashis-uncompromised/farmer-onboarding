"use client";

import { useEffect, useState } from "react";
import {
  Button, Divider, Group, NumberInput, Select, Stack, Text, TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppModal from "@/components/AppModal";
import AutoCloseMultiSelect from "@/components/AutoCloseMultiSelect";
import { apiDirectUpdateEntityVersion } from "@/lib/api";
import { getSession } from "@/lib/session";
import { PREVIOUS_CROPS, cropLabel } from "@/lib/crops";
import {
  mobileCoverageOpts, shapeOpts, farmerFocusOpts, waterSourceOpts, irrigationOpts,
  seasonOpts, knownIssueOpts, animalPressureOpts, accessibilityOpts, toolOpts,
  benchmarkOpts, gradientOpts, waterloggingOpts, sunlightOpts, fencingOpts,
} from "@/lib/dynamicFieldMeta";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type {
  Farm, MobileCoverage, FarmShape, FarmerFocus, WaterSource, IrrigationAvailable, Season,
  KnownIssue, AnimalPressure, Accessibility, FarmTool, BenchmarkComparison, Gradient,
  WaterloggingProbability, SunlightAvailability, FencingAvailability,
} from "@/lib/types";

// Every dynamic field this farm can carry — must match DYNAMIC_FIELDS.farm
// on the backend exactly. plotSizeHectOverride is deliberately excluded from
// the form below (deprecated) but is still carried through untouched via the
// baseline snapshot, so saving here can never silently wipe it.
const DYNAMIC_KEYS = [
  "treeCountBig", "treeCountSmall", "mobileCoverage", "shapeOverride", "plotSizeSqFtOverride", "plotSizeHectOverride",
  "farmerFocus", "waterSource", "irrigationAvailable", "seasonsPossible", "seasonsPossibleOther",
  "knownIssues", "knownIssuesOther", "previousCrop", "previousCropProduction",
  "animalPressure", "animalPressureOther", "accessibility", "toolsAvailable", "toolsAvailableOther",
  "gradient", "waterloggingProbability", "sunlightAvailability", "fencingAvailability",
] as const;

function baselineOf(farm: Farm): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of DYNAMIC_KEYS) {
    const v = (farm as any)[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

interface Props {
  farm: Farm | null;
  farmerLabel?: string;
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// Admin direct-edit for a farm's dynamic (seasonally re-examined) fields —
// physical fieldwork measurements, farmer-reported answers, and supervisor
// observations. Static fields (location, boundary, alias…) aren't editable
// here. Saving applies immediately as the new `current` version.
export default function EditFarmModal({ farm, farmerLabel, opened, onClose, onSaved }: Props) {
  const { t, language } = useLanguage();
  const [treeCountBig, setTreeCountBig] = useState<number | "">("");
  const [treeCountSmall, setTreeCountSmall] = useState<number | "">("");
  const [mobileCoverage, setMobileCoverage] = useState<MobileCoverage | "">("");
  const [shapeOverride, setShapeOverride] = useState<FarmShape | "">("");
  const [plotSizeSqFtOverride, setPlotSizeSqFtOverride] = useState<number | "">("");
  const [farmerFocus, setFarmerFocus] = useState<FarmerFocus | "">("");
  const [waterSource, setWaterSource] = useState<WaterSource[]>([]);
  const [irrigationAvailable, setIrrigationAvailable] = useState<IrrigationAvailable[]>([]);
  const [seasonsPossible, setSeasonsPossible] = useState<Season[]>([]);
  const [seasonsPossibleOther, setSeasonsPossibleOther] = useState("");
  const [knownIssues, setKnownIssues] = useState<KnownIssue[]>([]);
  const [knownIssuesOther, setKnownIssuesOther] = useState("");
  const [previousCrop, setPreviousCrop] = useState("");
  const [prevQuintals, setPrevQuintals] = useState<number | "">("");
  const [prevBenchmark, setPrevBenchmark] = useState<BenchmarkComparison | "">("");
  const [animalPressure, setAnimalPressure] = useState<AnimalPressure[]>([]);
  const [animalPressureOther, setAnimalPressureOther] = useState("");
  const [accessibility, setAccessibility] = useState<Accessibility | "">("");
  const [toolsAvailable, setToolsAvailable] = useState<FarmTool[]>([]);
  const [toolsAvailableOther, setToolsAvailableOther] = useState("");
  const [gradient, setGradient] = useState<Gradient | "">("");
  const [waterloggingProbability, setWaterloggingProbability] = useState<WaterloggingProbability | "">("");
  const [sunlightAvailability, setSunlightAvailability] = useState<SunlightAvailability | "">("");
  const [fencingAvailability, setFencingAvailability] = useState<FencingAvailability | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!farm) return;
    setTreeCountBig(farm.treeCountBig ?? "");
    setTreeCountSmall(farm.treeCountSmall ?? "");
    setMobileCoverage(farm.mobileCoverage || "");
    setShapeOverride(farm.shapeOverride || "");
    setPlotSizeSqFtOverride(farm.plotSizeSqFtOverride ?? "");
    setFarmerFocus(farm.farmerFocus || "");
    setWaterSource(farm.waterSource || []);
    setIrrigationAvailable(farm.irrigationAvailable || []);
    setSeasonsPossible(farm.seasonsPossible || []);
    setSeasonsPossibleOther(farm.seasonsPossibleOther || "");
    setKnownIssues(farm.knownIssues || []);
    setKnownIssuesOther(farm.knownIssuesOther || "");
    setPreviousCrop(farm.previousCrop || "");
    setPrevQuintals(farm.previousCropProduction?.quintals ?? "");
    setPrevBenchmark(farm.previousCropProduction?.vsBenchmark || "");
    setAnimalPressure(farm.animalPressure || []);
    setAnimalPressureOther(farm.animalPressureOther || "");
    setAccessibility(farm.accessibility || "");
    setToolsAvailable(farm.toolsAvailable || []);
    setToolsAvailableOther(farm.toolsAvailableOther || "");
    setGradient(farm.gradient || "");
    setWaterloggingProbability(farm.waterloggingProbability || "");
    setSunlightAvailability(farm.sunlightAvailability || "");
    setFencingAvailability(farm.fencingAvailability || "");
  }, [farm]);

  const save = async () => {
    if (!farm) return;
    const session = getSession();
    if (!session) return;
    setSaving(true);
    try {
      const edited = {
        treeCountBig: treeCountBig === "" ? null : treeCountBig,
        treeCountSmall: treeCountSmall === "" ? null : treeCountSmall,
        mobileCoverage: mobileCoverage || null,
        shapeOverride: shapeOverride || null,
        plotSizeSqFtOverride: plotSizeSqFtOverride === "" ? null : plotSizeSqFtOverride,
        farmerFocus: farmerFocus || null,
        waterSource, irrigationAvailable,
        seasonsPossible, seasonsPossibleOther: seasonsPossibleOther || undefined,
        knownIssues, knownIssuesOther: knownIssuesOther || undefined,
        previousCrop: previousCrop || undefined,
        previousCropProduction: (prevQuintals !== "" || prevBenchmark)
          ? { quintals: prevQuintals === "" ? null : prevQuintals, vsBenchmark: prevBenchmark || null }
          : null,
        animalPressure, animalPressureOther: animalPressureOther || undefined,
        accessibility: accessibility || null,
        toolsAvailable, toolsAvailableOther: toolsAvailableOther || undefined,
        gradient: gradient || null,
        waterloggingProbability: waterloggingProbability || null,
        sunlightAvailability: sunlightAvailability || null,
        fencingAvailability: fencingAvailability || null,
      };
      // Carry forward anything this form doesn't expose (plotSizeHectOverride)
      // untouched, so saving never silently drops a field.
      const dynamicData = { ...baselineOf(farm), ...edited };
      await apiDirectUpdateEntityVersion(session.token, { entityType: "farm", entityId: farm.id, dynamicData });
      notifications.show({ color: "green", message: t("editFarm_savedToast", { id: farm.id }) });
      onSaved();
      onClose();
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || t("editFarm_saveError") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal opened={opened} onClose={onClose} title={farm ? t("editFarm_titleWithId", { id: farm.id }) : t("editFarm_title")} size="lg">
      {farm && (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            {t("editFarm_metaLine", { prefix: farmerLabel ? `${farmerLabel} · ` : "", village: farm.villageCode })}
          </Text>

          <Divider label={t("farms_physicalFieldwork")} labelPosition="left" />
          <Group grow>
            <NumberInput label={t("farms_bigTrees")} min={0} value={treeCountBig} onChange={(v) => setTreeCountBig(v === "" ? "" : Number(v))} />
            <NumberInput label={t("farms_smallTrees")} min={0} value={treeCountSmall} onChange={(v) => setTreeCountSmall(v === "" ? "" : Number(v))} />
          </Group>
          <Group grow>
            <Select label={t("field_mobileCoverage")} data={mobileCoverageOpts(t)} value={mobileCoverage || null} clearable
              onChange={(v) => setMobileCoverage((v as MobileCoverage) || "")} />
            <Select label={t("field_shapeOverride")} data={shapeOpts(t)} value={shapeOverride || null} clearable
              onChange={(v) => setShapeOverride((v as FarmShape) || "")} />
          </Group>
          <NumberInput label={t("field_plotSizeSqFtOverride")} min={0} value={plotSizeSqFtOverride}
            onChange={(v) => setPlotSizeSqFtOverride(v === "" ? "" : Number(v))} />

          <Divider label={t("farms_fromFarmer")} labelPosition="left" />
          <Select label={t("field_farmerFocus")} data={farmerFocusOpts(t)} value={farmerFocus || null} clearable
            onChange={(v) => setFarmerFocus((v as FarmerFocus) || "")} />
          <AutoCloseMultiSelect label={t("field_waterSource")} data={waterSourceOpts(t)} value={waterSource}
            onChange={(v) => setWaterSource(v as WaterSource[])} />
          <AutoCloseMultiSelect label={t("field_irrigationAvailable")} data={irrigationOpts(t)} value={irrigationAvailable}
            onChange={(v) => setIrrigationAvailable(v as IrrigationAvailable[])} />
          <AutoCloseMultiSelect label={t("field_seasonsPossible")} data={seasonOpts(t)} value={seasonsPossible}
            onChange={(v) => setSeasonsPossible(v as Season[])} />
          {seasonsPossible.includes("other" as Season) && (
            <TextInput label={t("editFarm_seasonsOtherSpecify")} value={seasonsPossibleOther} onChange={(e) => setSeasonsPossibleOther(e.currentTarget.value)} />
          )}
          <AutoCloseMultiSelect label={t("field_knownIssues")} data={knownIssueOpts(t)} value={knownIssues}
            onChange={(v) => setKnownIssues(v as KnownIssue[])} />
          {knownIssues.includes("other" as KnownIssue) && (
            <TextInput label={t("editFarm_knownIssuesOtherSpecify")} value={knownIssuesOther} onChange={(e) => setKnownIssuesOther(e.currentTarget.value)} />
          )}
          <Select label={t("field_previousCrop")} data={PREVIOUS_CROPS.map((c) => ({ value: c, label: cropLabel(c, language) }))} value={previousCrop || null} searchable clearable
            onChange={(v) => setPreviousCrop(v || "")} />
          <Group grow>
            <NumberInput label={t("editFarm_previousProductionQuintals")} min={0} value={prevQuintals}
              onChange={(v) => setPrevQuintals(v === "" ? "" : Number(v))} />
            <Select label={t("farms_vsBenchmarkLabel")} data={benchmarkOpts(t)} value={prevBenchmark || null} clearable
              onChange={(v) => setPrevBenchmark((v as BenchmarkComparison) || "")} />
          </Group>
          <AutoCloseMultiSelect label={t("field_animalPressure")} data={animalPressureOpts(t)} value={animalPressure}
            onChange={(v) => setAnimalPressure(v as AnimalPressure[])} />
          {animalPressure.includes("other" as AnimalPressure) && (
            <TextInput label={t("editFarm_animalPressureOtherSpecify")} value={animalPressureOther} onChange={(e) => setAnimalPressureOther(e.currentTarget.value)} />
          )}
          <Select label={t("field_accessibility")} data={accessibilityOpts(t)} value={accessibility || null} clearable
            onChange={(v) => setAccessibility((v as Accessibility) || "")} />
          <AutoCloseMultiSelect label={t("field_toolsAvailable")} data={toolOpts(t)} value={toolsAvailable}
            onChange={(v) => setToolsAvailable(v as FarmTool[])} />
          {toolsAvailable.includes("other" as FarmTool) && (
            <TextInput label={t("editFarm_toolsOtherSpecify")} value={toolsAvailableOther} onChange={(e) => setToolsAvailableOther(e.currentTarget.value)} />
          )}

          <Divider label={t("farms_supervisorObservation")} labelPosition="left" />
          <Group grow>
            <Select label={t("field_gradient")} data={gradientOpts(t)} value={gradient || null} clearable
              onChange={(v) => setGradient((v as Gradient) || "")} />
            <Select label={t("field_waterloggingProbability")} data={waterloggingOpts(t)} value={waterloggingProbability || null} clearable
              onChange={(v) => setWaterloggingProbability((v as WaterloggingProbability) || "")} />
          </Group>
          <Group grow>
            <Select label={t("field_sunlightAvailability")} data={sunlightOpts(t)} value={sunlightAvailability || null} clearable
              onChange={(v) => setSunlightAvailability((v as SunlightAvailability) || "")} />
            <Select label={t("field_fencingAvailability")} data={fencingOpts(t)} value={fencingAvailability || null} clearable
              onChange={(v) => setFencingAvailability((v as FencingAvailability) || "")} />
          </Group>

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose}>{t("common_cancel")}</Button>
            <Button onClick={save} loading={saving}>{t("common_save")}</Button>
          </Group>
        </Stack>
      )}
    </AppModal>
  );
}
