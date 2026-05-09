COMPOSE = docker compose -f docker-compose.yml
COMPOSE_DEV = docker compose -f docker-compose.dev.yml
COMPOSE_PROD = docker compose -f docker-compose.prod.yml

.PHONY: help dev-up dev-down dev-logs up down logs prod-up prod-down prod-logs web-build web-install web-clean

help:
	@echo "Make targets:"
	@echo "  up          - start base stack (caddy, web, api)"
	@echo "  down        - stop base stack"
	@echo "  logs        - follow base stack logs"
	@echo "  dev-up      - start development stack"
	@echo "  dev-down    - stop development stack"
	@echo "  dev-logs    - follow dev logs (caddy, web, api)"
	@echo "  prod-up     - start production stack"
	@echo "  prod-down   - stop production stack"
	@echo "  prod-logs   - follow production logs (caddy, web, api)"
	@echo "  web-build   - build Next.js artifacts in prod web service"
	@echo "  web-install - install Node dependencies in prod web service"
	@echo "  web-clean   - clean .next and node_modules in workspace"

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f caddy web api

dev-up:
	$(COMPOSE_DEV) up --build -d

dev-down:
	$(COMPOSE_DEV) down

dev-logs:
	$(COMPOSE_DEV) logs -f caddy web api

prod-up:
	$(COMPOSE_PROD) up --build -d

prod-down:
	$(COMPOSE_PROD) down

prod-logs:
	$(COMPOSE_PROD) logs -f caddy web api

web-build:
	$(COMPOSE_PROD) run --rm --no-deps web sh -c "npm install --no-audit --no-fund && npm run build"

web-install:
	$(COMPOSE_PROD) run --rm --no-deps web sh -c "npm install --no-audit --no-fund"

web-clean:
	rm -rf .next node_modules || true

