const fs = require('fs').promises;
const path = require('path');
const config = require('../utils/config');
const Utils = require('../utils/utils');
const DatabaseManager = require('./databaseManager');

/**
 * Менеджер для управления чатами и настройками пользователей
 * 
 * @class ChatManager
 * @description Управляет созданием, удалением и настройкой чатов пользователей,
 * а также их настройками (модели, предпочтения)
 * 
 * @example
 * const chatManager = new ChatManager();
 * await chatManager.createChat(userId, 'Новый чат');
 * 
 * @property {string} dataDir - Директория для хранения данных
 * @property {string} userChatsFile - Файл с данными чатов
 * @property {string} userSettingsFile - Файл с настройками пользователей
 * @property {Map} userChats - Кэш чатов пользователей
 * @property {Map} userSettings - Кэш настроек пользователей
 */
class ChatManager {
  /**
   * Создает новый экземпляр ChatManager
   * 
   * @constructor
   * @description Инициализирует менеджер чатов, создает необходимые директории
   * и загружает существующие данные
   */
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data', 'chats');
    this.userChatsFile = path.join(this.dataDir, 'user-chats.json');
    this.userSettingsFile = path.join(this.dataDir, 'user-settings.json');
    
    this.userChats = new Map(); // userId -> { chats: [], activeChatId: null }
    this.userSettings = new Map(); // userId -> { model: string, ... }
    
    this.dbManager = new DatabaseManager();
    this.useDatabase = false; // Флаг для переключения между БД и JSON
    
    this.init();
  }

  /**
   * Инициализация менеджера чатов
   */
  async init() {
    try {
      // Создаем директорию если не существует
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // Пытаемся инициализировать базу данных
      const dbInitialized = await this.dbManager.init();
      if (dbInitialized) {
        this.useDatabase = true;
        Utils.log('info', 'ChatManager использует базу данных');
      } else {
        Utils.log('warn', 'ChatManager использует JSON файлы (база данных недоступна)');
      }
      
      // Загружаем данные (если не используем БД)
      if (!this.useDatabase) {
        await this.loadData();
      }
      
      // Запускаем автоочистку
      this.startAutoCleanup();
      
      Utils.log('info', 'ChatManager инициализирован');
    } catch (error) {
      Utils.log('error', 'Ошибка инициализации ChatManager', error);
    }
  }

  /**
   * Загрузка данных из файлов
   */
  async loadData() {
    try {
      // Загружаем чаты пользователей
      const userChatsData = await fs.readFile(this.userChatsFile, 'utf8').catch(() => '{}');
      const userChatsObj = JSON.parse(userChatsData);
      
      for (const [userId, data] of Object.entries(userChatsObj)) {
        this.userChats.set(parseInt(userId), data);
      }

      // Загружаем настройки пользователей
      const userSettingsData = await fs.readFile(this.userSettingsFile, 'utf8').catch(() => '{}');
      const userSettingsObj = JSON.parse(userSettingsData);
      
      for (const [userId, settings] of Object.entries(userSettingsObj)) {
        this.userSettings.set(parseInt(userId), settings);
      }

      Utils.log('info', 'Данные чатов загружены', { 
        users: this.userChats.size, 
        settings: this.userSettings.size 
      });
    } catch (error) {
      Utils.log('error', 'Ошибка загрузки данных чатов', error);
    }
  }

  /**
   * Сохранение данных в файлы
   */
  async saveData() {
    try {
      // Сохраняем чаты пользователей
      const userChatsObj = {};
      for (const [userId, data] of this.userChats.entries()) {
        userChatsObj[userId] = data;
      }
      await fs.writeFile(this.userChatsFile, JSON.stringify(userChatsObj, null, 2));

      // Сохраняем настройки пользователей
      const userSettingsObj = {};
      for (const [userId, settings] of this.userSettings.entries()) {
        userSettingsObj[userId] = settings;
      }
      await fs.writeFile(this.userSettingsFile, JSON.stringify(userSettingsObj, null, 2));

      Utils.log('info', 'Данные чатов сохранены');
    } catch (error) {
      Utils.log('error', 'Ошибка сохранения данных чатов', error);
    }
  }

  /**
   * Получение или создание данных пользователя
   */
  getUserData(userId) {
    if (!this.userChats.has(userId)) {
      this.userChats.set(userId, {
        chats: [],
        activeChatId: null
      });
    }
    return this.userChats.get(userId);
  }

  /**
   * Получение настроек пользователя
   */
  getUserSettings(userId) {
    if (!this.userSettings.has(userId)) {
      this.userSettings.set(userId, {
        model: config.telegram.defaultModel
      });
    }
    return this.userSettings.get(userId);
  }

  /**
   * Создание нового чата
   */
  async createChat(userId, chatName) {
    try {
      if (this.useDatabase) {
        return await this.createChatDB(userId, chatName);
      } else {
        return await this.createChatJSON(userId, chatName);
      }
    } catch (error) {
      Utils.log('error', 'Ошибка создания чата', error);
      return {
        success: false,
        error: 'Ошибка создания чата'
      };
    }
  }

  /**
   * Создание нового чата (база данных)
   */
  async createChatDB(userId, chatName) {
    try {
      // Получаем или создаем пользователя в БД
      const user = this.dbManager.getUserOrCreate(userId);
      
      // Проверяем лимит чатов
      const userChats = this.dbManager.getUserChats(user.id);
      if (userChats.length >= config.chat.maxChatsPerUser) {
        return {
          success: false,
          error: `Достигнут лимит чатов (${config.chat.maxChatsPerUser}). Удалите старые чаты.`
        };
      }

      // Проверяем длину названия
      if (chatName.length > config.chat.maxChatNameLength) {
        return {
          success: false,
          error: `Название чата слишком длинное (максимум ${config.chat.maxChatNameLength} символов).`
        };
      }

      // Создаем чат через БД менеджер
      const result = this.dbManager.createChat(user.id, chatName, this.getUserModel(userId));
      
      if (result.success) {
        Utils.log('info', 'Создан новый чат (БД)', { userId, chatId: result.data.id, chatName });
      }
      
      return result;
    } catch (error) {
      Utils.log('error', 'Ошибка создания чата (БД)', { userId, chatName, error });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Создание нового чата (JSON)
   */
  async createChatJSON(userId, chatName) {
    try {
      const userData = this.getUserData(userId);
      
      // Проверяем лимит чатов
      if (userData.chats.length >= config.chat.maxChatsPerUser) {
        return {
          success: false,
          error: `Достигнут лимит чатов (${config.chat.maxChatsPerUser}). Удалите старые чаты.`
        };
      }

      // Проверяем длину названия
      if (chatName.length > config.chat.maxChatNameLength) {
        return {
          success: false,
          error: `Название чата слишком длинное (максимум ${config.chat.maxChatNameLength} символов).`
        };
      }

      // Создаем новый чат
      const newChat = {
        id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: chatName,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        messageCount: 0
      };

      userData.chats.push(newChat);
      
      // Если это первый чат, делаем его активным
      if (userData.chats.length === 1) {
        userData.activeChatId = newChat.id;
      }

      await this.saveData();

      Utils.log('info', 'Создан новый чат (JSON)', { userId, chatId: newChat.id, chatName });

      return {
        success: true,
        data: newChat
      };
    } catch (error) {
      Utils.log('error', 'Ошибка создания чата (JSON)', { userId, chatName, error });
      return {
        success: false,
        error: 'Ошибка создания чата'
      };
    }
  }

  /**
   * Получение списка чатов пользователя
   */
  getChats(userId) {
    try {
      if (this.useDatabase) {
        return this.getChatsDB(userId);
      } else {
        return this.getChatsJSON(userId);
      }
    } catch (error) {
      Utils.log('error', 'Ошибка получения чатов', { userId, error });
      return {
        success: false,
        error: 'Ошибка получения чатов'
      };
    }
  }

  /**
   * Получение списка чатов пользователя (база данных)
   */
  getChatsDB(userId) {
    try {
      // Получаем или создаем пользователя в БД
      const user = this.dbManager.getUserOrCreate(userId);
      
      // Получаем все чаты пользователя
      const chats = this.dbManager.getUserChats(user.id);
      
      // Получаем активный чат
      const activeChat = this.dbManager.getActiveChat(user.id);
      
      return {
        success: true,
        data: {
          chats: chats,
          activeChatId: activeChat.success ? activeChat.data.id : null
        }
      };
    } catch (error) {
      Utils.log('error', 'Ошибка получения чатов (БД)', { userId, error });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получение списка чатов пользователя (JSON)
   */
  getChatsJSON(userId) {
    const userData = this.getUserData(userId);
    return {
      success: true,
      data: {
        chats: userData.chats,
        activeChatId: userData.activeChatId
      }
    };
  }

  /**
   * Выбор активного чата
   */
  async selectChat(userId, chatId) {
    try {
      if (this.useDatabase) {
        return await this.selectChatDB(userId, chatId);
      } else {
        return await this.selectChatJSON(userId, chatId);
      }
    } catch (error) {
      Utils.log('error', 'Ошибка выбора чата', { userId, chatId, error });
      return {
        success: false,
        error: 'Ошибка выбора чата'
      };
    }
  }

  /**
   * Выбор активного чата (база данных)
   */
  async selectChatDB(userId, chatId) {
    try {
      // Получаем или создаем пользователя в БД
      const user = this.dbManager.getUserOrCreate(userId);
      
      // Проверяем существование чата
      const chats = this.dbManager.getUserChats(user.id);
      const chat = chats.find(c => c.id == chatId); // Используем == для сравнения строки и числа
      
      if (!chat) {
        return {
          success: false,
          error: 'Чат не найден'
        };
      }

      // Деактивируем все чаты пользователя
      this.dbManager.db.prepare('UPDATE chats SET is_active = 0 WHERE user_id = ?').run(user.id);
      
      // Активируем выбранный чат
      this.dbManager.db.prepare(`
        UPDATE chats 
        SET is_active = 1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? AND user_id = ?
      `).run(chatId, user.id);

      Utils.log('info', 'Выбран активный чат (БД)', { userId, chatId, chatName: chat.name });

      return {
        success: true,
        data: chat
      };
    } catch (error) {
      Utils.log('error', 'Ошибка выбора чата (БД)', { userId, chatId, error });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Выбор активного чата (JSON)
   */
  async selectChatJSON(userId, chatId) {
    try {
      const userData = this.getUserData(userId);
      const chat = userData.chats.find(c => c.id === chatId);
      
      if (!chat) {
        return {
          success: false,
          error: 'Чат не найден'
        };
      }

      userData.activeChatId = chatId;
      chat.lastUsed = new Date().toISOString();
      
      await this.saveData();

      Utils.log('info', 'Выбран активный чат (JSON)', { userId, chatId, chatName: chat.name });

      return {
        success: true,
        data: chat
      };
    } catch (error) {
      Utils.log('error', 'Ошибка выбора чата (JSON)', { userId, chatId, error });
      return {
        success: false,
        error: 'Ошибка выбора чата'
      };
    }
  }

  /**
   * Переименование чата
   */
  async renameChat(userId, chatId, newName) {
    try {
      const userData = this.getUserData(userId);
      const chat = userData.chats.find(c => c.id === chatId);
      
      if (!chat) {
        return {
          success: false,
          error: 'Чат не найден'
        };
      }

      // Проверяем длину названия
      if (newName.length > config.chat.maxChatNameLength) {
        return {
          success: false,
          error: `Название чата слишком длинное (максимум ${config.chat.maxChatNameLength} символов).`
        };
      }

      const oldName = chat.name;
      chat.name = newName;
      
      await this.saveData();

      Utils.log('info', 'Чат переименован', { userId, chatId, oldName, newName });

      return {
        success: true,
        data: chat
      };
    } catch (error) {
      Utils.log('error', 'Ошибка переименования чата', error);
      return {
        success: false,
        error: 'Ошибка переименования чата'
      };
    }
  }

  /**
   * Удаление чата
   */
  async deleteChat(userId, chatId) {
    try {
      const userData = this.getUserData(userId);
      const chatIndex = userData.chats.findIndex(c => c.id === chatId);
      
      if (chatIndex === -1) {
        return {
          success: false,
          error: 'Чат не найден'
        };
      }

      const deletedChat = userData.chats.splice(chatIndex, 1)[0];
      
      // Если удаляемый чат был активным, выбираем другой
      if (userData.activeChatId === chatId) {
        userData.activeChatId = userData.chats.length > 0 ? userData.chats[0].id : null;
      }
      
      await this.saveData();

      Utils.log('info', 'Чат удален', { userId, chatId, chatName: deletedChat.name });

      return {
        success: true,
        data: deletedChat
      };
    } catch (error) {
      Utils.log('error', 'Ошибка удаления чата', error);
      return {
        success: false,
        error: 'Ошибка удаления чата'
      };
    }
  }

  /**
   * Получение активного чата
   */
  getActiveChat(userId) {
    try {
      if (this.useDatabase) {
        return this.getActiveChatDB(userId);
      } else {
        return this.getActiveChatJSON(userId);
      }
    } catch (error) {
      Utils.log('error', 'Ошибка получения активного чата', { userId, error });
      return {
        success: false,
        error: 'Ошибка получения активного чата'
      };
    }
  }

  /**
   * Получение активного чата (база данных)
   */
  getActiveChatDB(userId) {
    try {
      // Получаем или создаем пользователя в БД
      const user = this.dbManager.getUserOrCreate(userId);
      
      // Получаем активный чат через БД менеджер
      const result = this.dbManager.getActiveChat(user.id);
      
      if (result.success) {
        Utils.log('info', 'Активный чат получен (БД)', { userId, chatId: result.data.id });
      }
      
      return result;
    } catch (error) {
      Utils.log('error', 'Ошибка получения активного чата (БД)', { userId, error });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получение активного чата (JSON)
   */
  getActiveChatJSON(userId) {
    const userData = this.getUserData(userId);
    if (!userData.activeChatId) {
      return {
        success: false,
        error: 'Нет активного чата'
      };
    }

    const activeChat = userData.chats.find(c => c.id === userData.activeChatId);
    if (!activeChat) {
      return {
        success: false,
        error: 'Активный чат не найден'
      };
    }

    return {
      success: true,
      data: activeChat
    };
  }

  /**
   * Обновление статистики чата
   */
  async updateChatStats(userId, chatId) {
    try {
      const userData = this.getUserData(userId);
      const chat = userData.chats.find(c => c.id === chatId);
      
      if (chat) {
        chat.lastUsed = new Date().toISOString();
        chat.messageCount++;
        await this.saveData();
      }
    } catch (error) {
      Utils.log('error', 'Ошибка обновления статистики чата', error);
    }
  }

  /**
   * Установка модели для пользователя
   */
  async setUserModel(userId, model) {
    try {
      const settings = this.getUserSettings(userId);
      settings.model = model;
      
      await this.saveData();

      Utils.log('info', 'Модель пользователя обновлена', { userId, model });

      return {
        success: true,
        data: settings
      };
    } catch (error) {
      Utils.log('error', 'Ошибка установки модели', error);
      return {
        success: false,
        error: 'Ошибка установки модели'
      };
    }
  }

  /**
   * Получение модели пользователя
   */
  getUserModel(userId) {
    const settings = this.getUserSettings(userId);
    return settings.model;
  }

  /**
   * Автоочистка неиспользуемых чатов
   */
  startAutoCleanup() {
    setInterval(async () => {
      try {
        const now = new Date();
        let cleanedCount = 0;

        for (const [userId, userData] of this.userChats.entries()) {
          const oldChats = userData.chats.filter(chat => {
            const lastUsed = new Date(chat.lastUsed);
            const daysSinceLastUse = (now - lastUsed) / (1000 * 60 * 60 * 24);
            return daysSinceLastUse > 30; // Удаляем чаты неиспользуемые более 30 дней
          });

          for (const oldChat of oldChats) {
            const chatIndex = userData.chats.findIndex(c => c.id === oldChat.id);
            if (chatIndex !== -1) {
              userData.chats.splice(chatIndex, 1);
              cleanedCount++;
            }
          }

          // Если активный чат был удален, выбираем новый
          if (userData.activeChatId && !userData.chats.find(c => c.id === userData.activeChatId)) {
            userData.activeChatId = userData.chats.length > 0 ? userData.chats[0].id : null;
          }
        }

        if (cleanedCount > 0) {
          await this.saveData();
          Utils.log('info', 'Автоочистка завершена', { cleanedCount });
        }
      } catch (error) {
        Utils.log('error', 'Ошибка автоочистки', error);
      }
    }, config.chat.autoCleanupInterval);
  }
}

module.exports = ChatManager;
