import { SNAPSHOT_WINDOW_MS, mapConfig } from '../../../lib/config';
import {
  defaultReaderClock,
  readSnapshot,
  type ReaderClock,
  type ReaderErrorCode,
  type ReaderOptions,
  type ReaderResult,
} from '../../../lib/aisstream/reader';
import { getAisstreamApiKey } from '../../../lib/server/aisstream-key';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ERROR_MESSAGES: Record<ReaderErrorCode | 'no_api_key', string> = {
  no_api_key: 'Ключ AISStream не настроен',
  connect_failed: 'Не удалось подключиться к источнику',
  provider_error: 'Источник вернул ошибку',
  disconnected: 'Соединение с источником разорвано',
  internal: 'Внутренняя ошибка сервера',
};

type SnapshotReader = (options: ReaderOptions) => Promise<ReaderResult>;

type SnapshotHandlerOptions = {
  clock?: ReaderClock;
  reader?: SnapshotReader;
};

const createSnapshotHandler = ({
  clock = defaultReaderClock,
  reader = readSnapshot,
}: SnapshotHandlerOptions = {}) => async (request: Request) => {
  const attemptedAt = clock.now().toISOString();
  const apiKey = getAisstreamApiKey();

  if (apiKey === null) {
    return Response.json({
      ok: false,
      attemptedAt,
      error: {
        code: 'no_api_key',
        message: ERROR_MESSAGES.no_api_key,
      },
    }, { status: 502 });
  }

  try {
    const result = await reader({
      apiKey,
      bounds: mapConfig.bounds,
      signal: request.signal,
      clock,
    });

    if (!result.ok) {
      return Response.json({
        ok: false,
        attemptedAt,
        error: {
          code: result.code,
          message: ERROR_MESSAGES[result.code],
        },
      }, { status: 502 });
    }

    return Response.json({
      ok: true,
      vessels: result.vessels,
      collectedAt: result.collectedAt.toISOString(),
      windowSeconds: SNAPSHOT_WINDOW_MS / 1000,
      count: result.vessels.length,
      truncated: result.truncated,
      reason: result.reason,
    });
  } catch {
    return Response.json({
      ok: false,
      attemptedAt,
      error: {
        code: 'internal',
        message: ERROR_MESSAGES.internal,
      },
    }, { status: 502 });
  }
};

export async function GET(request: Request) {
  return createSnapshotHandler()(request);
}
