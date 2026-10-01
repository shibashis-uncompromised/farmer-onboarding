"use client";

import { useEffect, useState } from "react";
import {
  ActionIcon, Badge, Button, Divider, Group, NumberInput, Paper, Select, Stack, Text, TextInput, Tooltip,
} from "@mantine/core";
import { CalendarBlank, Plus, Trash } from "@phosphor-icons/react";
import { notifications } from "@mantine/notifications";
import AppModal from "@/components/AppModal";
import { apiCreateCropPlan, apiDeleteCropPlan, type CropPlan } from "@/lib/api";
import { getSession } from "@/lib/session";
import { SEASONS, SEASON_LABEL_KEY, planName, validYear, type SeasonName } from "@/lib/cropPlans";
import type { Farm } from "@/lib/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// Define a farm's crop plans — "<Season> <Year> <Farm ID>". Only defining
// happens here; cultivations are then added per plot (the plot's
// "Cultivations" button stays disabled until the farm has a plan).
export default function CropPlansModal({
  farm, farmLabel, cropPlans, opened, onClose, onChanged,
}: {
  farm: Farm | null;
  farmLabel: string;
  /** This farm's plans. */
  cropPlans: CropPlan[];
  opened: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [season, setSeason] = useState<SeasonName>("Kharif");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (opened) { setSeason("Kharif"); setYear(new Date().getFullYear()); setCreating(cropPlans.length === 0); }
  }, [opened]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = farm ? planName(season, year, farm.id) : "";
  const exists = cropPlans.some((p) => p.name.toLowerCase() === name.toLowerCase());
  const sorted = [...cropPlans].sort((a, b) => b.year - a.year || a.season.localeCompare(b.season));

  const run = async (fn: (token: string) => Promise<unknown>, ok: string) => {
    const session = getSession();
    if (!session) return;
    setBusy(true);
    try {
      await fn(session.token);
      notifications.show({ color: "green", message: ok });
      onChanged();
      return true;
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message || t("cropPlans_saveError") });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!farm) return;
    if (!validYear(year)) {
      notifications.show({ color: "red", message: t("cultivation_yearInvalid") });
      return;
    }
    if (await run((tk) => apiCreateCropPlan(tk, farm.id, season, year), t("cropPlans_created", { name }))) setCreating(false);
  };
  const remove = (p: CropPlan) => {
    if (!window.confirm(t("cropPlans_deleteConfirm", { name: p.name }))) return;
    run((tk) => apiDeleteCropPlan(tk, p.id), t("cropPlans_deleted"));
  };

  return (
    <AppModal opened={opened} onClose={onClose} size="md" title={t("cropPlans_title", { farm: farmLabel })}>
      {farm && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">{t("cropPlans_help")}</Text>

          {sorted.length === 0 && !creating && (
            <Text size="sm" c="dimmed" ta="center" py="sm">{t("cropPlans_none")}</Text>
          )}
          {sorted.map((p) => (
            <Paper key={p.id} withBorder radius="md" p="sm">
              <Group justify="space-between" wrap="nowrap">
                <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                  <CalendarBlank size={18} color="var(--mantine-color-green-7)" />
                  <div style={{ minWidth: 0 }}>
                    <Text fw={600} size="sm" truncate>{p.name}</Text>
                    <Text size="xs" c="dimmed">
                      {SEASONS.includes(p.season as SeasonName) ? t(SEASON_LABEL_KEY[p.season as SeasonName]) : p.season} · {p.year}
                    </Text>
                  </div>
                </Group>
                <Group gap={6} wrap="nowrap">
                  <Badge variant="light" color={p.cultivations ? "green" : "gray"}>
                    {t("cropPlans_cultivationsN", { n: p.cultivations })}
                  </Badge>
                  <Tooltip label={p.cultivations ? t("cropPlans_cantDelete") : t("common_delete")}>
                    <ActionIcon variant="subtle" color="red" disabled={busy || p.cultivations > 0} onClick={() => remove(p)}
                      aria-label={t("common_delete")}>
                      <Trash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Paper>
          ))}

          {creating ? (
            <Paper withBorder radius="md" p="sm" bg="gray.0">
              <Divider label={t("cropPlans_new")} labelPosition="left" mb="sm" />
              <Group grow align="flex-end">
                <Select label={t("cultivation_season")} allowDeselect={false}
                  data={SEASONS.map((x) => ({ value: x, label: t(SEASON_LABEL_KEY[x]) }))} value={season}
                  onChange={(v) => v && setSeason(v as SeasonName)} />
                <NumberInput label={t("cultivation_year")} min={2000} max={2100} allowDecimal={false} value={year}
                  onChange={(v) => setYear(typeof v === "number" ? v : Number(v) || new Date().getFullYear())} />
                <TextInput label={t("cultivation_farm")} value={farm.id} readOnly disabled />
              </Group>
              <Text size="xs" c="dimmed" mt={6}>
                {t("cropPlans_willBe")} <Text span fw={600} c="dark">{name}</Text>
              </Text>
              {exists && <Text size="xs" c="orange" mt={4}>{t("cropPlans_exists")}</Text>}
              <Group justify="flex-end" mt="sm">
                {sorted.length > 0 && <Button variant="default" disabled={busy} onClick={() => setCreating(false)}>{t("common_cancel")}</Button>}
                <Button loading={busy} disabled={exists} onClick={create}>{t("cropPlans_save")}</Button>
              </Group>
            </Paper>
          ) : (
            <Button variant="light" leftSection={<Plus size={16} />} onClick={() => setCreating(true)}>{t("cropPlans_new")}</Button>
          )}
        </Stack>
      )}
    </AppModal>
  );
}
