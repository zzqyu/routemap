import type { Direction, RouteDetailResponse } from '../types';

export function formatTerminal(route: RouteDetailResponse['route'], direction: Direction) {
  if (direction === '하행') {
    return `${route.endStationName ?? ''} - ${route.startStationName ?? ''}`;
  }
  return `${route.startStationName ?? ''} - ${route.endStationName ?? ''}`;
}

export function getEndpointIds(route: RouteDetailResponse['route'], direction: Direction) {
  if (direction === '하행') {
    return {
      startId: String(route.endStationId ?? ''),
      endId: String(route.startStationId ?? ''),
    };
  }
  return {
    startId: String(route.startStationId ?? ''),
    endId: String(route.endStationId ?? ''),
  };
}

