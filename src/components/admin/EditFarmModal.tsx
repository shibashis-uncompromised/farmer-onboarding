"use client";

import { useEffect, useState } from "react";
import {
  Button, Divider, Group, MultiSelect, NumberInput, Select, Stack, Text, TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppModal from "@/components/AppModal";
import { apiDirectUpdateEntityVersion } from "@/lib/api";
import { getSession } from "@/lib/session";
import { PREVIOUS_CROPS } from "@/lib/crops";
import type {
  Farm, MobileCoverage, FarmShape, FarmerFocus, WaterSource, IrrigationAvailable, Season,
  KnownIssue, AnimalPressure, Accessibility, FarmTool, BenchmarkComparison, Gradient,
  WaterloggingProbability, SunlightAvailability, FencingAvailability,
} from "@/lib/types";

// Same option lists as the field app's FarmsStep, kept in sync by hand since
// this is a separate (admin-only) editor for the same dynamic fields.
const MOBILE_COVERAGE_OPTS = [{ value: "good", label: "Good" }, { value: "weak", label: "Weak" }, { value: "none", label: "None" }];
const SHAPE_OPTS = [
  { value: "rectangle", label: "Rectangle" }, { value: "square", label: "Square" },
  { value: "trapezoid", label: "Trapezoid" }, { value: "irregular", label: "Irregular" },
];
const FARMER_FOCUS_OPTS = [
  { value: "daily", label: "Daily" }, { value: "twice_weekly", label: "Twice a week" }, { value: "weekly_plus", label: "Weekly or less" },
];
const WATER_SOURCE_OPTS = [
  { value: "rainfed", label: "Rainfed" }, { value: "borewell", label: "Borewell" },
  { value: "open_well", label: "Open well" }, { value: "farm_pond", label: "Farm pond" },
  { value: "anicut_river", label: "Anicut / River" },
];
const IRRIGATION_OPTS = [
  { value: "none", label: "None" }, { value: "flood", label: "Flood" },
  { value: "sprinkler", label: "Sprinkler" }, { value: "drip", label: "Drip" },
];
const SEASON_OPTS = [
  { value: "kharif", label: "Kharif" }, { value: "rabi", label: "Rabi" }, { value: "zaid", label: "Zaid" }, { value: "other", label: "Other" },
];
const KNOWN_ISSUE_OPTS = [
  { value: "termites", label: "Termites" }, { value: "nematodes", label: "Nematodes" },
  { value: "frost", label: "Frost" }, { value: "flooding", label: "Flooding" }, { value: "other", label: "Other" },
];
const ANIMAL_PRESSURE_OPTS = [
  { value: "nilgai", label: "Nilgai" }, { value: "boar", label: "Boar" }, { value: "monkey", label: "Monkey" },
  { value: "rabbit", label: "Rabbit" }, { value: "birds", label: "Birds" }, { value: "other", label: "Other" },
];
const ACCESSIBILITY_OPTS = [
  { value: "tractor", label: "Tractor" }, { value: "small_machinery", label: "Small machinery" },
  { value: "hand_tools", label: "Hand tools only" },
];
const TOOL_OPTS = [
  { value: "tractor", label: "Tractor" }, { value: "power_tiller", label: "Power tiller" },
  { value: "pump_set", label: "Pump set" }, { value: "sprayer", label: "Sprayer" },
  { value: "thresher", label: "Thresher" }, { value: "plough", label: "Plough" },
  { value: "hand_tools", label: "Hand tools" }, { value: "other", label: "Other" },
];
const BENCHMARK_OPTS = [
  { value: "above", label: "Above average" }, { value: "at", label: "About average" }, { value: "below", label: "Below average" },
];
const GRADIENT_OPTS = [
  { value: "lt_5", label: "<5%" }, { value: "5_10", label: "5%–10%" },
  { value: "10_30", label: "10%–30%" }, { value: "gt_30", label: ">30%" },
];
const WATERLOGGING_OPTS = [{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }];
const SUNLIGHT_OPTS = [
  { value: "lt_5", label: "<5%" }, { value: "5_10", label: "5%–10%" }, { value: "10_30", label: "10%–30%" },
  { value: "30_50", label: "30%–50%" }, { value: "gt_50", label: ">50%" },
];
const FENCING_OPTS = [
  { value: "none", label: "None" }, { value: "natural", label: "Natural" }, { value: "stone_pitch", label: "Stone pitch" },
  { value: "wire_fence", label: "Wire fence" }, { value: "boundary_wall", label: "Boundary wall" },
];

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
      notifications.show({ color: "green", message: `Saved — applied immediately for farm ${farm.id}` });
      onSaved();
      onClose();
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || "Could not save changes" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal opened={opened} onClose={onClose} title={farm ? `Edit farm ${farm.id}` : "Edit farm"} size="lg">
      {farm && (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            {farmerLabel ? `${farmerLabel} · ` : ""}village {farm.villageCode} — no approval needed, this saves directly.
          </Text>

          <Divider label="Physical fieldwork" labelPosition="left" />
          <Group grow>
            <NumberInput label="Big trees" min={0} value={treeCountBig} onChange={(v) => setTreeCountBig(v === "" ? "" : Number(v))} />
            <NumberInput label="Small trees" min={0} value={treeCountSmall} onChange={(v) => setTreeCountSmall(v === "" ? "" : Number(v))} />
          </Group>
          <Group grow>
            <Select label="Mobile coverage" data={MOBILE_COVERAGE_OPTS} value={mobileCoverage || null} clearable
              onChange={(v) => setMobileCoverage((v as MobileCoverage) || "")} />
            <Select label="Farm shape" data={SHAPE_OPTS} value={shapeOverride || null} clearable
              onChange={(v) => setShapeOverride((v as FarmShape) || "")} />
          </Group>
          <NumberInput label="Plot size override (sq ft)" min={0} value={plotSizeSqFtOverride}
            onChange={(v) => setPlotSizeSqFtOverride(v === "" ? "" : Number(v))} />

          <Divider label="From farmer" labelPosition="left" />
          <Select label="Farmer's visit frequency" data={FARMER_FOCUS_OPTS} value={farmerFocus || null} clearable
            onChange={(v) => setFarmerFocus((v as FarmerFocus) || "")} />
          <MultiSelect label="Water source" data={WATER_SOURCE_OPTS} value={waterSource}
            onChange={(v) => setWaterSource(v as WaterSource[])} />
          <MultiSelect label="Irrigation available" data={IRRIGATION_OPTS} value={irrigationAvailable}
            onChange={(v) => setIrrigationAvailable(v as IrrigationAvailable[])} />
          <MultiSelect label="Seasons possible" data={SEASON_OPTS} value={seasonsPossible}
            onChange={(v) => setSeasonsPossible(v as Season[])} />
          {seasonsPossible.includes("other" as Season) && (
            <TextInput label="Seasons — other, specify" value={seasonsPossibleOther} onChange={(e) => setSeasonsPossibleOther(e.currentTarget.value)} />
          )}
          <MultiSelect label="Known issues" data={KNOWN_ISSUE_OPTS} value={knownIssues}
            onChange={(v) => setKnownIssues(v as KnownIssue[])} />
          {knownIssues.includes("other" as KnownIssue) && (
            <TextInput label="Known issues — other, specify" value={knownIssuesOther} onChange={(e) => setKnownIssuesOther(e.currentTarget.value)} />
          )}
          <Select label="Previous crop" data={PREVIOUS_CROPS} value={previousCrop || null} searchable clearable
            onChange={(v) => setPreviousCrop(v || "")} />
          <Group grow>
            <NumberInput label="Previous crop production (quintals)" min={0} value={prevQuintals}
              onChange={(v) => setPrevQuintals(v === "" ? "" : Number(v))} />
            <Select label="Vs. benchmark" data={BENCHMARK_OPTS} value={prevBenchmark || null} clearable
              onChange={(v) => setPrevBenchmark((v as BenchmarkComparison) || "")} />
          </Group>
          <MultiSelect label="Animal pressure" data={ANIMAL_PRESSURE_OPTS} value={animalPressure}
            onChange={(v) => setAnimalPressure(v as AnimalPressure[])} />
          {animalPressure.includes("other" as AnimalPressure) && (
            <TextInput label="Animal pressure — other, specify" value={animalPressureOther} onChange={(e) => setAnimalPressureOther(e.currentTarget.value)} />
          )}
          <Select label="Accessibility" data={ACCESSIBILITY_OPTS} value={accessibility || null} clearable
            onChange={(v) => setAccessibility((v as Accessibility) || "")} />
          <MultiSelect label="Tools available" data={TOOL_OPTS} value={toolsAvailable}
            onChange={(v) => setToolsAvailable(v as FarmTool[])} />
          {toolsAvailable.includes("other" as FarmTool) && (
            <TextInput label="Tools — other, specify" value={toolsAvailableOther} onChange={(e) => setToolsAvailableOther(e.currentTarget.value)} />
          )}

          <Divider label="Supervisor observation" labelPosition="left" />
          <Group grow>
            <Select label="Gradient" data={GRADIENT_OPTS} value={gradient || null} clearable
              onChange={(v) => setGradient((v as Gradient) || "")} />
            <Select label="Waterlogging probability" data={WATERLOGGING_OPTS} value={waterloggingProbability || null} clearable
              onChange={(v) => setWaterloggingProbability((v as WaterloggingProbability) || "")} />
          </Group>
          <Group grow>
            <Select label="Sunlight availability" data={SUNLIGHT_OPTS} value={sunlightAvailability || null} clearable
              onChange={(v) => setSunlightAvailability((v as SunlightAvailability) || "")} />
            <Select label="Fencing availability" data={FENCING_OPTS} value={fencingAvailability || null} clearable
              onChange={(v) => setFencingAvailability((v as FencingAvailability) || "")} />
          </Group>

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save</Button>
          </Group>
        </Stack>
      )}
    </AppModal>
  );
}
