import type { Table } from "dexie";
import { db } from "./db";
import { apiSync, apiPull } from "./api";
import { getSession } from "./session";
import type { Media } from "./types";

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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
}

async function mediaForSync(media: Media[]) {
  return Promise.all(media.map(async (m) => ({
    id: m.id,
    createdAt: m.createdAt,
    type: m.blob.type || "image/jpeg",
    dataUrl: await blobToDataUrl(m.blob),
  })));
}

function dataUrlToBlob(dataUrl: string, fallbackType = "image/jpeg"): Blob {
  const [meta, data = ""] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(meta)?.[1] || fallbackType;
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function mergeMedia(records: any[] = []): Promise<number> {
  let n = 0;
  for (const r of records) {
    if (!r?.id || !r.dataUrl) continue;
    const local = await db.media.get(r.id);
    if (!local) {
      await db.media.put({
        id: r.id,
        blob: dataUrlToBlob(r.dataUrl, r.type),
        createdAt: Number(r.createdAt || Date.now()),
        synced: true,
      });
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

  // 1) push local changes
  const [lf, lfm, lp, lm] = await Promise.all([db.farmers.toArray(), db.farms.toArray(), db.plots.toArray(), db.media.toArray()]);
  const uf = lf.filter((x) => !x.synced);
  const um = lfm.filter((x) => !x.synced);
  const up = lp.filter((x) => !x.synced);
  const uMedia = lm.filter((x) => !x.synced);
  if (uf.length || um.length || up.length || uMedia.length) {
    await apiSync(s.token, { farmers: uf, farms: um, plots: up, media: await mediaForSync(uMedia) });
    await db.transaction("rw", db.farmers, db.farms, db.plots, db.media, async () => {
      for (const x of uf) await db.farmers.update(x.id, { synced: true } as any);
      for (const x of um) await db.farms.update(x.id, { synced: true } as any);
      for (const x of up) await db.plots.update(x.id, { synced: true } as any);
      for (const x of uMedia) await db.media.update(x.id, { synced: true } as any);
    });
  }

  // 2) pull the full server set + merge (network call OUTSIDE the tx)
  const server = await apiPull(s.token);
  let pulled = 0;
  await db.transaction("rw", db.farmers, db.farms, db.plots, db.media, async () => {
    pulled += await mergeTable(db.farmers as any, server.farmers as any);
    pulled += await mergeTable(db.farms as any, server.farms as any);
    pulled += await mergeTable(db.plots as any, server.plots as any);
    pulled += await mergeMedia(server.media);
  });

  return { pushed: uf.length + um.length + up.length + uMedia.length, pulled };
}
