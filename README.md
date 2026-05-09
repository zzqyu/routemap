# 경기도 공공버스 차내 노선안내도 테스트 웹앱

`plans/route_map_webapp_plan.md` 기반 init 버전입니다.

## 실행

### Docker Compose (refer 동일 구성)

기본 스택(`docker-compose.yml`):

```bash
make up
make logs
```

개발 스택(`docker-compose.dev.yml`):

```bash
make dev-up
make dev-logs
```

운영 스택(`docker-compose.prod.yml`):

```bash
make prod-up
make prod-logs
```

중지:

```bash
make down
make dev-down
make prod-down
```

- 외부 진입점: `http://localhost:3000` (Caddy)
- API 서버(Express): 컨테이너 내부 전용(외부 미노출)
- API 요청은 [`/api`](src/features/route-map/constants.ts:3) 경로로 호출되고, Next 리라이트([`rewrites()`](next.config.ts:6))로 `api` 서비스에 전달됩니다.

### 로컬(Node.js)

```bash
npm run dev
```

- API 서버: `http://localhost:5174`
- 웹 앱(Next.js): `http://localhost:3000`

로컬 실행 시에도 프론트엔드 API 베이스는 상대경로(`/api`)를 사용합니다.

## 구현된 init 기능

- `../basedata.db`의 `route`, `routestation` 테이블 조회
- 노선번호, 기종점, 지역명 검색
- 상행/하행 선택
- 평일, 토요일, 일요일, 공휴일 운행 정보 표시
- 평일/토요일/일요일/공휴일 정보가 모두 같으면 `매일`로 통합 표시
- 일요일/공휴일 정보만 같으면 `일요일/공휴일`로 통합 표시
- SVG 기반 노선안내도 미리보기
- 정류장 수 기반 세로 높이 자동 확장
- 좌→우, 아래 꺾기, 우→좌 왕복형 routeLine 배치
- 끝단 둥근 U턴형 routeLine 연결
- 출발지/목적지 정류장 강조
- 정류장명 대각선 배치 및 긴 이름 2줄/축소 표시
- 색상 테마 선택
  - 빨간색 `#EE2737` · Pantone 1788 C
  - 파란색 `#0085CA` · Pantone Process Blue C
  - 초록색 `#009775` · Pantone 334 C
  - 노란색 `#F2A900` · Pantone 130 C
- SVG export
- PNG export

## 검증용 예시

초기 검색어는 `300`으로 설정되어 있습니다. 실행 후 첫 번째 노선을 선택하면 샘플 노선 안내도를 확인할 수 있습니다.
