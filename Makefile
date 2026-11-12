.DEFAULT_GOAL := test
.PHONY: test build build-all build-backend build-web build-admin list-images help \
	build-api-gateway build-auth-service build-users-service build-campaign-service \
	build-game-systems-service build-sync-service build-admin-panel build-web-hub \
	build-web-campaign build-web-profile build-web-login build-web-game-systems \
	run run-backend run-web web-install web-typecheck web-test web-build check-web test-web certs clean

WEB_BUILD_ENV ?= template.env.build
BUILD_FLAGS ?=
IMAGE_TAG ?= latest
export IMAGE_TAG
IMAGE_SERVICES := api-gateway auth-service users-service campaign-service game-systems-service sync-service admin-panel web-hub web-campaign web-profile web-login web-game-systems
WEB_BUILD_ENV_FILE := $(if $(filter /%,$(WEB_BUILD_ENV)),$(WEB_BUILD_ENV),apps/web/$(WEB_BUILD_ENV))

ifneq ($(strip $(SERVICE)),)
ifneq ($(words $(SERVICE)),1)
$(error SERVICE must be exactly one of: $(IMAGE_SERVICES))
endif
ifeq ($(filter $(IMAGE_SERVICES),$(SERVICE)),)
$(error Unknown SERVICE '$(SERVICE)'; choose exactly one of: $(IMAGE_SERVICES))
endif
endif

# Интеграционные тесты
test:
	cd apps/backend/tests && ./test.sh 5

# Изолированные сборки образов (не запускают контейнеры).
build: $(if $(strip $(SERVICE)),build-$(SERVICE),build-all)

build-all:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) $(IMAGE_SERVICES)

build-backend:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) api-gateway auth-service users-service campaign-service game-systems-service sync-service

build-web:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) web-hub web-campaign web-profile web-login web-game-systems

build-admin:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) admin-panel

build-api-gateway:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) api-gateway
build-auth-service:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) auth-service
build-users-service:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) users-service
build-campaign-service:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) campaign-service
build-game-systems-service:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) game-systems-service
build-sync-service:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) sync-service
build-admin-panel:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) admin-panel
build-web-hub:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) web-hub
build-web-campaign:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) web-campaign
build-web-profile:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) web-profile
build-web-login:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) web-login
build-web-game-systems:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) web-game-systems

list-images:
	@printf '%s\n' $(IMAGE_SERVICES)

help:
	@printf '%s\n' 'make build [SERVICE=<name>] [BUILD_FLAGS="--no-cache"] [IMAGE_TAG=<tag>]'
	@printf '%s\n' 'make build-backend | build-web | build-admin | build-all | build-<service>'
	@printf '%s\n' 'make list-images; WEB_BUILD_ENV=<path> (default template.env.build)'

# Запуск
run: run-backend run-web

run-backend:
	cd apps/backend && docker compose up -d

run-web:
	cd apps/web && docker compose --env-file "$(WEB_BUILD_ENV)" up -d

web-install:
	cd apps/web && npm ci

web-typecheck:
	cd apps/web && npm run typecheck --workspaces --if-present

web-test:
	cd apps/web && npm run test:run

web-build:
	cd apps/web && npm run build --workspaces --if-present

check-web: web-typecheck web-test web-build

test-web: web-test

certs:
	@mkdir -p apps/backend/certs
	@openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out apps/backend/certs/private.pem
	@openssl pkey -in apps/backend/certs/private.pem -pubout -out apps/backend/certs/public.pem

# Очистка данных базы (MongoDB и MySQL) с подтверждением
clean:
	@read -p "Are you sure? [y/N] " answer && \
	case $$answer in \
		[yY]*) sudo rm -rf apps/backend/mongo_data apps/backend/mysql_data ;; \
		*) echo "Aborted." && exit 1 ;; \
	esac
