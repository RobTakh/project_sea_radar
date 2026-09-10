'use client';

import { useCallback, useState } from 'react';
import MapView from '../components/ClientMap';
import VesselCard from '../components/VesselCard';
import { demoVessel } from '../lib/config';
import type { Vessel } from '../lib/types';

const vessel: Vessel = demoVessel;

export default function Home() {
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const selectVessel = useCallback((nextVessel: Vessel) => {
    setSelectedVessel(nextVessel);
  }, []);

  return (
    <main className="page">
      <header className="header">
        <h1>Sea Radar — пролив Дувр</h1>
      </header>
      <section className="map-area">
        <MapView vessel={vessel} onSelect={selectVessel} />
        <aside className="side-panel">
          <p className="source">Демонстрационные данные</p>
          {selectedVessel && <VesselCard vessel={selectedVessel} />}
        </aside>
      </section>
    </main>
  );
}
