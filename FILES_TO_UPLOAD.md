# 📁 Файлы для загрузки на Timeweb

## 📋 Обязательные файлы

### Основные файлы
- `index.js` - точка входа приложения
- `package.json` - зависимости и скрипты
- `ecosystem.config.js` - конфигурация PM2
- `deploy.sh` - скрипт деплоя
- `env.example` - пример переменных окружения
- `.env` - ваши переменные окружения (создать на сервере)

### Директория bot/
- `bot/core/telegramBot.js` - основной класс бота
- `bot/core/qwenApi.js` - API клиент для Qwen
- `bot/managers/chatManager.js` - управление чатами
- `bot/managers/learningManager.js` - система обучения
- `bot/managers/databaseManager.js` - управление БД
- `bot/utils/config.js` - конфигурация
- `bot/utils/utils.js` - утилиты
- `bot/README.md` - документация

### Директория scripts/
- `scripts/migrate-to-database.js` - миграция данных
- `scripts/check-database.js` - проверка БД
- `scripts/fix-active-chat.js` - исправление чатов
- `scripts/cleanup-chats.js` - очистка чатов

### Директория FreeQwenApi/
- `FreeQwenApi/` - весь каталог с API сервером

### Документация
- `DEPLOY.md` - инструкция по деплою
- `README.md` - основная документация
- `FILES_TO_UPLOAD.md` - этот файл

## 📁 Директории для создания на сервере

### Автоматически создаваемые
- `logs/` - логи приложения
- `bot/data/` - база данных и данные
- `backup/` - резервные копии

## 🚫 Файлы НЕ загружать

### Исключаемые файлы
- `node_modules/` - установится на сервере
- `.git/` - система контроля версий
- `*.log` - логи
- `bot/data/*.db` - база данных (создастся на сервере)
- `.env` - создайте на сервере на основе env.example

## 📦 Команды для подготовки

### Создание архива (опционально)
```bash
# Создать архив для загрузки
tar -czf tg-comment-bot.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=*.log \
  --exclude=bot/data/*.db \
  --exclude=.env \
  .
```

### Проверка файлов
```bash
# Проверить наличие всех файлов
ls -la
ls -la bot/
ls -la scripts/
ls -la FreeQwenApi/
```

## 🔧 На сервере

### После загрузки файлов
```bash
# 1. Создать .env
cp env.example .env
nano .env  # отредактировать

# 2. Установить зависимости
npm install --production

# 3. Инициализировать БД
npm run db:migrate

# 4. Запустить бота
npm run pm2:start
```

## ✅ Чек-лист загрузки

- [ ] Все файлы из списка загружены
- [ ] Структура директорий сохранена
- [ ] Файл .env создан на сервере
- [ ] Права доступа установлены
- [ ] Зависимости установлены
- [ ] База данных инициализирована
- [ ] Бот запущен и работает
