import Dexie, { type Table } from "dexie";
import type { Farmer, Farm, Plot, Media, SoilSample } from "./types";

// Local-first store. Swapping/adding a backend later = add a sync layer that
// reads rows where `synced === false` and pushes them.
export class AppDB extends Dexie {
  farmers!: Table<Farmer, string>;
  farms!: Table<Farm, string>;
  plots!: Table<Plot, string>;
  media!: Table<Media, string>;
  soilSamples!: Table<SoilSample, string>;

  constructor() {
    super("farmer-onboarding");
    this.version(1).stores({
      farmers: "id, villageCode, bioComplete, updatedAt, lastName, firstName",
      farms: "id, farmerId, villageCode, updatedAt",
      plots: "id, farmId, farmerId, updatedAt",
      media: "id",
    });
    this.version(2).stores({
      farmers: "id, villageCode, bioComplete, updatedAt, lastName, firstName",
      farms: "id, farmerId, villageCode, updatedAt",
      plots: "id, farmId, farmerId, updatedAt",
      media: "id, synced, createdAt",
    });
    // v3: add soilSamples (purely additive — existing stores & data untouched).
    this.version(3).stores({
      farmers: "id, villageCode, bioComplete, updatedAt, lastName, firstName",
      farms: "id, farmerId, villageCode, updatedAt",
      plots: "id, farmId, farmerId, updatedAt",
      media: "id, synced, createdAt",
      soilSamples: "id, farmId, farmerId, synced, createdAt",
    });
  }
}

export const db = new AppDB();
