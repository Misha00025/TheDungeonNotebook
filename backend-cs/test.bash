#!/bin/bash

# Запускаем первое приложение, перенаправляя stdout и stderr в файл test.log
dotnet run > test.log 2>&1 &
APP1_PID=$!

# Функция для проверки доступности порта 5077
check_port_occupied() {
    nc -z localhost 5077 &
    return $?
}

# Ждем готовности первого приложения
while ! check_port_occupied; do
    echo "Ожидание доступности порта 5077..."
    sleep 1
done

# Собираем все аргументы, переданные скрипту, кроме имени самого скрипта ($0)
PARAMS="${@:1}"

# Запускаем второе приложение с передачей всех параметров
./tests/venv/bin/python tests/test.py ${PARAMS} &
APP2_PID=$!

# Ожидаем завершения второго приложения
wait $APP2_PID

# Завершаем работу первого приложения
kill $APP1_PID


