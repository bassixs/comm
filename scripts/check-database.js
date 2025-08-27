const DatabaseManager = require('../bot/managers/databaseManager');
const Utils = require('../bot/utils/utils');

/**
 * Скрипт для проверки состояния базы данных
 */
async function checkDatabase() {
  console.log('🔍 Проверка состояния базы данных...');
  
  const dbManager = new DatabaseManager();
  
  try {
    // Инициализируем базу данных
    console.log('📊 Инициализация базы данных...');
    const dbInitialized = await dbManager.init();
    
    if (!dbInitialized) {
      console.error('❌ Не удалось инициализировать базу данных');
      return;
    }
    
    console.log('✅ База данных инициализирована');
    
    // Получаем статистику
    const stats = dbManager.getDatabaseStats();
    console.log('\n📈 Статистика базы данных:');
    console.log(`👥 Пользователей: ${stats.users}`);
    console.log(`💬 Чатов: ${stats.chats}`);
    console.log(`⭐ Обратной связи: ${stats.feedback}`);
    console.log(`💾 Размер БД: ${stats.dbSizeMB} МБ`);
    
    // Проверяем пользователей
    console.log('\n👥 Пользователи:');
    const users = dbManager.db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    
    for (const user of users) {
      console.log(`\n  Пользователь ID: ${user.id}`);
      console.log(`  Telegram ID: ${user.telegram_id}`);
      console.log(`  Имя: ${user.first_name || 'Не указано'}`);
      console.log(`  Username: ${user.username || 'Не указан'}`);
      console.log(`  Создан: ${user.created_at}`);
      
      // Получаем чаты пользователя
      const userChats = dbManager.getUserChats(user.id);
      console.log(`  💬 Чатов: ${userChats.length}`);
      
      for (const chat of userChats) {
        const status = chat.is_active ? '✅ АКТИВНЫЙ' : '❌ Неактивный';
        console.log(`    - ${chat.name} (ID: ${chat.id}) - ${status}`);
        console.log(`      Модель: ${chat.model}`);
        console.log(`      Сообщений: ${chat.message_count}`);
        console.log(`      Создан: ${chat.created_at}`);
        console.log(`      Обновлен: ${chat.updated_at}`);
      }
      
      // Получаем активный чат
      const activeChat = dbManager.getActiveChat(user.id);
      if (activeChat.success) {
        console.log(`  🎯 Активный чат: ${activeChat.data.name} (ID: ${activeChat.data.id})`);
      } else {
        console.log(`  ⚠️ Активный чат: ${activeChat.error}`);
      }
      
      // Получаем статистику обратной связи
      const feedbackStats = dbManager.getUserFeedbackStats(user.id);
      console.log(`  📊 Обратная связь: ${feedbackStats.totalFeedback} записей`);
      if (feedbackStats.totalFeedback > 0) {
        console.log(`    Средняя оценка: ${feedbackStats.averageRating}`);
        console.log(`    Оценки: ${JSON.stringify(feedbackStats.ratings)}`);
        console.log(`    Доработки: ${feedbackStats.improvementFeedback}`);
      }
    }
    
    // Проверяем все чаты
    console.log('\n💬 Все чаты:');
    const allChats = dbManager.db.prepare(`
      SELECT c.*, u.telegram_id, u.first_name 
      FROM chats c 
      JOIN users u ON c.user_id = u.id 
      ORDER BY c.created_at DESC
    `).all();
    
    for (const chat of allChats) {
      const status = chat.is_active ? '✅ АКТИВНЫЙ' : '❌ Неактивный';
      console.log(`  ${chat.name} (ID: ${chat.id}) - ${status}`);
      console.log(`    Пользователь: ${chat.first_name} (${chat.telegram_id})`);
      console.log(`    Модель: ${chat.model}`);
      console.log(`    Сообщений: ${chat.message_count}`);
      console.log(`    Создан: ${chat.created_at}`);
    }
    
    // Проверяем обратную связь
    console.log('\n⭐ Обратная связь:');
    const feedback = dbManager.db.prepare(`
      SELECT f.*, u.telegram_id 
      FROM feedback f 
      JOIN users u ON f.user_id = u.id 
      ORDER BY f.created_at DESC 
      LIMIT 10
    `).all();
    
    for (const fb of feedback) {
      console.log(`  ${fb.feedback_type} - Пользователь ${fb.user_telegram_id}`);
      console.log(`    Комментарий: ${fb.comment_id}`);
      if (fb.rating) console.log(`    Оценка: ${fb.rating}/5`);
      if (fb.feedback_text) console.log(`    Текст: ${fb.feedback_text.substring(0, 50)}...`);
      console.log(`    Дата: ${fb.created_at}`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка проверки базы данных:', error);
  } finally {
    dbManager.close();
  }
}

// Запуск проверки
if (require.main === module) {
  (async () => {
    console.log('🗄️ Проверка состояния базы данных');
    console.log('================================\n');
    
    await checkDatabase();
    
    console.log('\n✨ Проверка завершена!');
  })();
}

module.exports = { checkDatabase };
