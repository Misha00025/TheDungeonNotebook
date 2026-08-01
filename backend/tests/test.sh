#!/bin/bash

# Имя контейнера, состояние которого нужно отслеживать
MAIN_SERVICE="api-gateway-test"

docker compose down -v

# Проверка и создание виртуального окружения
if [ ! -d "venv" ]; then
    echo "Создаю виртуальное окружение..."
    python3 -m venv venv
    echo "Готово"
fi

echo "Устанавливаю зависимости..."
./venv/bin/pip install --ignore-installed -r requirements.txt -q
echo "Готово"

# Перегенерация RSA-ключей
sudo rm -rf certs
mkdir -p certs
openssl genrsa -out certs/private.pem 2048 2>/dev/null
openssl rsa -in certs/private.pem -pubout -out certs/public.pem 2>/dev/null

# Очистка данных БД между запусками
sudo rm -rf mongo_data
sudo rm -rf mysql_data

sudo rm -rf logs 
mkdir logs

# Поднимаем Docker Compose в фоновых процессах
docker compose build
docker compose up -d

# Ждём, пока контейнер перейдёт в состояние Running (максимум 120 сек)
MAX_RETRIES=24  # 24 * 5 = 120 секунд
RETRY_COUNT=0
until [[ "$(docker inspect -f "{{.State.Running}}" ${MAIN_SERVICE} 2>/dev/null)" = "true" ]]; do
    if [[ $RETRY_COUNT -ge $MAX_RETRIES ]]; then
        echo "Ошибка: контейнер $MAIN_SERVICE не запустился за $((MAX_RETRIES * 5)) секунд."
        echo "Логи контейнера:"
        docker logs ${MAIN_SERVICE} 2>/dev/null || echo "(контейнер не найден)"
        docker compose down -v
        exit 1
    fi
    sleep 5
    ((RETRY_COUNT++))
    echo "Ожидаем старт контейнера $MAIN_SERVICE... (попытка $RETRY_COUNT/$MAX_RETRIES)"
done

sleep $1

# После того, как все контейнеры готовы, запускаем тесты
./venv/bin/python test.py --server http://localhost:5000 ${@:2} > logs/test.log

docker compose logs | grep "${MAIN_SERVICE}" > logs/server.log
docker compose logs | grep -v "mongo-db-gateway-test  " | grep -v "mysql-db-gateway-test  " | grep -v "${MAIN_SERVICE}" > logs/all.log
docker compose logs | grep "mongo-db-gateway-test  " > logs/db.log
docker compose logs | grep "mysql-db-gateway-test  " >> logs/db.log

# Завершаем работу
docker compose down

grep -i 'campaign-service-test' logs/all.log > logs/campaign.log
grep -i 'auth-service-test' logs/all.log > logs/auth.log
grep -i 'users-service-test' logs/all.log > logs/user.log

# Сводка результатов
echo ""
echo "╔═══════════════════════════════════════╗"
echo "║         Сводка тестирования           ║"
echo "╚═══════════════════════════════════════╝"
echo ""

echo "=== Всего запросов ==="
grep -c "REQUEST" logs/test.log

echo ""
echo "=== Распределение статусов ==="
grep "REQUEST" logs/test.log | grep -oP ' \d{3}:' | sort | uniq -c | sort -rn

echo ""
echo "=== Ошибок в тестах ==="
grep -c "ERROR:" logs/test.log

echo ""

echo "Тестирование завершено!"