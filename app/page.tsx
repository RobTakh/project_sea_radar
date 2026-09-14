'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import MapView from '../components/ClientMap';
import VesselCard from '../components/VesselCard';
import { DEMO_TICK_MS, demoVessels } from '../lib/config';
import type { DemoVessel, RoutePoint, Vessel } from '../lib/types';

type DemoState = {
  vessel: Vessel;
  route: readonly RoutePoint[];
  routeIndex: number;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

const bearingBetween = (from: RoutePoint, to: RoutePoint) => {
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const deltaLon = toRadians(to.lon - from.lon);
  const bearing = toDegrees(Math.atan2(
    Math.sin(deltaLon) * Math.cos(toLat),
    Math.cos(fromLat) * Math.sin(toLat)
      - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLon),
  ));

  return (bearing + 360) % 360;
};

const createInitialState = (): DemoState[] => demoVessels.map((demoVessel: DemoVessel) => ({
  vessel: {
    ...demoVessel,
    timestamp: new Date().toISOString(),
    courseDeg: bearingBetween(demoVessel.route[0], demoVessel.route[1]),
  },
  route: demoVessel.route,
  routeIndex: 0,
}));

const advanceVessels = (states: DemoState[], timestamp: string) => states.map((state) => {
  if (state.routeIndex >= state.route.length - 1) return state;

  const nextIndex = state.routeIndex + 1;
  const previousPoint = state.route[state.routeIndex];
  const currentPoint = state.route[nextIndex];
  const isLastPoint = nextIndex === state.route.length - 1;

  return {
    ...state,
    vessel: {
      ...state.vessel,
      lat: currentPoint.lat,
      lon: currentPoint.lon,
      speedKnots: isLastPoint ? 0 : state.vessel.speedKnots,
      courseDeg: bearingBetween(previousPoint, currentPoint),
      timestamp,
    },
    routeIndex: nextIndex,
  };
});

export default function Home() {
  const [demoStates, setDemoStates] = useState<DemoState[]>(createInitialState);
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const vessels = demoStates.map(({ vessel }) => vessel);
  const selectedVessel = selectedVesselId === null
    ? null
    : vessels.find((vessel) => vessel.id === selectedVesselId) ?? null;

  const selectVessel = useCallback((vessel: Vessel) => {
    setSelectedVesselId(vessel.id);
  }, []);

  useEffect(() => {
    const timerStartedAt = new Date().toISOString();
    setDemoStates((states) => states.map((state) => ({
      ...state,
      vessel: { ...state.vessel, timestamp: timerStartedAt },
    })));

    timerRef.current = window.setInterval(() => {
      setDemoStates((states) => advanceVessels(states, new Date().toISOString()));
    }, DEMO_TICK_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return (
    <main className="page">
      <header className="header">
        <h1>Sea Radar — пролив Дувр</h1>
      </header>
      <section className="map-area">
        <MapView vessels={vessels} onSelect={selectVessel} />
        <aside className="side-panel">
          <p className="source">Демонстрационные данные</p>
          {selectedVessel && <VesselCard vessel={selectedVessel} />}
        </aside>
      </section>
    </main>
  );
}
