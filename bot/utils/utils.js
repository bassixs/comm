const fs = require('fs');
const path = require('path');

class Utils {
  /**
   * Логирование с временной меткой
   */
  static log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };

    // Вывод в консоль
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
    if (data) {
      console.log('Data:', JSON.stringify(data, null, 2));
    }

    // Сохранение в файл (опционально)
    this.saveToLogFile(logEntry);
  }

  /**
   * Сохранение лога в файл
   */
  static saveToLogFile(logEntry) {
    try {
      const logDir = path.join(__dirname, '..', 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logFile = path.join(logDir, `${new Date().toISOString().split('T')[0]}.log`);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      fs.appendFileSync(logFile, logLine);
    } catch (error) {
      console.error('Ошибка при сохранении лога:', error);
    }
  }

  /**
   * Обработка ошибок API
   */
  static handleApiError(error, context = '') {
    let errorMessage = 'Неизвестная ошибка';
    let errorCode = 'UNKNOWN';

    if (error.response) {
      // Ошибка от сервера
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 401:
          errorMessage = 'Ошибка авторизации API';
          errorCode = 'AUTH_ERROR';
          break;
        case 403:
          errorMessage = 'Доступ запрещен';
          errorCode = 'FORBIDDEN';
          break;
        case 404:
          errorMessage = 'API эндпоинт не найден';
          errorCode = 'NOT_FOUND';
          break;
        case 429:
          errorMessage = 'Превышен лимит запросов';
          errorCode = 'RATE_LIMIT';
          break;
        case 500:
          errorMessage = 'Внутренняя ошибка сервера';
          errorCode = 'SERVER_ERROR';
          break;
        default:
          errorMessage = `Ошибка сервера: ${status}`;
          errorCode = `HTTP_${status}`;
      }

      if (data && data.error) {
        errorMessage += ` - ${data.error}`;
      }
    } else if (error.request) {
      // Ошибка сети
      errorMessage = 'Ошибка подключения к API';
      errorCode = 'NETWORK_ERROR';
    } else {
      // Другая ошибка
      errorMessage = error.message || 'Неизвестная ошибка';
      errorCode = 'GENERAL_ERROR';
    }

    this.log('error', `${context}: ${errorMessage}`, {
      code: errorCode,
      originalError: error.message,
      stack: error.stack
    });

    return {
      success: false,
      error: errorMessage,
      code: errorCode
    };
  }

  /**
   * Валидация текста
   */
  static validateText(text, maxLength = null) {
    if (!text || typeof text !== 'string') {
      return {
        valid: false,
        error: 'Текст должен быть строкой'
      };
    }

    if (text.trim().length === 0) {
      return {
        valid: false,
        error: 'Текст не может быть пустым'
      };
    }

    // Убираем ограничение по длине, если maxLength не указан или равен null
    if (maxLength && text.length > maxLength) {
      return {
        valid: false,
        error: `Текст слишком длинный (${text.length} символов). Максимум: ${maxLength}`
      };
    }

    return {
      valid: true,
      text: text.trim()
    };
  }

  /**
   * Форматирование времени
   */
  static formatDuration(ms) {
    if (ms < 1000) {
      return `${ms}мс`;
    } else if (ms < 60000) {
      return `${Math.round(ms / 1000)}с`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.round((ms % 60000) / 1000);
      return `${minutes}м ${seconds}с`;
    }
  }

  /**
   * Создание уникального ID
   */
  static generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Очистка текста от лишних символов
   */
  static cleanText(text) {
    return text
      .replace(/\s+/g, ' ') // Убираем множественные пробелы
      .replace(/\n\s*\n/g, '\n') // Убираем пустые строки
      .trim();
  }

  /**
   * Разбиение длинного текста на части
   */
  static splitText(text, maxLength = 4096) {
    if (text.length <= maxLength) {
      return [text];
    }

    const parts = [];
    let currentPart = '';

    const sentences = text.split(/[.!?]+/).filter(s => s.trim());

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;

      const potentialPart = currentPart + (currentPart ? '. ' : '') + trimmedSentence + '.';

      if (potentialPart.length <= maxLength) {
        currentPart = potentialPart;
      } else {
        if (currentPart) {
          parts.push(currentPart);
        }
        currentPart = trimmedSentence + '.';
      }
    }

    if (currentPart) {
      parts.push(currentPart);
    }

    return parts;
  }

  /**
   * Проверка доступности URL
   */
  static async checkUrl(url, timeout = 5000) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

module.exports = Utils;
