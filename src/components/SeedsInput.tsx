"use client";

import { ActionIcon, Box, Button, Group, Paper, Select, Text } from "@mantine/core";
import { Minus, Plus, Trash, Plant } from "@phosphor-icons/react";
import { SEEDS, SEED_QTY_MAX } from "@/lib/seeds";
import type { SeedPackage } from "@/lib/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface Props {
  value: SeedPackage[];
  onChange: (seeds: SeedPackage[]) => void;
}

// Multi-seed editor: pick a seed, then adjust quantity with a stepper.
export default function SeedsInput({ value, onChange }: Props) {
  const { t } = useLanguage();
  const available = SEEDS.filter((s) => !value.some((x) => x.seed === s));

  const add = (seed: string) => {
    if (!seed || value.some((x) => x.seed === seed)) return;
    onChange([...value, { seed, qty: 1 }]);
  };
  const setQty = (i: number, qty: number) => {
    const next = value.slice();
    next[i] = { ...next[i], qty: Math.max(1, Math.min(SEED_QTY_MAX, qty)) };
    onChange(next);
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <Box>
      <Text size="sm" fw={500} mb={6}>
        <Group gap={6} component="span"><Plant size={16} /> {t("field_seeds")}</Group>
      </Text>

      {value.length === 0 ? (
        <Text size="xs" c="dimmed" mb="xs">{t("seedsInput_noneAdded")}</Text>
      ) : (
        <Box mb="xs">
          {value.map((item, i) => (
            <Paper key={item.seed} withBorder radius="md" p={8} mb={6} bg="gray.0">
              <Group justify="space-between" wrap="nowrap">
                <Text size="sm" fw={600} style={{ flex: 1, minWidth: 0 }} truncate>{item.seed}</Text>
                <Group gap={4} wrap="nowrap">
                  <ActionIcon variant="default" radius="xl" size="md" onClick={() => setQty(i, item.qty - 1)} aria-label={t("seedsInput_decreaseAria")}>
                    <Minus size={14} />
                  </ActionIcon>
                  <Text size="sm" fw={700} w={22} ta="center">{item.qty}</Text>
                  <ActionIcon variant="default" radius="xl" size="md" onClick={() => setQty(i, item.qty + 1)} aria-label={t("seedsInput_increaseAria")}>
                    <Plus size={14} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" size="md" onClick={() => remove(i)} aria-label={t("seedsInput_removeAria")}>
                    <Trash size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            </Paper>
          ))}
        </Box>
      )}

      <Select
        placeholder={available.length ? t("seedsInput_addPlaceholder") : t("seedsInput_allAddedPlaceholder")}
        data={available}
        value={null}
        disabled={available.length === 0}
        onChange={(v) => v && add(v)}
        leftSection={<Plus size={16} />}
        checkIconPosition="right"
        size="sm"
        comboboxProps={{ withinPortal: true }}
      />
    </Box>
  );
}
