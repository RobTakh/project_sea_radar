export type Vessel = {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
  speedKnots: number | null;
  courseDeg: number | null;
  timestamp: string;
  source: 'demo' | 'aisstream';
};

export type RoutePoint = {
  lat: number;
  lon: number;
};

export type DemoVessel = Vessel & {
  route: readonly RoutePoint[];
};
