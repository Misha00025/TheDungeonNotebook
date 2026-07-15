#!/bin/bash

MAIN_SERVICE="auth"

# Очистка данных БД между запусками
sudo rm -rf mysql_data/*

# Поднимаем Docker Compose в фоновых процессах
docker compose build
docker compose up -d

# Ждём, пока контейнер перейдёт в состояние Running
until [[ "$(docker inspect -f "{{.State.Running}}" ${MAIN_SERVICE})" = "true" ]]; do
    sleep 5
    echo "Ожидаем старт контейнера $MAIN_SERVICE..."
done

sleep $1

mkdir -p logs

# Запускаем тесты
python test.py ${@:2} > logs/test.log

docker compose logs auth > logs/auth.log
docker compose logs mysql > logs/mysql.log

# Сводка результатов
echo ""
echo "╔═══════════════════════════════════════╗"
echo "║         Сводка тестирования           ║"
echo "╚═══════════════════════════════════════╝"
echo ""

echo "=== Всего запросов ==="
grep -c "REQUEST" logs/test.log 2>/dev/null || echo "0"

echo ""
echo "=== Распределение статусов ==="
grep "REQUEST" logs/test.log | grep -oP ' \d{3}:' | sort | uniq -c | sort -rn

echo ""
echo "=== Ошибок в тестах ==="
grep -c "ERROR:" logs/test.log 2>/dev/null || echo "0"

echo ""
echo "=== Any 501? ==="
if grep -qE '\b501\b' logs/test.log 2>/dev/null; then
    echo "⚠️  ЕСТЬ 501!"
    grep "501" logs/test.log | head -5
else
    echo "✅ Нет"
fi

echo ""

# Завершаем работу
docker compose down
echo "Тестирование завершено!"
