import type { Farmer, OnboardingStatus } from "./types";

export function computeStatus(
  farmer: Pick<Farmer, "bioComplete">,
  farmCount: number,
  plotCount: number
): OnboardingStatus {
  if (farmer.bioComplete && farmCount > 0 && plotCount > 0) return "completed";
  if (!farmer.bioComplete && farmCount === 0) return "not_started";
  return "pending";
}

export const STATUS_META: Record<
  OnboardingStatus,
  { label: string; color: string }
> = {
  not_started: { label: "Not started", color: "gray" },
  pending: { label: "In progress", color: "yellow" },
  completed: { label: "Completed", color: "teal" },
};
