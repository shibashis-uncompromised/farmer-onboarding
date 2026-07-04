import { db } from "./db";

// Records created before this instant are treated as pre-launch test data and
// soft-deleted (hidden everywhere). 3 Jul 2026 00:00 IST = 2 Jul 2026 18:30 UTC.
export const LAUNCH_CUTOFF_TS = Date.UTC(2026, 6, 2, 18, 30, 0);

export const notDeleted = <T extends { deleted?: boolean }>(x: T) => !x.deleted;

// One-time (idempotent) sweep: soft-delete anything created before launch.
// Marks synced:false so the deletion propagates to the server + other devices.
export async function sweepPreLaunch(): Promise<number> {
  let n = 0;
  const now = Date.now();
  const stampDeleted = (x: { createdAt: number; deleted?: boolean }) =>
    !x.deleted && x.createdAt < LAUNCH_CUTOFF_TS;

  await db.transaction("rw", db.farmers, db.farms, db.plots, db.soilSamples, async () => {
    for (const table of [db.farmers, db.farms, db.plots, db.soilSamples] as const) {
      const rows = await table.toArray();
      for (const r of rows as any[]) {
        if (stampDeleted(r)) {
          await table.update(r.id, { deleted: true, updatedAt: now, synced: false } as any);
          n++;
        }
      }
    }
  });
  return n;
}
