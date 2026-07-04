"use client";

import { useEffect, useRef } from "react";
import { Box, Text } from "@mantine/core";
import L from "leaflet";
import "leaflet-draw";
import type { BoundaryPoint } from "@/lib/types";
import { ESRI_ATTRIBUTION, ESRI_TILE_URL } from "@/lib/offlineTiles";

const FALLBACK_CENTER: [number, number] = [23.0451, 72.5321];
const DEFAULT_ZOOM = 17;

interface Props {
  points: BoundaryPoint[];
  onChange: (points: BoundaryPoint[]) => void;
  centerHint?: { lat: number; lng: number } | null;
}

function layerToPoints(layer: L.Layer): BoundaryPoint[] {
  const rings = (layer as L.Polygon).getLatLngs();
  const latlngs = Array.isArray(rings[0]) ? rings[0] as L.LatLng[] : rings as L.LatLng[];
  const now = Date.now();
  return latlngs.map((p, i) => ({
    lat: Number(p.lat.toFixed(6)),
    lng: Number(p.lng.toFixed(6)),
    accuracy: 0,
    at: now + i,
  }));
}

export default function BoundaryDrawMap({ points, onChange, centerHint }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    const center: [number, number] = centerHint ? [centerHint.lat, centerHint.lng] : FALLBACK_CENTER;
    const map = L.map(containerRef.current, { zoomControl: true }).setView(center, DEFAULT_ZOOM);
    mapRef.current = map;

    L.tileLayer(ESRI_TILE_URL, { attribution: ESRI_ATTRIBUTION, maxZoom: 19 }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    drawnItemsRef.current = drawnItems;
    map.addLayer(drawnItems);

    if (points.length >= 3) {
      const existing = L.polygon(points.map((p) => L.latLng(p.lat, p.lng)), {
        color: "#f59e0b",
        weight: 3,
        fillOpacity: 0.16,
      });
      existing.addTo(drawnItems);
      map.fitBounds(existing.getBounds(), { padding: [24, 24], maxZoom: 18 });
    }

    const drawControl = new (L.Control as any).Draw({
      draw: {
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false,
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: { color: "#f59e0b", weight: 3, fillOpacity: 0.16 },
        },
      },
      edit: { featureGroup: drawnItems, remove: true },
    });
    map.addControl(drawControl);

    map.on((L as any).Draw.Event.CREATED, (e: any) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      onChangeRef.current(layerToPoints(e.layer));
    });
    map.on((L as any).Draw.Event.EDITED, (e: any) => {
      e.layers.eachLayer((layer: L.Layer) => onChangeRef.current(layerToPoints(layer)));
    });
    map.on((L as any).Draw.Event.DELETED, () => onChangeRef.current([]));

    if (!centerHint && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled || mapRef.current !== map) return;
          try {
            map.setView([pos.coords.latitude, pos.coords.longitude], DEFAULT_ZOOM, { animate: false });
          } catch {}
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }

    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      cancelled = true;
      map.remove();
      mapRef.current = null;
      drawnItemsRef.current = null;
    };
    // The Leaflet map owns its lifecycle imperatively while mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box>
      <div ref={containerRef} style={{ height: 320, width: "100%", borderRadius: 8, overflow: "hidden" }} />
      <Text size="xs" c="dimmed" mt={6}>
        Tap the polygon tool, trace the boundary, then tap the first point to close it. Cached tiles are used automatically when offline.
      </Text>
    </Box>
  );
}
