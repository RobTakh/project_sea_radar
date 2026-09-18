import type { mapConfig } from '../config';
import {
  createNativeSocket,
  type AisSocket,
  type SocketFactory,
} from './socket';

const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';
const DEFAULT_TIMEOUT_MS = 15_000;

type Bounds = typeof mapConfig.bounds;

type TimerHandle = ReturnType<typeof setTimeout>;

export type ReaderClock = {
  now: () => Date;
  setTimeout: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimeout: (handle: TimerHandle) => void;
};

export type ReaderSuccess = {
  ok: true;
  raw: unknown | null;
  collectedAt: Date;
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
  timeoutMs?: number;
};

const systemClock: ReaderClock = {
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

export const readFirstMessage = ({
  apiKey,
  bounds,
  signal,
  socketFactory = createNativeSocket,
  clock = systemClock,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ReaderOptions): Promise<ReaderResult> => new Promise((resolve) => {
  let socket: AisSocket | null = null;
  let settled = false;
  let opened = false;
  let subscribed = false;
  let timer: TimerHandle | null = null;
  const unsubscribe: Array<() => void> = [];

  const cleanup = () => {
    if (timer !== null) {
      clock.clearTimeout(timer);
      timer = null;
    }

    unsubscribe.splice(0).forEach((removeListener) => removeListener());
    signal?.removeEventListener('abort', onAbort);

    if (socket !== null) {
      try {
        socket.close();
      } catch {
        // The requested outcome must not be replaced by a close failure.
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
    finish({ ok: true, raw, collectedAt: clock.now() });
  };

  const onError = () => {
    if (settled) return;
    fail(opened && subscribed ? 'provider_error' : 'connect_failed');
  };

  const onClose = () => {
    if (settled) return;
    fail(opened && subscribed ? 'disconnected' : 'connect_failed');
  };

  signal?.addEventListener('abort', onAbort, { once: true });
  timer = clock.setTimeout(() => {
    if (subscribed) {
      finish({ ok: true, raw: null, collectedAt: clock.now() });
    } else {
      fail('connect_failed');
    }
  }, timeoutMs);

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
