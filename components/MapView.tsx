'use client';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mapConfig } from '../lib/config';
import type { Vessel } from '../lib/types';

type MapViewProps = {
  vessels: readonly Vessel[];
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

export default function MapView({ vessels, onSelect }: MapViewProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  const vesselsRef = useRef(vessels);
  const onSelectRef = useRef(onSelect);

  vesselsRef.current = vessels;
  onSelectRef.current = onSelect;

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

      vesselsRef.current.forEach((vessel) => {
        const icon = L.divIcon({
          className: 'vessel-marker',
          html: vesselIcon(vessel),
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
        const marker = L.marker([vessel.lat, vessel.lon], { icon }).addTo(map);
        marker.on('click', () => onSelectRef.current(vessel));
        markersRef.current.set(vessel.id, marker);
      });

      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 0);
    };

    void createMap();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(vessels.map((vessel) => vessel.id));
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.removeFrom(map);
        markersRef.current.delete(id);
      }
    });

    void import('leaflet').then((L) => {
      if (!mapRef.current || mapRef.current !== map) return;

      vessels.forEach((vessel) => {
        const marker = markersRef.current.get(vessel.id);
        if (marker) {
          marker.setLatLng([vessel.lat, vessel.lon]);
          marker.setIcon(L.divIcon({
            className: 'vessel-marker',
            html: vesselIcon(vessel),
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          }));
          return;
        }

        const newMarker = L.marker([vessel.lat, vessel.lon], {
          icon: L.divIcon({
            className: 'vessel-marker',
            html: vesselIcon(vessel),
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          }),
        }).addTo(map);
        newMarker.on('click', () => onSelectRef.current(vessel));
        markersRef.current.set(vessel.id, newMarker);
      });
    });
  }, [vessels]);

  return <div ref={mapElement} className="map" aria-label="Карта пролива Дувр" />;
}
