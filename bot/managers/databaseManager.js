const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs').promises;
const config = require('../utils/config');
const Utils = require('../utils/utils');

/**
 * Менеджер базы данных
 * 
 * @class DatabaseManager
 * @description Управляет подключением к базе данных SQLite,
 * созданием таблиц, миграциями и основными операциями
 * 
 * @example
 * const dbManager = new DatabaseManager();
 * await dbManager.init();
 * const users = await dbManager.getUsers();
 * 
 * @property {Database} db - Экземпляр базы данных
 * @property {string} dbPath - Путь к файлу базы данных
 * @property {boolean} isInitialized - Статус инициализации
 */
class DatabaseManager {
  /**
   * Создает новый экземпляр DatabaseManager
   * 
   * @constructor
   * @description Инициализирует менеджер базы данных
   */
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, '..', 'data', 'bot.db');
    this.isInitialized = false;
  }

  /**
   * Инициализация базы данных
   * 
   * @returns {Promise<boolean>} Успешность инициализации
   */
  async init() {
    try {
      // Создаем директорию если не существует
      const dbDir = path.dirname(this.dbPath);
      await fs.mkdir(dbDir, { recursive: true });

      // Подключаемся к базе данных
      this.db = new Database(this.dbPath);
      
      // Включаем WAL режим для лучшей производительности
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 10000');
      this.db.pragma('temp_store = MEMORY');

      // Создаем таблицы
      await this.createTables();
      
      // Запускаем миграции
      await this.runMigrations();
      
      this.isInitialized = true;
      Utils.log('info', 'База данных инициализирована', { dbPath: this.dbPath });
      
      return true;
    } catch (error) {
      Utils.log('error', 'Ошибка инициализации базы данных', error);
      return false;
    }
  }

  /**
   * Создание таблиц базы данных
   */
  async createTables() {
    // Таблица пользователей
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        telegram_id INTEGER UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        settings TEXT DEFAULT '{}'
      )
    `);

    // Таблица чатов
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        model TEXT DEFAULT 'qwen-max-latest',
        is_active BOOLEAN DEFAULT 0,
        message_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Таблица обратной связи
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        comment_id TEXT NOT NULL,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        feedback_text TEXT,
        feedback_type TEXT NOT NULL CHECK (feedback_type IN ('comment_rating', 'improvement_feedback')),
        context TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Таблица статистики
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS statistics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        chat_id INTEGER,
        action_type TEXT NOT NULL,
        action_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
      )
    `);

    // Индексы для оптимизации
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users (telegram_id);
      CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats (user_id);
      CREATE INDEX IF NOT EXISTS idx_chats_active ON chats (user_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback (user_id);
      CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback (feedback_type);
      CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback (created_at);
      CREATE INDEX IF NOT EXISTS idx_statistics_user_id ON statistics (user_id);
      CREATE INDEX IF NOT EXISTS idx_statistics_created ON statistics (created_at);
    `);

    Utils.log('info', 'Таблицы базы данных созданы');
  }

  /**
   * Запуск миграций
   */
  async runMigrations() {
    // Создаем таблицу миграций если её нет
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Список миграций
    const migrations = [
      {
        name: '001_initial_schema',
        sql: '-- Уже выполнено в createTables()'
      }
      // Будущие миграции будут добавляться здесь
    ];

    for (const migration of migrations) {
      const exists = this.db.prepare('SELECT 1 FROM migrations WHERE name = ?').get(migration.name);
      if (!exists) {
        try {
          if (migration.sql !== '-- Уже выполнено в createTables()') {
            this.db.exec(migration.sql);
          }
          this.db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
          Utils.log('info', 'Миграция выполнена', { migration: migration.name });
        } catch (error) {
          Utils.log('error', 'Ошибка выполнения миграции', { migration: migration.name, error });
        }
      }
    }
  }

  /**
   * Получение или создание пользователя
   * 
   * @param {number} telegramId - ID пользователя в Telegram
   * @param {Object} userData - Данные пользователя
   * @returns {Object} Пользователь
   */
  getUserOrCreate(telegramId, userData = {}) {
    try {
      // Ищем существующего пользователя
      let user = this.db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
      
      if (!user) {
        // Создаем нового пользователя
        const stmt = this.db.prepare(`
          INSERT INTO users (telegram_id, username, first_name, last_name)
          VALUES (?, ?, ?, ?)
        `);
        
        const result = stmt.run(
          telegramId,
          userData.username || null,
          userData.first_name || null,
          userData.last_name || null
        );
        
        user = this.db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        Utils.log('info', 'Создан новый пользователь', { telegramId, userId: user.id });
      }
      
      return user;
    } catch (error) {
      Utils.log('error', 'Ошибка получения/создания пользователя', { telegramId, error });
      throw error;
    }
  }

  /**
   * Создание нового чата
   * 
   * @param {number} userId - ID пользователя
   * @param {string} name - Название чата
   * @param {string} model - Модель
   * @returns {Object} Результат создания
   */
  createChat(userId, name, model = 'qwen-max-latest') {
    try {
      // Деактивируем все существующие чаты пользователя
      this.db.prepare('UPDATE chats SET is_active = 0 WHERE user_id = ?').run(userId);
      
      // Создаем новый чат
      const stmt = this.db.prepare(`
        INSERT INTO chats (user_id, name, model, is_active)
        VALUES (?, ?, ?, 1)
      `);
      
      const result = stmt.run(userId, name, model);
      const chat = this.db.prepare('SELECT * FROM chats WHERE id = ?').get(result.lastInsertRowid);
      
      Utils.log('info', 'Создан новый чат', { userId, chatId: chat.id, name });
      
      return {
        success: true,
        data: chat
      };
    } catch (error) {
      Utils.log('error', 'Ошибка создания чата', { userId, name, error });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получение активного чата пользователя
   * 
   * @param {number} userId - ID пользователя
   * @returns {Object} Активный чат
   */
  getActiveChat(userId) {
    try {
      const chat = this.db.prepare(`
        SELECT * FROM chats 
        WHERE user_id = ? AND is_active = 1
        ORDER BY updated_at DESC 
        LIMIT 1
      `).get(userId);
      
      if (!chat) {
        return {
          success: false,
          error: 'Активный чат не найден'
        };
      }
      
      return {
        success: true,
        data: chat
      };
    } catch (error) {
      Utils.log('error', 'Ошибка получения активного чата', { userId, error });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получение всех чатов пользователя
   * 
   * @param {number} userId - ID пользователя
   * @returns {Array} Список чатов
   */
  getUserChats(userId) {
    try {
      const chats = this.db.prepare(`
        SELECT * FROM chats 
        WHERE user_id = ? 
        ORDER BY updated_at DESC
      `).all(userId);
      
      return chats;
    } catch (error) {
      Utils.log('error', 'Ошибка получения чатов пользователя', { userId, error });
      return [];
    }
  }

  /**
   * Сохранение обратной связи
   * 
   * @param {number} userId - ID пользователя
   * @param {string} commentId - ID комментария
   * @param {number} rating - Оценка (1-5)
   * @param {string} feedbackText - Текст обратной связи
   * @param {string} feedbackType - Тип обратной связи
   * @param {Object} context - Контекст
   * @returns {Object} Результат сохранения
   */
  saveFeedback(userId, commentId, rating, feedbackText, feedbackType, context) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO feedback (user_id, comment_id, rating, feedback_text, feedback_type, context)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        userId,
        commentId,
        rating,
        feedbackText,
        feedbackType,
        JSON.stringify(context)
      );
      
      Utils.log('info', 'Обратная связь сохранена', { 
        userId, commentId, feedbackType, feedbackId: result.lastInsertRowid 
      });
      
      return {
        success: true,
        data: { id: result.lastInsertRowid }
      };
    } catch (error) {
      Utils.log('error', 'Ошибка сохранения обратной связи', { userId, commentId, error });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получение статистики обратной связи пользователя
   * 
   * @param {number} userId - ID пользователя
   * @returns {Object} Статистика
   */
  getUserFeedbackStats(userId) {
    try {
      const stats = {
        totalFeedback: 0,
        ratings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        improvementFeedback: 0,
        averageRating: 0
      };

      // Общая статистика
      const total = this.db.prepare(`
        SELECT COUNT(*) as count FROM feedback WHERE user_id = ?
      `).get(userId);
      stats.totalFeedback = total.count;

      // Статистика по оценкам
      const ratings = this.db.prepare(`
        SELECT rating, COUNT(*) as count 
        FROM feedback 
        WHERE user_id = ? AND feedback_type = 'comment_rating' AND rating IS NOT NULL
        GROUP BY rating
      `).all(userId);

      let totalRating = 0;
      let ratingCount = 0;

      ratings.forEach(row => {
        stats.ratings[row.rating] = row.count;
        totalRating += row.rating * row.count;
        ratingCount += row.count;
      });

      // Статистика по доработкам
      const improvements = this.db.prepare(`
        SELECT COUNT(*) as count 
        FROM feedback 
        WHERE user_id = ? AND feedback_type = 'improvement_feedback'
      `).get(userId);
      stats.improvementFeedback = improvements.count;

      // Средняя оценка
      if (ratingCount > 0) {
        stats.averageRating = (totalRating / ratingCount).toFixed(1);
      }

      return stats;
    } catch (error) {
      Utils.log('error', 'Ошибка получения статистики обратной связи', { userId, error });
      return {
        totalFeedback: 0,
        ratings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        improvementFeedback: 0,
        averageRating: 0
      };
    }
  }

  /**
   * Получение данных для обучения
   * 
   * @returns {Object} Данные для обучения
   */
  getTrainingData() {
    try {
      const trainingData = {
        ratings: [],
        improvements: [],
        totalFeedback: 0
      };

      // Получаем оценки
      const ratings = this.db.prepare(`
        SELECT f.*, u.telegram_id as user_telegram_id
        FROM feedback f
        JOIN users u ON f.user_id = u.id
        WHERE f.feedback_type = 'comment_rating' AND f.rating IS NOT NULL
        ORDER BY f.created_at DESC
      `).all();

      trainingData.ratings = ratings.map(row => ({
        userId: row.user_telegram_id,
        commentId: row.comment_id,
        rating: row.rating,
        context: JSON.parse(row.context),
        timestamp: row.created_at
      }));

      // Получаем обратную связь для доработки
      const improvements = this.db.prepare(`
        SELECT f.*, u.telegram_id as user_telegram_id
        FROM feedback f
        JOIN users u ON f.user_id = u.id
        WHERE f.feedback_type = 'improvement_feedback'
        ORDER BY f.created_at DESC
      `).all();

      trainingData.improvements = improvements.map(row => ({
        userId: row.user_telegram_id,
        commentId: row.comment_id,
        feedback: row.feedback_text,
        context: JSON.parse(row.context),
        timestamp: row.created_at
      }));

      trainingData.totalFeedback = trainingData.ratings.length + trainingData.improvements.length;

      return trainingData;
    } catch (error) {
      Utils.log('error', 'Ошибка получения данных для обучения', { error });
      return {
        ratings: [],
        improvements: [],
        totalFeedback: 0
      };
    }
  }

  /**
   * Очистка старых данных
   * 
   * @param {number} days - Количество дней для хранения
   * @returns {number} Количество удаленных записей
   */
  cleanupOldData(days = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      // Удаляем старую обратную связь
      const feedbackResult = this.db.prepare(`
        DELETE FROM feedback 
        WHERE created_at < ?
      `).run(cutoffDate.toISOString());
      
      // Удаляем старую статистику
      const statsResult = this.db.prepare(`
        DELETE FROM statistics 
        WHERE created_at < ?
      `).run(cutoffDate.toISOString());
      
      const totalDeleted = feedbackResult.changes + statsResult.changes;
      
      if (totalDeleted > 0) {
        Utils.log('info', 'Очистка старых данных завершена', { 
          deletedFeedback: feedbackResult.changes,
          deletedStats: statsResult.changes,
          totalDeleted
        });
      }
      
      return totalDeleted;
    } catch (error) {
      Utils.log('error', 'Ошибка очистки старых данных', { error });
      return 0;
    }
  }

  /**
   * Закрытие соединения с базой данных
   */
  close() {
    if (this.db) {
      this.db.close();
      this.isInitialized = false;
      Utils.log('info', 'Соединение с базой данных закрыто');
    }
  }

  /**
   * Получение статистики базы данных
   * 
   * @returns {Object} Статистика
   */
  getDatabaseStats() {
    try {
      const stats = {};
      
      // Количество пользователей
      const usersCount = this.db.prepare('SELECT COUNT(*) as count FROM users').get();
      stats.users = usersCount.count;
      
      // Количество чатов
      const chatsCount = this.db.prepare('SELECT COUNT(*) as count FROM chats').get();
      stats.chats = chatsCount.count;
      
      // Количество обратной связи
      const feedbackCount = this.db.prepare('SELECT COUNT(*) as count FROM feedback').get();
      stats.feedback = feedbackCount.count;
      
      // Размер базы данных
      const dbSize = this.db.prepare('PRAGMA page_count').get();
      const pageSize = this.db.prepare('PRAGMA page_size').get();
      stats.dbSizeMB = Math.round((dbSize.page_count * pageSize.page_size) / 1024 / 1024 * 100) / 100;
      
      return stats;
    } catch (error) {
      Utils.log('error', 'Ошибка получения статистики БД', { error });
      return {};
    }
  }
}

module.exports = DatabaseManager;
