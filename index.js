const TelegramBotHandler = require('./bot/core/telegramBot');
const config = require('./bot/utils/config');

// Обработка сигналов завершения
process.on('SIGINT', () => {
  console.log('\n🛑 Получен сигнал завершения...');
  if (global.bot) {
    global.bot.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Получен сигнал завершения...');
  if (global.bot) {
    global.bot.stop();
  }
  process.exit(0);
});

// Обработка необработанных ошибок
process.on('uncaughtException', (error) => {
  console.error('❌ Необработанная ошибка:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Необработанное отклонение промиса:', reason);
  process.exit(1);
});

/**
 * Запуск бота
 */
async function startBot() {
  try {
    console.log('🚀 Запуск Telegram бота...');
    
    // Проверяем наличие токена
    if (!config.telegram.token) {
      console.error('❌ Ошибка: TELEGRAM_BOT_TOKEN не установлен в переменных окружения');
      console.log('📝 Создайте файл .env на основе env.example и установите токен бота');
      process.exit(1);
    }

    // Создаем бота
    global.bot = new TelegramBotHandler();
    
    // Инициализируем менеджеры
    console.log('📊 Инициализация менеджеров...');
    await global.bot.init();
    
    // Запускаем бота
    global.bot.start();
    
    console.log('✅ Бот успешно запущен!');
    console.log('📱 Отправьте /start в Telegram для начала работы');
    
  } catch (error) {
    console.error('❌ Ошибка при запуске бота:', error);
    process.exit(1);
  }
}

// Запускаем бота
startBot();
