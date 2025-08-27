@echo off
echo 🤖 Запуск Telegram бота с монитором...
echo.

REM Проверяем, что Node.js установлен
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Ошибка: Node.js не найден. Установите Node.js и попробуйте снова.
    pause
    exit /b 1
)

REM Проверяем, что файлы существуют
if not exist "index.js" (
    echo ❌ Ошибка: Файл index.js не найден.
    pause
    exit /b 1
)

if not exist "bot-monitor.js" (
    echo ❌ Ошибка: Файл bot-monitor.js не найден.
    pause
    exit /b 1
)

echo ✅ Все проверки пройдены
echo 🚀 Запуск бота с монитором...
echo.

REM Запускаем монитор
node bot-monitor.js

echo.
echo 📤 Бот остановлен
pause
