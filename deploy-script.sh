#!/bin/bash

# Скрипт автоматического деплоя Telegram Comment Bot
# Выполняется на сервере

set -e

echo "🚀 Начинаем деплой Telegram Comment Bot..."

# Обновление системы
echo "📦 Обновление системы..."
apt update
apt upgrade -y

# Установка необходимых пакетов
echo "📦 Установка необходимых пакетов..."
apt install -y curl wget git htop nano ufw fail2ban

# Установка Node.js 18
echo "📦 Установка Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Установка PM2
echo "📦 Установка PM2..."
npm install -g pm2

# Создание пользователя bot
echo "👤 Создание пользователя bot..."
useradd -m -s /bin/bash bot || echo "Пользователь bot уже существует"
usermod -aG sudo bot

# Настройка firewall
echo "🔥 Настройка firewall..."
ufw --force enable
ufw allow ssh
ufw allow 3000/tcp
ufw allow 3264/tcp

# Настройка fail2ban
echo "🛡️ Настройка fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

# Создание директорий
echo "📁 Создание директорий..."
mkdir -p /home/bot/tg-comment-bot
mkdir -p /home/bot/logs
mkdir -p /home/bot/backup
chown -R bot:bot /home/bot
chmod 755 /home/bot

# Настройка автозапуска PM2
echo "⚙️ Настройка автозапуска PM2..."
pm2 startup ubuntu -u bot --hp /home/bot

# Установка прав на sudo для пользователя bot
echo "🔐 Настройка прав доступа..."
echo "bot ALL=(ALL) NOPASSWD: /usr/bin/pm2, /usr/bin/npm, /usr/bin/node" >> /etc/sudoers

# Создание алиасов для удобства
echo "📝 Создание алиасов..."
echo 'alias bot-status="pm2 status"' >> /home/bot/.bashrc
echo 'alias bot-logs="pm2 logs tg-comment-bot"' >> /home/bot/.bashrc
echo 'alias bot-restart="pm2 restart tg-comment-bot"' >> /home/bot/.bashrc
echo 'alias bot-stop="pm2 stop tg-comment-bot"' >> /home/bot/.bashrc
echo 'alias bot-start="pm2 start tg-comment-bot"' >> /home/bot/.bashrc
echo 'alias bot-monit="pm2 monit"' >> /home/bot/.bashrc
echo 'alias bot-deploy="./deploy-bot.sh"' >> /home/bot/.bashrc

# Установка прав на файлы
chown bot:bot /home/bot/.bashrc

echo "✅ Базовая настройка завершена!"
echo "📋 Следующие шаги:"
echo "1. Переключитесь на пользователя: su - bot"
echo "2. Запустите деплой проекта: ./deploy-bot.sh"
