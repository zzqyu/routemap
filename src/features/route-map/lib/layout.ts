import { headerHeight, minCanvasHeight } from '../constants';
import { getEndpointIds } from './route';
import type { Direction, LayoutOverride, RouteDetailResponse, RouteStation, StationOverride, StationPoint } from '../types';

export function buildLayout(
  stations: RouteStation[],
  route: RouteDetailResponse['route'] | null,
  direction: Direction,
  layoutOverride: LayoutOverride,
  endpointOverride: { startId?: string; endId?: string },
  stationOverrides: Record<string, StationOverride>,
) {
  const orderedStations = [...stations]
    .filter((station) => !station.stationName.includes('미정차'))
    .sort((a, b) => Number(a.staOrder) - Number(b.staOrder));
  const withEndpoint = [...orderedStations];
  const baseEndpoints = route ? getEndpointIds(route, direction) : { startId: '', endId: '' };
  const endpoints = {
    startId: endpointOverride.startId || baseEndpoints.startId,
    endId: endpointOverride.endId || baseEndpoints.endId,
  };
  const terminalId = endpoints.endId;
  const terminalName = direction === '하행' ? String(route?.startStationName ?? '') : String(route?.endStationName ?? '');
  if (route && terminalId && !withEndpoint.some((station) => String(station.stationId) === terminalId)) {
    const last = withEndpoint[withEndpoint.length - 1];
    withEndpoint.push({
      routeId: String(route.routeId ?? last?.routeId ?? ''),
      routeName: String(route.routeName ?? last?.routeName ?? ''),
      upDown: direction,
      staOrder: Number(last?.staOrder ?? withEndpoint.length) + 1,
      stationId: terminalId,
      stationName: terminalName,
      x: Number(last?.x ?? 0),
      y: Number(last?.y ?? 0),
    });
  }
  const targetStationsPerRow = withEndpoint.length <= 20 ? Math.max(withEndpoint.length, 1) : 22;
  const rowCount = Math.max(1, Math.ceil(withEndpoint.length / targetStationsPerRow));
  const baseStationsPerRow = Math.ceil(withEndpoint.length / rowCount);
  const height = Math.max(minCanvasHeight, headerHeight + rowCount * layoutOverride.rowHeight + 34);
  const rowSizes = Array.from({ length: rowCount }, (_, rowIndex) => {
    const remaining = withEndpoint.length - rowIndex * baseStationsPerRow;
    return Math.min(baseStationsPerRow, Math.max(remaining, 0));
  });
  const points: StationPoint[] = withEndpoint.map((station, index) => {
    let row = 0;
    let rowStartIndex = 0;
    while (row < rowSizes.length - 1 && index >= rowStartIndex + rowSizes[row]) {
      rowStartIndex += rowSizes[row];
      row += 1;
    }
    const itemsInRow = rowSizes[row];
    const rowIndex = index - rowStartIndex;
    const progress = itemsInRow <= 1 ? 0 : rowIndex / (itemsInRow - 1);
    const isLeftToRight = row % 2 === 0;
    const rowStartX = isLeftToRight ? layoutOverride.lineStartX : layoutOverride.lineEndX;
    const rowEndX = isLeftToRight ? layoutOverride.lineEndX : layoutOverride.lineStartX;
    const rowHasPrevTurn = row > 0;
    const rowHasNextTurn = row < rowCount - 1;
    const rowVisualStart = rowHasPrevTurn
      ? (isLeftToRight ? layoutOverride.lineStartX + layoutOverride.cornerStationGap : layoutOverride.lineEndX - layoutOverride.cornerStationGap)
      : rowStartX;
    const rowVisualEnd = rowHasNextTurn
      ? (isLeftToRight ? layoutOverride.lineEndX - layoutOverride.cornerStationGap : layoutOverride.lineStartX + layoutOverride.cornerStationGap)
      : rowEndX;
    const rowLeft = Math.min(rowVisualStart, rowVisualEnd);
    const rowRight = Math.max(rowVisualStart, rowVisualEnd);
    const rowUsableWidth = rowRight - rowLeft;
    let xPos = isLeftToRight ? rowLeft + rowUsableWidth * progress : rowRight - rowUsableWidth * progress;
    const yPos = headerHeight + 35 + row * layoutOverride.rowHeight;
    const isStart = index === 0;
    const isEnd = index === withEndpoint.length - 1;

    if (isStart) xPos = rowStartX;
    if (isEnd) xPos = rowEndX;

    return {
      ...station,
      xPos,
      yPos,
      row,
      rowIndex,
      isStart,
      isEnd,
    };
  });

  const adjustedPoints = points.map((point) => ({ ...point }));

  for (let row = 0; row < rowCount; row += 1) {
    const rowPoints = adjustedPoints
      .map((point, idx) => ({ point, idx }))
      .filter(({ point }) => point.row === row)
      .sort((a, b) => a.point.rowIndex - b.point.rowIndex);

    if (rowPoints.length <= 2) continue;

    const first = rowPoints[0].point;
    const last = rowPoints[rowPoints.length - 1].point;
    const span = Math.abs(last.xPos - first.xPos);
    const segments = rowPoints.length - 1;
    if (span <= 0 || segments <= 0) continue;

    const baseDist = span / segments;
    const desiredDists = Array.from({ length: segments }, (_, i) => {
      const leftStation = rowPoints[i].point;
      const gap = Number(stationOverrides[String(leftStation.stationId)]?.segmentGap ?? 0);
      const extra = Number.isFinite(gap) ? Math.min(80, Math.max(0, gap)) : 0;
      return baseDist + extra;
    });

    const desiredTotal = desiredDists.reduce((acc, value) => acc + value, 0);
    const scale = desiredTotal > 0 ? span / desiredTotal : 1;
    const finalDists = desiredDists.map((value) => value * scale);

    const isLeftToRight = first.xPos <= last.xPos;
    let cursor = first.xPos;
    for (let i = 1; i < rowPoints.length - 1; i += 1) {
      cursor += isLeftToRight ? finalDists[i - 1] : -finalDists[i - 1];
      adjustedPoints[rowPoints[i].idx].xPos = cursor;
    }
  }

  return { points: adjustedPoints, height, rowCount, stationsPerRow: baseStationsPerRow };
}

export function buildRoutePath(points: StationPoint[], rowCount: number, layoutOverride: LayoutOverride) {
  if (points.length === 0) return '';
  let path = '';

  for (let row = 0; row < rowCount; row += 1) {
    const rowPoints = points.filter((point) => point.row === row);
    if (rowPoints.length === 0) continue;
    const first = rowPoints[0];
    const isLeftToRight = row % 2 === 0;
    const rowStartX = isLeftToRight ? layoutOverride.lineStartX : layoutOverride.lineEndX;
    const rowEndX = isLeftToRight ? layoutOverride.lineEndX : layoutOverride.lineStartX;
    const hasNextTurn = row < rowCount - 1;
    const edgeX = isLeftToRight ? layoutOverride.lineEndX : layoutOverride.lineStartX;
    const innerX = isLeftToRight ? edgeX - layoutOverride.turnRadius : edgeX + layoutOverride.turnRadius;
    const straightEndX = hasNextTurn ? innerX : rowEndX;

    if (row === 0) path += `M ${rowStartX} ${first.yPos}`;
    path += ` L ${straightEndX} ${first.yPos}`;

    const nextFirst = points.find((point) => point.row === row + 1 && point.rowIndex === 0);
    if (!nextFirst) continue;

    path += ` Q ${edgeX} ${first.yPos} ${edgeX} ${first.yPos + layoutOverride.turnRadius}`;
    path += ` L ${edgeX} ${nextFirst.yPos - layoutOverride.turnRadius}`;
    path += ` Q ${edgeX} ${nextFirst.yPos} ${innerX} ${nextFirst.yPos}`;
  }
  return path;
}

