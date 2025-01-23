@echo off

:: Строим проект и сохраняем логи в test.log
start /b dotnet build > test.log 2>&1
set BUILD_PID=%ERRORLEVEL%

:: Ожидаем завершения процесса сборки
call :WaitForProcess %BUILD_PID%

:: Запускаем первое приложение, перенаправляем вывод в test.log
start /b dotnet run >> test.log 2>&1
set APP1_PID=%ERRORLEVEL%

:: Функция для проверки занятости порта 5077
:CheckPortOccupied
timeout /T 1 >nul
ping -n 1 localhost | find "TTL=" >nul
if errorlevel 1 (
    exit /B 1
) else (
    exit /B 0
)
goto :EOF

:: Ждем готовности первого приложения
timeout /T 10 >nul
:: call :CheckPortOccupied
:: if errorlevel 1 goto CheckPortOccupied

:: Получаем параметры, передаваемые скрипту
shift
set PARAMS=%*

:: Запускаем второе приложение с параметрами
start /b ./tests/venv/bin/python tests/test.py %PARAMS%
set APP2_PID=%ERRORLEVEL%

:: Ожидаем завершения второго приложения
call :WaitForProcess %APP2_PID%

:: Завершаем работу первого приложения
taskkill /F /PID %APP1_PID% >nul

:: Функция ожидания завершения процесса
:WaitForProcess
tasklist /FI "PID eq %~1" 2>NUL | find "%~1">NUL
if not errorlevel 1 timeout /T 1 >nul & goto WaitForProcess
goto :EOF
