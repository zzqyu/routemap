import { useMemo } from 'react';
import { buildDisplayedStations } from '../lib/station';
import { buildLayout, buildRoutePath } from '../lib/layout';
import { getLabelMetrics, splitStationName } from '../lib/label';
import { canvasWidth, highlightColor, rightPad, topPadding } from '../constants';
import type { HeaderLogoKey, HeaderLogoOption, HighlightKey, LayoutOverride, RouteDetailResponse, RouteStation, StationOverride, Theme, TypographySettings } from '../types';

const genericFontFamilies = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'emoji', 'math', 'fangsong']);

function toFontToken(fontFamily: string): string {
  const value = String(fontFamily || '').trim();
  if (!value) return '';
  if (genericFontFamilies.has(value.toLowerCase())) return value;
  return `'${value.replace(/'/g, "\\'")}'`;
}

function buildFontStack(primary: string): string {
  return [
    toFontToken(primary),
    `'Pretendard'`,
    `'Noto Sans KR'`,
    `'Apple SD Gothic Neo'`,
    `'Malgun Gothic'`,
    `'Segoe UI'`,
    'sans-serif',
  ]
    .filter(Boolean)
    .join(',');
}

function buildStretchTransform(x: number, y: number, fontStretchPercent: number): string {
  const sx = Math.max(0.5, fontStretchPercent / 100);
  return `translate(${x} ${y}) scale(${sx} 1) translate(${-x} ${-y})`;
}

function buildRotatedStretchTransform(x: number, y: number, angle: number, fontStretchPercent: number): string {
  const sx = Math.max(0.5, fontStretchPercent / 100);
  return `translate(${x} ${y}) rotate(${angle}) scale(${sx} 1) translate(${-x} ${-y})`;
}

type RouteMapPreviewProps = {
  detail: RouteDetailResponse | null;
  theme: Theme;
  sourceStations: RouteStation[];
  layoutOverride: LayoutOverride;
  stationOverrides: Record<string, StationOverride>;
  effectiveStartId: string;
  effectiveEndId: string;
  connectorTargetId: string;
  selectedStationId: string;
  headerLogoKey: HeaderLogoKey;
  headerLogo: HeaderLogoOption;
  terminalText: string;
  typographySettings: TypographySettings;
  highlightKey: HighlightKey;
  onSelectStation: (stationId: string) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
};

export function RouteMapPreview({
  detail,
  theme,
  sourceStations,
  layoutOverride,
  stationOverrides,
  effectiveStartId,
  effectiveEndId,
  connectorTargetId,
  selectedStationId,
  headerLogoKey,
  headerLogo,
  terminalText,
  typographySettings,
  highlightKey,
  onSelectStation,
  svgRef,
}: RouteMapPreviewProps) {
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
  const displayRouteName = headerLogoKey === 'mbus' && /^m/i.test(routeName) ? routeName.replace(/^m\s*/i, '') : routeName;
  const showMbusPrefix = headerLogoKey === 'mbus';
  const routeNameFontSize = layoutOverride.routeNameFontSize;
  const effectiveRouteNameFontSize = typographySettings.routeName.fontSize || routeNameFontSize;
  const routeNameY = topPadding + 42;
  const routeNameRightX = canvasWidth - rightPad;
  const routeNameApproxWidth = Math.max(1, displayRouteName.length) * effectiveRouteNameFontSize * 0.55;
  const routeNameLeftX = routeNameRightX - routeNameApproxWidth;
  const mbusPrefixSize = Math.max(20, Math.round(effectiveRouteNameFontSize * 1.16));
  const mbusPrefixGap = Math.round(effectiveRouteNameFontSize * -0.15);
  const mbusPrefixBottomOffset = effectiveRouteNameFontSize * 0.24;
  const mbusPrefixX = routeNameLeftX - mbusPrefixGap - mbusPrefixSize;
  const terminalTypography = typographySettings.terminal;
  const routeInfoTypography = typographySettings.routeInfo;
  const stationTypography = typographySettings.stationLabel;
  const headerTitleTypography = typographySettings.headerTitle;
  const routeNameTypography = typographySettings.routeName;

  return (
    <svg
      ref={svgRef}
      className="route-map"
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${canvasWidth} ${layout.height}`}
      role="img"
      aria-label={`${routeName} 노선안내도`}
      style={{ fontFamily: buildFontStack('Pretendard') }}
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
      {headerLogo.showHeaderAccent && <path d={`M 180 ${topPadding} H 320 Q 250 ${topPadding + 27} 180 ${topPadding}`} fill={theme.headerAccentColor} opacity="0.95" />}
      <text
        x="14"
        y={topPadding + 21}
        fontSize="10"
        fontWeight={terminalTypography.fontWeight}
        fill={highlightKey === 'terminal' ? highlightColor : theme.routeNumberColor}
        transform={buildStretchTransform(14, topPadding + 21, terminalTypography.fontStretchPercent)}
      >
        <tspan
          style={{
            fontFamily: buildFontStack(terminalTypography.fontFamily),
            letterSpacing: `${terminalTypography.letterSpacing}px`,
          }}
          fontSize={terminalTypography.fontSize}
        >
        {terminalText}
        </tspan>
      </text>
      <text
        x="14"
        y={topPadding + 28}
        fontSize={routeInfoTypography.fontSize}
        fontWeight={routeInfoTypography.fontWeight}
        fill="#111"
        transform={buildStretchTransform(14, topPadding + 28, routeInfoTypography.fontStretchPercent)}
      >
        <tspan
          style={{
            fontFamily: buildFontStack(routeInfoTypography.fontFamily),
            letterSpacing: `${routeInfoTypography.letterSpacing}px`,
          }}
        >
          {detail ? `운송회사: ${detail.route.companyName ?? '-'} / 문의: ${detail.route.companyTel ?? '-'}` : '노선을 선택하세요'}
        </tspan>
      </text>
      {detail?.scheduleRows.map((row, index) => (
        <text
          key={row.label}
          x="14"
          y={topPadding + 34 + index * 6}
          fontSize={routeInfoTypography.fontSize}
          fontWeight={routeInfoTypography.fontWeight}
          fill="#111"
          transform={buildStretchTransform(14, topPadding + 34 + index * 6, routeInfoTypography.fontStretchPercent)}
        >
          <tspan
            style={{
              fontFamily: buildFontStack(routeInfoTypography.fontFamily),
              letterSpacing: `${routeInfoTypography.letterSpacing}px`,
            }}
          >
            {(() => {
              const [startFirst = '-', endFirst = '-'] = String(row.firstTime ?? '-|-').split('|');
              const [startLast = '-', endLast = '-'] = String(row.lastTime ?? '-|-').split('|');
              return `${row.label} 기점 ${startFirst}~${startLast} 종점 ${endFirst}~${endLast} 배차 ${row.intervalText}`;
            })()}
          </tspan>
        </text>
      ))}

      <g transform={`translate(250 ${topPadding + 36})`} opacity={highlightKey === 'header' ? 1 : 0.96}>
        <image
          href={headerLogo.src}
          x={headerLogo.x}
          y={headerLogo.y}
          width={headerLogo.width}
          height={headerLogo.height}
          preserveAspectRatio="xMidYMid meet"
        />
        <text
          x={headerLogo.titleX}
          y={headerLogo.titleY}
          textAnchor="start"
          fontSize={headerTitleTypography.fontSize}
          fontWeight={headerTitleTypography.fontWeight}
          fill="#111"
          dominantBaseline="middle"
          style={{ fontFamily: buildFontStack(headerTitleTypography.fontFamily), letterSpacing: `${headerTitleTypography.letterSpacing}px` }}
          transform={buildStretchTransform(headerLogo.titleX, headerLogo.titleY, headerTitleTypography.fontStretchPercent)}
        >
          {headerLogo.titleText}
        </text>
      </g>
      {showMbusPrefix && (
        <image
          href="/mbus_m.png"
          x={mbusPrefixX}
          y={routeNameY - mbusPrefixSize + mbusPrefixBottomOffset}
          width={mbusPrefixSize}
          height={mbusPrefixSize}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
      <g transform={`translate(${routeNameRightX} ${routeNameY}) scale(${routeNameTypography.fontStretchPercent / 100} 1)`}>
        <text
          x={0}
          y={0}
          textAnchor="end"
          fontSize={effectiveRouteNameFontSize}
          fontWeight={routeNameTypography.fontWeight}
          fill={highlightKey === 'routeName' ? highlightColor : theme.routeNumberColor}
          style={{ fontFamily: buildFontStack(routeNameTypography.fontFamily), letterSpacing: `${routeNameTypography.letterSpacing}px` }}
        >
          {displayRouteName}
        </text>
      </g>

      {routePath && (
        <>
          <path d={routePath} fill="none" stroke={theme.lineColor} strokeWidth={layoutOverride.lineStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
          {highlightKey === 'line' && (
            <path d={routePath} fill="none" stroke={highlightColor} strokeWidth={Math.max(layoutOverride.lineStrokeWidth + 1.6, 4.2)} strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
          )}
        </>
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
        const label = splitStationName(point.stationName, layoutOverride.stationLabelWrapThreshold);
        const isTerminal = point.isStart || point.isEnd;
        const override = stationOverrides[String(point.stationId)];
        const pointMode = override?.pointMode ?? (isTerminal ? 'emphasis' : 'normal');
        const isEmphasis = pointMode === 'emphasis';
        const labelWeight = stationTypography.fontWeight;
        const baseLabelSize = stationTypography.fontSize || label.fontSize;
        const labelSize = isEmphasis ? Math.min(6.4, baseLabelSize + 0.7) : baseLabelSize;
        const { lineHeight, baselineOffset } = getLabelMetrics(label.lines.length, labelSize);
        const englishName = String(override?.englishName ?? '').trim();
        const englishLineDy = 3.9;
        const angleRad = (Math.abs(layoutOverride.labelAngle) * Math.PI) / 180;
        const englishXOffset = Math.tan(angleRad) * englishLineDy - 2.0;
        const labelX = point.xPos - 3;
        const labelY = point.yPos - 5 - baselineOffset;
        const subwayColor = override?.subwayColor ?? '#a855f7';
        const subwayLabel = (override?.subwayLabelText ?? '지').slice(0, 2);
        const isSelected = selectedStationId === String(point.stationId);
        const isStationHighlighted = highlightKey === 'station' && isEmphasis;
        return (
          <g key={`${point.stationId}-${point.staOrder}`} onClick={() => onSelectStation(String(point.stationId))} style={{ cursor: 'pointer' }}>
            {isStationHighlighted && (
              <circle
                cx={point.xPos}
                cy={point.yPos}
                r={layoutOverride.terminalMarkerRadius + 1.8}
                fill="none"
                stroke={highlightColor}
                strokeWidth="1.8"
                opacity="0.85"
              />
            )}
            {pointMode === 'intercityTransfer' ? (
              <g>
                {(() => {
                  const baseStroke = '#0369a1';
                  const baseStrokeWidth = '1.1';
                  return (
                <rect
                  x={point.xPos - 4.2}
                  y={point.yPos - 4.2}
                  width={8.4}
                  height={8.4}
                  rx={1.8}
                  fill="#0ea5e9"
                  stroke={isSelected ? '#111827' : '#0369a1'}
                  strokeWidth={isSelected ? '1.6' : '1.1'}
                  data-selected={isSelected ? '1' : '0'}
                  data-base-stroke={baseStroke}
                  data-base-stroke-width={baseStrokeWidth}
                />
                  );
                })()}
                <text x={point.xPos} y={point.yPos + 1.6} textAnchor="middle" fontSize="4" fontWeight="900" fill="#fff">
                  B
                </text>
              </g>
            ) : pointMode === 'subwayTransfer' ? (
              <g>
                {(() => {
                  const baseStroke = '#ffffff';
                  const baseStrokeWidth = '1.2';
                  return (
                <circle
                  cx={point.xPos}
                  cy={point.yPos}
                  r={4.2}
                  fill={subwayColor}
                  stroke={isSelected ? '#111827' : '#ffffff'}
                  strokeWidth={isSelected ? '1.6' : '1.2'}
                  data-selected={isSelected ? '1' : '0'}
                  data-base-stroke={baseStroke}
                  data-base-stroke-width={baseStrokeWidth}
                />
                  );
                })()}
                <text x={point.xPos} y={point.yPos + 1.5} textAnchor="middle" fontSize="3.8" fontWeight="900" fill="#fff">
                  {subwayLabel}
                </text>
              </g>
            ) : (
              (() => {
                const baseStroke = isEmphasis ? '#fff' : theme.markerStrokeColor;
                const baseStrokeWidth = '1.2';
                return (
              <circle
                cx={point.xPos}
                cy={point.yPos}
                r={isEmphasis ? layoutOverride.terminalMarkerRadius : markerRadius}
                fill={isEmphasis ? theme.lineColor : theme.markerFillColor}
                stroke={isSelected ? '#111827' : isEmphasis ? '#fff' : theme.markerStrokeColor}
                strokeWidth={isSelected ? '1.8' : '1.2'}
                data-selected={isSelected ? '1' : '0'}
                data-base-stroke={baseStroke}
                data-base-stroke-width={baseStrokeWidth}
              />
                );
              })()
            )}
            <text
              x={labelX}
              y={labelY}
              transform={buildRotatedStretchTransform(
                labelX,
                labelY,
                layoutOverride.labelAngle,
                stationTypography.fontStretchPercent,
              )}
              textAnchor="start"
              fontSize={labelSize}
              fontWeight={labelWeight}
              fill={highlightKey === 'labels' ? highlightColor : '#111'}
              style={{ fontFamily: buildFontStack(stationTypography.fontFamily), letterSpacing: `${stationTypography.letterSpacing}px` }}
            >
              {label.lines.map((line, index) => (
                <tspan key={`${point.stationId}-line-${index}`} x={labelX} dy={index === 0 ? 0 : lineHeight}>
                  {line}
                </tspan>
              ))}
              {englishName && (
                <tspan
                  x={labelX + englishXOffset}
                  dy={englishLineDy}
                  fontSize={4.0}
                  fontWeight={500}
                  fill={highlightKey === 'labels' ? highlightColor : '#475569'}
                  style={{ letterSpacing: `${stationTypography.letterSpacing * 0.55}px` }}
                >
                  {englishName}
                </tspan>
              )}
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
          <text key={`segment-label-${point.stationId}-${next.stationId}`} x={midX} y={textY} textAnchor="middle" fontSize="4.4" fontWeight="800" fill={highlightKey === 'segment' ? highlightColor : '#374151'}>
            {label}
          </text>
        );
      })}
    </svg>
  );
}
