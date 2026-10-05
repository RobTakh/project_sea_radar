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

type SnapshotSuccess = {
  ok: true;
  vessels: Vessel[];
  collectedAt: string;
  windowSeconds: number;
  count: number;
  truncated: boolean;
  reason: 'window_elapsed' | 'limit_reached';
};

type SnapshotError = {
  ok: false;
  attemptedAt: string;
  error: {
    code: string;
    message: string;
  };
};

type SnapshotState =
  | { kind: 'idle-demo' }
  | { kind: 'loading' }
  | { kind: 'success'; response: SnapshotSuccess }
  | { kind: 'empty'; response: SnapshotSuccess }
  | { kind: 'error'; response: SnapshotError | null; message: string };

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isSnapshotSuccess = (value: unknown): value is SnapshotSuccess => {
  if (!isRecord(value)) return false;
  return value.ok === true
    && Array.isArray(value.vessels)
    && typeof value.collectedAt === 'string'
    && typeof value.windowSeconds === 'number'
    && typeof value.count === 'number'
    && typeof value.truncated === 'boolean'
    && (value.reason === 'window_elapsed' || value.reason === 'limit_reached');
};

const isSnapshotError = (value: unknown): value is SnapshotError => {
  if (!isRecord(value) || value.ok !== false) return false;
  if (typeof value.attemptedAt !== 'string' || !isRecord(value.error)) return false;
  return typeof value.error.code === 'string' && typeof value.error.message === 'string';
};

const formatServerTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Нет данных';
  return `${date.toISOString().slice(11, 19)} UTC`;
};

const snapshotSource = (response: SnapshotSuccess) => {
  const truncatedSuffix = response.truncated ? ' · остановлено на лимите 100' : '';
  return `AISStream · снимок за ${response.windowSeconds} с · получен ${formatServerTime(response.collectedAt)} · судов: ${response.count} · выборка неполная${truncatedSuffix}`;
};

export default function Home() {
  const [demoStates, setDemoStates] = useState<DemoState[]>(createInitialState);
  const [snapshotState, setSnapshotState] = useState<SnapshotState>({ kind: 'idle-demo' });
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [mapViewKey, setMapViewKey] = useState(0);
  const timerRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasShownRealDataRef = useRef(false);

  const stopDemoTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const vessels = snapshotState.kind === 'idle-demo'
    ? demoStates.map(({ vessel }) => vessel)
    : snapshotState.kind === 'success'
      ? snapshotState.response.vessels
      : [];
  const selectedVessel = selectedVesselId === null
    ? null
    : vessels.find((vessel) => vessel.id === selectedVesselId) ?? null;

  const selectVessel = useCallback((vessel: Vessel) => {
    setSelectedVesselId(vessel.id);
  }, []);

  const loadSnapshot = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    stopDemoTimer();
    setSelectedVesselId(null);
    setSnapshotState({ kind: 'loading' });

    try {
      const response = await fetch('/api/snapshot', { signal: controller.signal });
      const payload: unknown = await response.json();
      if (requestId !== requestIdRef.current || controller.signal.aborted) return;

      if (response.ok && isSnapshotSuccess(payload)) {
        if (payload.vessels.length === 0) {
          setSnapshotState({ kind: 'empty', response: payload });
        } else {
          if (!hasShownRealDataRef.current) {
            hasShownRealDataRef.current = true;
            setMapViewKey((key) => key + 1);
          }
          setSnapshotState({ kind: 'success', response: payload });
        }
        return;
      }

      if (isSnapshotError(payload)) {
        setSnapshotState({ kind: 'error', response: payload, message: payload.error.message });
      } else {
        setSnapshotState({ kind: 'error', response: null, message: 'Сервер вернул некорректный ответ' });
      }
    } catch {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setSnapshotState({ kind: 'error', response: null, message: 'Сервер недоступен' });
    } finally {
      if (requestId === requestIdRef.current && abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [stopDemoTimer]);

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
      stopDemoTimer();
      requestIdRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, [stopDemoTimer]);

  let sourceLabel = 'Демонстрационные данные';
  let statusMessage: string | null = null;
  let attemptedAt: string | null = null;
  if (snapshotState.kind === 'loading') {
    sourceLabel = 'Загрузка…';
  } else if (snapshotState.kind === 'success' || snapshotState.kind === 'empty') {
    sourceLabel = snapshotSource(snapshotState.response);
    if (snapshotState.kind === 'empty') {
      statusMessage = 'За время сбора позиции не получены';
    }
  } else if (snapshotState.kind === 'error') {
    sourceLabel = 'Данных на карте нет';
    statusMessage = `Не удалось получить данные: ${snapshotState.message}`;
    attemptedAt = snapshotState.response?.attemptedAt ?? null;
  }

  return (
    <main className="page">
      <header className="header">
        <h1>Sea Radar — пролив Дувр</h1>
      </header>
      <section className="map-area">
        <MapView
          key={mapViewKey}
          vessels={vessels}
          onSelect={selectVessel}
        />
        <aside className="side-panel">
          <button
            type="button"
            className="load-button"
            disabled={snapshotState.kind === 'loading'}
            onClick={() => void loadSnapshot()}
          >
            Загрузить настоящие позиции
          </button>
          <p className="source">{sourceLabel}</p>
          {statusMessage && <p className="status-message">{statusMessage}</p>}
          {attemptedAt && (
            <time className="attempted-at" dateTime={attemptedAt}>
              Попытка: {formatServerTime(attemptedAt)}
            </time>
          )}
          {selectedVessel && <VesselCard vessel={selectedVessel} />}
        </aside>
      </section>
    </main>
  );
}
