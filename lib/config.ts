export const mapConfig = {
  bounds: {
    south: 50.75,
    west: 0.95,
    north: 51.25,
    east: 1.95,
  },
  center: [51.00, 1.45] as [number, number],
  zoom: 10,
};

export const demoVessel = {
  id: 'demo-1',
  name: 'Демо-судно 1',
  lat: 51.03,
  lon: 1.52,
  speedKnots: 12,
  courseDeg: 135,
  timestamp: '2026-09-10T12:00:00Z',
  source: 'demo',
} as const;
