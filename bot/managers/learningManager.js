const fs = require('fs').promises;
const path = require('path');
const config = require('../utils/config');
const Utils = require('../utils/utils');
const DatabaseManager = require('./databaseManager');

/**
 * Менеджер для управления обучением и обратной связью
 * 
 * @class LearningManager
 * @description Управляет сбором обратной связи от пользователей,
 * сохранением оценок комментариев и подготовкой данных для обучения
 * 
 * @example
 * const learningManager = new LearningManager();
 * await learningManager.saveFeedback(userId, commentId, rating, feedback);
 * 
 * @property {string} dataDir - Директория для хранения данных обучения
 * @property {string} feedbackFile - Файл с обратной связью
 * @property {string} trainingDataFile - Файл с данными для обучения
 * @property {Map} feedbackCache - Кэш обратной связи
 */
class LearningManager {
  /**
   * Создает новый экземпляр LearningManager
   * 
   * @constructor
   * @description Инициализирует менеджер обучения, создает необходимые директории
   * и загружает существующие данные
   */
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data', 'learning');
    this.feedbackFile = path.join(this.dataDir, 'feedback.json');
    this.trainingDataFile = path.join(this.dataDir, 'training-data.json');
    
    this.feedbackCache = new Map(); // userId -> feedback[]
    
    this.dbManager = new DatabaseManager();
    this.useDatabase = false; // Флаг для переключения между БД и JSON
    
    this.init();
  }

  /**
   * Инициализация менеджера обучения
   */
  async init() {
    try {
      // Создаем директорию если не существует
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // Пытаемся инициализировать базу данных
      const dbInitialized = await this.dbManager.init();
      if (dbInitialized) {
        this.useDatabase = true;
        Utils.log('info', 'LearningManager использует базу данных');
      } else {
        Utils.log('warn', 'LearningManager использует JSON файлы (база данных недоступна)');
      }
      
      // Загружаем данные (если не используем БД)
      if (!this.useDatabase) {
        await this.loadFeedback();
      }
      
      // Запускаем автоочистку
      this.startAutoCleanup();
      
      Utils.log('info', 'LearningManager инициализирован');
    } catch (error) {
      Utils.log('error', 'Ошибка инициализации LearningManager', error);
    }
  }

  /**
   * Загрузка обратной связи из файла
   */
  async loadFeedback() {
    try {
      const feedbackData = await fs.readFile(this.feedbackFile, 'utf8').catch(() => '{}');
      const feedbackObj = JSON.parse(feedbackData);
      
      for (const [userId, feedback] of Object.entries(feedbackObj)) {
        this.feedbackCache.set(parseInt(userId), feedback);
      }

      Utils.log('info', 'Обратная связь загружена', { 
        users: this.feedbackCache.size 
      });
    } catch (error) {
      Utils.log('error', 'Ошибка загрузки обратной связи', error);
    }
  }

  /**
   * Сохранение обратной связи в файл
   */
  async saveFeedback() {
    try {
      const feedbackObj = {};
      for (const [userId, feedback] of this.feedbackCache.entries()) {
        feedbackObj[userId] = feedback;
      }
      await fs.writeFile(this.feedbackFile, JSON.stringify(feedbackObj, null, 2));

      Utils.log('info', 'Обратная связь сохранена');
    } catch (error) {
      Utils.log('error', 'Ошибка сохранения обратной связи', error);
    }
  }

  /**
   * Сохранение оценки комментария
   * 
   * @param {number} userId - ID пользователя
   * @param {string} commentId - ID комментария
   * @param {number} rating - Оценка (1-5)
   * @param {Object} context - Контекст (оригинальный текст, личность, модель)
   * @returns {Promise<Object>} Результат сохранения
   */
  async saveCommentRating(userId, commentId, rating, context) {
    try {
      if (this.useDatabase) {
        return await this.saveCommentRatingDB(userId, commentId, rating, context);
      } else {
        return await this.saveCommentRatingJSON(userId, commentId, rating, context);
      }
    } catch (error) {
      Utils.log('error', 'Ошибка сохранения оценки комментария', error);
      return {
        success: false,
        error: 'Ошибка сохранения оценки'
      };
    }
  }

  /**
   * Сохранение оценки комментария (база данных)
   */
  async saveCommentRatingDB(userId, commentId, rating, context) {
    try {
      // Получаем или создаем пользователя в БД
      const user = this.dbManager.getUserOrCreate(userId);
      
      // Сохраняем через БД менеджер
      const result = this.dbManager.saveFeedback(
        user.id,
        commentId,
        rating,
        null, // feedbackText
        'comment_rating',
        context
      );
      
      if (result.success) {
        Utils.log('info', 'Оценка комментария сохранена (БД)', { 
          userId, commentId, rating 
        });
      }
      
      return result;
    } catch (error) {
      Utils.log('error', 'Ошибка сохранения оценки комментария (БД)', { userId, commentId, error });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Сохранение оценки комментария (JSON)
   */
  async saveCommentRatingJSON(userId, commentId, rating, context) {
    try {
      if (!this.feedbackCache.has(userId)) {
        this.feedbackCache.set(userId, []);
      }

      const userFeedback = this.feedbackCache.get(userId);
      
      const feedback = {
        id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        commentId,
        rating,
        context,
        timestamp: new Date().toISOString(),
        type: 'comment_rating'
      };

      userFeedback.push(feedback);
      await this.saveFeedback();

      Utils.log('info', 'Оценка комментария сохранена (JSON)', { 
        userId, commentId, rating 
      });

      return {
        success: true,
        data: feedback
      };
    } catch (error) {
      Utils.log('error', 'Ошибка сохранения оценки комментария (JSON)', { userId, commentId, error });
      return {
        success: false,
        error: 'Ошибка сохранения оценки'
      };
    }
  }

  /**
   * Сохранение обратной связи для доработки
   * 
   * @param {number} userId - ID пользователя
   * @param {string} commentId - ID комментария
   * @param {string} feedback - Текст обратной связи
   * @param {Object} context - Контекст
   * @returns {Promise<Object>} Результат сохранения
   */
  async saveImprovementFeedback(userId, commentId, feedback, context) {
    try {
      if (!this.feedbackCache.has(userId)) {
        this.feedbackCache.set(userId, []);
      }

      const userFeedback = this.feedbackCache.get(userId);
      
      const feedbackData = {
        id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        commentId,
        feedback,
        context,
        timestamp: new Date().toISOString(),
        type: 'improvement_feedback'
      };

      userFeedback.push(feedbackData);
      await this.saveFeedback();

      Utils.log('info', 'Обратная связь для доработки сохранена', { 
        userId, commentId 
      });

      return {
        success: true,
        data: feedbackData
      };
    } catch (error) {
      Utils.log('error', 'Ошибка сохранения обратной связи для доработки', error);
      return {
        success: false,
        error: 'Ошибка сохранения обратной связи'
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
    const userFeedback = this.feedbackCache.get(userId) || [];
    
    const stats = {
      totalFeedback: userFeedback.length,
      ratings: {
        1: 0, 2: 0, 3: 0, 4: 0, 5: 0
      },
      improvementFeedback: 0,
      averageRating: 0
    };

    let totalRating = 0;
    let ratingCount = 0;

    userFeedback.forEach(feedback => {
      if (feedback.type === 'comment_rating') {
        stats.ratings[feedback.rating]++;
        totalRating += feedback.rating;
        ratingCount++;
      } else if (feedback.type === 'improvement_feedback') {
        stats.improvementFeedback++;
      }
    });

    if (ratingCount > 0) {
      stats.averageRating = (totalRating / ratingCount).toFixed(1);
    }

    return stats;
  }

  /**
   * Получение данных для обучения
   * 
   * @returns {Object} Данные для обучения
   */
  getTrainingData() {
    const trainingData = {
      ratings: [],
      improvements: [],
      totalFeedback: 0
    };

    for (const [userId, userFeedback] of this.feedbackCache.entries()) {
      userFeedback.forEach(feedback => {
        if (feedback.type === 'comment_rating') {
          trainingData.ratings.push({
            userId,
            commentId: feedback.commentId,
            rating: feedback.rating,
            context: feedback.context,
            timestamp: feedback.timestamp
          });
        } else if (feedback.type === 'improvement_feedback') {
          trainingData.improvements.push({
            userId,
            commentId: feedback.commentId,
            feedback: feedback.feedback,
            context: feedback.context,
            timestamp: feedback.timestamp
          });
        }
      });
    }

    trainingData.totalFeedback = trainingData.ratings.length + trainingData.improvements.length;

    return trainingData;
  }

  /**
   * Автоочистка старых данных обратной связи
   */
  startAutoCleanup() {
    setInterval(async () => {
      try {
        const now = new Date();
        const retentionDays = config.learning.feedbackRetentionDays;
        const cutoffDate = new Date(now.getTime() - (retentionDays * 24 * 60 * 60 * 1000));
        
        let cleanedCount = 0;

        for (const [userId, userFeedback] of this.feedbackCache.entries()) {
          const oldFeedback = userFeedback.filter(feedback => {
            const feedbackDate = new Date(feedback.timestamp);
            return feedbackDate < cutoffDate;
          });

          for (const oldFeedbackItem of oldFeedback) {
            const index = userFeedback.indexOf(oldFeedbackItem);
            if (index !== -1) {
              userFeedback.splice(index, 1);
              cleanedCount++;
            }
          }
        }

        if (cleanedCount > 0) {
          await this.saveFeedback();
          Utils.log('info', 'Автоочистка обратной связи завершена', { cleanedCount });
        }
      } catch (error) {
        Utils.log('error', 'Ошибка автоочистки обратной связи', error);
      }
    }, config.chat.autoCleanupInterval);
  }

  /**
   * Экспорт данных для обучения
   * 
   * @returns {Promise<Object>} Экспортированные данные
   */
  async exportTrainingData() {
    try {
      const trainingData = this.getTrainingData();
      await fs.writeFile(this.trainingDataFile, JSON.stringify(trainingData, null, 2));
      
      Utils.log('info', 'Данные для обучения экспортированы', { 
        totalFeedback: trainingData.totalFeedback 
      });

      return {
        success: true,
        data: trainingData
      };
    } catch (error) {
      Utils.log('error', 'Ошибка экспорта данных для обучения', error);
      return {
        success: false,
        error: 'Ошибка экспорта данных'
      };
    }
  }
}

module.exports = LearningManager;
