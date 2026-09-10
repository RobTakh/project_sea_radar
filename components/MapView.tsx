'use client';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mapConfig } from '../lib/config';
import type { Vessel } from '../lib/types';

type MapViewProps = {
  vessel: Vessel;
  onSelect: (vessel: Vessel) => void;
};

const vesselIcon = (vessel: Vessel) => {
  const iconType = vessel.courseDeg === null ? 'neutral' : 'course';
  const rotation = vessel.courseDeg === null ? '' : ` transform: rotate(${vessel.courseDeg}deg);`;
  const shape = vessel.courseDeg === null
    ? '<span class="vessel-dot"></span>'
    : '<span class="vessel-arrow"></span>';

  return `<div data-vessel-id="${vessel.id}" data-icon="${iconType}" style="${rotation}">${shape}</div>`;
};

export default function MapView({ vessel, onSelect }: MapViewProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let disposed = false;

    const createMap = async () => {
      const L = await import('leaflet');
      if (disposed || !mapElement.current || mapRef.current) return;

      const map = L.map(mapElement.current).setView(mapConfig.center, mapConfig.zoom);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: 'vessel-marker',
        html: vesselIcon(vessel),
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      const marker = L.marker([vessel.lat, vessel.lon], { icon }).addTo(map);
      marker.on('click', () => onSelect(vessel));

      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 0);
    };

    void createMap();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={mapElement} className="map" aria-label="Карта пролива Дувр" />;
}
