import { mapConfig } from '../../../lib/config';
import { readFirstMessage, type ReaderErrorCode } from '../../../lib/aisstream/reader';
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

export async function GET(request: Request) {
  const attemptedAt = new Date().toISOString();
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
    const result = await readFirstMessage({
      apiKey,
      bounds: mapConfig.bounds,
      signal: request.signal,
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
      raw: result.raw,
      collectedAt: result.collectedAt.toISOString(),
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
}
