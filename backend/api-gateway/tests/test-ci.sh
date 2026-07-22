#!/bin/bash

# 0. Create .env from template if missing
cp -n template.env .env 2>/dev/null || true

# 0.1 Generate fresh test RSA keys (always, discard stale Docker-created dirs)
rm -rf certs
mkdir -p certs
openssl genrsa -out certs/private.pem 2048 2>/dev/null
openssl rsa -in certs/private.pem -pubout -out certs/public.pem 2>/dev/null

# 1. Install test dependencies
pip install --break-system-packages --ignore-installed -r ../../api-gateway/req.txt -q

# 2. Build and start stack
docker compose up -d --build

# 3. Wait for api-gateway container
echo "Waiting for api-gateway..."
for i in $(seq 1 20); do
    if docker inspect -f "{{.State.Running}}" api-gateway 2>/dev/null | grep -q true; then
        echo "api-gateway is running!"
        break
    fi
    echo "Waiting... ($i)"
    sleep 3
done
sleep 15

# 4. Run tests (stdout + tee to log file)
mkdir -p logs
python test.py --server http://localhost:5000 "$@" 2>&1 | tee logs/test.log
TEST_EXIT=${PIPESTATUS[0]}

# 5. Print summary
echo ""
echo "╔═══════════════════════════════════════╗"
echo "║         Сводка тестирования           ║"
echo "╚═══════════════════════════════════════╝"
echo ""
echo "=== Всего запросов ==="
grep -c "REQUEST" logs/test.log 2>/dev/null || echo "0"
echo ""
echo "=== Распределение статусов ==="
grep "REQUEST" logs/test.log 2>/dev/null | grep -oP ' \d{3}:' | sort | uniq -c | sort -rn || echo "(нет данных)"
echo ""
echo "=== Ошибок в тестах ==="
grep -c "ERROR:" logs/test.log 2>/dev/null || echo "0"
echo ""
echo "=== SERVER LOGS (tail 20) ==="
docker compose logs api-gateway --tail=20 2>/dev/null || true

# 6. Cleanup
echo ""
echo "=== Останавливаем контейнеры ==="
docker compose down -v

exit $TEST_EXIT
