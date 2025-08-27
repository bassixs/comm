const fs = require('fs').promises;
const path = require('path');
const DatabaseManager = require('../bot/managers/databaseManager');
const Utils = require('../bot/utils/utils');

/**
 * Скрипт миграции данных из JSON файлов в базу данных
 */
async function migrateToDatabase() {
  console.log('🚀 Начинаем миграцию данных в базу данных...');
  
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
    
    // Мигрируем данные чатов
    await migrateChats(dbManager);
    
    // Мигрируем данные обратной связи
    await migrateFeedback(dbManager);
    
    console.log('🎉 Миграция завершена успешно!');
    
    // Показываем статистику
    const stats = dbManager.getDatabaseStats();
    console.log('\n📈 Статистика базы данных:');
    console.log(`👥 Пользователей: ${stats.users}`);
    console.log(`💬 Чатов: ${stats.chats}`);
    console.log(`⭐ Обратной связи: ${stats.feedback}`);
    console.log(`💾 Размер БД: ${stats.dbSizeMB} МБ`);
    
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
  } finally {
    dbManager.close();
  }
}

/**
 * Миграция данных чатов
 */
async function migrateChats(dbManager) {
  console.log('\n📁 Миграция данных чатов...');
  
  try {
    const chatsFile = path.join(__dirname, '..', 'bot', 'data', 'chats', 'user-chats.json');
    
    // Проверяем существование файла
    try {
      await fs.access(chatsFile);
    } catch {
      console.log('ℹ️ Файл чатов не найден, пропускаем миграцию чатов');
      return;
    }
    
    const chatsData = await fs.readFile(chatsFile, 'utf8');
    const userChats = JSON.parse(chatsData);
    
    let migratedUsers = 0;
    let migratedChats = 0;
    
    for (const [telegramId, userData] of Object.entries(userChats)) {
      try {
        // Создаем пользователя
        const user = dbManager.getUserOrCreate(parseInt(telegramId));
        migratedUsers++;
        
        // Мигрируем чаты пользователя
        if (userData.chats && Array.isArray(userData.chats)) {
          for (const chat of userData.chats) {
            try {
              const result = dbManager.createChat(user.id, chat.name, chat.model || 'qwen-max-latest');
              if (result.success) {
                migratedChats++;
                
                // Обновляем статистику чата
                if (chat.messageCount > 0) {
                  dbManager.db.prepare(`
                    UPDATE chats 
                    SET message_count = ?, updated_at = ? 
                    WHERE id = ?
                  `).run(chat.messageCount, chat.lastUsed || chat.updatedAt, result.data.id);
                }
              }
            } catch (chatError) {
              console.warn(`⚠️ Ошибка миграции чата ${chat.id}:`, chatError.message);
            }
          }
        }
      } catch (userError) {
        console.warn(`⚠️ Ошибка миграции пользователя ${telegramId}:`, userError.message);
      }
    }
    
    console.log(`✅ Мигрировано пользователей: ${migratedUsers}`);
    console.log(`✅ Мигрировано чатов: ${migratedChats}`);
    
  } catch (error) {
    console.error('❌ Ошибка миграции чатов:', error);
  }
}

/**
 * Миграция данных обратной связи
 */
async function migrateFeedback(dbManager) {
  console.log('\n📁 Миграция данных обратной связи...');
  
  try {
    const feedbackFile = path.join(__dirname, '..', 'bot', 'data', 'learning', 'feedback.json');
    
    // Проверяем существование файла
    try {
      await fs.access(feedbackFile);
    } catch {
      console.log('ℹ️ Файл обратной связи не найден, пропускаем миграцию');
      return;
    }
    
    const feedbackData = await fs.readFile(feedbackFile, 'utf8');
    const userFeedback = JSON.parse(feedbackData);
    
    let migratedFeedback = 0;
    
    for (const [telegramId, feedbackList] of Object.entries(userFeedback)) {
      try {
        // Создаем пользователя
        const user = dbManager.getUserOrCreate(parseInt(telegramId));
        
        // Мигрируем обратную связь
        if (Array.isArray(feedbackList)) {
          for (const feedback of feedbackList) {
            try {
              const result = dbManager.saveFeedback(
                user.id,
                feedback.commentId,
                feedback.rating,
                feedback.feedback,
                feedback.type,
                feedback.context
              );
              
              if (result.success) {
                migratedFeedback++;
              }
            } catch (feedbackError) {
              console.warn(`⚠️ Ошибка миграции обратной связи ${feedback.id}:`, feedbackError.message);
            }
          }
        }
      } catch (userError) {
        console.warn(`⚠️ Ошибка миграции обратной связи пользователя ${telegramId}:`, userError.message);
      }
    }
    
    console.log(`✅ Мигрировано обратной связи: ${migratedFeedback}`);
    
  } catch (error) {
    console.error('❌ Ошибка миграции обратной связи:', error);
  }
}

/**
 * Создание резервной копии JSON файлов
 */
async function createBackup() {
  console.log('\n💾 Создание резервной копии JSON файлов...');
  
  try {
    const backupDir = path.join(__dirname, '..', 'backup', new Date().toISOString().split('T')[0]);
    await fs.mkdir(backupDir, { recursive: true });
    
    const filesToBackup = [
      '../bot/data/chats/user-chats.json',
      '../bot/data/chats/user-settings.json',
      '../bot/data/learning/feedback.json'
    ];
    
    for (const filePath of filesToBackup) {
      try {
        const sourcePath = path.join(__dirname, filePath);
        const fileName = path.basename(filePath);
        const backupPath = path.join(backupDir, fileName);
        
        await fs.copyFile(sourcePath, backupPath);
        console.log(`✅ Создана резервная копия: ${fileName}`);
      } catch (error) {
        console.warn(`⚠️ Не удалось создать резервную копию ${filePath}:`, error.message);
      }
    }
    
    console.log(`📁 Резервная копия сохранена в: ${backupDir}`);
    
  } catch (error) {
    console.error('❌ Ошибка создания резервной копии:', error);
  }
}

// Запуск миграции
if (require.main === module) {
  (async () => {
    console.log('🗄️ Миграция данных в базу данных SQLite');
    console.log('=====================================\n');
    
    // Создаем резервную копию
    await createBackup();
    
    // Запускаем миграцию
    await migrateToDatabase();
    
    console.log('\n✨ Миграция завершена!');
    console.log('Теперь бот будет использовать базу данных вместо JSON файлов.');
  })();
}

module.exports = { migrateToDatabase, createBackup };
