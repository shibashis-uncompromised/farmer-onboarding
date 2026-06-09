import type { Farmer, OnboardingStatus } from "./types";

export function computeStatus(
  farmer: Pick<Farmer, "bioComplete">,
  farmCount: number,
  _plotCount?: number
): OnboardingStatus {
  if (farmCount > 0) return "completed";        // at least one farm added
  if (farmer.bioComplete) return "pending";     // bio saved, no farm yet
  return "not_started";                          // nothing yet
}

export const STATUS_META: Record<
  OnboardingStatus,
  { label: string; color: string }
> = {
  not_started: { label: "Not started", color: "gray" },
  pending: { label: "In progress", color: "yellow" },
  completed: { label: "Completed", color: "teal" },
};
