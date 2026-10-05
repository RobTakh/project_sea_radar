import { SNAPSHOT_MAX_VESSELS, SNAPSHOT_WINDOW_MS, mapConfig } from '../config';
import type { Vessel } from '../types';
import { parsePositionReport } from './parser';
import {
  createNativeSocket,
  type AisSocket,
  type SocketFactory,
} from './socket';

const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';

type Bounds = typeof mapConfig.bounds;
type TimerHandle = ReturnType<typeof setTimeout>;

type StoredVessel = {
  vessel: Vessel;
  timestampMs: number;
};

export type ReaderClock = {
  now: () => Date;
  setTimeout: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimeout: (handle: TimerHandle) => void;
};

export type SnapshotReason = 'window_elapsed' | 'limit_reached';

export type ReaderSuccess = {
  ok: true;
  vessels: Vessel[];
  collectedAt: Date;
  truncated: boolean;
  reason: SnapshotReason;
};

export type ReaderErrorCode =
  | 'connect_failed'
  | 'provider_error'
  | 'disconnected'
  | 'internal';

export type ReaderError = {
  ok: false;
  code: ReaderErrorCode;
  attemptedAt: Date;
};

export type ReaderResult = ReaderSuccess | ReaderError;

export type ReaderOptions = {
  apiKey: string;
  bounds: Bounds;
  signal?: AbortSignal;
  socketFactory?: SocketFactory;
  clock?: ReaderClock;
};

export const defaultReaderClock: ReaderClock = {
  now: () => new Date(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle),
};

const subscriptionFor = (apiKey: string, bounds: Bounds) => ({
  APIKey: apiKey,
  BoundingBoxes: [[
    [bounds.south, bounds.west],
    [bounds.north, bounds.east],
  ]],
  FilterMessageTypes: ['PositionReport'],
});

const timestampMilliseconds = (vessel: Vessel): number => Date.parse(vessel.timestamp);

export const readSnapshot = ({
  apiKey,
  bounds,
  signal,
  socketFactory = createNativeSocket,
  clock = defaultReaderClock,
}: ReaderOptions): Promise<ReaderResult> => new Promise((resolve) => {
  const vessels = new Map<string, StoredVessel>();
  let socket: AisSocket | null = null;
  let settled = false;
  let opened = false;
  let subscribed = false;
  let timer: TimerHandle | null = null;
  const unsubscribe: Array<() => void> = [];

  const cleanup = () => {
    if (timer !== null) {
      try {
        clock.clearTimeout(timer);
      } catch {
        // Continue cleanup even if the injected clock rejects clearing a timer.
      }
      timer = null;
    }

    unsubscribe.splice(0).forEach((removeListener) => {
      try {
        removeListener();
      } catch {
        // The selected result must not be replaced by listener cleanup failure.
      }
    });
    signal?.removeEventListener('abort', onAbort);

    if (socket !== null) {
      try {
        socket.close();
      } catch {
        // The selected result must not be replaced by a close failure.
      }
      socket = null;
    }
  };

  const finish = (result: ReaderResult) => {
    if (settled) return;
    settled = true;
    cleanup();
    resolve(result);
  };

  const fail = (code: ReaderErrorCode) => {
    finish({ ok: false, code, attemptedAt: clock.now() });
  };

  const success = (reason: SnapshotReason, truncated: boolean) => {
    finish({
      ok: true,
      vessels: Array.from(vessels.values(), ({ vessel }) => vessel),
      collectedAt: clock.now(),
      truncated,
      reason,
    });
  };

  const onAbort = () => {
    fail('internal');
  };

  const onOpen = () => {
    if (settled || socket === null) return;
    opened = true;

    try {
      socket.send(JSON.stringify(subscriptionFor(apiKey, bounds)));
      subscribed = true;
    } catch {
      fail('connect_failed');
    }
  };

  const onMessage = (raw: unknown) => {
    if (settled || !subscribed) return;

    try {
      const vessel = parsePositionReport(raw);
      if (vessel === null) return;

      const timestampMs = timestampMilliseconds(vessel);
      const previous = vessels.get(vessel.id);
      if (previous !== undefined) {
        if (timestampMs > previous.timestampMs) {
          vessels.set(vessel.id, { vessel, timestampMs });
        }
        return;
      }

      vessels.set(vessel.id, { vessel, timestampMs });
      if (vessels.size >= SNAPSHOT_MAX_VESSELS) {
        success('limit_reached', true);
      }
    } catch {
      fail('internal');
    }
  };

  const onError = () => {
    if (settled) return;
    fail(opened && subscribed ? 'provider_error' : 'connect_failed');
  };

  const onClose = () => {
    if (settled) return;
    fail(opened && subscribed ? 'disconnected' : 'connect_failed');
  };

  if (signal?.aborted) {
    fail('internal');
    return;
  }

  signal?.addEventListener('abort', onAbort, { once: true });
  timer = clock.setTimeout(() => {
    if (subscribed) {
      success('window_elapsed', false);
    } else {
      fail('connect_failed');
    }
  }, SNAPSHOT_WINDOW_MS);

  if (settled) return;

  try {
    socket = socketFactory(AISSTREAM_URL);
    unsubscribe.push(socket.onOpen(onOpen));
    unsubscribe.push(socket.onMessage(onMessage));
    unsubscribe.push(socket.onError(onError));
    unsubscribe.push(socket.onClose(onClose));
  } catch {
    fail('connect_failed');
  }
});

// Keep the previous reader export while its implementation now collects a snapshot.
export const readFirstMessage = readSnapshot;
