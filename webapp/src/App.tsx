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

function buildLayout(stations: RouteStation[], route: RouteDetailResponse['route'] | null, direction: Direction) {
  const orderedStations = [...stations]
    .filter((station) => !station.stationName.includes('미정차'))
    .sort((a, b) => Number(a.staOrder) - Number(b.staOrder));
  const withEndpoint = [...orderedStations];
  const endpoints = route ? getEndpointIds(route, direction) : { startId: '', endId: '' };
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
  const height = Math.max(minCanvasHeight, headerHeight + rowCount * rowHeight + 34);
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
    const rowStartX = isLeftToRight ? lineStartX : lineEndX;
    const rowEndX = isLeftToRight ? lineEndX : lineStartX;
    const rowHasPrevTurn = row > 0;
    const rowHasNextTurn = row < rowCount - 1;
    const rowVisualStart = rowHasPrevTurn ? (isLeftToRight ? lineStartX + turnRadius : lineEndX - turnRadius) : rowStartX;
    const rowVisualEnd = rowHasNextTurn ? (isLeftToRight ? lineEndX - turnRadius : lineStartX + turnRadius) : rowEndX;
    const rowLeft = Math.min(rowVisualStart, rowVisualEnd);
    const rowRight = Math.max(rowVisualStart, rowVisualEnd);
    const rowUsableWidth = rowRight - rowLeft;
    let xPos = isLeftToRight ? rowLeft + rowUsableWidth * progress : rowRight - rowUsableWidth * progress;
    const yPos = headerHeight + 35 + row * rowHeight;
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

  return { points, height, rowCount, stationsPerRow: baseStationsPerRow };
}

function buildRoutePath(points: StationPoint[], rowCount: number) {
  if (points.length === 0) return '';
  let path = '';

  for (let row = 0; row < rowCount; row += 1) {
    const rowPoints = points.filter((point) => point.row === row);
    if (rowPoints.length === 0) continue;
    const first = rowPoints[0];
    const isLeftToRight = row % 2 === 0;
    const rowStartX = isLeftToRight ? lineStartX : lineEndX;
    const rowEndX = isLeftToRight ? lineEndX : lineStartX;
    const hasNextTurn = row < rowCount - 1;
    const edgeX = isLeftToRight ? lineEndX : lineStartX;
    const innerX = isLeftToRight ? edgeX - turnRadius : edgeX + turnRadius;
    const straightEndX = hasNextTurn ? innerX : rowEndX;

    if (row === 0) path += `M ${rowStartX} ${first.yPos}`;
    path += ` L ${straightEndX} ${first.yPos}`;

    const nextFirst = points.find((point) => point.row === row + 1 && point.rowIndex === 0);
    if (!nextFirst) continue;

    path += ` Q ${edgeX} ${first.yPos} ${edgeX} ${first.yPos + turnRadius}`;
    path += ` L ${edgeX} ${nextFirst.yPos - turnRadius}`;
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
  const cleanName = name.replace(/[()]/g, '').trim();
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
  labelAngle,
  showArrows,
  svgRef,
}: {
  detail: RouteDetailResponse | null;
  theme: Theme;
  labelAngle: number;
  showArrows: boolean;
  svgRef: React.RefObject<SVGSVGElement | null>;
}) {
  const layout = useMemo(
    () => buildLayout(detail?.stations ?? [], detail?.route ?? null, detail?.direction ?? '상행'),
    [detail],
  );
  const routePath = useMemo(() => buildRoutePath(layout.points, layout.rowCount), [layout.points, layout.rowCount]);
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
            return `${row.label} 기점 ${startFirst}~${startLast} 종점 ${endFirst}~${endLast} 배차간격 ${row.intervalText}`;
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
        <path d={routePath} fill="none" stroke={theme.lineColor} strokeWidth={routeLineStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      )}

      {showArrows && layout.points.length > 5 && (
        <>
          {layout.points.filter((point) => point.rowIndex === Math.floor(layout.stationsPerRow / 2)).map((point) => (
            <text key={`arrow-${point.stationId}-${point.staOrder}`} x={point.xPos} y={point.yPos + 14} textAnchor="middle" fontSize="4.2" fill="#777">
              {point.row % 2 === 0 ? '→' : '←'}
            </text>
          ))}
        </>
      )}

      {layout.points.map((point) => {
        const markerRadius = point.isStart || point.isEnd ? 3.6 : 2.3;
        const labelWeight = point.isStart || point.isEnd ? 900 : 700;
        const label = splitStationName(point.stationName);
        const labelSize = point.isStart || point.isEnd ? Math.min(6.4, label.fontSize + 0.7) : label.fontSize;
        const { lineHeight, baselineOffset } = getLabelMetrics(label.lines.length, labelSize);
        const labelX = point.xPos - 3;
        const labelY = point.yPos - 5 - baselineOffset;
        const isTerminal = point.isStart || point.isEnd;
        return (
          <g key={`${point.stationId}-${point.staOrder}`}>
            <circle
              cx={point.xPos}
              cy={point.yPos}
              r={markerRadius}
              fill={isTerminal ? theme.lineColor : theme.markerFillColor}
              stroke={isTerminal ? '#fff' : theme.markerStrokeColor}
              strokeWidth="1.2"
            />
            <text
              x={labelX}
              y={labelY}
              transform={`rotate(${labelAngle} ${labelX} ${labelY})`}
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
          </g>
        );
      })}
    </svg>
  );
}

function App() {
  const [query, setQuery] = useState('300');
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [direction, setDirection] = useState<Direction>('상행');
  const [themeName, setThemeName] = useState<ThemeName>('teal');
  const [labelAngle, setLabelAngle] = useState(-52);
  const [showArrows, setShowArrows] = useState(false);
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
        setMessage(data.stations.length ? '' : `${direction} 정류장 데이터가 없습니다.`);
      })
      .catch((error) => setMessage(`노선 상세 조회 실패: ${error.message}`));
  }, [selectedRouteId, direction]);

  const theme = themes[themeName];

  function downloadSvg() {
    if (!svgRef.current || !detail) return;
    const serializer = new XMLSerializer();
    const svgText = serializer.serializeToString(svgRef.current);
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
    const serializer = new XMLSerializer();
    const svgText = serializer.serializeToString(svgRef.current);
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

  return (
    <main className="app-shell">
      <aside className="control-panel">
        <div>
          <p className="eyebrow">Gyeonggi Bus Route Map</p>
          <h1>차내 노선안내도 테스트 웹앱</h1>
          <p className="description">`basedata.db`의 노선/정류장 데이터를 SVG 노선안내도로 미리봅니다.</p>
        </div>

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

        <div className="segmented">
          {(['상행', '하행'] as const).map((item) => (
            <button key={item} className={direction === item ? 'active' : ''} onClick={() => setDirection(item)} type="button">
              {item}
            </button>
          ))}
        </div>

        <label className="field">
          노선 색상 테마
          <select value={themeName} onChange={(event) => setThemeName(event.target.value as ThemeName)}>
            {Object.entries(themes).map(([key, value]) => (
              <option key={key} value={key}>
                {value.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          정류장명 각도: {labelAngle}도
          <input type="range" min="-70" max="-30" value={labelAngle} onChange={(event) => setLabelAngle(Number(event.target.value))} />
        </label>

        <label className="check-field">
          <input type="checkbox" checked={showArrows} onChange={(event) => setShowArrows(event.target.checked)} />
          방향 화살표 표시
        </label>

        <div className="export-actions">
          <button type="button" onClick={downloadSvg} disabled={!detail}>SVG export</button>
          <button type="button" onClick={downloadPng} disabled={!detail}>PNG export</button>
        </div>

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
          <RouteMapPreview detail={detail} theme={theme} labelAngle={labelAngle} showArrows={showArrows} svgRef={svgRef} />
        </div>
      </section>
    </main>
  );
}

export default App;
