#!/bin/bash

# Имя контейнера, состояние которого нужно отслеживать
MAIN_SERVICE="api-gateway"

# Поднимаем Docker Compose в фоновых процессах
docker-compose build
docker-compose up -d

# Ждём, пока контейнер перейдёт в состояние Running
until [[ "$(docker inspect -f "{{.State.Running}}" ${MAIN_SERVICE})" = "true" ]]; do
    sleep 5
    echo "Ожидаем старт контейнера $MAIN_SERVICE..."
done

sleep $1

rm -r logs 
mkdir logs

# После того, как все контейнеры готовы, запускаем тесты
python test.py ${@:2} > logs/test.log

docker-compose logs | grep "${MAIN_SERVICE}" > logs/server.log
docker-compose logs | grep -v "mongo-db-gateway-test  " | grep -v "mysql-db-gateway-test  " | grep -v "${MAIN_SERVICE}" > logs/all.log
docker-compose logs | grep "mongo-db-gateway-test  " > logs/db.log
docker-compose logs | grep "mysql-db-gateway-test  " >> logs/db.log

# Завершаем работу
docker-compose down
echo "Тестирование завершено!"