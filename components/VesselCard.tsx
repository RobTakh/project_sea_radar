import type { Vessel } from '../lib/types';

type VesselCardProps = {
  vessel: Vessel;
};

const formatSpeed = (speedKnots: number | null) =>
  speedKnots === null ? 'Нет данных' : `${Number(speedKnots.toFixed(1))} уз`;

const formatCourse = (courseDeg: number | null) =>
  courseDeg === null ? 'Нет данных' : `${Math.round(courseDeg) % 360}°`;

const formatTimestamp = (timestamp: string | null) => {
  if (timestamp === null) return 'Нет данных';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Нет данных';
  return `${date.toISOString().slice(11, 19)} UTC`;
};

export default function VesselCard({ vessel }: VesselCardProps) {
  return (
    <aside className="card" aria-label={`Карточка судна ${vessel.id}`}>
      <h2>Судно</h2>
      <dl>
        <dt>Идентификатор</dt>
        <dd>{vessel.id}</dd>
        <dt>Название</dt>
        <dd>{vessel.name ?? 'Нет данных'}</dd>
        <dt>Координаты</dt>
        <dd>{`${vessel.lat.toFixed(5)}, ${vessel.lon.toFixed(5)}`}</dd>
        <dt>Скорость</dt>
        <dd>{formatSpeed(vessel.speedKnots)}</dd>
        <dt>Курс</dt>
        <dd>{formatCourse(vessel.courseDeg)}</dd>
        <dt>Время</dt>
        <dd>{formatTimestamp(vessel.timestamp)}</dd>
        <dt>Источник</dt>
        <dd>{vessel.source === 'demo' ? 'Демонстрационные данные' : 'AISStream'}</dd>
      </dl>
    </aside>
  );
}
