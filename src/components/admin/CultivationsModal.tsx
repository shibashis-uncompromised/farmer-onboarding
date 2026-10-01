"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon, Autocomplete, Badge, Button, Divider, Group, NumberInput, Paper, Select, Stack, Text, TextInput, Textarea, Tooltip,
} from "@mantine/core";
import { CalendarCheck, PencilSimple, Plant, Plus, Trash } from "@phosphor-icons/react";
import { notifications } from "@mantine/notifications";
import AppModal from "@/components/AppModal";
import {
  apiCreateCultivation, apiDeleteCultivation, apiUpdateCultivation,
  type CropPlan, type Cultivation, type CultivationInput,
} from "@/lib/api";
import { getSession } from "@/lib/session";
import { CROPS } from "@/lib/crops";
import { seasonFor, todayStr } from "@/lib/cropPlans";
import type { Plot } from "@/lib/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const today = todayStr;
const blank = (plot: Plot | null): CultivationInput => ({
  crop: plot?.crop || "", variety: "", cropPlan: "", startDate: plot?.sowingDate || today(), endDate: null, notes: "",
});

// A plot's cultivations — what's grown there each season. Admin-only:
// supervisors never see these. One season = one cultivation; closing it sets
// the end date and keeps it as history. Published to TerraOS with the crop
// plan / crop / variety matched (or created) by name.
export default function CultivationsModal({
  plot, plotLabel, cultivations, allCultivations, cropPlans, opened, onClose, onChanged,
}: {
  plot: Plot | null;
  plotLabel: string;
  cultivations: Cultivation[];
  /** Every cultivation (all plots) — feeds the variety / crop-plan suggestions. */
  allCultivations: Cultivation[];
  /** The plot's farm's defined crop plans — a cultivation must pick one. */
  cropPlans: CropPlan[];
  opened: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState<Cultivation | "new" | null>(null);
  const [form, setForm] = useState<CultivationInput>(blank(null));
  // Until the admin picks a plan by hand, follow the sowing date.
  const [planTouched, setPlanTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!opened) setEditing(null); }, [opened]);

  const sorted = useMemo(
    // Open (current) seasons first, then most recent sowing first.
    () => [...cultivations].sort((a, b) =>
      (a.endDate ? 1 : 0) - (b.endDate ? 1 : 0) || b.startDate.localeCompare(a.startDate)),
    [cultivations]
  );
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort();
  const cropOptions = uniq([...CROPS, ...allCultivations.map((c) => c.crop)]);
  const varietyOptions = uniq(allCultivations.filter((c) => c.crop.toLowerCase() === form.crop.trim().toLowerCase()).map((c) => c.variety));
  const planOptions = [...cropPlans]
    .sort((a, b) => b.year - a.year || a.season.localeCompare(b.season))
    .map((p) => ({ value: p.name, label: p.name }));
  // The plan whose season + year match a sowing date, else the newest plan.
  const planFor = (date: string) => {
    const season = seasonFor(date), year = Number(date.slice(0, 4));
    return cropPlans.find((p) => p.season === season && p.year === year)?.name || planOptions[0]?.value || "";
  };

  const startNew = () => {
    const f = blank(plot);
    setForm({ ...f, cropPlan: planFor(f.startDate) });
    setPlanTouched(false);
    setEditing("new");
  };
  const startEdit = (c: Cultivation) => {
    setForm({ crop: c.crop, variety: c.variety, cropPlan: c.cropPlan, startDate: c.startDate, endDate: c.endDate, notes: c.notes || "" });
    setPlanTouched(true); // keep what was saved
    setEditing(c);
  };
  const onStartDate = (v: string) => {
    setForm((f) => ({ ...f, startDate: v }));
    if (!planTouched && v) setForm((f) => ({ ...f, cropPlan: planFor(v) }));
  };

  const run = async (fn: (token: string) => Promise<unknown>, okMsg: string) => {
    const session = getSession();
    if (!session) return;
    setSaving(true);
    try {
      await fn(session.token);
      notifications.show({ color: "green", message: okMsg });
      setEditing(null);
      onChanged();
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || t("cultivation_saveError") });
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (!plot || !editing) return;
    const body: CultivationInput = {
      crop: form.crop.trim(), variety: form.variety.trim(), cropPlan: form.cropPlan,
      startDate: form.startDate, endDate: form.endDate || null, notes: (form.notes || "").trim() || null,
    };
    if (!body.crop || !body.variety || !body.cropPlan || !body.startDate) {
      notifications.show({ color: "red", message: t("cultivation_fillRequired") });
      return;
    }
    if (body.endDate && body.endDate < body.startDate) {
      notifications.show({ color: "red", message: t("cultivation_endBeforeStart") });
      return;
    }
    if (editing === "new") run((tk) => apiCreateCultivation(tk, plot.id, body), t("cultivation_added"));
    else run((tk) => apiUpdateCultivation(tk, editing.id, body), t("cultivation_updated"));
  };

  const closeSeason = (c: Cultivation) =>
    run((tk) => apiUpdateCultivation(tk, c.id, { endDate: today() }), t("cultivation_closed"));
  const remove = (c: Cultivation) => {
    if (!window.confirm(t("cultivation_deleteConfirm", { crop: c.crop }))) return;
    run((tk) => apiDeleteCultivation(tk, c.id), t("cultivation_deleted"));
  };

  return (
    <AppModal opened={opened} onClose={onClose} size="lg" title={t("cultivation_title", { plot: plotLabel })}>
      <Stack gap="md">
        <Text size="sm" c="dimmed">{t("cultivation_help")}</Text>

        {sorted.length === 0 && editing === null && (
          <Text size="sm" c="dimmed" ta="center" py="md">{t("cultivation_none")}</Text>
        )}
        {sorted.map((c) => (
          <Paper key={c.id} withBorder radius="md" p="sm" bg={c.endDate ? undefined : "green.0"}>
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <div style={{ minWidth: 0 }}>
                <Group gap={6}>
                  <Plant size={16} color="var(--mantine-color-green-7)" />
                  <Text fw={600} size="sm">{c.crop} · {c.variety}</Text>
                  <Badge size="xs" variant="light" color={c.endDate ? "gray" : "green"}>
                    {c.endDate ? t("cultivation_closedBadge") : t("cultivation_currentBadge")}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" mt={2}>
                  {t("cultivation_planLine", { plan: c.cropPlan })} · {t("cultivation_sownLine", { date: c.startDate })}
                  {c.endDate ? ` · ${t("cultivation_endedLine", { date: c.endDate })}` : ""}
                </Text>
                {c.notes && <Text size="xs" c="dimmed">{c.notes}</Text>}
              </div>
              <Group gap={4} wrap="nowrap">
                {!c.endDate && (
                  <Tooltip label={t("cultivation_closeSeason")}>
                    <ActionIcon variant="subtle" color="gray" onClick={() => closeSeason(c)} disabled={saving}><CalendarCheck size={16} /></ActionIcon>
                  </Tooltip>
                )}
                <Tooltip label={t("common_edit")}>
                  <ActionIcon variant="subtle" color="gray" onClick={() => startEdit(c)} disabled={saving}><PencilSimple size={16} /></ActionIcon>
                </Tooltip>
                <Tooltip label={t("common_delete")}>
                  <ActionIcon variant="subtle" color="red" onClick={() => remove(c)} disabled={saving}><Trash size={16} /></ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          </Paper>
        ))}

        {editing === null ? (
          <Button variant="light" leftSection={<Plus size={16} />} onClick={startNew}>{t("cultivation_add")}</Button>
        ) : (
          <Paper withBorder radius="md" p="sm">
            <Stack gap="sm">
              <Divider label={editing === "new" ? t("cultivation_add") : t("cultivation_edit")} labelPosition="left" />
              <Group grow>
                <Autocomplete label={t("cultivation_crop")} required data={cropOptions} value={form.crop}
                  onChange={(v) => setForm((f) => ({ ...f, crop: v }))} />
                <Autocomplete label={t("cultivation_variety")} required data={varietyOptions} value={form.variety}
                  placeholder={t("cultivation_varietyPlaceholder")}
                  onChange={(v) => setForm((f) => ({ ...f, variety: v }))} />
              </Group>
              <Group grow align="flex-start">
                <TextInput label={t("cultivation_startDate")} type="date" required value={form.startDate}
                  onChange={(e) => onStartDate(e.currentTarget.value)} />
                <TextInput label={t("cultivation_endDate")} type="date" value={form.endDate || ""}
                  description={t("cultivation_endDateHelp")}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.currentTarget.value || null }))} />
              </Group>

              <Select
                label={t("cultivation_cropPlan")} required data={planOptions} value={form.cropPlan || null}
                allowDeselect={false} description={t("cultivation_cropPlanFromFarm")}
                onChange={(v) => { if (v) { setForm((f) => ({ ...f, cropPlan: v })); setPlanTouched(true); } }}
              />

              <Textarea label={t("admin_note")} autosize minRows={1} maxRows={3} value={form.notes || ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.currentTarget.value }))} />
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setEditing(null)} disabled={saving}>{t("common_cancel")}</Button>
                <Button onClick={save} loading={saving}>{t("common_save")}</Button>
              </Group>
            </Stack>
          </Paper>
        )}
      </Stack>
    </AppModal>
  );
}
