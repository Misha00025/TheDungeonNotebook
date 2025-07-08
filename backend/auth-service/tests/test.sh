#!/bin/bash

# Имя контейнера, состояние которого нужно отслеживать
MAIN_SERVICE="auth"

# Поднимаем Docker Compose в фоновых процессах
docker-compose build
docker-compose up -d

# Ждём, пока контейнер перейдёт в состояние Running
until [[ "$(docker inspect -f "{{.State.Running}}" ${MAIN_SERVICE})" = "true" ]]; do
    sleep 5
    echo "Ожидаем старт контейнера $MAIN_SERVICE..."
done

sleep $1

# После того, как все контейнеры готовы, запускаем тесты
python test.py ${@:2} > test.log

docker-compose logs | grep "${MAIN_SERVICE}" > server.log

# Завершаем работу
docker-compose down
echo "Тестирование завершено!"