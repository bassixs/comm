const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Конфигурация
const API_URL = 'http://localhost:3264';
const MAX_CHAT_AGE_DAYS = 7; // Удалять чаты старше 7 дней
const MAX_CHATS_PER_USER = 5; // Максимум 5 чатов на пользователя

class ChatCleanup {
  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000
    });
  }

  /**
   * Получение списка всех чатов
   */
  async getAllChats() {
    try {
      const response = await this.client.get('/api/chats');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Удаление чата
   */
  async deleteChat(chatId) {
    try {
      await this.client.delete(`/api/chats/${chatId}`);
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Автоматическая очистка чатов
   */
  async autoCleanup() {
    console.log('🧹 Начинаю автоматическую очистку чатов...');

    // Получаем все чаты
    const chatsResult = await this.getAllChats();
    if (!chatsResult.success) {
      console.error('❌ Не удалось получить список чатов:', chatsResult.error);
      return;
    }

    const chats = chatsResult.data;
    console.log(`📊 Найдено ${chats.length} чатов`);

    const now = Date.now();
    const maxAgeMs = MAX_CHAT_AGE_DAYS * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    // Группируем чаты по пользователям
    const userChats = {};
    chats.forEach(chat => {
      const match = chat.name.match(/User_(\d+)_Comments/);
      if (match) {
        const userId = match[1];
        if (!userChats[userId]) {
          userChats[userId] = [];
        }
        userChats[userId].push(chat);
      }
    });

    // Обрабатываем каждого пользователя
    for (const [userId, userChatList] of Object.entries(userChats)) {
      console.log(`👤 Пользователь ${userId}: ${userChatList.length} чатов`);

      // Сортируем чаты по времени создания (новые первыми)
      userChatList.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const timeB = new Date(b.createdAt || b.updatedAt || 0).getTime();
        return timeB - timeA;
      });

      // Удаляем старые чаты
      for (let i = 0; i < userChatList.length; i++) {
        const chat = userChatList[i];
        const chatTime = new Date(chat.createdAt || chat.updatedAt || 0).getTime();
        const chatAge = now - chatTime;

        // Удаляем если чат слишком старый или превышает лимит
        if (chatAge > maxAgeMs || i >= MAX_CHATS_PER_USER) {
          console.log(`🗑️ Удаляю чат ${chat.chatId} (возраст: ${Math.round(chatAge / (24 * 60 * 60 * 1000))} дней)`);
          
          const deleteResult = await this.deleteChat(chat.chatId);
          if (deleteResult.success) {
            deletedCount++;
          } else {
            console.error(`❌ Ошибка при удалении чата ${chat.chatId}:`, deleteResult.error);
          }
        }
      }
    }

    console.log(`✅ Очистка завершена. Удалено ${deletedCount} чатов.`);
  }

  /**
   * Получение статистики
   */
  async getStats() {
    const chatsResult = await this.getAllChats();
    if (!chatsResult.success) {
      console.error('❌ Не удалось получить статистику:', chatsResult.error);
      return;
    }

    const chats = chatsResult.data;
    const userChats = {};
    
    chats.forEach(chat => {
      const match = chat.name.match(/User_(\d+)_Comments/);
      if (match) {
        const userId = match[1];
        if (!userChats[userId]) {
          userChats[userId] = [];
        }
        userChats[userId].push(chat);
      }
    });

    console.log('📊 Статистика чатов:');
    console.log(`Всего чатов: ${chats.length}`);
    console.log(`Пользователей: ${Object.keys(userChats).length}`);
    
    for (const [userId, userChatList] of Object.entries(userChats)) {
      console.log(`👤 Пользователь ${userId}: ${userChatList.length} чатов`);
    }
  }
}

// Основная функция
async function main() {
  const cleanup = new ChatCleanup();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'cleanup':
      await cleanup.autoCleanup();
      break;
    case 'stats':
      await cleanup.getStats();
      break;
    default:
      console.log('Использование:');
      console.log('  node cleanup-chats.js cleanup  - Очистить старые чаты');
      console.log('  node cleanup-chats.js stats    - Показать статистику');
      break;
  }
}

// Запуск
if (require.main === module) {
  main().catch(console.error);
}

module.exports = ChatCleanup;
