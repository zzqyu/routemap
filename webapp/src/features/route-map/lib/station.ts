import type { RouteStation, StationOverride } from '../types';

export function buildDisplayedStations(
  stations: RouteStation[],
  stationOverrides: Record<string, StationOverride>,
  effectiveStartId: string,
  effectiveEndId: string,
) {
  const ordered = [...stations]
    .filter((station) => !station.stationName.includes('미정차'))
    .sort((a, b) => Number(a.staOrder) - Number(b.staOrder));

  const edited = ordered
    .map((station) => {
      const override = stationOverrides[String(station.stationId)];
      if (override?.omitted) return null;
      return {
        ...station,
        stationName: override?.customName?.trim() ? override.customName.trim() : station.stationName,
      };
    })
    .filter((station): station is RouteStation => station !== null);

  if (!edited.length) return [];

  const startIndex = effectiveStartId ? edited.findIndex((station) => String(station.stationId) === effectiveStartId) : -1;
  const endIndex = effectiveEndId ? edited.findIndex((station) => String(station.stationId) === effectiveEndId) : -1;
  const from = startIndex >= 0 ? startIndex : 0;
  const to = endIndex >= 0 ? endIndex : edited.length - 1;
  const left = Math.min(from, to);
  const right = Math.max(from, to);
  return edited.slice(left, right + 1);
}

