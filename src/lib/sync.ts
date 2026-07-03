import type { Table } from "dexie";
import { db } from "./db";
import { apiSync, apiPull, apiPresignMedia, fetchWithTimeout } from "./api";
import { getSession, ensureIdHeadroom } from "./session";

// Merge server records into a local table, last-write-wins by updatedAt.
// Pulled records are marked synced (they're reconciled with the server).
async function mergeTable<T extends { id: string; updatedAt?: number }>(
  table: Table<T, string>,
  records: T[]
): Promise<number> {
  let n = 0;
  for (const r of records || []) {
    if (!r || !r.id) continue;
    const local = await table.get(r.id);
    if (!local || (r.updatedAt || 0) > (local.updatedAt || 0)) {
      await table.put({ ...r, synced: true } as T);
      n++;
    }
  }
  return n;
}

// Two-way sync: push everything not yet synced, then pull the full server set
// and merge it in. After this every signed-in device converges to the same data.
export async function syncAll(): Promise<{ pushed: number; pulled: number }> {
  const s = getSession();
  if (!s) throw new Error("Not signed in");
  if (typeof navigator !== "undefined" && !navigator.onLine) throw new Error("You're offline — connect to sync");

  // 0) top up the offline ID block while we have connectivity (fire-and-forget)
  ensureIdHeadroom().catch(() => {});

  // 1) upload unsynced media blobs directly to S3 via presigned URLs
  const allMedia = await db.media.toArray();
  const unsyncedMedia = allMedia.filter((m) => !m.synced);
  const syncedMediaPayload: { id: string; createdAt: number; type: string; s3Key: string }[] = [];

  for (const m of unsyncedMedia) {
    try {
      const mimeType = m.blob.type || "image/jpeg";
      const { uploadUrl, s3Key } = await apiPresignMedia(s.token, m.id, mimeType);
      const put = await fetchWithTimeout(uploadUrl, {
        method: "PUT",
        body: m.blob,
        headers: { "Content-Type": mimeType },
      }, 15000);
      if (!put.ok) throw new Error(`S3 upload failed (${put.status})`);
      await db.media.update(m.id, { s3Key, synced: true } as any);
      syncedMediaPayload.push({ id: m.id, createdAt: m.createdAt, type: mimeType, s3Key });
    } catch (e) {
      console.warn(`Media upload failed for ${m.id}:`, e);
      // Don't block the rest of sync — media will retry next time
    }
  }

  // 2) push local farmer/farm/plot changes (include successfully uploaded media)
  // Best-effort: a push failure must NOT stop the pull below, so viewing
  // server data never depends on the upload/push succeeding.
  const [lf, lfm, lp, lss] = await Promise.all([
    db.farmers.toArray(), db.farms.toArray(), db.plots.toArray(), db.soilSamples.toArray(),
  ]);
  const uf = lf.filter((x) => !x.synced);
  const um = lfm.filter((x) => !x.synced);
  const up = lp.filter((x) => !x.synced);
  const uss = lss.filter((x) => !x.synced);
  let pushed = 0;
  try {
    if (uf.length || um.length || up.length || uss.length || syncedMediaPayload.length) {
      await apiSync(s.token, { farmers: uf, farms: um, plots: up, soilSamples: uss, media: syncedMediaPayload });
      await db.transaction("rw", db.farmers, db.farms, db.plots, db.soilSamples, async () => {
        for (const x of uf) await db.farmers.update(x.id, { synced: true } as any);
        for (const x of um) await db.farms.update(x.id, { synced: true } as any);
        for (const x of up) await db.plots.update(x.id, { synced: true } as any);
        for (const x of uss) await db.soilSamples.update(x.id, { synced: true } as any);
      });
      pushed = uf.length + um.length + up.length + uss.length;
    }
  } catch (e) {
    console.warn("Push failed — will retry next sync; continuing to pull:", e);
  }

  // 3) pull the full server set + merge (network call OUTSIDE the tx)
  const server = await apiPull(s.token);
  let pulled = 0;
  await db.transaction("rw", db.farmers, db.farms, db.plots, db.soilSamples, async () => {
    pulled += await mergeTable(db.farmers as any, server.farmers as any);
    pulled += await mergeTable(db.farms as any, server.farms as any);
    pulled += await mergeTable(db.plots as any, server.plots as any);
    pulled += await mergeTable(db.soilSamples as any, server.soilSamples as any);
  });

  // 4) download any media blobs we don't have locally yet
  for (const m of server.media || []) {
    if (!m?.id || !m?.s3Url) continue;
    const existing = await db.media.get(m.id);
    if (existing?.blob) continue;  // already have the blob
    try {
      const res = await fetchWithTimeout(m.s3Url, {}, 15000);
      if (!res.ok) continue;
      const blob = await res.blob();
      await db.media.put({ id: m.id, blob, createdAt: m.createdAt, synced: true, s3Key: m.s3Key });
      pulled++;
    } catch (e) {
      console.warn(`Media download failed for ${m.id}:`, e);
    }
  }

  return { pushed: pushed + syncedMediaPayload.length, pulled };
}
