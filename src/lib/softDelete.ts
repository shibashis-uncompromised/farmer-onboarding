import { db } from "./db";

// Records created before this instant are treated as pre-launch test data and
// soft-deleted (hidden everywhere). 3 Jul 2026 00:00 IST = 2 Jul 2026 18:30 UTC.
export const LAUNCH_CUTOFF_TS = Date.UTC(2026, 6, 2, 18, 30, 0);
const IMPORTED_FARMER_TS = Date.UTC(2026, 6, 3, 6, 30, 0);

export const notDeleted = <T extends { deleted?: boolean }>(x: T) => !x.deleted;

function isKnownImportedFarmerId(id: string): boolean {
  const m = /^RJ-(AMOD|VELA)-U(\d{3})$/i.exec(id || "");
  if (!m) return false;
  const seq = Number(m[2]);
  return m[1].toUpperCase() === "AMOD" ? seq >= 1 && seq <= 22 : seq >= 1 && seq <= 19;
}

// One-time (idempotent) sweep: soft-delete anything created before launch.
// Marks synced:false so the deletion propagates to the server + other devices.
export async function sweepPreLaunch(): Promise<number> {
  let n = 0;
  const now = Date.now();
  const stampDeleted = (x: { createdAt: number; deleted?: boolean }) =>
    !x.deleted && x.createdAt < LAUNCH_CUTOFF_TS;

  await db.transaction("rw", db.farmers, db.farms, db.plots, db.soilSamples, async () => {
    // Repair the first RJ import, which was accidentally stamped as 2025. Some
    // devices may already have pulled/swept it, so restore those known IDs
    // before applying the generic pre-launch cleanup.
    const farmers = await db.farmers.toArray();
    for (const r of farmers as any[]) {
      if (isKnownImportedFarmerId(r.id) && (r.createdAt || 0) < LAUNCH_CUTOFF_TS) {
        await db.farmers.update(r.id, {
          createdAt: IMPORTED_FARMER_TS,
          updatedAt: now,
          deleted: false,
          synced: false,
        } as any);
        n++;
      }
    }

    for (const table of [db.farmers, db.farms, db.plots, db.soilSamples] as const) {
      const rows = await table.toArray();
      for (const r of rows as any[]) {
        if (table === db.farmers && isKnownImportedFarmerId(r.id)) continue;
        if (stampDeleted(r)) {
          await table.update(r.id, { deleted: true, updatedAt: now, synced: false } as any);
          n++;
        }
      }
    }
  });
  return n;
}

export async function softDeleteFarmer(id: string): Promise<void> {
  const now = Date.now();
  await db.transaction("rw", db.farmers, db.farms, db.plots, db.soilSamples, async () => {
    await db.farmers.update(id, { deleted: true, updatedAt: now, synced: false } as any);
    const [farms, plots, samples] = await Promise.all([
      db.farms.where("farmerId").equals(id).toArray(),
      db.plots.where("farmerId").equals(id).toArray(),
      db.soilSamples.where("farmerId").equals(id).toArray(),
    ]);
    await Promise.all([
      ...farms.map((x) => db.farms.update(x.id, { deleted: true, updatedAt: now, synced: false } as any)),
      ...plots.map((x) => db.plots.update(x.id, { deleted: true, updatedAt: now, synced: false } as any)),
      ...samples.map((x) => db.soilSamples.update(x.id, { deleted: true, updatedAt: now, synced: false } as any)),
    ]);
  });
}

export async function softDeleteFarm(id: string): Promise<void> {
  const now = Date.now();
  await db.transaction("rw", db.farmers, db.farms, db.plots, db.soilSamples, async () => {
    const farm = await db.farms.get(id);
    await db.farms.update(id, { deleted: true, updatedAt: now, synced: false } as any);
    const [plots, samples] = await Promise.all([
      db.plots.where("farmId").equals(id).toArray(),
      db.soilSamples.where("farmId").equals(id).toArray(),
    ]);
    await Promise.all([
      ...plots.map((x) => db.plots.update(x.id, { deleted: true, updatedAt: now, synced: false } as any)),
      ...samples.map((x) => db.soilSamples.update(x.id, { deleted: true, updatedAt: now, synced: false } as any)),
    ]);
    if (farm?.farmerId) await db.farmers.update(farm.farmerId, { updatedAt: now, synced: false } as any);
  });
}

export async function softDeletePlot(id: string): Promise<void> {
  const now = Date.now();
  await db.transaction("rw", db.farmers, db.plots, async () => {
    const plot = await db.plots.get(id);
    await db.plots.update(id, { deleted: true, updatedAt: now, synced: false } as any);
    if (plot?.farmerId) await db.farmers.update(plot.farmerId, { updatedAt: now, synced: false } as any);
  });
}

export async function softDeleteSoilSample(id: string): Promise<void> {
  const now = Date.now();
  await db.transaction("rw", db.farmers, db.soilSamples, async () => {
    const sample = await db.soilSamples.get(id);
    await db.soilSamples.update(id, { deleted: true, updatedAt: now, synced: false } as any);
    if (sample?.farmerId) await db.farmers.update(sample.farmerId, { updatedAt: now, synced: false } as any);
  });
}
