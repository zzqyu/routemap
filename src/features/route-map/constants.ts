import type { FontOption, HeaderLogoKey, HeaderLogoOption, LayoutOverride, Theme, ThemeName, TypographySettings } from './types';

export const apiBase = '/api';
export const canvasWidth = 500;
export const minCanvasHeight = 180;
export const topPadding = 0;
export const headerHeight = 72;
export const rowHeight = 60;
export const leftPad = 20;
export const rightPad = 20;
export const turnRadius = 10;
export const cornerStationGap = 18;
export const routeLineStrokeWidth = 3.2;
export const lineStartX = leftPad;
export const lineEndX = canvasWidth - rightPad;
export const highlightColor = '#facc15';

export const defaultLayoutOverride: LayoutOverride = {
  labelAngle: -52,
  rowHeight,
  lineStrokeWidth: routeLineStrokeWidth,
  terminalMarkerRadius: 3.6,
  routeNameFontSize: 34,
  lineStartX,
  lineEndX,
  turnRadius,
  cornerStationGap,
};

export const themes: Record<ThemeName, Theme> = {
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
  black: {
    label: '검은색 · #000',
    lineColor: '#000000',
    routeNumberColor: '#000000',
    markerFillColor: '#ffffff',
    markerStrokeColor: '#000000',
    headerAccentColor: '#000000',
  },
};

export const headerLogoOptions: Record<HeaderLogoKey, HeaderLogoOption> = {
  gbus: { label: 'G-BUS', src: '/gbus.png', x: -66, y: -8, width: 80, height: 16, titleText: '노선안내도', titleX: 4, titleY: 1, showHeaderAccent: true },
  mbus: { label: 'M-BUS', src: '/mbus.png', x: -72, y: -14, width: 58, height: 22, titleText: '광역급행 노선안내도', titleX: -12, titleY: 1, showHeaderAccent: false },
  public_bus: { label: '공공버스', src: '/public_bus.png', x: -51, y: -12, width: 52, height: 20, titleText: '노선안내도', titleX: 4, titleY: 1, showHeaderAccent: true },
};

export const defaultTypographySettings: TypographySettings = {
  terminal: { fontFamily: 'Noto Sans KR', fontSize: 10, letterSpacing: -0.5, fontStretchPercent: 80 },
  routeInfo: { fontFamily: 'Noto Sans KR', fontSize: 4.8, letterSpacing: -0.2, fontStretchPercent: 80 },
  stationLabel: { fontFamily: 'Noto Sans KR', fontSize: 5.5, letterSpacing: -0.24, fontStretchPercent: 80 },
  headerTitle: { fontFamily: 'Noto Sans KR', fontSize: 13.5, letterSpacing: -0.4, fontStretchPercent: 80 },
  routeName: { fontFamily: 'Nanum Gothic', fontSize: 34, letterSpacing: -0.3, fontStretchPercent: 90 },
};

export const presetFontFamilies: FontOption[] = [
  { id: 'Noto Sans KR', label: 'Noto Sans KR', source: 'preset' },
  { id: 'Nanum Gothic', label: '나눔고딕 (Nanum Gothic)', source: 'preset' },
  { id: 'Pretendard', label: 'Pretendard', source: 'preset' },
  { id: 'Apple SD Gothic Neo', label: 'Apple SD Gothic Neo', source: 'preset' },
  { id: 'Malgun Gothic', label: 'Malgun Gothic', source: 'preset' },
];
