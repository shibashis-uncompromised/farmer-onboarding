"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { Box } from "@mantine/core";
import type { BoundaryPoint } from "@/lib/types";

// @ts-expect-error - CSS side-effect import, no type declarations needed
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const FALLBACK_CENTER: [number, number] = [23.0451, 72.5321];

const ESRI_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

interface Props {
  boundary?: BoundaryPoint[];
  /** Optional pin for a specific plot's location within the farm. */
  markerLat?: number | null;
  markerLng?: number | null;
  height?: number;
}

// Static, read-only map — no draw controls, no editing. Just shows the
// already-saved boundary (and optionally a plot pin) for context.
export default function FarmBoundaryPreview({ boundary, markerLat, markerLng, height = 220 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false, // avoid hijacking scroll while inside a modal
    });
    mapRef.current = map;

    L.tileLayer(ESRI_TILE_URL, { attribution: ESRI_ATTRIBUTION, maxZoom: 19 }).addTo(map);

    const hasBoundary = boundary && boundary.length >= 3;
    let bounds: L.LatLngBounds | null = null;

    if (hasBoundary) {
      const latlngs = boundary!.map((p) => L.latLng(p.lat, p.lng));
      const poly = L.polygon(latlngs, { color: "#ffe14d", weight: 3, fillOpacity: 0.15 }).addTo(map);
      bounds = poly.getBounds();
    }

    if (markerLat != null && markerLng != null) {
      L.marker([markerLat, markerLng]).addTo(map);
      bounds = bounds ? bounds.extend([markerLat, markerLng]) : L.latLngBounds([[markerLat, markerLng]]);
    }

    if (bounds) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 18 });
    } else {
      map.setView(FALLBACK_CENTER, 15);
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box>
      <div ref={containerRef} style={{ height, width: "100%", borderRadius: 8 }} />
    </Box>
  );
}