.PHONY: test build certs clean

# Запуск интеграционных тестов (5 секунд ожидания для старта сервисов)
test:
	cd backend/tests && ./test.sh 5

# Сборка всех Docker-контейнеров
build:
	cd backend && docker compose build

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
