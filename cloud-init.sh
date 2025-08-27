#cloud-config

# Cloud-init конфигурация для автоматической настройки Telegram Comment Bot
# Этот скрипт выполняется при первом запуске сервера

package_update: true
package_upgrade: true

packages:
  - curl
  - wget
  - git
  - htop
  - nano
  - ufw
  - fail2ban

runcmd:
  # Установка Node.js 18
  - curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  - apt-get install -y nodejs
  
  # Установка PM2
  - npm install -g pm2
  
  # Создание пользователя bot
  - useradd -m -s /bin/bash bot || echo "Пользователь bot уже существует"
  - usermod -aG sudo bot
  
  # Настройка firewall
  - ufw --force enable
  - ufw allow ssh
  - ufw allow 3000/tcp
  - ufw allow 3264/tcp
  
  # Настройка fail2ban
  - systemctl enable fail2ban
  - systemctl start fail2ban
  
  # Создание директорий
  - mkdir -p /home/bot/tg-comment-bot
  - mkdir -p /home/bot/logs
  - mkdir -p /home/bot/backup
  - chown -R bot:bot /home/bot
  - chmod 755 /home/bot
  
  # Настройка автозапуска PM2
  - pm2 startup ubuntu -u bot --hp /home/bot
  
  # Установка прав на sudo для пользователя bot
  - echo "bot ALL=(ALL) NOPASSWD: /usr/bin/pm2, /usr/bin/npm, /usr/bin/node" >> /etc/sudoers
  
  # Создание алиасов для удобства
  - echo 'alias bot-status="pm2 status"' >> /home/bot/.bashrc
  - echo 'alias bot-logs="pm2 logs tg-comment-bot"' >> /home/bot/.bashrc
  - echo 'alias bot-restart="pm2 restart tg-comment-bot"' >> /home/bot/.bashrc
  - echo 'alias bot-stop="pm2 stop tg-comment-bot"' >> /home/bot/.bashrc
  - echo 'alias bot-start="pm2 start tg-comment-bot"' >> /home/bot/.bashrc
  - echo 'alias bot-monit="pm2 monit"' >> /home/bot/.bashrc
  - echo 'alias bot-deploy="./deploy-bot.sh"' >> /home/bot/.bashrc
  
  # Установка прав на файлы
  - chown bot:bot /home/bot/.bashrc

write_files:
  - path: /home/bot/deploy-bot.sh
    owner: bot:bot
    permissions: '0755'
    content: |
      #!/bin/bash
      cd /home/bot/tg-comment-bot
      
      # Клонирование репозитория
      if [ ! -d ".git" ]; then
          echo "📥 Клонирование репозитория..."
          git clone https://github.com/bassixs/comm.git .
      fi
      
      # Создание .env файла
      if [ ! -f ".env" ]; then
          echo "📝 Создание .env файла..."
          cp env.example .env
          echo "⚠️ Не забудьте отредактировать .env файл!"
      fi
      
      # Установка зависимостей
      echo "📦 Установка зависимостей..."
      npm install --production
      
      # Создание директорий
      mkdir -p bot/data
      mkdir -p logs
      
      # Инициализация базы данных
      echo "🗄️ Инициализация базы данных..."
      npm run db:migrate
      
      # Запуск бота
      echo "🤖 Запуск бота..."
      pm2 start ecosystem.config.js
      
      # Сохранение конфигурации PM2
      pm2 save
      
      echo "✅ Бот успешно развернут!"
      echo "📊 Проверить статус: pm2 status"
      echo "📋 Просмотреть логи: pm2 logs tg-comment-bot"

  - path: /home/bot/README-SERVER.md
    owner: bot:bot
    permissions: '0644'
    content: |
      # 🚀 Инструкции по настройке Telegram Bot
      
      ## 📋 Что уже настроено:
      - ✅ Ubuntu 24.04 обновлена
      - ✅ Node.js 18 установлен
      - ✅ PM2 установлен
      - ✅ Firewall настроен
      - ✅ Fail2ban настроен
      - ✅ Пользователь bot создан
      
      ## 🔧 Следующие шаги:
      
      ### 1. Подключитесь к серверу:
      ```bash
      ssh root@YOUR_SERVER_IP
      ```
      
      ### 2. Переключитесь на пользователя bot:
      ```bash
      su - bot
      ```
      
      ### 3. Запустите автоматический деплой:
      ```bash
      ./deploy-bot.sh
      ```
      
      ### 4. Отредактируйте .env файл:
      ```bash
      nano .env
      ```
      
      ### 5. Проверьте работу бота:
      ```bash
      pm2 status
      pm2 logs tg-comment-bot
      ```
      
      ## 📊 Полезные команды:
      - `pm2 status` - статус процессов
      - `pm2 logs tg-comment-bot` - логи бота
      - `pm2 restart tg-comment-bot` - перезапуск
      - `htop` - мониторинг ресурсов
      - `ufw status` - статус firewall
      
      ## 🔒 Безопасность:
      - SSH доступ защищен fail2ban
      - Firewall настроен
      - Пользователь bot создан для изоляции
      
      ## 📞 Поддержка:
      При проблемах проверьте логи: `pm2 logs tg-comment-bot`

final_message: |
  ✅ Автоматическая настройка завершена!
  
  📋 Следующие шаги:
  1. Подключитесь к серверу: ssh root@YOUR_SERVER_IP
  2. Переключитесь на пользователя: su - bot
  3. Запустите деплой: ./deploy-bot.sh
  4. Отредактируйте .env файл
  
  📖 Подробные инструкции в: /home/bot/README-SERVER.md
  🔧 Быстрый деплой: /home/bot/deploy-bot.sh
