import type { Vessel } from '../types';

type PositionReportMessage = {
  MetaData?: {
    MMSI?: unknown;
    ShipName?: unknown;
    time_utc?: unknown;
  };
  Message?: {
    PositionReport?: {
      Latitude?: unknown;
      Longitude?: unknown;
      Sog?: unknown;
      Cog?: unknown;
    };
  };
};

const POSITION_REPORT_TIME = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{1,9}) ([+-])(\d{2})(\d{2}) UTC$/;

const parsePositionReportTime = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;

  const match = POSITION_REPORT_TIME.exec(value);
  if (!match) return null;

  const [
    , yearText, monthText, dayText, hourText, minuteText, secondText,
    fractionText, offsetSign, offsetHourText, offsetMinuteText,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const milliseconds = Number(fractionText.slice(0, 3).padEnd(3, '0'));
  const offsetHour = Number(offsetHourText);
  const offsetMinute = Number(offsetMinuteText);
  if (offsetHour > 23 || offsetMinute > 59) return null;

  const offsetMinutes = offsetHour * 60 + offsetMinute;
  const offset = offsetSign === '+' ? offsetMinutes : -offsetMinutes;
  const localTime = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    milliseconds,
  );
  const localDate = new Date(localTime);
  if (
    Number.isNaN(localDate.getTime())
    || localDate.getUTCFullYear() !== year
    || localDate.getUTCMonth() !== month - 1
    || localDate.getUTCDate() !== day
    || localDate.getUTCHours() !== hour
    || localDate.getUTCMinutes() !== minute
    || localDate.getUTCSeconds() !== second
    || localDate.getUTCMilliseconds() !== milliseconds
  ) {
    return null;
  }

  return new Date(localTime - offset * 60_000).toISOString();
};

const finiteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const parseId = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const id = value.trim();
    return id === '' ? null : id;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const parseName = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name === '' ? null : name;
};

const parseSpeed = (value: unknown): number | null => {
  const speed = finiteNumber(value);
  return speed !== null && speed >= 0 && speed <= 102.2 ? speed : null;
};

const parseCourse = (value: unknown): number | null => {
  const course = finiteNumber(value);
  return course !== null && course >= 0 && course < 360 ? course : null;
};

const parseMessage = (value: unknown): PositionReportMessage | null => {
  if (typeof value === 'string') {
    try {
      return parseMessage(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (typeof value !== 'object' || value === null) return null;
  return value as PositionReportMessage;
};

export const parsePositionReport = (value: unknown): Vessel | null => {
  const message = parseMessage(value);
  const metadata = message?.MetaData;
  const position = message?.Message?.PositionReport;
  if (!metadata || !position) return null;

  const id = parseId(metadata.MMSI);
  const timestamp = parsePositionReportTime(metadata.time_utc);
  const lat = finiteNumber(position.Latitude);
  const lon = finiteNumber(position.Longitude);

  if (
    id === null
    || timestamp === null
    || lat === null
    || lon === null
    || lat < -90
    || lat > 90
    || lon < -180
    || lon > 180
  ) {
    return null;
  }

  return {
    id,
    name: parseName(metadata.ShipName),
    lat,
    lon,
    speedKnots: parseSpeed(position.Sog),
    courseDeg: parseCourse(position.Cog),
    timestamp,
    source: 'aisstream',
  };
};
