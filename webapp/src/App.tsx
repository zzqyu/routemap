import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

type Direction = '상행' | '하행';
type ThemeName = 'teal' | 'red' | 'yellow' | 'gyeonggi-blue';

type RouteSummary = {
  routeId: string;
  routeName: string;
  startStationName: string;
  endStationName: string;
  regionName: string;
  companyName: string;
  routeTypeCd: string;
};

type RouteStation = {
  routeId: string;
  routeName: string;
  upDown: Direction;
  staOrder: number;
  stationId: string;
  stationName: string;
  x: number;
  y: number;
};

type ScheduleRow = {
  label: string;
  firstTime: string;
  lastTime: string;
  intervalText: string;
};

type RouteDetailResponse = {
  route: RouteSummary & Record<string, string | number | null>;
  direction: Direction;
  availableDirections: Array<{ upDown: Direction; count: number }>;
  scheduleRows: ScheduleRow[];
  stations: RouteStation[];
};

type Theme = {
  label: string;
  lineColor: string;
  routeNumberColor: string;
  markerFillColor: string;
  markerStrokeColor: string;
  headerAccentColor: string;
};

type StationPoint = RouteStation & {
  xPos: number;
  yPos: number;
  row: number;
  rowIndex: number;
  isStart: boolean;
  isEnd: boolean;
};

type StationListItem = {
  stationId: string;
  stationName: string;
  directions: Direction[];
  minOrder: number;
  isCustom?: boolean;
};

function buildDisplayedStations(
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

type StationPointMode = 'normal' | 'emphasis' | 'intercityTransfer' | 'subwayTransfer';

type StationRole = 'normal' | 'start' | 'end';

type StationOverride = {
  customName: string;
  omitted: boolean;
  role: StationRole;
  pointMode: StationPointMode;
  subwayColor?: string;
  subwayLabelText?: string;
  connectedToStationId?: string;
  connectorAnchor?: 'center' | 'left' | 'right';
  segmentLabel?: string;
  segmentGap?: number;
};

type LayoutOverride = {
  labelAngle: number;
  rowHeight: number;
  lineStrokeWidth: number;
  terminalMarkerRadius: number;
  lineStartX: number;
  lineEndX: number;
  turnRadius: number;
  cornerStationGap: number;
};

const apiBase = 'http://localhost:5174/api';
const canvasWidth = 500;
const minCanvasHeight = 180;
const topPadding = 0;
const headerHeight = 72;
const rowHeight = 60;
const leftPad = 20;
const rightPad = 20;
const turnRadius = 14;
const routeLineStrokeWidth = 3.2;
const lineStartX = leftPad;
const lineEndX = canvasWidth - rightPad;

const defaultLayoutOverride: LayoutOverride = {
  labelAngle: -52,
  rowHeight,
  lineStrokeWidth: routeLineStrokeWidth,
  terminalMarkerRadius: 3.6,
  lineStartX,
  lineEndX,
  turnRadius,
  cornerStationGap: turnRadius,
};

const themes: Record<ThemeName, Theme> = {
  teal: {
    label: '초록 · Pantone 334 C',
    lineColor: '#009775',
    routeNumberColor: '#009775',
    markerFillColor: '#ffffff',
    markerStrokeColor: '#009775',
    headerAccentColor: '#009775',
  },
  red: {
    label: '빨간색 · Pantone 1788 C',
    lineColor: '#EE2737',
    routeNumberColor: '#EE2737',
    markerFillColor: '#ffffff',
    markerStrokeColor: '#EE2737',
    headerAccentColor: '#EE2737',
  },
  yellow: {
    label: '노란색 · Pantone 130 C',
    lineColor: '#F2A900',
    routeNumberColor: '#F2A900',
    markerFillColor: '#ffffff',
    markerStrokeColor: '#F2A900',
    headerAccentColor: '#F2A900',
  },
  'gyeonggi-blue': {
    label: '파란색 · Pantone Process Blue C',
    lineColor: '#0085CA',
    routeNumberColor: '#0085CA',
    markerFillColor: '#ffffff',
    markerStrokeColor: '#0085CA',
    headerAccentColor: '#0085CA',
  },
};

function formatTerminal(route: RouteDetailResponse['route'], direction: Direction) {
  if (direction === '하행') {
    return `${route.endStationName ?? ''} - ${route.startStationName ?? ''}`;
  }
  return `${route.startStationName ?? ''} - ${route.endStationName ?? ''}`;
}

function getEndpointIds(route: RouteDetailResponse['route'], direction: Direction) {
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

function buildLayout(
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

  // 선택 정류장과 다음 정류장 사이 간격 확장
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

function buildRoutePath(points: StationPoint[], rowCount: number, layoutOverride: LayoutOverride) {
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

function getLabelMetrics(lineCount: number, fontSize: number) {
  const lineHeight = fontSize * 1.12;
  const blockHeight = lineCount === 1 ? fontSize : fontSize + lineHeight * (lineCount - 1);
  const baselineOffset = Math.max(0, blockHeight - fontSize) / 2;
  return { lineHeight, baselineOffset };
}

function splitStationName(name: string) {
  if (name.length <= 8) return { lines: [name], fontSize: 5.5 };
  const cleanName = name.replace(/\s+/g, ' ').trim();
  const breakMatch = [...cleanName.matchAll(/[.·\s]/g)]
    .map((match) => match.index ?? 0)
    .filter((index) => index > 1 && index < cleanName.length - 2)
    .sort((a, b) => Math.abs(cleanName.length / 2 - a) - Math.abs(cleanName.length / 2 - b))[0];

  if (breakMatch) {
    const first = cleanName.slice(0, breakMatch + 1).trim();
    const second = cleanName.slice(breakMatch + 1).trim();
    return { lines: [first, second], fontSize: cleanName.length > 18 ? 4.2 : 4.8 };
  }

  if (cleanName.length <= 12) {
    return { lines: [cleanName.slice(0, 6), cleanName.slice(6)], fontSize: 5.1 };
  }
  const breakPoint = Math.ceil(cleanName.length / 2);
  return { lines: [cleanName.slice(0, breakPoint), cleanName.slice(breakPoint)], fontSize: cleanName.length > 18 ? 4.2 : 4.7 };
}

function RouteMapPreview({
  detail,
  theme,
  sourceStations,
  layoutOverride,
  stationOverrides,
  effectiveStartId,
  effectiveEndId,
  connectorTargetId,
  selectedStationId,
  onSelectStation,
  svgRef,
}: {
  detail: RouteDetailResponse | null;
  theme: Theme;
  sourceStations: RouteStation[];
  layoutOverride: LayoutOverride;
  stationOverrides: Record<string, StationOverride>;
  effectiveStartId: string;
  effectiveEndId: string;
  connectorTargetId: string;
  selectedStationId: string;
  onSelectStation: (stationId: string) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
}) {
  const editedStations = useMemo(() => {
    return buildDisplayedStations(sourceStations, stationOverrides, effectiveStartId, effectiveEndId);
  }, [sourceStations, stationOverrides, effectiveStartId, effectiveEndId]);

  const endpointOverride = useMemo(
    () => ({ startId: effectiveStartId, endId: effectiveEndId }),
    [effectiveStartId, effectiveEndId],
  );

  const layout = useMemo(
    () =>
      buildLayout(
        editedStations,
        detail?.route ?? null,
        detail?.direction ?? '상행',
        layoutOverride,
        endpointOverride,
        stationOverrides,
      ),
    [detail?.route, detail?.direction, editedStations, layoutOverride, endpointOverride, stationOverrides],
  );
  const routePath = useMemo(
    () => buildRoutePath(layout.points, layout.rowCount, layoutOverride),
    [layout.points, layout.rowCount, layoutOverride],
  );
  const connectorArrowSize = Math.max(4, layoutOverride.lineStrokeWidth * 2.2);
  const connectorPath = useMemo(() => {
    if (!connectorTargetId) return '';
    const endPoint = layout.points.find((point) => String(point.stationId) === effectiveEndId);
    const targetPoint = layout.points.find((point) => String(point.stationId) === connectorTargetId);
    if (!endPoint || !targetPoint || endPoint.stationId === targetPoint.stationId) return '';

    const midY = Math.max(endPoint.yPos, targetPoint.yPos) + Math.max(18, layoutOverride.turnRadius + 6);
    const connectorGap = Math.max(7, layoutOverride.terminalMarkerRadius + 4);
    const targetJoinY = targetPoint.yPos + connectorGap;
    const anchor = stationOverrides[effectiveEndId]?.connectorAnchor ?? 'center';
    const xOffset = anchor === 'left' ? -7 : anchor === 'right' ? 7 : 0;
    const targetJoinX = targetPoint.xPos + xOffset;
    return `M ${endPoint.xPos} ${endPoint.yPos} L ${endPoint.xPos} ${midY} L ${targetJoinX} ${midY} L ${targetJoinX} ${targetJoinY}`;
  }, [layout.points, effectiveEndId, connectorTargetId, layoutOverride.turnRadius, layoutOverride.terminalMarkerRadius, stationOverrides]);
  const routeName = detail?.route.routeName ?? '노선';
  const terminal = detail ? formatTerminal(detail.route, detail.direction) : '출발지 - 목적지';

  return (
    <svg
      ref={svgRef}
      className="route-map"
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${canvasWidth} ${layout.height}`}
      role="img"
      aria-label={`${routeName} 노선안내도`}
    >
      <defs>
        <marker
          id="connector-arrow"
          markerWidth={connectorArrowSize}
          markerHeight={connectorArrowSize}
          refX={connectorArrowSize - 3}
          refY={connectorArrowSize / 2}
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path
            d={`M 0 0 L ${connectorArrowSize} ${connectorArrowSize / 2} L 0 ${connectorArrowSize} z`}
            fill={theme.lineColor}
          />
        </marker>
      </defs>
      <rect x="0" y="0" width={canvasWidth} height={layout.height} fill="#fff" />
      <path d={`M 180 ${topPadding} H 320 Q 250 ${topPadding + 27} 180 ${topPadding}`} fill={theme.headerAccentColor} opacity="0.95" />
      <text x="14" y={topPadding + 21} fontSize="10" fontWeight="800" fill={theme.routeNumberColor}>
        {terminal}
      </text>
      <text x="14" y={topPadding + 35} fontSize="4.8" fontWeight="700" fill="#111">
        {detail ? `운송회사: ${detail.route.companyName ?? '-'} / 문의: ${detail.route.companyTel ?? '-'}` : '노선을 선택하세요'}
      </text>
      {detail?.scheduleRows.map((row, index) => (
        <text key={row.label} x="14" y={topPadding + 41 + index * 6} fontSize="4.8" fontWeight="700" fill="#111">
          {(() => {
            const [startFirst = '-', endFirst = '-'] = String(row.firstTime ?? '-|-').split('|');
            const [startLast = '-', endLast = '-'] = String(row.lastTime ?? '-|-').split('|');
            return `${row.label} 기점 ${startFirst}~${startLast} 종점 ${endFirst}~${endLast} 배차 ${row.intervalText}`;
          })()}
        </text>
      ))}

      <g transform={`translate(250 ${topPadding + 36})`}>
        <image
          href="/G_BUS_Logo.svg.png"
          x={-74}
          y={-8}
          width={80}
          height={16}
          preserveAspectRatio="xMidYMid meet"
        />
        <text x={-4} y={1} textAnchor="start" fontSize="13.5" fontWeight="900" fill="#111" dominantBaseline="middle">
          노선안내도
        </text>
      </g>
      <text x={canvasWidth - rightPad} y={topPadding + 42} textAnchor="end" fontSize="34" fontWeight="900" fill={theme.routeNumberColor}>
        {routeName}
      </text>

      {routePath && (
        <path d={routePath} fill="none" stroke={theme.lineColor} strokeWidth={layoutOverride.lineStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      )}

      {connectorPath && (
        <path
          d={connectorPath}
          fill="none"
          stroke={theme.lineColor}
          strokeWidth={Math.max(2, layoutOverride.lineStrokeWidth - 0.6)}
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd="url(#connector-arrow)"
        />
      )}

      {layout.points.map((point) => {
        const markerRadius = 2.3;
        const label = splitStationName(point.stationName);
        const isTerminal = point.isStart || point.isEnd;
        const override = stationOverrides[String(point.stationId)];
        const pointMode = override?.pointMode ?? (isTerminal ? 'emphasis' : 'normal');
        const isEmphasis = pointMode === 'emphasis';
        const labelWeight = isEmphasis ? 900 : 700;
        const labelSize = isEmphasis ? Math.min(6.4, label.fontSize + 0.7) : label.fontSize;
        const { lineHeight, baselineOffset } = getLabelMetrics(label.lines.length, labelSize);
        const labelX = point.xPos - 3;
        const labelY = point.yPos - 5 - baselineOffset;
        const subwayColor = override?.subwayColor ?? '#a855f7';
        const subwayLabel = (override?.subwayLabelText ?? '지').slice(0, 2);
        const isSelected = selectedStationId === String(point.stationId);
        return (
          <g key={`${point.stationId}-${point.staOrder}`} onClick={() => onSelectStation(String(point.stationId))} style={{ cursor: 'pointer' }}>
            {pointMode === 'intercityTransfer' ? (
              <g>
                <rect
                  x={point.xPos - 4.2}
                  y={point.yPos - 4.2}
                  width={8.4}
                  height={8.4}
                  rx={1.8}
                  fill="#0ea5e9"
                  stroke={isSelected ? '#111827' : '#0369a1'}
                  strokeWidth={isSelected ? '1.6' : '1.1'}
                />
                <text x={point.xPos} y={point.yPos + 1.6} textAnchor="middle" fontSize="4" fontWeight="900" fill="#fff">
                  B
                </text>
              </g>
            ) : pointMode === 'subwayTransfer' ? (
              <g>
                <circle
                  cx={point.xPos}
                  cy={point.yPos}
                  r={4.2}
                  fill={subwayColor}
                  stroke={isSelected ? '#111827' : '#ffffff'}
                  strokeWidth={isSelected ? '1.6' : '1.2'}
                />
                <text x={point.xPos} y={point.yPos + 1.5} textAnchor="middle" fontSize="3.8" fontWeight="900" fill="#fff">
                  {subwayLabel}
                </text>
              </g>
            ) : (
              <circle
                cx={point.xPos}
                cy={point.yPos}
                r={isEmphasis ? layoutOverride.terminalMarkerRadius : markerRadius}
                fill={isEmphasis ? theme.lineColor : theme.markerFillColor}
                stroke={isSelected ? '#111827' : isEmphasis ? '#fff' : theme.markerStrokeColor}
                strokeWidth={isSelected ? '1.8' : '1.2'}
              />
            )}
            <text
              x={labelX}
              y={labelY}
              transform={`rotate(${layoutOverride.labelAngle} ${labelX} ${labelY})`}
              textAnchor="start"
              fontSize={labelSize}
              fontWeight={labelWeight}
              fill="#111"
            >
              {label.lines.map((line, index) => (
                <tspan key={`${point.stationId}-line-${index}`} x={labelX} dy={index === 0 ? 0 : lineHeight}>
                  {line}
                </tspan>
              ))}
            </text>
            {(pointMode === 'subwayTransfer' || pointMode === 'intercityTransfer') && (
              <text x={point.xPos + 5} y={point.yPos - 8} fontSize="4.2" fontWeight="900" fill="#374151">
                {pointMode === 'subwayTransfer' ? '지하철 환승' : '광역 환승'}
              </text>
            )}
          </g>
        );
      })}

      {layout.points.map((point, index) => {
        const next = layout.points[index + 1];
        if (!next || next.row !== point.row) return null;
        const label = stationOverrides[String(point.stationId)]?.segmentLabel?.trim();
        if (!label) return null;
        const midX = (point.xPos + next.xPos) / 2;
        const textY = Math.min(point.yPos, next.yPos) - 8;
        return (
          <text key={`segment-label-${point.stationId}-${next.stationId}`} x={midX} y={textY} textAnchor="middle" fontSize="4.4" fontWeight="800" fill="#374151">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

function App() {
  const [query, setQuery] = useState('300');
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const direction: Direction = '상행';
  const [themeName, setThemeName] = useState<ThemeName>('teal');
  const [layoutOverride, setLayoutOverride] = useState<LayoutOverride>(defaultLayoutOverride);
  const [stationOverrides, setStationOverrides] = useState<Record<string, StationOverride>>({});
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [stationCatalog, setStationCatalog] = useState<StationListItem[]>([]);
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [newStationName, setNewStationName] = useState('');
  const [detail, setDetail] = useState<RouteDetailResponse | null>(null);
  const [message, setMessage] = useState('');
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/routes?q=${encodeURIComponent(query)}&limit=40`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data: RouteSummary[]) => {
        setRoutes(data);
        if (!selectedRouteId && data[0]) setSelectedRouteId(String(data[0].routeId));
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setMessage(`노선 검색 실패: ${error.message}`);
      });
    return () => controller.abort();
  }, [query, selectedRouteId]);

  useEffect(() => {
    if (!selectedRouteId) return;
    fetch(`${apiBase}/routes/${selectedRouteId}?direction=${encodeURIComponent(direction)}`)
      .then((res) => res.json())
      .then((data: RouteDetailResponse) => {
        setDetail(data);
        const firstId = data.stations[0] ? String(data.stations[0].stationId) : '';
        setSelectedStationId(firstId);
        setStationOverrides({});
        setMessage(data.stations.length ? '' : `${direction} 정류장 데이터가 없습니다.`);
      })
      .catch((error) => setMessage(`노선 상세 조회 실패: ${error.message}`));
  }, [selectedRouteId]);

  useEffect(() => {
    let cancelled = false;

    fetch('/G_BUS_Logo.svg.png')
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (!blob) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          if (cancelled) return;
          if (typeof reader.result === 'string') {
            setLogoDataUrl(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => {
        if (!cancelled) setLogoDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedRouteId) return;

    Promise.all(
      (['상행', '하행'] as const).map((dir) =>
        fetch(`${apiBase}/routes/${selectedRouteId}?direction=${encodeURIComponent(dir)}`)
          .then((res) => res.json() as Promise<RouteDetailResponse>)
          .catch(() => null),
      ),
    ).then((responses) => {
      const byId = new Map<string, StationListItem>();
      responses.forEach((response, idx) => {
        if (!response?.stations) return;
        const dir = idx === 0 ? '상행' : '하행';
        response.stations.forEach((station) => {
          const id = String(station.stationId);
          const current = byId.get(id);
          if (!current) {
            byId.set(id, {
              stationId: id,
              stationName: station.stationName,
              directions: [dir],
              minOrder: Number(station.staOrder),
            });
            return;
          }
          current.minOrder = Math.min(current.minOrder, Number(station.staOrder));
          if (!current.directions.includes(dir)) current.directions.push(dir);
        });
      });

      const merged = [...byId.values()].sort((a, b) => a.minOrder - b.minOrder || a.stationName.localeCompare(b.stationName));
      setStationCatalog(merged.map((station, index) => ({ ...station, minOrder: index + 1 })));
      setSelectedStationId((prev) => (prev && byId.has(prev) ? prev : merged[0]?.stationId ?? ''));
    });
  }, [selectedRouteId]);

  const theme = themes[themeName];
  const baseEndpoints = detail?.route ? getEndpointIds(detail.route, direction) : { startId: '', endId: '' };
  const overrideStartId = Object.entries(stationOverrides).find(([, value]) => value.role === 'start')?.[0] ?? '';
  const overrideEndId = Object.entries(stationOverrides).find(([, value]) => value.role === 'end')?.[0] ?? '';
  const effectiveStartId = overrideStartId || baseEndpoints.startId;
  const effectiveEndId = overrideEndId || baseEndpoints.endId;

  const selectedOverride = selectedStationId
    ? {
        customName: stationOverrides[selectedStationId]?.customName ?? '',
        omitted: stationOverrides[selectedStationId]?.omitted ?? false,
        role:
          stationOverrides[selectedStationId]?.role ??
          (selectedStationId === effectiveStartId ? 'start' : selectedStationId === effectiveEndId ? 'end' : 'normal'),
        pointMode:
          stationOverrides[selectedStationId]?.pointMode ??
          (selectedStationId === effectiveStartId || selectedStationId === effectiveEndId ? 'emphasis' : 'normal'),
        subwayColor: stationOverrides[selectedStationId]?.subwayColor ?? '#a855f7',
        subwayLabelText: stationOverrides[selectedStationId]?.subwayLabelText ?? '지',
        connectedToStationId: stationOverrides[selectedStationId]?.connectedToStationId ?? '',
        connectorAnchor: stationOverrides[selectedStationId]?.connectorAnchor ?? 'center',
        segmentLabel: stationOverrides[selectedStationId]?.segmentLabel ?? '',
        segmentGap: stationOverrides[selectedStationId]?.segmentGap ?? 0,
      }
    : {
        customName: '',
        omitted: false,
        role: 'normal',
        pointMode: 'normal',
        subwayColor: '#a855f7',
        subwayLabelText: '지',
        connectedToStationId: '',
        connectorAnchor: 'center',
        segmentLabel: '',
        segmentGap: 0,
      };

  const selectedStationMeta = stationCatalog.find((station) => station.stationId === selectedStationId);

  const displayedStationIds = useMemo(
    () =>
      new Set(
        buildDisplayedStations(
          stationCatalog.map((station, index) => ({
            routeId: String(detail?.route?.routeId ?? selectedRouteId ?? ''),
            routeName: String(detail?.route?.routeName ?? ''),
            upDown: direction,
            staOrder: station.minOrder || index + 1,
            stationId: station.stationId,
            stationName: station.stationName,
            x: 0,
            y: 0,
          })),
          stationOverrides,
          effectiveStartId,
          effectiveEndId,
        ).map((station) => String(station.stationId)),
      ),
    [stationCatalog, stationOverrides, effectiveStartId, effectiveEndId, detail?.route?.routeId, detail?.route?.routeName, selectedRouteId],
  );

  const sourceStations = useMemo<RouteStation[]>(
    () =>
      stationCatalog.map((station, index) => ({
        routeId: String(detail?.route?.routeId ?? selectedRouteId ?? ''),
        routeName: String(detail?.route?.routeName ?? ''),
        upDown: direction,
        staOrder: station.minOrder || index + 1,
        stationId: station.stationId,
        stationName: station.stationName,
        x: 0,
        y: 0,
      })),
    [stationCatalog, detail?.route?.routeId, detail?.route?.routeName, selectedRouteId],
  );

  function updateStationOverride(stationId: string, patch: Partial<StationOverride>) {
    setStationOverrides((prev) => {
      const current = prev[stationId] ?? {
        customName: '',
        omitted: false,
        role: 'normal',
        pointMode: 'normal' as StationPointMode,
        subwayColor: '#a855f7',
        subwayLabelText: '지',
      };
      const next = { ...current, ...patch };
      const cloned = { ...prev, [stationId]: next };
      if (patch.role === 'start' || patch.role === 'end') {
        const roleToClear = patch.role;
        Object.keys(cloned).forEach((id) => {
          if (id !== stationId && cloned[id].role === roleToClear) cloned[id] = { ...cloned[id], role: 'normal' };
        });
      }
      if (patch.role && patch.role !== 'end') {
        cloned[stationId] = { ...cloned[stationId], connectedToStationId: '' };
      }
      return cloned;
    });
  }

  function resetLayoutField<K extends keyof LayoutOverride>(key: K) {
    setLayoutOverride((prev) => ({ ...prev, [key]: defaultLayoutOverride[key] }));
  }

  function addCustomStation() {
    const name = newStationName.trim();
    if (!name) return;

    const customId = `custom-${Date.now()}`;
    setStationCatalog((prev) => {
      const insertIndex = prev.findIndex((station) => station.stationId === selectedStationId);
      const base = [...prev];
      const item: StationListItem = {
        stationId: customId,
        stationName: name,
        directions: [direction],
        minOrder: 0,
        isCustom: true,
      };
      if (insertIndex >= 0) {
        base.splice(insertIndex + 1, 0, item);
      } else {
        base.push(item);
      }
      return base.map((station, index) => ({ ...station, minOrder: index + 1 }));
    });
    setSelectedStationId(customId);
    setNewStationName('');
  }

  function removeCustomStation() {
    const targetId = selectedStationId;
    if (!targetId) return;
    const target = stationCatalog.find((station) => station.stationId === targetId);
    if (!target?.isCustom) return;

    setStationCatalog((prev) => {
      const filtered = prev.filter((station) => station.stationId !== targetId).map((station, index) => ({ ...station, minOrder: index + 1 }));
      const fallback = filtered[Math.max(0, filtered.findIndex((station) => station.stationId === targetId) - 1)] ?? filtered[0];
      setSelectedStationId(fallback?.stationId ?? '');
      return filtered;
    });

    setStationOverrides((prev) => {
      const cloned = { ...prev };
      delete cloned[targetId];
      Object.keys(cloned).forEach((key) => {
        if (cloned[key]?.connectedToStationId === targetId) {
          cloned[key] = { ...cloned[key], connectedToStationId: '' };
        }
      });
      return cloned;
    });
  }

  function buildExportSvgText() {
    if (!svgRef.current) return '';

    const serializer = new XMLSerializer();
    const rawSvgText = serializer.serializeToString(svgRef.current);
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawSvgText, 'image/svg+xml');
    const logoCandidates = Array.from(doc.querySelectorAll('image')).filter((node) => {
      const href = node.getAttribute('href') ?? node.getAttribute('xlink:href') ?? '';
      return href.includes('G_BUS_Logo.svg.png');
    });

    if (logoCandidates.length === 0 || !logoDataUrl) {
      return rawSvgText;
    }

    logoCandidates.forEach((node) => {
      node.setAttribute('href', logoDataUrl);
      node.removeAttribute('xlink:href');
    });

    return serializer.serializeToString(doc);
  }

  function downloadSvg() {
    if (!svgRef.current || !detail) return;
    const svgText = buildExportSvgText();
    if (!svgText) return;
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `route-${detail.route.routeName}-${direction}.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadPng() {
    if (!svgRef.current || !detail) return;
    const svgText = buildExportSvgText();
    if (!svgText) return;
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.onload = () => {
      const box = svgRef.current?.viewBox.baseVal;
      if (!box) return;
      const scale = 3;
      const canvas = document.createElement('canvas');
      canvas.width = box.width * scale;
      canvas.height = box.height * scale;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = pngUrl;
        anchor.download = `route-${detail.route.routeName}-${direction}.png`;
        anchor.click();
        URL.revokeObjectURL(pngUrl);
      });
      URL.revokeObjectURL(url);
    };
    image.src = url;
  }

  const connectorTargetId =
    stationOverrides[effectiveEndId]?.connectedToStationId && displayedStationIds.has(stationOverrides[effectiveEndId].connectedToStationId ?? '')
      ? String(stationOverrides[effectiveEndId].connectedToStationId)
      : '';

  return (
    <main className="app-shell">
      <aside className="control-panel">
        <div>
          <h2>노선안내도 Generator</h2>
        </div>

        <details className="panel-group" open>
          <summary>기본 설정</summary>
          <label className="field">
            노선 검색
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="노선번호, 기종점, 지역명" />
          </label>

          <label className="field">
            노선 선택
            <select value={selectedRouteId} onChange={(event) => setSelectedRouteId(event.target.value)}>
              {routes.map((route) => (
                <option key={route.routeId} value={route.routeId}>
                  {route.routeName} · {route.startStationName} → {route.endStationName}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-head">
              노선 색상 테마
              <button type="button" className="mini-reset" onClick={() => setThemeName('teal')}>
                reset
              </button>
            </span>
            <select value={themeName} onChange={(event) => setThemeName(event.target.value as ThemeName)}>
              {Object.entries(themes).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
          </label>
        </details>

        <details className="panel-group" open>
          <summary>레이아웃 조정</summary>
          <label className="field">
            <span className="field-head">
              정류장명 각도: {layoutOverride.labelAngle}도
              <button type="button" className="mini-reset" onClick={() => resetLayoutField('labelAngle')}>
                reset
              </button>
            </span>
            <input
              type="range"
              min="-70"
              max="-30"
              value={layoutOverride.labelAngle}
              onChange={(event) => setLayoutOverride((prev) => ({ ...prev, labelAngle: Number(event.target.value) }))}
            />
          </label>

          <label className="field">
            <span className="field-head">
              행 간격: {layoutOverride.rowHeight}
              <button type="button" className="mini-reset" onClick={() => resetLayoutField('rowHeight')}>
                reset
              </button>
            </span>
            <input type="range" min="48" max="80" value={layoutOverride.rowHeight} onChange={(event) => setLayoutOverride((prev) => ({ ...prev, rowHeight: Number(event.target.value) }))} />
          </label>

          <label className="field">
            <span className="field-head">
              노선선 두께: {layoutOverride.lineStrokeWidth.toFixed(1)}
              <button type="button" className="mini-reset" onClick={() => resetLayoutField('lineStrokeWidth')}>
                reset
              </button>
            </span>
            <input type="range" min="2" max="6" step="0.2" value={layoutOverride.lineStrokeWidth} onChange={(event) => setLayoutOverride((prev) => ({ ...prev, lineStrokeWidth: Number(event.target.value) }))} />
          </label>

          <label className="field">
            <span className="field-head">
              출발/도착 점 크기: {layoutOverride.terminalMarkerRadius.toFixed(1)}
              <button type="button" className="mini-reset" onClick={() => resetLayoutField('terminalMarkerRadius')}>
                reset
              </button>
            </span>
            <input type="range" min="2.5" max="5" step="0.1" value={layoutOverride.terminalMarkerRadius} onChange={(event) => setLayoutOverride((prev) => ({ ...prev, terminalMarkerRadius: Number(event.target.value) }))} />
          </label>

          <label className="field">
            <span className="field-head">
              좌측 기준선: {layoutOverride.lineStartX}
              <button type="button" className="mini-reset" onClick={() => resetLayoutField('lineStartX')}>
                reset
              </button>
            </span>
            <input type="range" min="8" max="120" value={layoutOverride.lineStartX} onChange={(event) => setLayoutOverride((prev) => ({ ...prev, lineStartX: Number(event.target.value) }))} />
          </label>

          <label className="field">
            <span className="field-head">
              우측 기준선: {layoutOverride.lineEndX}
              <button type="button" className="mini-reset" onClick={() => resetLayoutField('lineEndX')}>
                reset
              </button>
            </span>
            <input type="range" min="380" max="492" value={layoutOverride.lineEndX} onChange={(event) => setLayoutOverride((prev) => ({ ...prev, lineEndX: Number(event.target.value) }))} />
          </label>

          <label className="field">
            <span className="field-head">
              유턴 반경: {layoutOverride.turnRadius}
              <button type="button" className="mini-reset" onClick={() => resetLayoutField('turnRadius')}>
                reset
              </button>
            </span>
            <input type="range" min="8" max="30" value={layoutOverride.turnRadius} onChange={(event) => setLayoutOverride((prev) => ({ ...prev, turnRadius: Number(event.target.value) }))} />
          </label>

          <label className="field">
            <span className="field-head">
              유턴-인접정류장 간격: {layoutOverride.cornerStationGap}
              <button type="button" className="mini-reset" onClick={() => resetLayoutField('cornerStationGap')}>
                reset
              </button>
            </span>
            <input type="range" min="8" max="32" value={layoutOverride.cornerStationGap} onChange={(event) => setLayoutOverride((prev) => ({ ...prev, cornerStationGap: Number(event.target.value) }))} />
          </label>
        </details>

        {message && <p className="message">{message}</p>}
      </aside>

      <section className="preview-panel">
        <div className="preview-header">
          <div>
            <p className="eyebrow">Preview</p>
            <h2>{detail ? `${detail.route.routeName} ${direction}` : '노선 선택 대기'}</h2>
          </div>
          <p>{detail?.stations.length ?? 0}개 정류장</p>
        </div>
        <div className="preview-stage">
          <RouteMapPreview
            detail={detail}
            theme={theme}
            sourceStations={sourceStations}
            layoutOverride={layoutOverride}
            stationOverrides={stationOverrides}
            effectiveStartId={effectiveStartId}
            effectiveEndId={effectiveEndId}
            connectorTargetId={connectorTargetId}
            selectedStationId={selectedStationId}
            onSelectStation={setSelectedStationId}
            svgRef={svgRef}
          />
        </div>
        <div className="preview-export-actions">
          <button type="button" onClick={downloadSvg} disabled={!detail}>SVG export</button>
          <button type="button" onClick={downloadPng} disabled={!detail}>PNG export</button>
        </div>
      </section>

      <aside className="edit-panel">
        <div>
          <h2>정류장 편집</h2>
        </div>

        <label className="field">
          사용자 정의 정류장 추가
          <input value={newStationName} onChange={(event) => setNewStationName(event.target.value)} placeholder="정류장명 입력" />
        </label>
        <button type="button" className="mini-reset" onClick={addCustomStation}>
          선택 정류장 다음에 추가
        </button>

        <div className="station-list">
          {stationCatalog.map((station) => (
            (() => {
              const directionLabel = station.directions.includes(direction)
                ? direction
                : station.directions[0] ?? '상행';
              return (
            <button
              key={station.stationId}
              type="button"
              className={`station-item ${
                selectedStationId === station.stationId ? 'active' : ''
              } ${displayedStationIds.has(station.stationId) ? 'in-map' : 'out-map'} ${
                station.stationId === effectiveStartId ? 'start-item' : ''
              } ${station.stationId === effectiveEndId ? 'end-item' : ''}`}
              onClick={() => setSelectedStationId(station.stationId)}
            >
              <span>
                {station.stationName}
                {station.isCustom ? ' (사용자정의)' : ''}
              </span>
              <small>{directionLabel}</small>
              {station.stationId === effectiveStartId && <em className="item-comment top">출발 정류장</em>}
              {station.stationId === effectiveEndId && <em className="item-comment bottom">도착 정류장</em>}
            </button>
              );
            })()
          ))}
        </div>

        {selectedStationId && (
          <div className="station-editor">
            <label className="field">
              정류장명 수정
              <input
                value={selectedOverride.customName}
                onChange={(event) => updateStationOverride(selectedStationId, { customName: event.target.value })}
                placeholder="원본명 사용 시 비워두기"
              />
            </label>

            {selectedStationMeta?.isCustom && (
              <button type="button" className="mini-reset" onClick={removeCustomStation}>
                사용자 정의 정류장 삭제
              </button>
            )}

            <label className="field">
              역할
              <select value={selectedOverride.role} onChange={(event) => updateStationOverride(selectedStationId, { role: event.target.value as StationRole })}>
                <option value="normal">일반</option>
                <option value="start">출발</option>
                <option value="end">도착</option>
              </select>
            </label>

            {selectedStationId === effectiveEndId && (
              <>
                <label className="field">
                  연결 정류장
                  <select
                    value={selectedOverride.connectedToStationId ?? ''}
                    onChange={(event) => updateStationOverride(selectedStationId, { connectedToStationId: event.target.value })}
                  >
                    <option value="">선택 안함</option>
                    {stationCatalog
                      .filter((station) => displayedStationIds.has(station.stationId) && station.stationId !== effectiveEndId)
                      .map((station) => (
                        <option key={`connector-${station.stationId}`} value={station.stationId}>
                          {station.stationName}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="field">
                  연결선 위치
                  <select
                    value={selectedOverride.connectorAnchor ?? 'center'}
                    onChange={(event) =>
                      updateStationOverride(selectedStationId, {
                        connectorAnchor: event.target.value as 'center' | 'left' | 'right',
                      })
                    }
                  >
                    <option value="center">정중앙</option>
                    <option value="right">오른쪽</option>
                    <option value="left">왼쪽</option>
                  </select>
                </label>
              </>
            )}

            <label className="field">
              구간 텍스트
              <input
                value={selectedOverride.segmentLabel ?? ''}
                onChange={(event) => updateStationOverride(selectedStationId, { segmentLabel: event.target.value })}
                placeholder="선택 정류장~다음 정류장 사이 텍스트"
              />
            </label>

            <label className="field">
              다음 정류장 간격 확장: {Number(selectedOverride.segmentGap ?? 0)}
              <input
                type="range"
                min="0"
                max="80"
                step="2"
                value={Number(selectedOverride.segmentGap ?? 0)}
                onChange={(event) => updateStationOverride(selectedStationId, { segmentGap: Number(event.target.value) })}
              />
            </label>

            <label className="field">
              정류장 지점 유형
              <select
                value={selectedOverride.pointMode}
                onChange={(event) => updateStationOverride(selectedStationId, { pointMode: event.target.value as StationPointMode })}
              >
                <option value="emphasis">강조 정류장 표시</option>
                <option value="normal">일반 정류장 표시</option>
                <option value="intercityTransfer">광역버스 환승 가능 정류장</option>
                <option value="subwayTransfer">지하철 환승가능 정류장</option>
              </select>
            </label>

            {selectedOverride.pointMode === 'subwayTransfer' && (
              <>
                <label className="field">
                  지하철 표식 색상
                  <input
                    type="color"
                    value={selectedOverride.subwayColor ?? '#a855f7'}
                    onChange={(event) => updateStationOverride(selectedStationId, { subwayColor: event.target.value })}
                  />
                </label>
                <label className="field">
                  지하철 라벨 텍스트
                  <input
                    value={selectedOverride.subwayLabelText ?? '지'}
                    maxLength={2}
                    onChange={(event) => updateStationOverride(selectedStationId, { subwayLabelText: event.target.value })}
                    placeholder="예: 8"
                  />
                </label>
              </>
            )}

            <label className="check-field">
              <input
                type="checkbox"
                checked={selectedOverride.omitted}
                onChange={(event) => updateStationOverride(selectedStationId, { omitted: event.target.checked })}
              />
              정류장 생략
            </label>
          </div>
        )}
      </aside>
    </main>
  );
}

export default App;
