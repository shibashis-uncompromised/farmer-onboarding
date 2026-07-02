// Pre-downloads Esri World Imagery tiles for an area into the service
// worker's tile cache (see public/sw.js — TILE_CACHE), so the boundary map
// still renders with no signal in the field.
//
// Esri serves from a single host with no subdomain rotation (unlike OSM's
// a/b/c), so there's no subdomain-pinning concern here.
//
// NOTE the tile path order: Esri uses {z}/{y}/{x} — reversed from OSM's
// {z}/{x}/{y}. Getting this backwards silently loads/caches the wrong tiles.

const TILE_URL = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

// Rough average size of a satellite tile — varies with terrain complexity,
// so this is an estimate for planning purposes, not an exact figure.
const AVG_TILE_KB = 20;

function lon2tileX(lon: number, zoom: number) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}
function lat2tileY(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** A box of roughly 2×radiusKm per side, centered on the given point. */
export function boundsAroundPoint(lat: number, lng: number, radiusKm = 2): Bounds {
  const latDelta = radiusKm / 111; // ~111km per degree latitude
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    north: lat + latDelta,
    south: lat - latDelta,
    east: lng + lngDelta,
    west: lng - lngDelta,
  };
}

/** Every tile URL needed to cover `bounds` across the given zoom range. */
export function tilesForBounds(bounds: Bounds, minZoom: number, maxZoom: number): string[] {
  const urls: string[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lon2tileX(bounds.west, z);
    const xMax = lon2tileX(bounds.east, z);
    const yMin = lat2tileY(bounds.north, z);
    const yMax = lat2tileY(bounds.south, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        urls.push(TILE_URL(z, x, y));
      }
    }
  }
  return urls;
}

/** Quick estimate to show the user before they commit to a download. */
export function estimateDownload(bounds: Bounds, minZoom: number, maxZoom: number) {
  const count = tilesForBounds(bounds, minZoom, maxZoom).length;
  return { tileCount: count, estimatedMB: Math.round((count * AVG_TILE_KB) / 1024 * 10) / 10 };
}

interface DownloadOptions {
  onProgress?: (done: number, total: number) => void;
  /** ms delay between requests — be a considerate citizen of the tile server. */
  delayMs?: number;
}

/**
 * Downloads tiles for the given bounds/zoom range straight into the
 * "map-tiles-v1" cache that public/sw.js reads from. Requires the service
 * worker to already be registered and active.
 */
export async function downloadTiles(
  bounds: Bounds,
  { minZoom = 14, maxZoom = 17 }: { minZoom?: number; maxZoom?: number } = {},
  { onProgress, delayMs = 30 }: DownloadOptions = {}
) {
  if (typeof caches === "undefined") {
    throw new Error("Cache API unavailable — offline tiles need a browser with service worker support.");
  }
  const urls = tilesForBounds(bounds, minZoom, maxZoom);
  const cache = await caches.open("map-tiles-v1");
  let done = 0;

  for (const url of urls) {
    const existing = await cache.match(url);
    if (!existing) {
      try {
        const res = await fetch(url);
        if (res.ok) await cache.put(url, res);
      } catch {
        // offline mid-download, or a single tile failed — keep going
      }
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    }
    done++;
    onProgress?.(done, urls.length);
  }

  return { total: urls.length };
}
