const DatabaseManager = require('../bot/managers/databaseManager');
const Utils = require('../bot/utils/utils');

/**
 * Скрипт для исправления активного чата
 */
async function fixActiveChat() {
  console.log('🔧 Исправление активного чата...');
  
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
    
    // Получаем всех пользователей
    const users = dbManager.db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    
    for (const user of users) {
      console.log(`\n👤 Обрабатываем пользователя ${user.telegram_id}...`);
      
      // Получаем чаты пользователя
      const userChats = dbManager.getUserChats(user.id);
      console.log(`  💬 Найдено чатов: ${userChats.length}`);
      
      if (userChats.length === 0) {
        console.log('  ⚠️ У пользователя нет чатов, пропускаем');
        continue;
      }
      
      // Проверяем, есть ли активный чат
      const activeChat = dbManager.getActiveChat(user.id);
      
      if (activeChat.success) {
        console.log(`  ✅ Активный чат уже есть: ${activeChat.data.name} (ID: ${activeChat.data.id})`);
      } else {
        console.log(`  ⚠️ Активный чат не найден: ${activeChat.error}`);
        
        // Деактивируем все чаты
        dbManager.db.prepare('UPDATE chats SET is_active = 0 WHERE user_id = ?').run(user.id);
        
        // Активируем самый новый чат
        const newestChat = userChats[0]; // Чаты уже отсортированы по updated_at DESC
        dbManager.db.prepare(`
          UPDATE chats 
          SET is_active = 1, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ? AND user_id = ?
        `).run(newestChat.id, user.id);
        
        console.log(`  ✅ Активирован чат: ${newestChat.name} (ID: ${newestChat.id})`);
      }
    }
    
    // Показываем финальную статистику
    console.log('\n📈 Финальная статистика:');
    const stats = dbManager.getDatabaseStats();
    console.log(`👥 Пользователей: ${stats.users}`);
    console.log(`💬 Чатов: ${stats.chats}`);
    
    // Проверяем активные чаты
    const activeChats = dbManager.db.prepare(`
      SELECT c.*, u.telegram_id, u.first_name 
      FROM chats c 
      JOIN users u ON c.user_id = u.id 
      WHERE c.is_active = 1
      ORDER BY c.updated_at DESC
    `).all();
    
    console.log(`🎯 Активных чатов: ${activeChats.length}`);
    for (const chat of activeChats) {
      console.log(`  - ${chat.name} (ID: ${chat.id}) - Пользователь ${chat.first_name} (${chat.telegram_id})`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка исправления активного чата:', error);
  } finally {
    dbManager.close();
  }
}

// Запуск исправления
if (require.main === module) {
  (async () => {
    console.log('🔧 Исправление активного чата в базе данных');
    console.log('==========================================\n');
    
    await fixActiveChat();
    
    console.log('\n✨ Исправление завершено!');
  })();
}

module.exports = { fixActiveChat };
