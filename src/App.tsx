import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { RouteMapPreview } from './features/route-map/components/RouteMapPreview';
import {
  apiBase,
  defaultLayoutOverride,
  defaultTypographySettings,
  headerLogoOptions,
  presetFontFamilies,
  themes,
} from './features/route-map/constants';
import { formatTerminal, getEndpointIds } from './features/route-map/lib/route';
import { buildDisplayedStations } from './features/route-map/lib/station';
import type {
  Direction,
  EditCategoryKey,
  ExportFormat,
  FontOption,
  HeaderLogoKey,
  HighlightKey,
  HistorySnapshot,
  LayoutOverride,
  LayoutWarning,
  MobileEditTab,
  RouteDetailResponse,
  RouteStation,
  RouteSummary,
  StageKey,
  StageTouched,
  StationListItem,
  StationOverride,
  StationPointMode,
  StationRole,
  ThemeName,
  TypographySettings,
  TypographyStyle,
} from './features/route-map/types';

function App() {
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [routeSelectionTick, setRouteSelectionTick] = useState(0);
  const [hasSearchedRoute, setHasSearchedRoute] = useState(false);
  const [attemptedEmptyRouteSearch, setAttemptedEmptyRouteSearch] = useState(false);
  const direction: Direction = '상행';
  const [themeName, setThemeName] = useState<ThemeName | ''>('');
  const [headerLogo, setHeaderLogo] = useState<HeaderLogoKey | ''>('');
  const [layoutOverride, setLayoutOverride] = useState<LayoutOverride>(defaultLayoutOverride);
  const [typographySettings, setTypographySettings] = useState<TypographySettings>(defaultTypographySettings);
  const [editCategory, setEditCategory] = useState<EditCategoryKey>('terminal');
  const [fontOptions, setFontOptions] = useState<FontOption[]>(presetFontFamilies);
  const [isClient, setIsClient] = useState(false);
  const [localFontsLoaded, setLocalFontsLoaded] = useState(false);
  const [showFontLicenseNotice, setShowFontLicenseNotice] = useState(false);
  const [stationOverrides, setStationOverrides] = useState<Record<string, StationOverride>>({});
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [stationCatalog, setStationCatalog] = useState<StationListItem[]>([]);
  const [baseStationCatalog, setBaseStationCatalog] = useState<StationListItem[]>([]);
  const [headerLogoDataUrl, setHeaderLogoDataUrl] = useState('');
  const [mbusMarkDataUrl, setMbusMarkDataUrl] = useState('');
  const [newStationName, setNewStationName] = useState('');
  const [stationSearch, setStationSearch] = useState('');
  const [filterInMapOnly, setFilterInMapOnly] = useState(false);
  const [filterCustomOnly, setFilterCustomOnly] = useState(false);
  const [detail, setDetail] = useState<RouteDetailResponse | null>(null);
  const [customTerminalText, setCustomTerminalText] = useState('');
  const [message, setMessage] = useState('');
  const [activeStage, setActiveStage] = useState<StageKey>('route');
  const [highlightKey, setHighlightKey] = useState<HighlightKey>(null);
  const [historyPast, setHistoryPast] = useState<HistorySnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<HistorySnapshot[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAddStationModalOpen, setIsAddStationModalOpen] = useState(false);
  const [isStationEditModalOpen, setIsStationEditModalOpen] = useState(false);
  const [mobileEditTab, setMobileEditTab] = useState<MobileEditTab>('settings');
  const [previewScale, setPreviewScale] = useState(1);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportScale, setExportScale] = useState(3);
  const [exportFileName, setExportFileName] = useState('');
  const [exportWhiteBg, setExportWhiteBg] = useState(true);
  const [downloadFallback, setDownloadFallback] = useState<{ url: string; filename: string } | null>(null);
  const [stageTouched, setStageTouched] = useState<StageTouched>({
    route: false,
    global: false,
    stationBasic: false,
    layout: false,
    stationAdvanced: false,
    export: false,
  });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const snapshotRef = useRef<HistorySnapshot | null>(null);
  const selectedHeaderLogo: HeaderLogoKey = headerLogo || 'gbus';
  const localFontsSupported = isClient && typeof (window as Window & { queryLocalFonts?: () => Promise<Array<{ family: string }>> }).queryLocalFonts === 'function';

  useEffect(() => {
    setIsClient(true);
  }, []);

  function getRouteNameStyle(routeTypeCd?: string): React.CSSProperties {
    const code = String(routeTypeCd || '').trim();
    if (code === '16') return { color: '#e60012', fontWeight: 700 };
    if (code === '11' || code === '14' || code === '21') return { color: '#e60012', fontWeight: 700 };
    if (code === '12' || code === '22' || code === '42') return { color: '#0068b7', fontWeight: 700 };
    if (code === '13' || code === '23') return { color: '#33CC99', fontWeight: 700 };
    if (code === '30') return { color: '#ffc600', fontWeight: 700 };
    if (code === '15') return { color: '#bb2266', fontWeight: 700 };
    return { color: '#6b7280', fontWeight: 700 };
  }

  function getDefaultThemeByRouteType(routeTypeCd?: string): ThemeName {
    const code = String(routeTypeCd || '').trim();
    if (code === '14') return 'black';
    if (code === '16' || code === '11' || code === '21' || code === '15') return 'red';
    if (code === '12' || code === '22' || code === '42') return 'gyeonggi-blue';
    if (code === '13' || code === '23') return 'teal';
    if (code === '30') return 'yellow';
    return 'black';
  }

  function getDefaultHeaderLogoByRouteName(routeName?: string): HeaderLogoKey {
    const normalized = String(routeName || '').trim().toUpperCase();
    return normalized.startsWith('M') ? 'mbus' : 'gbus';
  }

  function touchStage(stage: StageKey) {
    setStageTouched((prev) => (prev[stage] ? prev : { ...prev, [stage]: true }));
  }

  function pulseHighlight(key: Exclude<HighlightKey, null>) {
    setHighlightKey(key);
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => setHighlightKey(null), 900);
  }

  const cloneSnapshot = useCallback((): HistorySnapshot => {
    return {
      themeName,
      headerLogo,
      customTerminalText,
      layoutOverride: { ...layoutOverride },
      typographySettings: JSON.parse(JSON.stringify(typographySettings)),
      stationOverrides: JSON.parse(JSON.stringify(stationOverrides)),
      stationCatalog: stationCatalog.map((item) => ({ ...item, directions: [...item.directions] })),
      selectedStationId,
    };
  }, [themeName, headerLogo, customTerminalText, layoutOverride, typographySettings, stationOverrides, stationCatalog, selectedStationId]);

  const applySnapshot = useCallback((snapshot: HistorySnapshot) => {
    setThemeName(snapshot.themeName);
    setHeaderLogo(snapshot.headerLogo);
    setCustomTerminalText(snapshot.customTerminalText);
    setLayoutOverride(snapshot.layoutOverride);
    setTypographySettings(snapshot.typographySettings ?? defaultTypographySettings);
    setStationOverrides(snapshot.stationOverrides);
    setStationCatalog(snapshot.stationCatalog);
    setSelectedStationId(snapshot.selectedStationId);
  }, []);

  async function loadLocalFonts() {
    if (!localFontsSupported) return;
    setShowFontLicenseNotice(true);
    try {
      const api = (window as unknown as { queryLocalFonts: () => Promise<Array<{ family: string }>> }).queryLocalFonts;
      const localFonts = await api();
      const localOptions: FontOption[] = [...new Set(localFonts.map((item) => item.family.trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'ko'))
        .map((family) => ({ id: family, label: `${family} (기기 폰트)`, source: 'local' as const }));
      const merged = [...presetFontFamilies];
      localOptions.forEach((option) => {
        if (!merged.some((base) => base.id === option.id)) merged.push(option);
      });
      setFontOptions(merged);
      setLocalFontsLoaded(true);
    } catch (error) {
      setMessage(`기기 폰트 조회 실패: ${(error as Error).message}`);
    }
  }

  function commitHistory() {
    const current = snapshotRef.current;
    if (!current) return;
    setHistoryPast((prev) => [...prev.slice(-79), current]);
    setHistoryFuture([]);
  }

  const undoHistory = useCallback(() => {
    setHistoryPast((prev) => {
      if (!prev.length) return prev;
      const current = snapshotRef.current;
      const nextPast = [...prev];
      const target = nextPast.pop() as HistorySnapshot;
      if (current) setHistoryFuture((future) => [...future, current]);
      applySnapshot(target);
      return nextPast;
    });
  }, [applySnapshot]);

  const redoHistory = useCallback(() => {
    setHistoryFuture((prev) => {
      if (!prev.length) return prev;
      const current = snapshotRef.current;
      const nextFuture = [...prev];
      const target = nextFuture.pop() as HistorySnapshot;
      if (current) setHistoryPast((past) => [...past.slice(-79), current]);
      applySnapshot(target);
      return nextFuture;
    });
  }, [applySnapshot]);

  useEffect(() => {
    snapshotRef.current = cloneSnapshot();
  }, [cloneSnapshot]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod) return;

      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoHistory();
        return;
      }

      if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redoHistory();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undoHistory, redoHistory]);

  function submitRouteSearch() {
    touchStage('route');
    const keyword = queryInput.trim();
    if (!keyword) {
      setAttemptedEmptyRouteSearch(true);
      setHasSearchedRoute(false);
      setRoutes([]);
      setQuery('');
      return;
    }

    setAttemptedEmptyRouteSearch(false);
    setQuery(keyword);
    setHasSearchedRoute(true);
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/routes?q=${encodeURIComponent(query)}&limit=40`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data: RouteSummary[]) => {
        setRoutes(data);
        if (selectedRouteId && !data.some((route) => route.routeId === selectedRouteId)) {
          setSelectedRouteId('');
          setDetail(null);
          setMessage('검색 결과가 바뀌어 기존 노선 선택이 해제되었습니다. 다시 선택해 주세요.');
        }
        if (!data.length) {
          setMessage('검색 결과가 없습니다.');
        }
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
  }, [selectedRouteId, routeSelectionTick]);

  useEffect(() => {
    let cancelled = false;

    fetch(headerLogoOptions[selectedHeaderLogo].src)
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (!blob) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          if (cancelled) return;
          if (typeof reader.result === 'string') {
            setHeaderLogoDataUrl(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => {
        if (!cancelled) setHeaderLogoDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [selectedHeaderLogo]);

  useEffect(() => {
    let cancelled = false;

    fetch('/mbus_m.png')
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (!blob) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          if (cancelled) return;
          if (typeof reader.result === 'string') {
            setMbusMarkDataUrl(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => {
        if (!cancelled) setMbusMarkDataUrl('');
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
      const normalized = merged.map((station, index) => ({ ...station, minOrder: index + 1 }));
      setStationCatalog(normalized);
      setBaseStationCatalog(normalized);
      setSelectedStationId((prev) => (prev && byId.has(prev) ? prev : merged[0]?.stationId ?? ''));
    });
  }, [selectedRouteId]);

  const selectedStationName = selectedStationId
    ? stationCatalog.find((station) => station.stationId === selectedStationId)?.stationName ?? ''
    : '';

  const hasStationResetChanges = useMemo(() => {
    const normalize = (list: StationListItem[]) =>
      list.map((station) => ({
        stationId: station.stationId,
        stationName: station.stationName,
        directions: [...station.directions].sort(),
        minOrder: station.minOrder,
        isCustom: Boolean(station.isCustom),
      }));

    const catalogChanged = JSON.stringify(normalize(stationCatalog)) !== JSON.stringify(normalize(baseStationCatalog));
    const overridesChanged = Object.keys(stationOverrides).length > 0;
    const filterChanged = stationSearch.trim() !== '' || filterInMapOnly || filterCustomOnly;
    const selectionChanged = selectedStationId !== (baseStationCatalog[0]?.stationId ?? '');

    return catalogChanged || overridesChanged || filterChanged || selectionChanged;
  }, [stationCatalog, baseStationCatalog, stationOverrides, stationSearch, filterInMapOnly, filterCustomOnly, selectedStationId]);

  const theme = themes[themeName || 'teal'];
  const terminalText = customTerminalText.trim() || (detail ? formatTerminal(detail.route, detail.direction) : '출발지 - 목적지');
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

  function updateTypography<K extends keyof TypographyStyle>(target: keyof TypographySettings, key: K, value: TypographyStyle[K]) {
    setTypographySettings((prev) => ({
      ...prev,
      [target]: {
        ...prev[target],
        [key]: value,
      },
    }));
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

  function removeSelectedStation() {
    const targetId = selectedStationId;
    if (!targetId) return;

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

  function resetStationCatalog() {
    setStationCatalog(baseStationCatalog.map((station, index) => ({ ...station, minOrder: index + 1 })));
    setStationOverrides({});
    setSelectedStationId(baseStationCatalog[0]?.stationId ?? '');
    setStationSearch('');
    setFilterInMapOnly(false);
    setFilterCustomOnly(false);
  }

  function buildExportSvgText() {
    if (!svgRef.current) return '';

    const serializer = new XMLSerializer();
    const rawSvgText = serializer.serializeToString(svgRef.current);
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawSvgText, 'image/svg+xml');
    const imageNodes = Array.from(doc.querySelectorAll('image'));
    let changed = false;

    imageNodes.forEach((node) => {
      const href = node.getAttribute('href') ?? node.getAttribute('xlink:href') ?? '';
      if (href.includes('mbus_m.png')) {
        if (!mbusMarkDataUrl) return;
        node.setAttribute('href', mbusMarkDataUrl);
        node.removeAttribute('xlink:href');
        changed = true;
        return;
      }

      if (href.includes('gbus.png') || href.includes('mbus.png') || href.includes('public_bus.png')) {
        if (!headerLogoDataUrl) return;
        node.setAttribute('href', headerLogoDataUrl);
        node.removeAttribute('xlink:href');
        changed = true;
      }
    });

    if (!changed) return rawSvgText;

    const selectedMarkers = Array.from(doc.querySelectorAll('[data-selected="1"]'));
    selectedMarkers.forEach((node) => {
      const baseStroke = node.getAttribute('data-base-stroke');
      const baseStrokeWidth = node.getAttribute('data-base-stroke-width');
      if (baseStroke) node.setAttribute('stroke', baseStroke);
      if (baseStrokeWidth) node.setAttribute('stroke-width', baseStrokeWidth);
    });

    Array.from(doc.querySelectorAll('[data-selected]')).forEach((node) => {
      node.removeAttribute('data-selected');
      node.removeAttribute('data-base-stroke');
      node.removeAttribute('data-base-stroke-width');
    });

    return serializer.serializeToString(doc);
  }

  function runExportWithoutHighlight(exporter: () => void) {
    if (!highlightKey) {
      exporter();
      return;
    }

    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }

    setHighlightKey(null);
    window.requestAnimationFrame(() => {
      exporter();
    });
  }

  function zoomPreview(delta: number) {
    setPreviewScale((prev) => Math.min(2.5, Math.max(0.4, Number((prev + delta).toFixed(2)))));
  }

  function fitPreviewToStage() {
    const stageEl = previewStageRef.current;
    const svgEl = svgRef.current;
    if (!stageEl || !svgEl) {
      setPreviewScale(1);
      return;
    }
    const stageRect = stageEl.getBoundingClientRect();
    const svgRect = svgEl.getBoundingClientRect();
    const baseWidth = svgRect.width / Math.max(previewScale, 0.0001);
    const baseHeight = svgRect.height / Math.max(previewScale, 0.0001);
    const widthScale = (stageRect.width - 16) / Math.max(baseWidth, 1);
    const heightScale = (stageRect.height - 16) / Math.max(baseHeight, 1);
    const next = Math.min(widthScale, heightScale, 2.5);
    const fittedScale = Math.min(2.5, Math.max(0.4, Number(next.toFixed(2))));
    setPreviewScale(fittedScale);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const maxLeft = Math.max(stageEl.scrollWidth - stageEl.clientWidth, 0);
        const maxTop = Math.max(stageEl.scrollHeight - stageEl.clientHeight, 0);
        stageEl.scrollLeft = maxLeft / 2;
        stageEl.scrollTop = window.innerWidth <= 900 ? 0 : maxTop / 2;
      });
    });
  }

  useEffect(() => {
    if (!detail) return;
    requestAnimationFrame(() => {
      fitPreviewToStage();
    });
  }, [selectedRouteId, detail]);

  function triggerDownload(url: string, filename: string) {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    // 브라우저 사용자 제스처 제한으로 자동 다운로드가 막히는 경우를 대비해
    // 모달에 수동 다운로드 링크를 노출한다.
    setDownloadFallback({ url, filename });

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  function submitExport() {
    if (!detail) return;
    setDownloadFallback(null);
    const safeName = (exportFileName.trim() || `route-${detail.route.routeName}-${direction}`).replace(/[\\/:*?"<>|]/g, '_');

    if (exportFormat === 'svg') {
      runExportWithoutHighlight(() => {
        const svgText = buildExportSvgText();
        if (!svgText) return;
        const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        triggerDownload(url, `${safeName}.svg`);
      });
    } else {
      runExportWithoutHighlight(() => {
        const svgText = buildExportSvgText();
        if (!svgText || !svgRef.current) return;
        const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const image = new Image();
        image.onload = () => {
          const box = svgRef.current?.viewBox.baseVal;
          if (!box) return;
          const canvas = document.createElement('canvas');
          canvas.width = box.width * exportScale;
          canvas.height = box.height * exportScale;
          const context = canvas.getContext('2d');
          if (!context) return;
          if (exportWhiteBg) {
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
          }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (!blob) return;
            const pngUrl = URL.createObjectURL(blob);
            triggerDownload(pngUrl, `${safeName}.png`);
          });
          window.setTimeout(() => {
            URL.revokeObjectURL(url);
          }, 1500);
        };
        image.src = url;
      });
    }

    touchStage('export');
  }

  const connectorTargetId =
    stationOverrides[effectiveEndId]?.connectedToStationId && displayedStationIds.has(stationOverrides[effectiveEndId].connectedToStationId ?? '')
      ? String(stationOverrides[effectiveEndId].connectedToStationId)
      : '';

  const filteredStationCatalog = useMemo(() => {
    const keyword = stationSearch.trim().toLowerCase();
    return stationCatalog.filter((station) => {
      if (filterInMapOnly && !displayedStationIds.has(station.stationId)) return false;
      if (filterCustomOnly && !station.isCustom) return false;
      if (!keyword) return true;
      return station.stationName.toLowerCase().includes(keyword);
    });
  }, [stationCatalog, stationSearch, filterInMapOnly, filterCustomOnly, displayedStationIds]);

  const layoutWarnings = useMemo<LayoutWarning[]>(() => {
    const warnings: LayoutWarning[] = [];
    const lineSpan = layoutOverride.lineEndX - layoutOverride.lineStartX;
    if (lineSpan < 260) {
      warnings.push({
        id: 'lineSpan',
        title: '기준선 간격이 좁음',
        detail: '좌/우 기준선 간격이 작아 정류장 라벨 및 선형 겹침 가능성이 큽니다.',
      });
    }

    if (sourceStations.length >= 22 && layoutOverride.rowHeight <= 54 && layoutOverride.labelAngle <= -58) {
      warnings.push({
        id: 'labelDensity',
        title: '라벨 밀집 위험',
        detail: '정류장 수 대비 행 간격/각도 조합으로 라벨 가독성이 떨어질 수 있습니다.',
      });
    }

    if (layoutOverride.cornerStationGap < layoutOverride.turnRadius * 0.7) {
      warnings.push({
        id: 'cornerGap',
        title: '유턴 구간 간섭 위험',
        detail: '유턴 반경 대비 인접 정류장 간격이 좁아 코너 구간이 답답해질 수 있습니다.',
      });
    }

    return warnings;
  }, [layoutOverride, sourceStations.length]);

  function applyLayoutWarningFix(id: LayoutWarning['id']) {
    touchStage('layout');
    setActiveStage('layout');
    setLayoutOverride((prev) => {
      if (id === 'lineSpan') {
        return {
          ...prev,
          lineStartX: Math.min(prev.lineStartX, 46),
          lineEndX: Math.max(prev.lineEndX, 430),
        };
      }
      if (id === 'labelDensity') {
        return {
          ...prev,
          rowHeight: Math.max(prev.rowHeight, 58),
          labelAngle: Math.min(prev.labelAngle, -52),
        };
      }
      return {
        ...prev,
        cornerStationGap: Math.max(prev.cornerStationGap, Math.round(prev.turnRadius * 0.9)),
      };
    });
  }

  const hasRouteSelection = Boolean(selectedRouteId && detail);
  const hasStationSelected = Boolean(selectedStationId);
  const hasAdvancedStationEdits = Object.values(stationOverrides).some(
    (value) =>
      Boolean(value.connectedToStationId) ||
      Boolean(value.segmentLabel?.trim()) ||
      Number(value.segmentGap ?? 0) > 0 ||
      value.pointMode === 'subwayTransfer',
  );

  const stageItems: Array<{ key: StageKey; label: string; status: 'done' | 'todo' }> = [
    { key: 'route', label: '1) 노선 선택', status: stageTouched.route ? 'done' : 'todo' },
    { key: 'global', label: '2) 전역 설정', status: stageTouched.global ? 'done' : 'todo' },
    { key: 'stationBasic', label: '3) 정류장 편집 기본', status: stageTouched.stationBasic ? 'done' : 'todo' },
    {
      key: 'stationAdvanced',
      label: '4) 정류장 편집 고급',
      status: stageTouched.stationAdvanced && hasAdvancedStationEdits ? 'done' : 'todo',
    },
    {
      key: 'layout',
      label: '5) 레이아웃 조정',
      status: stageTouched.layout ? 'done' : 'todo',
    },
    { key: 'export', label: '6) 내보내기', status: stageTouched.export ? 'done' : 'todo' },
  ];

  const canOpen = (stage: StageKey) => {
    if (stage === 'route') return true;
    if (stage === 'global') return hasRouteSelection;
    if (stage === 'stationBasic') return hasRouteSelection;
    if (stage === 'layout') return hasRouteSelection;
    if (stage === 'stationAdvanced') return hasStationSelected;
    return hasRouteSelection;
  };

  const startMarkerStationId = useMemo(() => {
    if (effectiveStartId && displayedStationIds.has(effectiveStartId)) return effectiveStartId;
    return filteredStationCatalog.find((station) => displayedStationIds.has(station.stationId))?.stationId ?? '';
  }, [effectiveStartId, filteredStationCatalog, displayedStationIds]);

  return (
    <main className="app-shell">
      <aside
        className={`control-panel ${mobileEditTab === 'stations' ? 'mobile-hidden' : ''}`}
        data-mobile-tab={mobileEditTab}
      >
        <section className="stage-nav" aria-label="작업 단계">
          {stageItems.map((stage) => (
            <button
              key={stage.key}
              type="button"
              className={`stage-item ${activeStage === stage.key ? 'active' : ''}`}
              disabled={!canOpen(stage.key)}
              onClick={() => setActiveStage(stage.key)}
            >
              <span>{stage.label}</span>
              <em className={`stage-badge ${stage.status}`}>{stage.status === 'done' ? '완료' : '대기'}</em>
            </button>
          ))}
        </section>

        <details className="panel-group route-group" open={activeStage === 'route' || activeStage === 'global'}>
          <summary>기본 설정</summary>
          <h3 className="panel-title">기본 설정 편집</h3>
          <label className="field">
            노선 검색/선택
            <div className="route-search-row">
              <input
                value={queryInput}
                onChange={(event) => {
                  touchStage('route');
                  setQueryInput(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    submitRouteSearch();
                  }
                }}
                placeholder="노선명 키워드"
              />
              <button type="button" className="route-search-button" onClick={submitRouteSearch}>검색</button>
            </div>
          </label>

          <div className="field route-select-field">
            {
              <ul
                className={`route-search-results ${hasSearchedRoute && routes.length === 0 ? 'no-results' : ''}`}
                role="listbox"
                aria-label="노선 검색 결과"
              >
                {!hasSearchedRoute && (
                  <li className="route-result-empty">
                    {attemptedEmptyRouteSearch ? '노선명 키워드를 입력하세요.' : '노선을 검색하세요.'}
                  </li>
                )}
                {hasSearchedRoute &&
                  routes.map((route) => (
                    <li key={route.routeId}>
                      <button
                        type="button"
                        className={`route-result-item ${selectedRouteId === route.routeId ? 'active' : ''}`}
                        onClick={() => {
                          touchStage('route');
                          setSelectedRouteId(route.routeId);
                          setThemeName(getDefaultThemeByRouteType(route.routeTypeCd));
                          setHeaderLogo(getDefaultHeaderLogoByRouteName(route.routeName));
                          setRouteSelectionTick((prev) => prev + 1);
                          setMessage('');
                        }}
                      >
                        <span style={getRouteNameStyle(route.routeTypeCd)}>{route.routeName}</span> · {route.startStationName} → {route.endStationName}
                      </button>
                    </li>
                  ))}
                {hasSearchedRoute && routes.length === 0 && <li className="route-result-empty route-result-empty-muted">검색 결과가 없습니다.</li>}
              </ul>
            }
          </div>

          <label className="field">
            <span className="field-head">
              노선 색상 테마
              <button
                type="button"
                className="mini-reset"
                onClick={() => {
                  commitHistory();
                  touchStage('global');
                  setThemeName('');
                  pulseHighlight('line');
                }}
              >
                reset
              </button>
            </span>
            <select
              value={themeName}
              onChange={(event) => {
                commitHistory();
                touchStage('global');
                setThemeName(event.target.value as ThemeName);
                pulseHighlight('line');
              }}
            >
              <option value="" disabled>
                테마 선택
              </option>
              {Object.entries(themes).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
          </label>

        </details>

        <details className="panel-group layout-group" open={activeStage === 'layout'}>
          <summary>레이아웃 조정</summary>
          {layoutWarnings.length > 0 && (
            <div className="layout-warning-box">
              <p className="layout-warning-title">충돌/가독성 경고 {layoutWarnings.length}건</p>
              {layoutWarnings.map((warning) => (
                <div key={warning.id} className="layout-warning-item">
                  <div>
                    <strong>{warning.title}</strong>
                    <p>{warning.detail}</p>
                  </div>
                  <button type="button" className="mini-reset" onClick={() => applyLayoutWarningFix(warning.id)}>
                    자동 보정
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="field">
            편집 항목 선택
            <select value={editCategory} onChange={(event) => setEditCategory(event.target.value as EditCategoryKey)}>
              <option value="terminal">출발-도착지</option>
              <option value="routeInfo">노선정보</option>
              <option value="stationLabel">정류장명</option>
              <option value="headerTitle">노선안내도 헤더</option>
              <option value="routeName">노선명</option>
              <option value="line">노선선</option>
              <option value="layout">레이아웃</option>
            </select>
          </label>

            {editCategory === 'terminal' && (
              <label className="field">
                출발-도착지 텍스트
                <input
                  value={customTerminalText}
                  onChange={(event) => {
                    commitHistory();
                    touchStage('global');
                    setCustomTerminalText(event.target.value);
                    pulseHighlight('terminal');
                  }}
                  placeholder="비워두면 자동(기본값)"
                />
              </label>
            )}

            {editCategory === 'headerTitle' && (
              <label className="field">
                헤더 로고
                <select
                  value={headerLogo}
                  onChange={(event) => {
                    commitHistory();
                    touchStage('global');
                    setHeaderLogo(event.target.value as HeaderLogoKey);
                    pulseHighlight('header');
                  }}
                >
                  <option value="" disabled>
                    로고 선택
                  </option>
                  {Object.entries(headerLogoOptions).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {(['terminal', 'routeInfo', 'stationLabel', 'headerTitle', 'routeName'] as Array<keyof TypographySettings>).includes(editCategory as keyof TypographySettings) && (
              <>
                <label className="field">
                  <span className="field-head">
                    폰트 패밀리
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      <button type="button" className="mini-reset" onClick={loadLocalFonts} disabled={!localFontsSupported || localFontsLoaded}>
                        {localFontsSupported ? (localFontsLoaded ? '기기폰트로드 완료' : '기기폰트로드') : '기기폰트 미지원'}
                      </button>
                      <button
                        type="button"
                        className="mini-reset"
                        onClick={() => {
                          touchStage('global');
                          updateTypography(
                            editCategory as keyof TypographySettings,
                            'fontFamily',
                            defaultTypographySettings[editCategory as keyof TypographySettings].fontFamily,
                          );
                        }}
                      >
                        reset
                      </button>
                    </span>
                  </span>
                  <select
                    value={typographySettings[editCategory as keyof TypographySettings].fontFamily}
                    onChange={(event) => {
                      commitHistory();
                      touchStage('global');
                      updateTypography(editCategory as keyof TypographySettings, 'fontFamily', event.target.value);
                    }}
                  >
                    {fontOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>

                {showFontLicenseNotice && (
                  <div className="font-license-notice">
                    <p>[!] 기기 폰트 사용 시 해당 폰트 라이선스와 사용 권한은 사용자 책임입니다. 상업적 이용 또는 외부 배포 전 폰트 라이선스를 확인하세요.</p>
                  </div>
                )}

                <label className="field">
                  <span className="field-head">
                    폰트 크기: {typographySettings[editCategory as keyof TypographySettings].fontSize}
                    <button type="button" className="mini-reset" onClick={() => updateTypography(editCategory as keyof TypographySettings, 'fontSize', defaultTypographySettings[editCategory as keyof TypographySettings].fontSize)}>reset</button>
                  </span>
                  <input type="range" min="2" max="200" step="1" value={typographySettings[editCategory as keyof TypographySettings].fontSize} onChange={(event) => { commitHistory(); touchStage('global'); updateTypography(editCategory as keyof TypographySettings, 'fontSize', Number(event.target.value)); }} />
                </label>

                <label className="field">
                  <span className="field-head">
                    자간: {typographySettings[editCategory as keyof TypographySettings].letterSpacing.toFixed(2)}
                    <button type="button" className="mini-reset" onClick={() => updateTypography(editCategory as keyof TypographySettings, 'letterSpacing', defaultTypographySettings[editCategory as keyof TypographySettings].letterSpacing)}>reset</button>
                  </span>
                  <input type="range" step="0.05" min="-3" max="3" value={typographySettings[editCategory as keyof TypographySettings].letterSpacing} onChange={(event) => { commitHistory(); touchStage('global'); updateTypography(editCategory as keyof TypographySettings, 'letterSpacing', Number(event.target.value)); }} />
                </label>

                <label className="field">
                  <span className="field-head">
                    장평(%): {typographySettings[editCategory as keyof TypographySettings].fontStretchPercent}
                    <button type="button" className="mini-reset" onClick={() => updateTypography(editCategory as keyof TypographySettings, 'fontStretchPercent', defaultTypographySettings[editCategory as keyof TypographySettings].fontStretchPercent)}>reset</button>
                  </span>
                  <input type="range" min="50" max="130" step="1" value={typographySettings[editCategory as keyof TypographySettings].fontStretchPercent} onChange={(event) => { commitHistory(); touchStage('global'); updateTypography(editCategory as keyof TypographySettings, 'fontStretchPercent', Number(event.target.value)); }} />
                </label>
              </>
            )}

            {editCategory === 'stationLabel' && (
              <label className="field">
                <span className="field-head">정류장명 각도: {layoutOverride.labelAngle}도<button type="button" className="mini-reset" onClick={() => setLayoutOverride((prev) => ({ ...prev, labelAngle: defaultLayoutOverride.labelAngle }))}>reset</button></span>
                <input type="range" min="-70" max="-30" value={layoutOverride.labelAngle} onChange={(event) => { touchStage('layout'); setLayoutOverride((prev) => ({ ...prev, labelAngle: Number(event.target.value) })); pulseHighlight('labels'); }} />
              </label>
            )}

            {editCategory === 'line' && (
              <>
                <label className="field"><span className="field-head">노선선 두께: {layoutOverride.lineStrokeWidth.toFixed(1)}<button type="button" className="mini-reset" onClick={() => setLayoutOverride((prev) => ({ ...prev, lineStrokeWidth: defaultLayoutOverride.lineStrokeWidth }))}>reset</button></span><input type="range" min="2" max="6" step="0.2" value={layoutOverride.lineStrokeWidth} onChange={(event) => { touchStage('layout'); setLayoutOverride((prev) => ({ ...prev, lineStrokeWidth: Number(event.target.value) })); pulseHighlight('line'); }} /></label>
                <label className="field"><span className="field-head">점 크기: {layoutOverride.terminalMarkerRadius.toFixed(1)}<button type="button" className="mini-reset" onClick={() => setLayoutOverride((prev) => ({ ...prev, terminalMarkerRadius: defaultLayoutOverride.terminalMarkerRadius }))}>reset</button></span><input type="range" min="2.5" max="5" step="0.1" value={layoutOverride.terminalMarkerRadius} onChange={(event) => { touchStage('layout'); setLayoutOverride((prev) => ({ ...prev, terminalMarkerRadius: Number(event.target.value) })); pulseHighlight('station'); }} /></label>
                <label className="field"><span className="field-head">유턴 반경: {layoutOverride.turnRadius}<button type="button" className="mini-reset" onClick={() => setLayoutOverride((prev) => ({ ...prev, turnRadius: defaultLayoutOverride.turnRadius }))}>reset</button></span><input type="range" min="8" max="30" value={layoutOverride.turnRadius} onChange={(event) => { touchStage('layout'); setLayoutOverride((prev) => ({ ...prev, turnRadius: Number(event.target.value) })); pulseHighlight('line'); }} /></label>
                <label className="field"><span className="field-head">유턴-인접정류장 간격: {layoutOverride.cornerStationGap}<button type="button" className="mini-reset" onClick={() => setLayoutOverride((prev) => ({ ...prev, cornerStationGap: defaultLayoutOverride.cornerStationGap }))}>reset</button></span><input type="range" min="8" max="32" value={layoutOverride.cornerStationGap} onChange={(event) => { touchStage('layout'); setLayoutOverride((prev) => ({ ...prev, cornerStationGap: Number(event.target.value) })); pulseHighlight('line'); }} /></label>
              </>
            )}

            {editCategory === 'layout' && (
              <>
                <label className="field"><span className="field-head">좌측 기준선: {layoutOverride.lineStartX}<button type="button" className="mini-reset" onClick={() => setLayoutOverride((prev) => ({ ...prev, lineStartX: defaultLayoutOverride.lineStartX }))}>reset</button></span><input type="range" min="8" max="120" value={layoutOverride.lineStartX} onChange={(event) => { touchStage('layout'); setLayoutOverride((prev) => ({ ...prev, lineStartX: Number(event.target.value) })); pulseHighlight('line'); }} /></label>
                <label className="field"><span className="field-head">우측 기준선: {layoutOverride.lineEndX}<button type="button" className="mini-reset" onClick={() => setLayoutOverride((prev) => ({ ...prev, lineEndX: defaultLayoutOverride.lineEndX }))}>reset</button></span><input type="range" min="380" max="492" value={layoutOverride.lineEndX} onChange={(event) => { touchStage('layout'); setLayoutOverride((prev) => ({ ...prev, lineEndX: Number(event.target.value) })); pulseHighlight('line'); }} /></label>
              </>
            )}

        </details>

        {message && <p className="message">{message}</p>}
      </aside>

      <section className="preview-panel">
        <div className="preview-header">
          <h1>노선안내도 Generator</h1>
          <div className="preview-history-actions" aria-label="히스토리 액션">
            <button
              type="button"
              className="icon-button"
              onClick={() => zoomPreview(-0.1)}
              title="축소"
              aria-label="축소"
            >
              −
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => zoomPreview(0.1)}
              title="확대"
              aria-label="확대"
            >
              +
            </button>
            <button
              type="button"
              className="icon-button fit-button"
              onClick={fitPreviewToStage}
              title="화면에 맞게"
              aria-label="화면에 맞게"
            >
              FIT
            </button>
            <span className="action-divider" aria-hidden="true" />
            <button
              type="button"
              className="icon-button"
              onClick={undoHistory}
              disabled={historyPast.length === 0}
              title="실행취소 (Ctrl/Cmd+Z)"
              aria-label="실행취소 (Ctrl/Cmd+Z)"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M9 6L3 12L9 18" fill="currentColor" stroke="none" transform="translate(0 -5.5)" />
                <path d="M6.5 18H14.8C18.2 18 21 15.2 21 11.8C21 8.4 18.2 5.6 14.8 5.6H8.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={redoHistory}
              disabled={historyFuture.length === 0}
              title="다시실행 (Ctrl+Y / Shift+Ctrl/Cmd+Z)"
              aria-label="다시실행 (Ctrl+Y / Shift+Ctrl/Cmd+Z)"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M15 6L21 12L15 18" fill="currentColor" stroke="none" transform="translate(0 -5.5)" />
                <path d="M17.5 18H9.2C5.8 18 3 15.2 3 11.8C3 8.4 5.8 5.6 9.2 5.6H15.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="action-divider" aria-hidden="true" />
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                if (!detail) return;
                setExportFileName(`route-${detail.route.routeName}`);
                setExportFormat('png');
                setExportScale(3);
                setExportWhiteBg(true);
                setIsExportModalOpen(true);
              }}
              disabled={!detail}
              title="내보내기"
              aria-label="내보내기"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M12 4V15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M8 11L12 15L16 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 18H19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        <div className="preview-stage" ref={previewStageRef}>
          <div className="preview-zoom" style={{ transform: `scale(${previewScale})` }}>
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
              headerLogoKey={selectedHeaderLogo}
              headerLogo={headerLogoOptions[selectedHeaderLogo]}
              terminalText={terminalText}
              typographySettings={typographySettings}
              highlightKey={highlightKey}
              onSelectStation={setSelectedStationId}
              svgRef={svgRef}
            />
          </div>
        </div>
      </section>

      <nav className="mobile-edit-tabs" aria-label="모바일 편집 탭">
        <button
          type="button"
          className={mobileEditTab === 'settings' ? 'active' : ''}
          onClick={() => {
            setMobileEditTab('settings');
            setActiveStage('global');
          }}
        >
          설정
        </button>
        <button
          type="button"
          className={mobileEditTab === 'layout' ? 'active' : ''}
          onClick={() => {
            setMobileEditTab('layout');
            setActiveStage('layout');
          }}
        >
          레이아웃
        </button>
        <button
          type="button"
          className={mobileEditTab === 'stations' ? 'active' : ''}
          onClick={() => {
            setMobileEditTab('stations');
            setActiveStage('stationBasic');
          }}
        >
          정류장
        </button>
      </nav>

      {isExportModalOpen && (
        <div className="export-modal-backdrop" role="dialog" aria-modal="true" aria-label="내보내기 설정">
          <div className="export-modal">
            <h3>내보내기 설정</h3>
            <label className="field">
              형식
              <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as ExportFormat)}>
                <option value="png">PNG</option>
                <option value="svg">SVG</option>
              </select>
            </label>
            <label className="field">
              파일명
              <input value={exportFileName} onChange={(event) => setExportFileName(event.target.value)} placeholder="파일명" />
            </label>
            {exportFormat === 'png' && (
              <>
                <label className="field">
                  품질 배율: {exportScale}x
                  <input type="range" min="1" max="4" step="1" value={exportScale} onChange={(event) => setExportScale(Number(event.target.value))} />
                </label>
                <label className="check-field">
                  <input type="checkbox" checked={exportWhiteBg} onChange={(event) => setExportWhiteBg(event.target.checked)} />
                  흰 배경 포함
                </label>
              </>
            )}
            <div className="export-modal-actions">
              <button type="button" onClick={() => setIsExportModalOpen(false)}>취소</button>
              <button type="button" onClick={submitExport}>내보내기</button>
            </div>
            {downloadFallback && (
              <p style={{ marginTop: 10, fontSize: 13 }}>
                자동 다운로드가 차단되면
                {' '}
                <a href={downloadFallback.url} download={downloadFallback.filename}>여기를 눌러 수동 다운로드</a>
              </p>
            )}
          </div>
        </div>
      )}

      {isAddStationModalOpen && (
        <div className="export-modal-backdrop station-panel-modal-backdrop" role="dialog" aria-modal="true" aria-label="사용자 정의 정류장 추가">
          <div className="export-modal">
            <h3>사용자 정의 정류장 추가</h3>
            <p className="message">선택한 {selectedStationName || '정류장'} 정류장 다음에 추가됩니다.</p>
            <label className="field">
              정류장명
              <input value={newStationName} onChange={(event) => setNewStationName(event.target.value)} placeholder="정류장명 입력" />
            </label>
            <div className="export-modal-actions">
              <button type="button" onClick={() => setIsAddStationModalOpen(false)}>취소</button>
              <button
                type="button"
                onClick={() => {
                  touchStage('stationBasic');
                  addCustomStation();
                  setIsAddStationModalOpen(false);
                }}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {isStationEditModalOpen && selectedStationId && (
        <div className="export-modal-backdrop station-panel-modal-backdrop" role="dialog" aria-modal="true" aria-label="정류장 편집">
          <div className="export-modal station-edit-modal">
            <h3>정류장 편집</h3>
            <div className="station-edit-modal-body">
              <div className="station-editor">
                <h3 className="editor-section-title">기본 편집</h3>
                <label className="field">
                  정류장명 수정
                  <input
                    value={selectedOverride.customName}
                    onChange={(event) => { touchStage('stationBasic'); updateStationOverride(selectedStationId, { customName: event.target.value }); pulseHighlight('labels'); }}
                    placeholder="원본명 사용 시 비워두기"
                  />
                </label>

                <label className="field">
                  역할
                  <select value={selectedOverride.role} onChange={(event) => updateStationOverride(selectedStationId, { role: event.target.value as StationRole })}>
                    <option value="normal">일반</option>
                    <option value="start">출발</option>
                    <option value="end">도착</option>
                  </select>
                </label>

                <label className="field">
                  정류장 지점 유형
                  <select
                    value={selectedOverride.pointMode}
                    onChange={(event) => { touchStage('stationAdvanced'); updateStationOverride(selectedStationId, { pointMode: event.target.value as StationPointMode }); }}
                  >
                    <option value="emphasis">강조 정류장 표시</option>
                    <option value="normal">일반 정류장 표시</option>
                    {/* TODO: 환승 - 광역버스/지하철 환승 유형 옵션 재노출 및 개선 */}
                  </select>
                </label>

                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={selectedOverride.omitted}
                    onChange={(event) => { touchStage('stationBasic'); updateStationOverride(selectedStationId, { omitted: event.target.checked }); }}
                  />
                  정류장 생략
                </label>

                <details className="advanced-editor" open={activeStage === 'stationAdvanced'}>
                  <summary>고급 편집</summary>

                  {selectedStationId === effectiveEndId && (
                    <>
                      <label className="field">
                        연결 정류장
                        <select
                          value={selectedOverride.connectedToStationId ?? ''}
                          onChange={(event) => { touchStage('stationAdvanced'); updateStationOverride(selectedStationId, { connectedToStationId: event.target.value }); }}
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
                          onChange={(event) => {
                            touchStage('stationAdvanced');
                            updateStationOverride(selectedStationId, {
                              connectorAnchor: event.target.value as 'center' | 'left' | 'right',
                            });
                          }}
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
                      onChange={(event) => { touchStage('stationAdvanced'); updateStationOverride(selectedStationId, { segmentLabel: event.target.value }); pulseHighlight('segment'); }}
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
                      onChange={(event) => { touchStage('stationAdvanced'); updateStationOverride(selectedStationId, { segmentGap: Number(event.target.value) }); }}
                    />
                  </label>

                  {selectedOverride.pointMode === 'subwayTransfer' && (
                    <>
                      <label className="field">
                        지하철 표식 색상
                        <input
                          type="color"
                          value={selectedOverride.subwayColor ?? '#a855f7'}
                          onChange={(event) => { touchStage('stationAdvanced'); updateStationOverride(selectedStationId, { subwayColor: event.target.value }); }}
                        />
                      </label>
                      <label className="field">
                        지하철 라벨 텍스트
                        <input
                          value={selectedOverride.subwayLabelText ?? '지'}
                          maxLength={2}
                          onChange={(event) => { touchStage('stationAdvanced'); updateStationOverride(selectedStationId, { subwayLabelText: event.target.value }); }}
                          placeholder="예: 8"
                        />
                      </label>
                    </>
                  )}
                </details>
              </div>
            </div>
            <div className="export-modal-actions">
              <button type="button" onClick={() => setIsStationEditModalOpen(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      <aside className={`edit-panel stations-desktop ${mobileEditTab === 'stations' ? '' : 'mobile-hidden'}`}>
        <div className="edit-panel-top">
          <div className={`station-action-row ${selectedStationId ? '' : 'disabled'} ${hasStationResetChanges ? '' : 'reset-disabled'}`}>
            <button type="button" className="icon-button station-action-icon" onClick={() => setIsAddStationModalOpen(true)} disabled={!selectedStationId} title="추가" aria-label="정류장 추가">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M12 6V18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M6 12H18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <button type="button" className="icon-button station-action-icon" onClick={removeSelectedStation} disabled={!selectedStationId} title="삭제" aria-label="정류장 삭제">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M6 7H18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M9 7V5H15V7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 7L9 19H15L16 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" className="icon-button station-action-icon" onClick={() => setIsStationEditModalOpen(true)} disabled={!selectedStationId} title="편집" aria-label="정류장 편집">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M4 20H20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M6 17L7 13L15.5 4.5C16.3 3.7 17.7 3.7 18.5 4.5C19.3 5.3 19.3 6.7 18.5 7.5L10 16L6 17Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" className="icon-button station-action-icon" onClick={resetStationCatalog} disabled={!hasStationResetChanges} title="초기화" aria-label="정류장 목록 초기화">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M9 6L3 12L9 18" fill="currentColor" stroke="none" transform="translate(0 -6.8)" />
                <path d="M7.5 17.5C9 19 11 20 13.5 20C18.2 20 22 16.2 22 11.5C22 6.8 18.2 3 13.5 3C11.6 3 9.9 3.6 8.5 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="station-filter-box">
            <h3 className="editor-section-title">정류장 검색/필터</h3>
            <label className="field">
              <input
                value={stationSearch}
                onChange={(event) => {
                  touchStage('stationBasic');
                  setStationSearch(event.target.value);
                }}
                placeholder="정류장명 검색"
              />
            </label>

            <label className="check-field">
              <input
                type="checkbox"
                checked={filterInMapOnly}
                onChange={(event) => {
                  touchStage('stationBasic');
                  setFilterInMapOnly(event.target.checked);
                }}
              />
              표시 중 정류장만
            </label>

            <label className="check-field">
              <input
                type="checkbox"
                checked={filterCustomOnly}
                onChange={(event) => {
                  touchStage('stationBasic');
                  setFilterCustomOnly(event.target.checked);
                }}
              />
              사용자정의 정류장만
            </label>
          </div>

        </div>

        <div className="edit-panel-bottom">
          <div className="station-list">
            {filteredStationCatalog.map((station) => (
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
                  station.stationId === startMarkerStationId ? 'start-item' : ''
                } ${station.stationId === effectiveEndId ? 'end-item' : ''}`}
                onClick={() => {
                  touchStage('stationBasic');
                  setSelectedStationId((prev) => (prev === station.stationId ? '' : station.stationId));
                }}
              >
                <span>
                  {station.stationName}
                  {station.isCustom ? ' (사용자정의)' : ''}
                </span>
                <small>{directionLabel}</small>
                {station.stationId === startMarkerStationId && <em className="item-comment top">출발 정류장</em>}
                {station.stationId === effectiveEndId && <em className="item-comment bottom">도착 정류장</em>}
              </button>
                );
              })()
            ))}
            {filteredStationCatalog.length === 0 && <p className="message">필터 조건에 맞는 정류장이 없습니다.</p>}
          </div>
        </div>
      </aside>
    </main>
  );
}

export default App;
