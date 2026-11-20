.DEFAULT_GOAL := test
.PHONY: test test-oidc build build-all build-backend build-web list-images help \
	build-api-gateway build-users-service build-account-service build-campaign-service \
	build-web-hub build-bff build-bff-web \
 	build-web-campaign build-web-profile build-web-login build-web-proxy \
	run run-backend run-web web-install web-typecheck web-test web-build check-web test-web clean

WEB_BUILD_ENV ?= template.env.build
WEB_ENV ?= .env
BUILD_FLAGS ?=
IMAGE_TAG ?= latest
export IMAGE_TAG
BACKEND_SERVICES := api-gateway users-service account-service campaign-service # game-systems-service sync-service
WEB_SERVICES := web-hub web-campaign web-profile web-login web-proxy # web-game-systems
IMAGE_SERVICES :=  $(BACKEND_SERVICES) $(WEB_SERVICES) bff-web
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

test-oidc:
	bash apps/backend/tests/oidc/run.sh

# Изолированные сборки образов (не запускают контейнеры).
build: $(if $(strip $(SERVICE)),build-$(SERVICE),build-all)

build-all:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) $(IMAGE_SERVICES)

build-backend:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) $(BACKEND_SERVICES)

build-web:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) $(WEB_SERVICES)

build-api-gateway:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) api-gateway
build-users-service:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) users-service
build-account-service:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) account-service
build-campaign-service:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) campaign-service
#build-game-systems-service:
#	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) game-systems-service
#build-sync-service:
#	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) sync-service
build-web-hub:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) web-hub
build-web-campaign:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) web-campaign
build-web-profile:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) web-profile
build-web-login:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) web-login
#build-web-game-systems:
#	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) web-game-systems
build-web-proxy:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) web-proxy
build-bff: build-bff-web
build-bff-web:
	docker compose --env-file "$(WEB_BUILD_ENV_FILE)" -f docker-compose.build.yaml build $(BUILD_FLAGS) bff-web

list-images:
	@printf '%s\n' $(IMAGE_SERVICES)

help:
	@printf '%s\n' 'make build [SERVICE=<name>] [BUILD_FLAGS="--no-cache"] [IMAGE_TAG=<tag>]'
	@printf '%s\n' 'make build-backend | build-web | build-all | build-<service>'
	@printf '%s\n' 'make build-bff | build-bff-web'
	@printf '%s\n' 'make list-images; WEB_BUILD_ENV=<path> (default template.env.build); WEB_ENV=<path> (default .env)'

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

# Очистка данных базы (MongoDB и MySQL) с подтверждением
clean:
	@read -p "Are you sure? [y/N] " answer && \
	case $$answer in \
		[yY]*) sudo rm -rf apps/backend/mongo_data apps/backend/mysql_data ;; \
		*) echo "Aborted." && exit 1 ;; \
	esac
