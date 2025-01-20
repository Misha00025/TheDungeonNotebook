#!/bin/bash

# Запускаем первое приложение
dotnet run > test.log 2>&1 &
APP1_PID=$!

# Ждем 10 секунд перед запуском второго приложения
sleep 10

# Запускаем второе приложение
../backend/venv/bin/python ../backend/test.py &
APP2_PID=$!

# Ожидаем завершения второго приложения
wait $APP2_PID

# Завершаем работу первого приложения
kill $APP1_PID

