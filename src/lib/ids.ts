import { db } from "./db";
import { REGION_PREFIX } from "./villages";

const pad3 = (n: number) => String(n).padStart(3, "0");

// Next farmer id for a village: RJ{village}U{seq}
export async function nextFarmerId(villageCode: string): Promise<string> {
  const existing = await db.farmers.where("villageCode").equals(villageCode).toArray();
  const max = existing.reduce((m, f) => {
    const match = f.id.match(/U(\d{3})$/);
    return match ? Math.max(m, parseInt(match[1], 10)) : m;
  }, 0);
  return `${REGION_PREFIX}${villageCode}U${pad3(max + 1)}`;
}

// Next farm id for a village: RJ{village}F{seq}
export async function nextFarmId(villageCode: string): Promise<string> {
  const existing = await db.farms.where("villageCode").equals(villageCode).toArray();
  const max = existing.reduce((m, f) => {
    const match = f.id.match(/F(\d{3})$/);
    return match ? Math.max(m, parseInt(match[1], 10)) : m;
  }, 0);
  return `${REGION_PREFIX}${villageCode}F${pad3(max + 1)}`;
}

// Next plot id within a farm: {farmId}-{seq}
export async function nextPlotId(farmId: string): Promise<{ id: string; seq: string }> {
  const existing = await db.plots.where("farmId").equals(farmId).toArray();
  const max = existing.reduce((m, p) => {
    const n = parseInt(p.seq, 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  const seq = pad3(max + 1);
  return { id: `${farmId}-${seq}`, seq };
}

export const uid = () =>
  "m_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
