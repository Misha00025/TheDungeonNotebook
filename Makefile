.PHONY: test build build-backend build-web run run-backend run-web web-install web-typecheck web-test web-build check-web test-web certs clean

WEB_BUILD_ENV ?= template.env.build

# Запуск интеграционных тестов (5 секунд ожидания для старта сервисов)
test:
	cd backend/tests && ./test.sh 5

# Сборка всех Docker-контейнеров
build: build-backend build-web

build-backend:
	cd backend && docker compose build

build-web:
	cd web && docker compose --env-file $(WEB_BUILD_ENV) build

# Запуск
run: run-backend run-web

run-backend:
	cd backend && docker compose up -d

run-web:
	cd web && docker compose --env-file $(WEB_BUILD_ENV) up -d

web-install:
	cd web && npm ci

web-typecheck:
	cd web && npm run typecheck --workspaces --if-present

web-test:
	cd web && npm run test:run

web-build:
	cd web && npm run build --workspaces --if-present

check-web: web-typecheck web-test web-build

test-web: web-test

# Генерация RSA-ключей (2048 bit) для JWT в backend/certs/
certs:
	@mkdir -p backend/certs
	@openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out backend/certs/private.pem
	@openssl pkey -in backend/certs/private.pem -pubout -out backend/certs/public.pem

# Очистка данных базы (MongoDB и MySQL) с подтверждением
clean:
	@read -p "Are you sure? [y/N] " answer && \
	case $$answer in \
		[yY]*) sudo rm -rf backend/mongo_data backend/mysql_data ;; \
		*) echo "Aborted." && exit 1 ;; \
	esac
