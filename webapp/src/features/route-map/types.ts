export type Direction = '상행' | '하행';
export type ThemeName = 'teal' | 'red' | 'yellow' | 'gyeonggi-blue' | 'black';
export type HeaderLogoKey = 'gbus' | 'mbus' | 'public_bus';

export type HeaderLogoOption = {
  label: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  titleText: string;
  titleX: number;
  titleY: number;
  showHeaderAccent: boolean;
};

export type RouteSummary = {
  routeId: string;
  routeName: string;
  startStationName: string;
  endStationName: string;
  regionName: string;
  companyName: string;
  routeTypeCd: string;
};

export type RouteStation = {
  routeId: string;
  routeName: string;
  upDown: Direction;
  staOrder: number;
  stationId: string;
  stationName: string;
  x: number;
  y: number;
};

export type ScheduleRow = {
  label: string;
  firstTime: string;
  lastTime: string;
  intervalText: string;
};

export type RouteDetailResponse = {
  route: RouteSummary & Record<string, string | number | null>;
  direction: Direction;
  availableDirections: Array<{ upDown: Direction; count: number }>;
  scheduleRows: ScheduleRow[];
  stations: RouteStation[];
};

export type Theme = {
  label: string;
  lineColor: string;
  routeNumberColor: string;
  markerFillColor: string;
  markerStrokeColor: string;
  headerAccentColor: string;
};

export type StationPoint = RouteStation & {
  xPos: number;
  yPos: number;
  row: number;
  rowIndex: number;
  isStart: boolean;
  isEnd: boolean;
};

export type StationListItem = {
  stationId: string;
  stationName: string;
  directions: Direction[];
  minOrder: number;
  isCustom?: boolean;
};

export type StageKey = 'route' | 'global' | 'stationBasic' | 'layout' | 'stationAdvanced' | 'export';
export type StageTouched = Record<StageKey, boolean>;

export type LayoutWarning = {
  id: 'lineSpan' | 'labelDensity' | 'cornerGap';
  title: string;
  detail: string;
};

export type HighlightKey = 'header' | 'terminal' | 'line' | 'labels' | 'station' | 'segment' | 'routeName' | null;

export type StationPointMode = 'normal' | 'emphasis' | 'intercityTransfer' | 'subwayTransfer';
export type StationRole = 'normal' | 'start' | 'end';

export type StationOverride = {
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

export type LayoutOverride = {
  labelAngle: number;
  rowHeight: number;
  lineStrokeWidth: number;
  terminalMarkerRadius: number;
  routeNameFontSize: number;
  lineStartX: number;
  lineEndX: number;
  turnRadius: number;
  cornerStationGap: number;
};

export type HistorySnapshot = {
  themeName: ThemeName | '';
  headerLogo: HeaderLogoKey | '';
  customTerminalText: string;
  layoutOverride: LayoutOverride;
  stationOverrides: Record<string, StationOverride>;
  stationCatalog: StationListItem[];
  selectedStationId: string;
};

export type ExportFormat = 'svg' | 'png';
export type MobileEditTab = 'settings' | 'layout' | 'stations';

