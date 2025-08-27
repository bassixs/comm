# 🚀 Деплой на Timeweb

## 📋 Требования

- Node.js 18+ на сервере
- PM2 для управления процессами
- SSH доступ к серверу
- Telegram Bot Token

## 🔧 Подготовка к деплою

### 1. Подготовка файлов

```bash
# Клонируйте репозиторий или загрузите файлы
git clone <your-repo-url>
cd tg-comment-assistant

# Создайте файл .env на основе примера
cp env.example .env
```

### 2. Настройка переменных окружения

Отредактируйте файл `.env`:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_actual_telegram_bot_token

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
```

## 🚀 Деплой на Timeweb

### 1. Загрузка файлов

Загрузите все файлы проекта на сервер Timeweb через:
- FTP/SFTP клиент (FileZilla, WinSCP)
- Git (если настроен на сервере)
- Панель управления Timeweb

### 2. Подключение к серверу

```bash
ssh username@your-server-ip
cd /path/to/your/project
```

### 3. Установка зависимостей

```bash
# Установка Node.js (если не установлен)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка PM2
npm install -g pm2

# Установка зависимостей проекта
npm install --production
```

### 4. Настройка базы данных

```bash
# Создание директорий
mkdir -p bot/data
mkdir -p logs

# Инициализация базы данных
npm run db:migrate

# Проверка состояния БД
npm run db:check
```

### 5. Запуск бота

```bash
# Запуск через PM2
npm run pm2:start

# Проверка статуса
npm run pm2:status

# Просмотр логов
npm run pm2:logs
```

## 🔧 Управление ботом

### Основные команды PM2

```bash
# Запуск
pm2 start ecosystem.config.js

# Остановка
pm2 stop tg-comment-bot

# Перезапуск
pm2 restart tg-comment-bot

# Просмотр статуса
pm2 status

# Просмотр логов
pm2 logs tg-comment-bot

# Мониторинг
pm2 monit

# Автозапуск при перезагрузке сервера
pm2 startup
pm2 save
```

### Команды проекта

```bash
# Деплой
npm run deploy

# Управление PM2
npm run pm2:start
npm run pm2:stop
npm run pm2:restart
npm run pm2:logs
npm run pm2:status

# Управление базой данных
npm run db:migrate
npm run db:check
npm run db:fix
```

## 📊 Мониторинг

### Логи

Логи сохраняются в директории `logs/`:
- `err.log` - ошибки
- `out.log` - стандартный вывод
- `combined.log` - все логи

### Статистика

```bash
# Статистика PM2
pm2 show tg-comment-bot

# Использование ресурсов
pm2 monit

# Статистика базы данных
npm run db:check
```

## 🔒 Безопасность

### Рекомендации

1. **Файл .env**: Никогда не коммитьте в Git
2. **Права доступа**: Установите правильные права на файлы
3. **Firewall**: Настройте firewall на сервере
4. **SSL**: Используйте HTTPS для API (если необходимо)

### Права доступа

```bash
# Установка прав
chmod 600 .env
chmod 755 deploy.sh
chmod -R 755 bot/data
chmod -R 755 logs
```

## 🚨 Устранение неполадок

### Частые проблемы

1. **Бот не отвечает**
   ```bash
   pm2 logs tg-comment-bot
   npm run db:check
   ```

2. **Ошибки базы данных**
   ```bash
   npm run db:fix
   npm run db:migrate
   ```

3. **Высокое потребление памяти**
   ```bash
   pm2 restart tg-comment-bot
   pm2 monit
   ```

4. **Проблемы с зависимостями**
   ```bash
   rm -rf node_modules
   npm install --production
   ```

### Полезные команды

```bash
# Перезапуск всего
pm2 delete all
npm run pm2:start

# Очистка логов
pm2 flush

# Обновление кода
git pull
npm install --production
pm2 restart tg-comment-bot
```

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи: `npm run pm2:logs`
2. Проверьте статус: `npm run pm2:status`
3. Проверьте базу данных: `npm run db:check`
4. Перезапустите бота: `npm run pm2:restart`

## ✅ Чек-лист деплоя

- [ ] Файлы загружены на сервер
- [ ] Node.js установлен
- [ ] PM2 установлен
- [ ] Файл .env настроен
- [ ] Зависимости установлены
- [ ] База данных инициализирована
- [ ] Бот запущен через PM2
- [ ] Логи проверены
- [ ] Бот отвечает в Telegram
