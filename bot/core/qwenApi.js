const axios = require('axios');
const config = require('../utils/config');
const Utils = require('../utils/utils');

/**
 * API клиент для работы с FreeQwenApi
 * 
 * @class QwenApi
 * @description Предоставляет интерфейс для взаимодействия с FreeQwenApi сервером,
 * включая генерацию комментариев, проверку статуса и управление моделями
 * 
 * @example
 * const api = new QwenApi();
 * const result = await api.generateComments('Текст для генерации');
 * 
 * @property {string} baseURL - Базовый URL API сервера
 * @property {string} apiKey - API ключ для авторизации
 * @property {string} model - Модель по умолчанию
 * @property {AxiosInstance} client - HTTP клиент
 */
class QwenApi {
  /**
   * Создает новый экземпляр QwenApi
   * 
   * @constructor
   * @description Инициализирует API клиент с настройками из конфигурации
   */
  constructor() {
    this.baseURL = config.qwen.apiUrl;
    this.apiKey = config.qwen.apiKey;
    this.model = config.qwen.model;
    
    // Настройка axios
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: config.qwen.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Добавляем API ключ в заголовки если он есть
    if (this.apiKey) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.apiKey}`;
    }
  }

  /**
   * Проверка статуса API
   */
  async checkStatus() {
    try {
      Utils.log('info', 'Проверка статуса API');
      const response = await this.client.get('/api/status');
      Utils.log('info', 'API статус получен', response.data);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return Utils.handleApiError(error, 'Проверка статуса API');
    }
  }

  /**
   * Получение списка доступных моделей
   */
  async getModels() {
    try {
      Utils.log('info', 'Получение списка моделей');
      const response = await this.client.get('/api/models');
      Utils.log('info', 'Список моделей получен', response.data);
      
      // Извлекаем только названия моделей из OpenAI формата
      const models = response.data.data ? response.data.data.map(model => model.id) : [];
      
      return {
        success: true,
        data: { models }
      };
    } catch (error) {
      return Utils.handleApiError(error, 'Получение списка моделей');
    }
  }

  /**
   * Генерация комментариев к тексту с повторными попытками
   * 
   * @method generateComments
   * @description Генерирует 4 варианта комментария к заданному тексту с учетом выбранной личности
   * Использует отдельный чат для каждого пользователя и поддерживает повторные попытки при ошибках
   * 
   * @param {string} text - Текст для генерации комментариев
   * @param {number|null} userId - ID пользователя (опционально)
   * @param {string|null} model - Модель для генерации (опционально)
   * @param {string|null} chatId - ID чата (опционально)
   * @param {number|null} maxRetries - Максимальное количество попыток (опционально)
   * @param {string|null} personality - Выбранная личность (опционально)
   * @param {Object|null} personalityConfig - Конфигурация личности (опционально)
   * 
   * @returns {Promise<Object>} Результат генерации
   * @returns {boolean} returns.success - Успешность операции
   * @returns {string} returns.data - Сгенерированные комментарии
   * @returns {string} returns.error - Сообщение об ошибке (если есть)
   * 
   * @example
   * const result = await api.generateComments('Текст поста', 123, 'qwen-max-latest', 'chat_123', 3, 'timur', personalityConfig);
   */
  async generateComments(text, userId = null, model = null, chatId = null, maxRetries = null, personality = null, personalityConfig = null) {
    const retries = maxRetries || config.qwen.maxRetries;
    const userModel = model || config.qwen.model;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Валидация входного текста (без ограничения по длине)
        const validation = Utils.validateText(text);
        if (!validation.valid) {
          return {
            success: false,
            error: validation.error
          };
        }

        const cleanText = Utils.cleanText(validation.text);
        Utils.log('info', `Генерация комментариев (попытка ${attempt}/${retries})`, { 
          textLength: cleanText.length,
          model: userModel,
          userId: userId || 'anonymous',
          chatId: chatId || 'new'
        });

        const startTime = Date.now();
        
        // Формируем промпт с учетом личности
        let prompt = config.prompt;
        
        if (personality && personalityConfig) {
          prompt += `\n\nВАЖНО: Ты отвечаешь от имени личности "${personalityConfig.name}".
          
Характеристики личности:
- Возраст и пол: ${personalityConfig.description}
- Стиль речи: ${personalityConfig.style}
- Фон: ${personalityConfig.background}
- Приемы: ${personalityConfig.techniques}
- Запрещено: ${personalityConfig.forbidden}

Отвечай строго в стиле этой личности, используя её характерные приемы и избегая запрещенных элементов.`;
        }
        
        // Формируем запрос
        const requestBody = {
          message: `${prompt}\n\nТекст для генерации комментариев:\n"${cleanText}"`,
          model: userModel
        };

        // Если указан chatId, добавляем его в запрос
        if (chatId) {
          requestBody.chatId = chatId;
        }

        const response = await this.client.post('/api/chat', requestBody);
        
        // Извлекаем текст ответа из OpenAI формата
        let responseText = '';
        let responseChatId = chatId;
        
        if (response.data && response.data.choices && response.data.choices.length > 0) {
          responseText = response.data.choices[0].message.content;
          responseChatId = response.data.chatId || chatId;
        } else if (typeof response.data === 'string') {
          responseText = response.data;
        } else {
          responseText = JSON.stringify(response.data);
        }
        
        const duration = Math.round((Date.now() - startTime) / 1000);
        Utils.log('info', 'Комментарии сгенерированы', {
          duration: `${duration}с`,
          responseLength: responseText.length || 0
        });

        return {
          success: true,
          data: responseText,
          chatId: responseChatId,
          model: userModel
        };
      } catch (error) {
        Utils.log('error', `Ошибка генерации комментариев (попытка ${attempt}/${retries})`, error);
        
        // Если это последняя попытка, возвращаем ошибку
        if (attempt === retries) {
          return Utils.handleApiError(error, 'Генерация комментариев');
        }
        
        // Ждем перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  /**
   * Очистка истории чата
   */
  async clearChat(chatId) {
    try {
      Utils.log('info', 'Очистка истории чата', { chatId });
      const response = await this.client.delete(`/api/chats/${chatId}/messages`);
      Utils.log('info', 'История чата очищена', { chatId });
      
      return {
        success: true,
        data: { chatId, cleared: true }
      };
    } catch (error) {
      return Utils.handleApiError(error, 'Очистка истории чата');
    }
  }

  /**
   * Доработка комментария на основе обратной связи
   * 
   * @method improveComment
   * @description Дорабатывает комментарий на основе обратной связи пользователя,
   * сохраняя контекст и применяя новые требования
   * 
   * @param {string} originalComment - Оригинальный комментарий
   * @param {string} feedback - Обратная связь пользователя
   * @param {string} originalText - Оригинальный текст поста
   * @param {string|null} personality - Личность (опционально)
   * @param {Object|null} personalityConfig - Конфигурация личности (опционально)
   * @param {string|null} chatId - ID чата (опционально)
   * @param {string|null} model - Модель (опционально)
   * 
   * @returns {Promise<Object>} Результат доработки
   * @returns {boolean} returns.success - Успешность операции
   * @returns {string} returns.data - Доработанный комментарий
   * @returns {string} returns.error - Сообщение об ошибке (если есть)
   * 
   * @example
   * const result = await api.improveComment('Оригинальный комментарий', 'Сделай более коротким', 'Текст поста');
   */
  async improveComment(originalComment, feedback, originalText, personality = null, personalityConfig = null, chatId = null, model = null) {
    const userModel = model || config.qwen.model;
    
    try {
      Utils.log('info', 'Доработка комментария', { 
        originalLength: originalComment.length,
        feedbackLength: feedback.length,
        model: userModel
      });

      const startTime = Date.now();
      
      // Формируем промпт для доработки
      let prompt = `Ты — эксперт по доработке комментариев для соцсетей.

ОРИГИНАЛЬНЫЙ ТЕКСТ ПОСТА:
"${originalText}"

ОРИГИНАЛЬНЫЙ КОММЕНТАРИЙ:
"${originalComment}"

ОБРАТНАЯ СВЯЗЬ ПОЛЬЗОВАТЕЛЯ:
"${feedback}"

ЗАДАЧА: Доработай оригинальный комментарий согласно обратной связи пользователя, сохраняя:
- Основную идею и позицию
- Стиль и тон
- Соответствие контексту оригинального поста
- Все требования к комментариям (без эмодзи, сленга, длинных тире)
- Позицию поддержки власти (запрещена критика власти)

ВАЖНО: 
- Верни ТОЛЬКО доработанный комментарий, без пояснений
- Сохрани нумерацию если она есть (1., 2., 3., 4.)
- Комментарий должен быть законченным и готовым к использованию
- Выступай с точки зрения гражданина, который поддерживает власть`;

      // Добавляем конфигурацию личности если указана
      if (personality && personalityConfig) {
        prompt += `\n\nСОХРАНИ СТИЛЬ ЛИЧНОСТИ "${personalityConfig.name}":
- Возраст и пол: ${personalityConfig.description}
- Стиль речи: ${personalityConfig.style}
- Фон: ${personalityConfig.background}
- Приемы: ${personalityConfig.techniques}
- Запрещено: ${personalityConfig.forbidden}`;
      }
      
      // Формируем запрос
      const requestBody = {
        message: prompt,
        model: userModel
      };

      // Если указан chatId, добавляем его в запрос
      if (chatId) {
        requestBody.chatId = chatId;
      }

      const response = await this.client.post('/api/chat', requestBody);
      
      // Извлекаем текст ответа
      let responseText = '';
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        responseText = response.data.choices[0].message.content;
      } else if (typeof response.data === 'string') {
        responseText = response.data;
      } else {
        responseText = JSON.stringify(response.data);
      }
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      Utils.log('info', 'Комментарий доработан', {
        duration: `${duration}с`,
        responseLength: responseText.length || 0
      });

      return {
        success: true,
        data: responseText,
        model: userModel
      };
    } catch (error) {
      Utils.log('error', 'Ошибка доработки комментария', error);
      return Utils.handleApiError(error, 'Доработка комментария');
    }
  }
}

module.exports = QwenApi;
