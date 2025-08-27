#!/bin/bash

# Скрипт деплоя для Timeweb
# Использование: ./deploy.sh

set -e

echo "🚀 Начинаем деплой на Timeweb..."

# Проверяем наличие необходимых файлов
if [ ! -f ".env" ]; then
    echo "❌ Файл .env не найден!"
    echo "📝 Создайте файл .env на основе .env.example"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo "❌ Файл package.json не найден!"
    exit 1
fi

# Создаем директории для логов
mkdir -p logs
mkdir -p bot/data

echo "📦 Устанавливаем зависимости..."
npm install --production

echo "🔧 Проверяем синтаксис..."
node -c index.js
node -c bot/core/telegramBot.js
node -c bot/managers/chatManager.js
node -c bot/managers/learningManager.js
node -c bot/managers/databaseManager.js

echo "🗄️ Инициализируем базу данных..."
node scripts/migrate-to-database.js

echo "✅ Деплой завершен!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Загрузите файлы на сервер Timeweb"
echo "2. Установите PM2: npm install -g pm2"
echo "3. Запустите бота: pm2 start ecosystem.config.js"
echo "4. Проверьте статус: pm2 status"
echo "5. Просмотрите логи: pm2 logs tg-comment-bot"
