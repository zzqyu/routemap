COMPOSE = docker compose -f docker-compose.yml
COMPOSE_DEV = docker compose -f docker-compose.dev.yml
COMPOSE_PROD = docker compose -f docker-compose.prod.yml
COMPOSE_PROD_APP = docker compose -f docker-compose.prod.app.yml

-include deploy.config.mk

SSH_USER ?= root
SSH_HOST ?= bustal-time.kro.kr
SSH_PORT ?= 2222
REMOTE_DIR ?= /root/routemap
REMOTE_COMPOSE_FILE ?= docker-compose.prod.app.yml
REMOTE_BRANCH ?= master
SSH = ssh -p $(SSH_PORT) $(SSH_USER)@$(SSH_HOST)

.PHONY: help dev-up dev-down dev-logs up down logs prod-up prod-down prod-logs prod-up-app prod-down-app prod-logs-app web-build web-install web-clean remote-status remote-pull remote-up-app remote-down-app remote-logs-app remote-ps deploy-app

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
	@echo "  prod-up-app   - start production app stack only (web, api)"
	@echo "  prod-down-app - stop production app stack only (web, api)"
	@echo "  prod-logs-app - follow production app logs (web, api)"
	@echo "  web-build   - build Next.js artifacts in prod web service"
	@echo "  web-install - install Node dependencies in prod web service"
	@echo "  web-clean   - clean .next and node_modules in workspace"
	@echo "  remote-status - show remote branch/HEAD and compose container status"
	@echo "  remote-pull   - pull latest code on remote server"
	@echo "  remote-up-app - build and start remote app stack"
	@echo "  remote-down-app - stop remote app stack"
	@echo "  remote-logs-app - follow remote app logs"
	@echo "  remote-ps     - show remote app container status"
	@echo "  deploy-app    - remote pull + rebuild + restart + status"

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

prod-up-app:
	$(COMPOSE_PROD_APP) up --build -d

prod-down-app:
	$(COMPOSE_PROD_APP) down

prod-logs-app:
	$(COMPOSE_PROD_APP) logs -f web api

web-build:
	$(COMPOSE_PROD) run --rm --no-deps web sh -c "npm install --no-audit --no-fund && npm run build"

web-install:
	$(COMPOSE_PROD) run --rm --no-deps web sh -c "npm install --no-audit --no-fund"

web-clean:
	rm -rf .next node_modules || true

remote-status:
	$(SSH) "cd $(REMOTE_DIR) && git branch --show-current && git rev-parse --short HEAD && docker-compose -f $(REMOTE_COMPOSE_FILE) ps"

remote-pull:
	$(SSH) "cd $(REMOTE_DIR) && git fetch origin && git checkout $(REMOTE_BRANCH) && git pull origin $(REMOTE_BRANCH)"

remote-up-app:
	$(SSH) "cd $(REMOTE_DIR) && docker-compose -f $(REMOTE_COMPOSE_FILE) up -d --build"

remote-down-app:
	$(SSH) "cd $(REMOTE_DIR) && docker-compose -f $(REMOTE_COMPOSE_FILE) down"

remote-logs-app:
	$(SSH) "cd $(REMOTE_DIR) && docker-compose -f $(REMOTE_COMPOSE_FILE) logs -f web api"

remote-ps:
	$(SSH) "cd $(REMOTE_DIR) && docker-compose -f $(REMOTE_COMPOSE_FILE) ps"

deploy-app:
	$(MAKE) remote-pull
	$(MAKE) remote-up-app
	$(MAKE) remote-ps
