import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../basedata.db');

const app = express();
const port = Number(process.env.API_PORT ?? process.env.PORT ?? 5174);

app.use(cors());
app.use(express.json());

const dbPromise = open({
  filename: dbPath,
  driver: sqlite3.Database,
  mode: sqlite3.OPEN_READONLY,
});

function normalizeDirection(value) {
  return value === '하행' ? '하행' : '상행';
}

function getDirectionFields(direction) {
  const isUp = normalizeDirection(direction) === '상행';
  return {
    first: isUp ? 'upFirstTime' : 'downFirstTime',
    last: isUp ? 'upLastTime' : 'downLastTime',
    satFirst: isUp ? 'satUpFirstTime' : 'satDownFirstTime',
    satLast: isUp ? 'satUpLastTime' : 'satDownLastTime',
    sunFirst: isUp ? 'sunUpFirstTime' : 'sunDownFirstTime',
    sunLast: isUp ? 'sunUpLastTime' : 'sunDownLastTime',
    holidayFirst: isUp ? 'weUpFirstTime' : 'weDownFirstTime',
    holidayLast: isUp ? 'weUpLastTime' : 'weDownLastTime',
  };
}

function intervalText(a, b) {
  const left = Number(a);
  const right = Number(b);
  if (!Number.isFinite(left) && !Number.isFinite(right)) return '-';
  if (left === right || !Number.isFinite(right)) return `${left}분`;
  if (!Number.isFinite(left)) return `${right}분`;
  return `${Math.min(left, right)}~${Math.max(left, right)}분`;
}

function buildScheduleRows(route, direction) {
  const fields = getDirectionFields(direction);
  const startEndFields = {
    weekdayFirst: ['upFirstTime', 'downFirstTime'],
    weekdayLast: ['upLastTime', 'downLastTime'],
    satFirst: ['satUpFirstTime', 'satDownFirstTime'],
    satLast: ['satUpLastTime', 'satDownLastTime'],
    sunFirst: ['sunUpFirstTime', 'sunDownFirstTime'],
    sunLast: ['sunUpLastTime', 'sunDownLastTime'],
    holidayFirst: ['weUpFirstTime', 'weDownFirstTime'],
    holidayLast: ['weUpLastTime', 'weDownLastTime'],
  };
  const pairTime = ([startField, endField]) => `${route[startField] ?? '-'}|${route[endField] ?? '-'}`;
  const rows = [
    {
      label: '평일',
      firstTime: pairTime(startEndFields.weekdayFirst),
      lastTime: pairTime(startEndFields.weekdayLast),
      intervalText: intervalText(route.peekAlloc, route.npeekAlloc),
    },
    {
      label: '토요일',
      firstTime: pairTime(startEndFields.satFirst),
      lastTime: pairTime(startEndFields.satLast),
      intervalText: intervalText(route.satPeekAlloc, route.satNpeekAlloc),
    },
    {
      label: '일요일',
      firstTime: pairTime(startEndFields.sunFirst),
      lastTime: pairTime(startEndFields.sunLast),
      intervalText: intervalText(route.sunPeekAlloc, route.sunNpeekAlloc),
    },
    {
      label: '공휴일',
      firstTime: pairTime(startEndFields.holidayFirst),
      lastTime: pairTime(startEndFields.holidayLast),
      intervalText: intervalText(route.wePeekAlloc, route.weNpeekAlloc),
    },
  ];

  const compactSameRows = (targetRows) => {
    const first = targetRows[0];
    const everyDaySame = targetRows.every(
      (row) => row.firstTime === first.firstTime && row.lastTime === first.lastTime && row.intervalText === first.intervalText,
    );
    return everyDaySame ? [{ ...first, label: '매일' }] : targetRows;
  };

  const allSameRows = compactSameRows(rows);
  if (allSameRows.length === 1) return allSameRows;

  const sunday = rows[2];
  const holiday = rows[3];
  if (sunday.firstTime === holiday.firstTime && sunday.lastTime === holiday.lastTime && sunday.intervalText === holiday.intervalText) {
    const sat = rows[1];
    const sundayHoliday = { ...sunday, label: '일요일/공휴일' };
    const satSameAsSunHoliday =
      sat.firstTime === sundayHoliday.firstTime &&
      sat.lastTime === sundayHoliday.lastTime &&
      sat.intervalText === sundayHoliday.intervalText;

    if (satSameAsSunHoliday) {
      return compactSameRows([rows[0], { ...sat, label: '토요일/일요일/공휴일' }]);
    }

    return compactSameRows([rows[0], sat, sundayHoliday]);
  }

  return rows;
}

app.get('/api/health', async (_req, res) => {
  const db = await dbPromise;
  const routeCount = await db.get('SELECT COUNT(*) AS count FROM route');
  res.json({ ok: true, routeCount: routeCount.count });
});

app.get('/api/routes', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const db = await dbPromise;
    const like = `%${q}%`;
    const rows = await db.all(
      `SELECT routeId, routeName, startStationName, endStationName, regionName, companyName, routeTypeCd
       FROM route
       WHERE (? = '' OR routeName LIKE ? OR startStationName LIKE ? OR endStationName LIKE ? OR regionName LIKE ?)
       ORDER BY routeName COLLATE NOCASE, routeId
       LIMIT ?`,
      [q, like, like, like, like, limit],
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/routes/:routeId', async (req, res, next) => {
  try {
    const direction = normalizeDirection(req.query.direction);
    const db = await dbPromise;
    const route = await db.get('SELECT * FROM route WHERE routeId = ?', req.params.routeId);
    if (!route) {
      res.status(404).json({ message: 'route not found' });
      return;
    }
    const stations = await db.all(
      `SELECT routeId, routeName, upDown, staOrder, stationId, stationName, x, y
       FROM routestation
       WHERE routeId = ? AND upDown = ?
         AND stationName NOT LIKE '%미정차%'
       ORDER BY CAST(staOrder AS INTEGER) ASC`,
      [req.params.routeId, direction],
    );
    const terminalId = String(direction === '상행' ? route.endStationId : route.startStationId);
    const terminalName = String(direction === '상행' ? route.endStationName : route.startStationName);
    if (terminalId && !stations.some((station) => String(station.stationId) === terminalId)) {
      const last = stations[stations.length - 1];
      stations.push({
        routeId: route.routeId,
        routeName: route.routeName,
        upDown: direction,
        staOrder: Number(last?.staOrder ?? stations.length) + 1,
        stationId: terminalId,
        stationName: terminalName,
        x: last?.x ?? null,
        y: last?.y ?? null,
      });
    }
    const availableDirections = await db.all(
      `SELECT upDown, COUNT(*) AS count FROM routestation WHERE routeId = ? GROUP BY upDown`,
      req.params.routeId,
    );

    res.json({
      route,
      direction,
      availableDirections,
      scheduleRows: buildScheduleRows(route, direction),
      stations,
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: error.message ?? 'internal server error' });
});

app.listen(port, () => {
  console.log(`Route map API listening on http://localhost:${port}`);
});
