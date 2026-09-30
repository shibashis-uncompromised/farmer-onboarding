"use client";

import { Badge, ThemeIcon } from "@mantine/core";
import { CheckCircle, Circle, CircleHalf } from "@phosphor-icons/react";
import type { OnboardingStatus } from "@/lib/types";
import { STATUS_META } from "@/lib/status";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/LanguageContext";

const ICON = {
  not_started: Circle,
  pending: CircleHalf,
  completed: CheckCircle,
} as const;

const STATUS_LABEL_KEY: Record<OnboardingStatus, TranslationKey> = {
  not_started: "statusBadge_notStarted",
  pending: "statusBadge_inProgress",
  completed: "statusBadge_completed",
};

export function StatusIcon({ status, size = 26 }: { status: OnboardingStatus; size?: number }) {
  const { t } = useLanguage();
  const Icon = ICON[status];
  const { color } = STATUS_META[status];
  const label = t(STATUS_LABEL_KEY[status]);
  return (
    <ThemeIcon variant="light" color={color} radius="xl" size={size + 10} aria-label={label}>
      <Icon size={size} weight={status === "completed" ? "fill" : "duotone"} />
    </ThemeIcon>
  );
}

export function StatusChip({ status }: { status: OnboardingStatus }) {
  const { t } = useLanguage();
  const { color } = STATUS_META[status];
  return <Badge color={color} variant="light" radius="sm">{t(STATUS_LABEL_KEY[status])}</Badge>;
}
