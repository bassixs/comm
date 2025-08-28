# 🚀 Инструкция по деплою Telegram Comment Bot

## 📋 Подготовка

### 1. Получите Telegram Bot Token
1. Напишите @BotFather в Telegram
2. Создайте нового бота: `/newbot`
3. Получите токен бота

### 2. Подготовьте файлы проекта
Убедитесь, что у вас есть все файлы проекта в папке `bor`

## 🔧 Деплой на сервер

### Шаг 1: Подключение к серверу
```bash
ssh root@194.87.131.189
# Пароль: yE__JXf+d.m9,U
```

### Шаг 2: Загрузка файлов проекта
Есть несколько способов:

#### Вариант A: Через SCP (рекомендуется)
```bash
# Из локальной папки проекта выполните:
scp -r . root@194.87.131.189:/home/bot/tg-comment-bot/
```

#### Вариант B: Через панель управления Timeweb
1. Зайдите в панель управления Timeweb
2. Найдите файловый менеджер
3. Загрузите все файлы проекта в `/home/bot/tg-comment-bot/`

#### Вариант C: Через Git (если есть репозиторий)
```bash
# На сервере:
cd /home/bot/tg-comment-bot
git clone https://github.com/your-username/your-repo.git .
```

### Шаг 3: Запуск базовой настройки
```bash
# На сервере:
chmod +x deploy-script.sh
./deploy-script.sh
```

### Шаг 4: Переключение на пользователя bot
```bash
su - bot
```

### Шаг 5: Настройка проекта
```bash
cd /home/bot/tg-comment-bot
chmod +x deploy-bot.sh
./deploy-bot.sh
```

### Шаг 6: Настройка конфигурации
```bash
nano .env
```

Замените `your_telegram_bot_token_here` на ваш реальный токен бота.

### Шаг 7: Запуск бота
```bash
pm2 start ecosystem.config.js
pm2 save
```

## 📊 Управление ботом

### Полезные команды:
```bash
# Статус бота
pm2 status

# Логи бота
pm2 logs tg-comment-bot

# Перезапуск
pm2 restart tg-comment-bot

# Остановка
pm2 stop tg-comment-bot

# Мониторинг
pm2 monit
```

### Алиасы (уже настроены):
```bash
bot-status    # pm2 status
bot-logs      # pm2 logs tg-comment-bot
bot-restart   # pm2 restart tg-comment-bot
bot-stop      # pm2 stop tg-comment-bot
bot-start     # pm2 start tg-comment-bot
bot-monit     # pm2 monit
```

## 🔒 Безопасность

### Настроенные меры безопасности:
- ✅ Firewall (UFW) настроен
- ✅ Fail2ban установлен
- ✅ SSH защищен
- ✅ Пользователь bot создан для изоляции

### Рекомендации:
1. Измените root пароль после настройки
2. Настройте SSH ключи вместо паролей
3. Регулярно обновляйте систему

## 🚨 Устранение неполадок

### Бот не отвечает:
```bash
pm2 logs tg-comment-bot
# Проверьте логи на ошибки
```

### Проблемы с базой данных:
```bash
node scripts/check-database.js
node scripts/fix-active-chat.js
```

### Высокое потребление ресурсов:
```bash
pm2 monit
# Проверьте использование CPU и памяти
```

### Перезапуск всего:
```bash
pm2 delete all
pm2 start ecosystem.config.js
pm2 save
```

## 📞 Поддержка

При проблемах:
1. Проверьте логи: `pm2 logs tg-comment-bot`
2. Проверьте статус: `pm2 status`
3. Проверьте конфигурацию: `cat .env`
4. Перезапустите бота: `pm2 restart tg-comment-bot`

## ✅ Чек-лист

- [ ] Подключились к серверу
- [ ] Загрузили файлы проекта
- [ ] Запустили базовую настройку
- [ ] Настроили .env файл
- [ ] Запустили бота
- [ ] Проверили логи
- [ ] Бот отвечает в Telegram
