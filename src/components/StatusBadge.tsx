"use client";

import { Badge, ThemeIcon } from "@mantine/core";
import { CheckCircle, Circle, CircleHalf } from "@phosphor-icons/react";
import type { OnboardingStatus } from "@/lib/types";
import { STATUS_META } from "@/lib/status";

const ICON = {
  not_started: Circle,
  pending: CircleHalf,
  completed: CheckCircle,
} as const;

export function StatusIcon({ status, size = 26 }: { status: OnboardingStatus; size?: number }) {
  const Icon = ICON[status];
  const { color, label } = STATUS_META[status];
  return (
    <ThemeIcon variant="light" color={color} radius="xl" size={size + 10} aria-label={label}>
      <Icon size={size} weight={status === "completed" ? "fill" : "duotone"} />
    </ThemeIcon>
  );
}

export function StatusChip({ status }: { status: OnboardingStatus }) {
  const { color, label } = STATUS_META[status];
  return <Badge color={color} variant="light" radius="sm">{label}</Badge>;
}
