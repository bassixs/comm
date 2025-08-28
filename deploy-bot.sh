#!/bin/bash

# Скрипт деплоя Telegram Comment Bot
# Выполняется от имени пользователя bot

set -e

echo "🤖 Начинаем деплой Telegram Comment Bot..."

cd /home/bot/tg-comment-bot

# Клонирование репозитория (если нужно)
if [ ! -d ".git" ]; then
    echo "📥 Клонирование репозитория..."
    # Если у вас есть Git репозиторий, раскомментируйте следующую строку:
    # git clone https://github.com/your-username/your-repo.git .
    echo "⚠️ Пожалуйста, загрузите файлы проекта вручную или настройте Git репозиторий"
fi

# Создание .env файла
if [ ! -f ".env" ]; then
    echo "📝 Создание .env файла..."
    cat > .env << EOF
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=7044517029:AAGvO2gu8UeqQEU-BTDgU2GNjK2SvvEQNDc

# Qwen API Configuration
QWEN_API_URL=http://localhost:3264
QWEN_API_TIMEOUT=30000
QWEN_API_RETRY_ATTEMPTS=3

# Database Configuration
DATABASE_PATH=./bot/data/bot.db
LEARNING_ENABLED=true
FEEDBACK_STORAGE_PATH=./bot/data/learning
MIN_FEEDBACK_FOR_TRAINING=10
FEEDBACK_RETENTION_DAYS=90

# Chat Configuration
MAX_CHATS_PER_USER=10
MAX_CHAT_NAME_LENGTH=50
AUTO_CLEANUP_INTERVAL=86400000

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/bot.log

# Environment
NODE_ENV=production
PORT=3000
EOF
    echo "⚠️ Не забудьте отредактировать .env файл и указать ваш TELEGRAM_BOT_TOKEN!"
fi

# Создание директорий
echo "📁 Создание директорий..."
mkdir -p bot/data
mkdir -p logs
mkdir -p bot/data/learning

# Установка зависимостей
echo "📦 Установка зависимостей..."
npm install --production

# Инициализация базы данных
echo "🗄️ Инициализация базы данных..."
if [ -f "scripts/migrate-to-database.js" ]; then
    node scripts/migrate-to-database.js
fi

# Запуск бота
echo "🤖 Запуск бота..."
if [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js
else
    # Создаем простой ecosystem.config.js если его нет
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'tg-comment-bot',
    script: 'index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
EOF
    pm2 start ecosystem.config.js
fi

# Сохранение конфигурации PM2
pm2 save

echo "✅ Бот успешно развернут!"
echo "📊 Проверить статус: pm2 status"
echo "📋 Просмотреть логи: pm2 logs tg-comment-bot"
echo "🔄 Перезапуск: pm2 restart tg-comment-bot"
echo "⏹️ Остановка: pm2 stop tg-comment-bot"
