const TelegramBot = require('node-telegram-bot-api');
const config = require('../utils/config');
const QwenApi = require('./qwenApi');
const ChatManager = require('../managers/chatManager');
const LearningManager = require('../managers/learningManager');
const Utils = require('../utils/utils');

/**
 * Главный класс для обработки Telegram бота
 * 
 * @class TelegramBotHandler
 * @description Обрабатывает все взаимодействия с пользователями через Telegram API,
 * управляет состояниями пользователей, интегрируется с Qwen API для генерации комментариев
 * 
 * @example
 * const bot = new TelegramBotHandler();
 * bot.start();
 * 
 * @property {TelegramBot} bot - Экземпляр Telegram бота
 * @property {QwenApi} qwenApi - API клиент для Qwen
 * @property {ChatManager} chatManager - Менеджер чатов
 * @property {Map} userStates - Состояния пользователей
 */
class TelegramBotHandler {
  /**
   * Создает новый экземпляр TelegramBotHandler
   * 
   * @constructor
   * @description Инициализирует бота с настройками polling и обработчиками событий
   */
  constructor() {
    this.bot = new TelegramBot(config.telegram.token, { 
      polling: true,
      // Добавляем настройки для более стабильного соединения
      polling_options: {
        timeout: 10,
        limit: 100,
        retryTimeout: 5000
      }
    });
    this.qwenApi = new QwenApi();
    this.chatManager = new ChatManager();
    this.learningManager = new LearningManager();
    this.userStates = new Map(); // Хранение состояний пользователей
    
    this.setupHandlers();
  }

  /**
   * Инициализация бота
   * 
   * @method init
   * @description Асинхронная инициализация менеджеров
   */
  async init() {
    try {
      // Инициализируем менеджеры
      await this.chatManager.init();
      await this.learningManager.init();
      
      Utils.log('info', 'TelegramBotHandler инициализирован');
    } catch (error) {
      Utils.log('error', 'Ошибка инициализации TelegramBotHandler', error);
    }
  }

  /**
   * Настройка обработчиков событий
   * 
   * @method setupHandlers
   * @description Регистрирует все обработчики событий для команд и сообщений
   * Включает обработку команд, текстовых сообщений, callback-запросов и ошибок
   * 
   * @private
   */
  setupHandlers() {
    // Основные команды
    this.bot.onText(/\/start/, this.handleStart.bind(this));
    this.bot.onText(/\/help/, this.handleHelp.bind(this));
    this.bot.onText(/\/generate/, this.handleGenerate.bind(this));
    this.bot.onText(/\/status/, this.handleStatus.bind(this));
    this.bot.onText(/\/learning/, this.handleLearning.bind(this));
    
    // Управление моделями
    this.bot.onText(/\/models/, this.handleModels.bind(this));
    this.bot.onText(/\/setmodel/, this.handleSetModel.bind(this));
    
    // Управление чатами
    this.bot.onText(/\/chats/, this.handleChats.bind(this));
    this.bot.onText(/\/newchat/, this.handleNewChat.bind(this));
    this.bot.onText(/\/selectchat/, this.handleSelectChat.bind(this));
    this.bot.onText(/\/renamechat/, this.handleRenameChat.bind(this));
    this.bot.onText(/\/deletechat/, this.handleDeleteChat.bind(this));
    this.bot.onText(/\/clear/, this.handleClear.bind(this));
    
    // Обработчик текстовых сообщений
    this.bot.on('message', this.handleMessage.bind(this));
    
    // Обработчик callback-запросов (кнопки)
    this.bot.on('callback_query', this.handleCallbackQuery.bind(this));
    
    // Обработчик ошибок
    this.bot.on('polling_error', (error) => {
      console.error('Ошибка polling:', error);
      
      // Обрабатываем разные типы ошибок
      if (error.code === 'EFATAL') {
        console.error('Фатальная ошибка polling - перезапуск через 10 секунд...');
        setTimeout(() => {
          this.restartPolling();
        }, 10000);
      } else if (error.code === 'ECONNRESET' || error.message.includes('ECONNRESET')) {
        console.error('Соединение разорвано - перезапуск через 5 секунд...');
        setTimeout(() => {
          this.restartPolling();
        }, 5000);
      } else {
        console.error('Неизвестная ошибка polling - перезапуск через 15 секунд...');
        setTimeout(() => {
          this.restartPolling();
        }, 15000);
      }
    });
  }

  /**
   * Обработчик команды /start
   */
  async handleStart(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Создаем первый чат для пользователя если его нет
    const userData = this.chatManager.getUserData(userId);
    if (userData.chats.length === 0) {
      await this.chatManager.createChat(userId, 'Основной чат');
    }
    
    const welcomeMessage = `👋 Привет! Я бот-ассистент для генерации комментариев к постам в соцсетях.

🤖 Я использую AI модель Qwen для создания реалистичных, живых комментариев без "соплей" и пустой эмпатии.

👤 *Новые возможности:*
- Выбор личности для генерации комментариев
- 5 уникальных персонажей с разными стилями речи
- Без ограничений по длине текста

📝 Как использовать:
1. Используйте команду /generate
2. Выберите личность из предложенных
3. Отправьте текст поста из соцсети
4. Получите 4 разных варианта комментария

💡 Доступные команды:
/help - Показать справку
/generate - Начать генерацию комментариев
/models - Показать доступные модели
/setmodel - Выбрать модель
/chats - Управление чатами
/newchat - Создать новый чат
/status - Проверить статус API
/learning - Статистика обучения

Начните с команды /generate для выбора личности!`;

    await this.bot.sendMessage(chatId, welcomeMessage);
  }

  /**
   * Обработчик команды /help
   */
  async handleHelp(msg) {
    const chatId = msg.chat.id;
    const helpMessage = `📚 Справка по использованию бота

🎯 Назначение:
Бот генерирует реалистичные комментарии к постам в соцсетях, используя AI модель Qwen.

👤 *Личности для генерации:*
• *Тимур* - Мужчина 38-45 лет, госсектор/тех/юриспруденция
• *Любовь* - Девушка 38-45 лет, образование (учитель/воспитатель)
• *Софья* - Девушка 25-32 года, самозанятая в beauty-сфере
• *Галина* - Девушка 59-65 лет, бывший бухгалтер/пенсионерка
• *Павел* - Мужчина 25-28 лет, молодой рабочий с завода

📋 Основные команды:
/start - Запустить бота
/help - Показать эту справку
/generate - Начать генерацию комментариев
/status - Проверить статус API
/learning - Статистика обучения

🤖 Управление моделями:
/models - Показать доступные модели
/setmodel - Выбрать модель для использования

💬 Управление чатами:
/chats - Показать список чатов
/newchat - Создать новый чат
/selectchat - Выбрать активный чат
/renamechat - Переименовать чат
/deletechat - Удалить чат
/clear - Очистить историю чата

💡 Как использовать:
1. Используйте команду /generate
2. Выберите личность из предложенных
3. Отправьте текст поста из соцсети
4. Получите 4 варианта комментария в стиле выбранной личности

⚠️ Ограничения:
• Максимум чатов на пользователя: ${config.chat.maxChatsPerUser}
• Комментарии генерируются на русском языке
• Время генерации: до 60 секунд

🔧 Техническая информация:
• API: FreeQwenApi (локальный прокси)
• URL: ${config.qwen.apiUrl}`;

    await this.bot.sendMessage(chatId, helpMessage);
  }

  /**
   * Обработчик команды /generate
   */
  async handleGenerate(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Создаем клавиатуру с личностями (добавляем timestamp для уникальности)
    const timestamp = Date.now();
    const keyboard = {
      inline_keyboard: [
        [
          { text: 'Тимур', callback_data: `personality_timur_${timestamp}` },
          { text: 'Любовь', callback_data: `personality_lyubov_${timestamp}` }
        ],
        [
          { text: 'Софья', callback_data: `personality_sofya_${timestamp}` },
          { text: 'Галина', callback_data: `personality_galina_${timestamp}` }
        ],
        [
          { text: 'Павел', callback_data: `personality_pavel_${timestamp}` }
        ]
      ]
    };
    
    const message = `👤 Выберите личность для генерации комментариев:

*Тимур* - Мужчина 38-45 лет, госсектор/тех/юриспруденция
*Любовь* - Девушка 38-45 лет, образование (учитель/воспитатель)
*Софья* - Девушка 25-32 года, самозанятая в beauty-сфере
*Галина* - Девушка 59-65 лет, бывший бухгалтер/пенсионерка
*Павел* - Мужчина 25-28 лет, молодой рабочий с завода

После выбора личности отправьте текст поста для генерации комментариев.`;
    
    await this.bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    });
  }

  /**
   * Обработчик команды /status
   */
  async handleStatus(msg) {
    const chatId = msg.chat.id;
    
    await this.bot.sendMessage(chatId, '🔍 Проверяю статус API...');
    
    const status = await this.qwenApi.checkStatus();
    
    if (status.success) {
      const statusMessage = `✅ API работает нормально

📊 Статус: ${status.data.status || 'OK'}
🔗 URL: ${config.qwen.apiUrl}
🤖 Доступные аккаунты: ${status.data.accounts?.length || 0}`;
      
      await this.bot.sendMessage(chatId, statusMessage);
    } else {
      const errorMessage = `❌ Ошибка подключения к API

🔗 URL: ${config.qwen.apiUrl}
⚠️ Ошибка: ${status.error}

Убедитесь, что FreeQwenApi запущен и доступен по указанному адресу.`;
      
      await this.bot.sendMessage(chatId, errorMessage);
    }
  }

  /**
   * Обработчик команды /models
   */
  async handleModels(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    await this.bot.sendMessage(chatId, '🤖 Получаю список доступных моделей...');
    
    try {
      const result = await this.qwenApi.getModels();
      
      if (result.success && result.data && result.data.models) {
        const currentModel = this.chatManager.getUserModel(userId);
        let message = `🤖 *Доступные модели Qwen*\n\n`;
        
        result.data.models.forEach((model, index) => {
          const isCurrent = model === currentModel ? ' ✅' : '';
          message += `${index + 1}. \`${model}\`${isCurrent}\n`;
        });
        
        message += `\nТекущая модель: \`${currentModel}\``;
        message += `\n\nИспользуйте /setmodel для выбора модели`;
        
        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } else {
        const message = `❌ Не удалось получить список моделей.

Попробуйте позже или проверьте статус API командой /status`;
        
        await this.bot.sendMessage(chatId, message);
      }
    } catch (error) {
      console.error('Ошибка при получении моделей:', error);
      
      const errorMessage = `❌ Произошла ошибка при получении списка моделей.

Попробуйте позже или обратитесь к администратору.`;
      
      await this.bot.sendMessage(chatId, errorMessage);
    }
  }

  /**
   * Обработчик команды /setmodel
   */
  async handleSetModel(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Устанавливаем состояние ожидания модели
    this.userStates.set(userId, { state: 'waiting_for_model' });
    
    const message = `🤖 Отправьте название модели, которую хотите использовать.

Примеры: qwen-max-latest, qwen-plus, qwen-turbo

Используйте /models для просмотра доступных моделей.`;
    
    await this.bot.sendMessage(chatId, message);
  }

  /**
   * Обработчик команды /chats
   */
  async handleChats(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
      const result = this.chatManager.getChats(userId);
      
      if (result.success && result.data.chats.length > 0) {
        let message = `💬 *Ваши чаты*\n\n`;
        
        result.data.chats.forEach((chat, index) => {
          const isActive = chat.id === result.data.activeChatId ? ' ✅' : '';
          const date = new Date(chat.createdAt).toLocaleDateString('ru-RU');
          message += `${index + 1}. \`${chat.name}\`${isActive}\n`;
          message += `   📅 ${date} | 💬 ${chat.messageCount} сообщений\n\n`;
        });
        
        message += `Активный чат: \`${result.data.chats.find(c => c.id === result.data.activeChatId)?.name || 'Не выбран'}\``;
        message += `\n\nИспользуйте /selectchat для выбора чата`;
        
        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } else {
        const message = `💬 У вас пока нет чатов.

Используйте /newchat для создания первого чата.`;
        
        await this.bot.sendMessage(chatId, message);
      }
    } catch (error) {
      console.error('Ошибка при получении чатов:', error);
      
      const errorMessage = `❌ Произошла ошибка при получении списка чатов.

Попробуйте позже или обратитесь к администратору.`;
      
      await this.bot.sendMessage(chatId, errorMessage);
    }
  }

  /**
   * Обработчик команды /newchat
   */
  async handleNewChat(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Устанавливаем состояние ожидания названия чата
    this.userStates.set(userId, { state: 'waiting_for_chat_name' });
    
    const message = `💬 Отправьте название для нового чата.

Максимальная длина: ${config.chat.maxChatNameLength} символов`;
    
    await this.bot.sendMessage(chatId, message);
  }

  /**
   * Обработчик команды /selectchat
   */
  async handleSelectChat(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
      const result = this.chatManager.getChats(userId);
      
      if (result.success && result.data.chats.length > 0) {
        // Устанавливаем состояние ожидания выбора чата
        this.userStates.set(userId, { 
          state: 'waiting_for_chat_selection',
          data: { chats: result.data.chats }
        });
        
        let message = `💬 Выберите чат для активации:\n\n`;
        
        result.data.chats.forEach((chat, index) => {
          const isActive = chat.id === result.data.activeChatId ? ' ✅' : '';
          message += `${index + 1}. \`${chat.name}\`${isActive}\n`;
        });
        
        message += `\nОтправьте номер чата для выбора.`;
        
        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } else {
        const message = `💬 У вас пока нет чатов.

Используйте /newchat для создания первого чата.`;
        
        await this.bot.sendMessage(chatId, message);
      }
    } catch (error) {
      console.error('Ошибка при выборе чата:', error);
      
      const errorMessage = `❌ Произошла ошибка при выборе чата.

Попробуйте позже или обратитесь к администратору.`;
      
      await this.bot.sendMessage(chatId, errorMessage);
    }
  }

  /**
   * Обработчик команды /renamechat
   */
  async handleRenameChat(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
      const result = this.chatManager.getChats(userId);
      
      if (result.success && result.data.chats.length > 0) {
        // Устанавливаем состояние ожидания выбора чата для переименования
        this.userStates.set(userId, { 
          state: 'waiting_for_rename_chat_selection',
          data: { chats: result.data.chats }
        });
        
        let message = `✏️ Выберите чат для переименования:\n\n`;
        
        result.data.chats.forEach((chat, index) => {
          message += `${index + 1}. \`${chat.name}\`\n`;
        });
        
        message += `\nОтправьте номер чата для переименования.`;
        
        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } else {
        const message = `💬 У вас пока нет чатов.

Используйте /newchat для создания первого чата.`;
        
        await this.bot.sendMessage(chatId, message);
      }
    } catch (error) {
      console.error('Ошибка при переименовании чата:', error);
      
      const errorMessage = `❌ Произошла ошибка при переименовании чата.

Попробуйте позже или обратитесь к администратору.`;
      
      await this.bot.sendMessage(chatId, errorMessage);
    }
  }

  /**
   * Обработчик команды /deletechat
   */
  async handleDeleteChat(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
      const result = this.chatManager.getChats(userId);
      
      if (result.success && result.data.chats.length > 0) {
        // Устанавливаем состояние ожидания выбора чата для удаления
        this.userStates.set(userId, { 
          state: 'waiting_for_delete_chat_selection',
          data: { chats: result.data.chats }
        });
        
        let message = `🗑️ Выберите чат для удаления:\n\n`;
        
        result.data.chats.forEach((chat, index) => {
          const isActive = chat.id === result.data.activeChatId ? ' (активный)' : '';
          message += `${index + 1}. \`${chat.name}\`${isActive}\n`;
        });
        
        message += `\n⚠️ Внимание: удаление чата необратимо!
Отправьте номер чата для удаления.`;
        
        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } else {
        const message = `💬 У вас пока нет чатов.

Используйте /newchat для создания первого чата.`;
        
        await this.bot.sendMessage(chatId, message);
      }
    } catch (error) {
      console.error('Ошибка при удалении чата:', error);
      
      const errorMessage = `❌ Произошла ошибка при удалении чата.

Попробуйте позже или обратитесь к администратору.`;
      
      await this.bot.sendMessage(chatId, errorMessage);
    }
  }

  /**
   * Обработчик команды /clear
   */
  async handleClear(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
      const activeChat = this.chatManager.getActiveChat(userId);
      
      if (activeChat.success) {
        const result = await this.qwenApi.clearChat(activeChat.data.id);
        
        if (result.success) {
          const successMessage = `✅ История чата "\`${activeChat.data.name}\`" очищена!

Теперь каждый новый запрос будет обрабатываться без учета предыдущих сообщений.`;
          
          await this.bot.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });
        } else {
          const errorMessage = `❌ Ошибка при очистке истории:

${result.error}

Попробуйте позже или обратитесь к администратору.`;
          
          await this.bot.sendMessage(chatId, errorMessage);
        }
      } else {
        const errorMessage = `❌ Нет активного чата.

Используйте /selectchat для выбора чата.`;
        
        await this.bot.sendMessage(chatId, errorMessage);
      }
    } catch (error) {
      console.error('Ошибка при очистке чата:', error);
      
      const errorMessage = `❌ Произошла ошибка при очистке истории.

Попробуйте позже или обратитесь к администратору.`;
      
      await this.bot.sendMessage(chatId, errorMessage);
    }
  }

  /**
   * Обработчик текстовых сообщений
   */
  async handleMessage(msg) {
    try {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const text = msg.text;

      // Игнорируем команды
      if (text.startsWith('/')) {
        return;
      }

      // Проверяем состояние пользователя
      const userState = this.userStates.get(userId);
      
      if (userState) {
        await this.handleUserState(chatId, userId, text, userState);
      } else {
        // Если пользователь просто отправил текст без команды /generate
        await this.processTextForComments(chatId, text, userId);
      }
    } catch (error) {
      console.error('Ошибка в обработчике сообщений:', error);
      
      // Отправляем пользователю сообщение об ошибке
      try {
        await this.bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при обработке сообщения. Попробуйте еще раз.');
      } catch (sendError) {
        console.error('Не удалось отправить сообщение об ошибке:', sendError);
      }
    }
  }

  /**
   * Обработчик callback-запросов (кнопки)
   */
  async handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;
    
    // Отвечаем на callback чтобы убрать "часики" у кнопки
    await this.bot.answerCallbackQuery(callbackQuery.id);
    
    if (data.startsWith('personality_')) {
      await this.handlePersonalitySelection(callbackQuery);
    } else if (data.startsWith('select_comment_')) {
      await this.handleCommentSelection(callbackQuery);
    } else if (data.startsWith('rate_')) {
      await this.handleCommentRating(callbackQuery);
    } else if (data.startsWith('improve_')) {
      await this.handleCommentImprovement(callbackQuery);
    }
  }

  /**
   * Обработка выбора личности
   */
  async handlePersonalitySelection(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;
    
    // Извлекаем имя личности из callback_data (убираем timestamp)
    const personality = data.split('_')[1]; // Берем вторую часть после разделения по _
    const personalityConfig = config.personalities[personality];
    
    if (personalityConfig) {
      // Сохраняем выбранную личность в состоянии пользователя
      this.userStates.set(userId, { 
        state: 'waiting_for_text',
        personality: personality,
        personalityConfig: personalityConfig
      });
      
      const message = `✅ Выбрана личность: *${personalityConfig.name}*

${personalityConfig.description}
*Стиль:* ${personalityConfig.style}

Теперь отправьте текст поста для генерации комментариев.`;
      
      try {
        // Пытаемся отредактировать сообщение
        await this.bot.editMessageText(message, {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          parse_mode: 'Markdown'
        });
      } catch (error) {
        // Если не удалось отредактировать (например, содержимое не изменилось),
        // отправляем новое сообщение
        if (error.code === 'ETELEGRAM' && error.response?.body?.description?.includes('message is not modified')) {
          await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } else {
          // Для других ошибок логируем и отправляем новое сообщение
          console.error('Ошибка при редактировании сообщения:', error.message);
          await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        }
      }
    }
  }

  /**
   * Обработка выбора комментария для оценки
   */
  async handleCommentSelection(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;
    
    // Извлекаем номер комментария
    const commentIndex = parseInt(data.split('_')[2]);
    const timestamp = data.split('_')[3];
    
    const userState = this.userStates.get(userId);
    if (!userState || !userState.context) {
      await this.bot.sendMessage(chatId, '❌ Контекст комментариев не найден. Сгенерируйте комментарии заново.');
      return;
    }
    
    // Получаем выбранный комментарий
    const comments = userState.context.generatedComments.split('\n\n');
    const selectedComment = comments[commentIndex];
    
    if (!selectedComment) {
      await this.bot.sendMessage(chatId, '❌ Комментарий не найден.');
      return;
    }
    
    // Сохраняем выбранный комментарий в состоянии
    this.userStates.set(userId, {
      ...userState,
      selectedCommentIndex: commentIndex,
      selectedComment: selectedComment
    });
    
    // Создаем клавиатуру для оценки
    const keyboard = this.createRatingKeyboard(userState.commentId, timestamp);
    
    const message = `💬 *Выбран комментарий для оценки:*

${selectedComment}

⭐ Оцените качество комментария от 1 до 5 звезд, или нажмите "Докрутить" для доработки.`;
    
    try {
      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (error) {
      console.error('Ошибка при редактировании сообщения:', error.message);
      await this.bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    }
  }

  /**
   * Обработка оценки комментария
   */
  async handleCommentRating(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;
    
    // Извлекаем оценку и ID комментария
    const rating = parseInt(data.split('_')[1]);
    const commentId = data.split('_')[2];
    
    const userState = this.userStates.get(userId);
    if (!userState || !userState.context) {
      await this.bot.sendMessage(chatId, '❌ Контекст комментариев не найден.');
      return;
    }
    
    // Сохраняем оценку
    const result = await this.learningManager.saveCommentRating(
      userId, 
      commentId, 
      rating, 
      userState.context
    );
    
    if (result.success) {
      const message = `✅ Спасибо за оценку! Ваша оценка: ${'⭐'.repeat(rating)}

Ваша обратная связь поможет улучшить качество генерации комментариев.`;
      
      try {
        await this.bot.editMessageText(message, {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          parse_mode: 'Markdown'
        });
      } catch (error) {
        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      }
      
      // Очищаем состояние пользователя
      this.userStates.delete(userId);
    } else {
      await this.bot.sendMessage(chatId, '❌ Ошибка при сохранении оценки. Попробуйте позже.');
    }
  }

  /**
   * Обработка запроса на доработку комментария
   */
  async handleCommentImprovement(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    
    const userState = this.userStates.get(userId);
    console.log('DEBUG: handleCommentImprovement - userId:', userId);
    console.log('DEBUG: handleCommentImprovement - userState:', userState);
    
    if (!userState || !userState.context) {
      console.log('DEBUG: Контекст не найден для userId:', userId);
      console.log('DEBUG: Все состояния:', Array.from(this.userStates.entries()));
      await this.bot.sendMessage(chatId, '❌ Контекст комментариев не найден. Сгенерируйте комментарии заново.');
      return;
    }
    
    // Устанавливаем состояние ожидания обратной связи
    this.userStates.set(userId, {
      ...userState,
      state: 'waiting_for_improvement_feedback'
    });
    
    const message = `🔧 *Как можем улучшить ответ?*

Опишите, что нужно изменить. Например:
• "Сделай заход с позиции жителя который недавно переехал"
• "Сделай более коротким"
• "Добавь больше фактов"
• "Измени тон на более официальный"
• "Убери лишние детали"

Отправьте ваши пожелания:`;
    
    try {
      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
  }

  /**
   * Обработка команды /learning
   */
  async handleLearning(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
      // Получаем статистику обратной связи пользователя
      const stats = this.learningManager.getUserFeedbackStats(userId);
      
      // Получаем общую статистику
      const trainingData = this.learningManager.getTrainingData();
      
      const message = `📊 *Статистика обучения*

👤 *Ваша статистика:*
• Всего оценок: ${stats.totalFeedback}
• Средняя оценка: ${stats.averageRating}⭐
• Обратная связь для доработки: ${stats.improvementFeedback}

📈 *Детализация оценок:*
• ⭐ (1): ${stats.ratings[1]}
• ⭐⭐ (2): ${stats.ratings[2]}
• ⭐⭐⭐ (3): ${stats.ratings[3]}
• ⭐⭐⭐⭐ (4): ${stats.ratings[4]}
• ⭐⭐⭐⭐⭐ (5): ${stats.ratings[5]}

🌐 *Общая статистика системы:*
• Всего обратной связи: ${trainingData.totalFeedback}
• Оценок комментариев: ${trainingData.ratings.length}
• Обратной связи для доработки: ${trainingData.improvements.length}

💡 *Как это помогает:*
Ваша обратная связь используется для улучшения качества генерации комментариев. Чем больше оценок, тем лучше становятся результаты!`;
      
      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Ошибка при получении статистики обучения:', error);
      await this.bot.sendMessage(chatId, '❌ Ошибка при получении статистики обучения.');
    }
  }

  /**
   * Обработка обратной связи для доработки комментария
   */
  async handleImprovementFeedback(chatId, userId, text, userState) {
    try {
      // Отправляем сообщение о начале доработки
      const processingMessage = await this.bot.sendMessage(chatId, '🔧 Дорабатываю комментарии... Это может занять до минуты.');
      
      // Получаем все комментарии для доработки
      const comments = userState.context.generatedComments.split('\n\n');
      
      // Дорабатываем каждый комментарий
      const improvedComments = [];
      
      for (let i = 0; i < comments.length; i++) {
        const originalComment = comments[i];
        
        // Дорабатываем комментарий
        const result = await this.qwenApi.improveComment(
          originalComment,
          text,
          userState.context.originalText,
          userState.context.personality,
          userState.context.personalityConfig,
          userState.context.chatId,
          userState.context.model
        );
        
        if (result.success) {
          improvedComments.push(result.data);
        } else {
          // Если не удалось доработать, оставляем оригинальный
          improvedComments.push(originalComment);
        }
      }
      
      // Сохраняем обратную связь для обучения
      await this.learningManager.saveImprovementFeedback(
        userId,
        userState.commentId,
        text,
        userState.context
      );
      
      // Форматируем ответ
      const improvedText = improvedComments.join('\n\n');
      const response = `🔧 *Доработанные комментарии*

*Ваши пожелания:*
${text}

*Доработанные комментарии:*

${improvedText}

---
🤖 Доработано с помощью Qwen AI`;
      
      // Отправляем результат
      try {
        await this.bot.editMessageText(response, {
          chat_id: chatId,
          message_id: processingMessage.message_id,
          parse_mode: 'Markdown'
        });
      } catch (editError) {
        console.error('Ошибка при редактировании результата:', editError.message);
        await this.bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
      }
      
      // Очищаем состояние пользователя
      this.userStates.delete(userId);
      
    } catch (error) {
      console.error('Ошибка при обработке обратной связи:', error);
      await this.bot.sendMessage(chatId, '❌ Произошла ошибка при доработке комментариев. Попробуйте позже.');
      this.userStates.delete(userId);
    }
  }

  /**
   * Обработка состояний пользователя
   */
  async handleUserState(chatId, userId, text, userState) {
    switch (userState.state) {
      case 'waiting_for_text':
        await this.processTextForComments(chatId, text, userId);
        // НЕ очищаем состояние здесь, так как нужно сохранить контекст для кнопок
        break;
        
      case 'waiting_for_model':
        await this.handleModelSelection(chatId, userId, text);
        break;
        
      case 'waiting_for_chat_name':
        await this.handleChatNameInput(chatId, userId, text);
        break;
        
      case 'waiting_for_chat_selection':
        await this.handleChatSelection(chatId, userId, text, userState.data.chats);
        break;
        
      case 'waiting_for_rename_chat_selection':
        await this.handleRenameChatSelection(chatId, userId, text, userState.data.chats);
        break;
        
      case 'waiting_for_delete_chat_selection':
        await this.handleDeleteChatSelection(chatId, userId, text, userState.data.chats);
        break;
        
      case 'waiting_for_new_chat_name':
        await this.handleNewChatNameInput(chatId, userId, text);
        break;
        
      case 'waiting_for_improvement_feedback':
        await this.handleImprovementFeedback(chatId, userId, text, userState);
        break;
        
      default:
        this.userStates.delete(userId);
        await this.bot.sendMessage(chatId, '❌ Неизвестное состояние. Попробуйте снова.');
    }
  }

  /**
   * Обработка выбора модели
   */
  async handleModelSelection(chatId, userId, text) {
    try {
      const result = await this.chatManager.setUserModel(userId, text);
      
      if (result.success) {
        const successMessage = `✅ Модель успешно изменена на \`${text}\``;
        await this.bot.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });
      } else {
        const errorMessage = `❌ Ошибка при изменении модели:

${result.error}`;
        await this.bot.sendMessage(chatId, errorMessage);
      }
    } catch (error) {
      console.error('Ошибка при выборе модели:', error);
      await this.bot.sendMessage(chatId, '❌ Произошла ошибка при выборе модели.');
    }
    
    this.userStates.delete(userId);
  }

  /**
   * Обработка ввода названия чата
   */
  async handleChatNameInput(chatId, userId, text) {
    try {
      const result = await this.chatManager.createChat(userId, text);
      
      if (result.success) {
        const successMessage = `✅ Чат "\`${text}\`" успешно создан!`;
        await this.bot.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });
      } else {
        const errorMessage = `❌ Ошибка при создании чата:

${result.error}`;
        await this.bot.sendMessage(chatId, errorMessage);
      }
    } catch (error) {
      console.error('Ошибка при создании чата:', error);
      await this.bot.sendMessage(chatId, '❌ Произошла ошибка при создании чата.');
    }
    
    this.userStates.delete(userId);
  }

  /**
   * Обработка выбора чата
   */
  async handleChatSelection(chatId, userId, text, chats) {
    try {
      const chatIndex = parseInt(text) - 1;
      
      if (chatIndex >= 0 && chatIndex < chats.length) {
        const selectedChat = chats[chatIndex];
        const result = await this.chatManager.selectChat(userId, selectedChat.id);
        
        if (result.success) {
          const successMessage = `✅ Выбран чат "\`${selectedChat.name}\`"`;
          await this.bot.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });
        } else {
          const errorMessage = `❌ Ошибка при выборе чата:

${result.error}`;
          await this.bot.sendMessage(chatId, errorMessage);
        }
      } else {
        await this.bot.sendMessage(chatId, '❌ Неверный номер чата. Попробуйте снова.');
        return; // Не удаляем состояние
      }
    } catch (error) {
      console.error('Ошибка при выборе чата:', error);
      await this.bot.sendMessage(chatId, '❌ Произошла ошибка при выборе чата.');
    }
    
    this.userStates.delete(userId);
  }

  /**
   * Обработка выбора чата для переименования
   */
  async handleRenameChatSelection(chatId, userId, text, chats) {
    try {
      const chatIndex = parseInt(text) - 1;
      
      if (chatIndex >= 0 && chatIndex < chats.length) {
        const selectedChat = chats[chatIndex];
        
        // Устанавливаем состояние ожидания нового названия
        this.userStates.set(userId, { 
          state: 'waiting_for_new_chat_name',
          data: { chatId: selectedChat.id, oldName: selectedChat.name }
        });
        
        const message = `✏️ Введите новое название для чата "\`${selectedChat.name}\`":

Максимальная длина: ${config.chat.maxChatNameLength} символов`;
        
        await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        return; // Не удаляем состояние
      } else {
        await this.bot.sendMessage(chatId, '❌ Неверный номер чата. Попробуйте снова.');
        return; // Не удаляем состояние
      }
    } catch (error) {
      console.error('Ошибка при выборе чата для переименования:', error);
      await this.bot.sendMessage(chatId, '❌ Произошла ошибка при выборе чата.');
    }
    
    this.userStates.delete(userId);
  }

  /**
   * Обработка ввода нового названия чата
   */
  async handleNewChatNameInput(chatId, userId, text) {
    try {
      const userState = this.userStates.get(userId);
      const result = await this.chatManager.renameChat(userId, userState.data.chatId, text);
      
      if (result.success) {
        const successMessage = `✅ Чат переименован с "\`${userState.data.oldName}\`" на "\`${text}\`"`;
        await this.bot.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });
      } else {
        const errorMessage = `❌ Ошибка при переименовании чата:

${result.error}`;
        await this.bot.sendMessage(chatId, errorMessage);
      }
    } catch (error) {
      console.error('Ошибка при переименовании чата:', error);
      await this.bot.sendMessage(chatId, '❌ Произошла ошибка при переименовании чата.');
    }
    
    this.userStates.delete(userId);
  }

  /**
   * Обработка выбора чата для удаления
   */
  async handleDeleteChatSelection(chatId, userId, text, chats) {
    try {
      const chatIndex = parseInt(text) - 1;
      
      if (chatIndex >= 0 && chatIndex < chats.length) {
        const selectedChat = chats[chatIndex];
        const result = await this.chatManager.deleteChat(userId, selectedChat.id);
        
        if (result.success) {
          const successMessage = `✅ Чат "\`${selectedChat.name}\`" успешно удален!`;
          await this.bot.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });
        } else {
          const errorMessage = `❌ Ошибка при удалении чата:

${result.error}`;
          await this.bot.sendMessage(chatId, errorMessage);
        }
      } else {
        await this.bot.sendMessage(chatId, '❌ Неверный номер чата. Попробуйте снова.');
        return; // Не удаляем состояние
      }
    } catch (error) {
      console.error('Ошибка при удалении чата:', error);
      await this.bot.sendMessage(chatId, '❌ Произошла ошибка при удалении чата.');
    }
    
    this.userStates.delete(userId);
  }

  /**
   * Обработка текста для генерации комментариев
   */
  async processTextForComments(chatId, text, userId) {
    // Получаем состояние пользователя для определения личности
    const userState = this.userStates.get(userId);
    const selectedPersonality = userState?.personality || null;
    const personalityConfig = userState?.personalityConfig || null;

    // Получаем активный чат и модель пользователя
    const activeChat = this.chatManager.getActiveChat(userId);
    const userModel = this.chatManager.getUserModel(userId);
    
    if (!activeChat.success) {
      const errorMessage = `❌ Нет активного чата.

Используйте /selectchat для выбора чата или /newchat для создания нового.`;
      
      await this.bot.sendMessage(chatId, errorMessage);
      return;
    }

    // Отправляем сообщение о начале генерации
    const processingMessage = await this.bot.sendMessage(chatId, '🤖 Генерирую комментарии... Это может занять до минуты.');

    try {
      // Генерируем комментарии
      const result = await this.qwenApi.generateComments(text, userId, userModel, activeChat.data.id, null, selectedPersonality, personalityConfig);
      
      if (result.success) {
        // Обновляем статистику чата
        await this.chatManager.updateChatStats(userId, activeChat.data.id);
        
        // Форматируем ответ
        const response = this.formatCommentsResponse(text, result.data, personalityConfig?.name);
        
        // Создаем уникальный ID для комментариев
        const commentId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = Date.now();
        
        // Сохраняем контекст для обучения
        const context = {
          originalText: text,
          personality: selectedPersonality,
          personalityConfig: personalityConfig,
          model: userModel,
          chatId: activeChat.data.id,
          generatedComments: result.data,
          timestamp: new Date().toISOString()
        };
        
        // Сохраняем контекст в состоянии пользователя
        const newUserState = {
          ...userState,
          context: context,
          commentId: commentId,
          timestamp: timestamp
        };
        
        this.userStates.set(userId, newUserState);
        console.log('DEBUG: Контекст сохранен для userId:', userId);
        console.log('DEBUG: Состояние после сохранения:', newUserState);
        
        // Создаем клавиатуру для оценки
        const keyboard = this.createCommentSelectionKeyboard(result.data.split('\n\n'), timestamp);
        
        // Отправляем результат с кнопками
        try {
          await this.bot.editMessageText(response, {
            chat_id: chatId,
            message_id: processingMessage.message_id,
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
        } catch (editError) {
          // Если не удалось отредактировать, отправляем новое сообщение
          console.error('Ошибка при редактировании результата:', editError.message);
          await this.bot.sendMessage(chatId, response, { 
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
        }
      } else {
        // Определяем тип ошибки и даем соответствующий совет
        let errorMessage = `❌ Ошибка при генерации комментариев:\n\n${result.error}\n\n`;
        
        if (result.error.includes('500') || result.error.includes('браузер')) {
          errorMessage += '🔄 Проблема с API сервером. Попробуйте через 30 секунд.';
        } else if (result.error.includes('ECONNREFUSED') || result.error.includes('сеть')) {
          errorMessage += '🔌 API сервер недоступен. Проверьте, что FreeQwenApi запущен.';
        } else if (result.error.includes('токен') || result.error.includes('авторизация')) {
          errorMessage += '🔑 Проблема с авторизацией. Проверьте статус API командой /status';
        } else {
          errorMessage += 'Попробуйте позже или проверьте статус API командой /status';
        }
        
        try {
          await this.bot.editMessageText(errorMessage, {
            chat_id: chatId,
            message_id: processingMessage.message_id
          });
        } catch (editError) {
          // Если не удалось отредактировать, отправляем новое сообщение
          console.error('Ошибка при редактировании сообщения об ошибке:', editError.message);
          await this.bot.sendMessage(chatId, errorMessage);
        }
      }
    } catch (error) {
      console.error('Ошибка при обработке запроса:', error);
      
      const errorMessage = `❌ Произошла ошибка при обработке запроса.

Попробуйте позже или обратитесь к администратору.`;
      
      try {
        await this.bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: processingMessage.message_id
        });
      } catch (editError) {
        // Если не удалось отредактировать, отправляем новое сообщение
        console.error('Ошибка при редактировании сообщения об ошибке:', editError.message);
        await this.bot.sendMessage(chatId, errorMessage);
      }
    }
  }

  /**
   * Форматирование ответа с комментариями
   */
  formatCommentsResponse(originalText, aiResponse, personalityName = null) {
    // Обрезаем оригинальный текст если он слишком длинный
    const truncatedText = originalText.length > 300 
      ? originalText.substring(0, 300) + '...' 
      : originalText;
    
    const personalityInfo = personalityName ? `\n👤 *Личность:* ${personalityName}` : '';
    
    return `📝 *Оригинальный текст:*
"${truncatedText}"${personalityInfo}

💬 *Варианты комментариев:*

${aiResponse}

---
🤖 Сгенерировано с помощью Qwen AI`;
  }

  /**
   * Создание клавиатуры для оценки комментариев
   */
  createRatingKeyboard(commentId, timestamp) {
    return {
      inline_keyboard: [
        [
          { text: '⭐ Оценить 1', callback_data: `rate_1_${commentId}_${timestamp}` },
          { text: '⭐⭐ Оценить 2', callback_data: `rate_2_${commentId}_${timestamp}` },
          { text: '⭐⭐⭐ Оценить 3', callback_data: `rate_3_${commentId}_${timestamp}` }
        ],
        [
          { text: '⭐⭐⭐⭐ Оценить 4', callback_data: `rate_4_${commentId}_${timestamp}` },
          { text: '⭐⭐⭐⭐⭐ Оценить 5', callback_data: `rate_5_${commentId}_${timestamp}` }
        ],
        [
          { text: '🔧 Докрутить', callback_data: `improve_${commentId}_${timestamp}` }
        ]
      ]
    };
  }

  /**
   * Создание клавиатуры для выбора комментария для оценки
   */
  createCommentSelectionKeyboard(comments, timestamp) {
    const keyboard = {
      inline_keyboard: []
    };

    // Добавляем кнопки для каждого комментария
    for (let i = 0; i < Math.min(comments.length, 4); i++) {
      keyboard.inline_keyboard.push([
        { text: `💬 Оценить комментарий ${i + 1}`, callback_data: `select_comment_${i}_${timestamp}` }
      ]);
    }

    // Добавляем кнопку "Докрутить"
    keyboard.inline_keyboard.push([
      { text: '🔧 Докрутить', callback_data: `improve_${timestamp}` }
    ]);

    return keyboard;
  }

  /**
   * Запуск бота
   * 
   * @method start
   * @description Запускает бота и настраивает обработчики сигналов завершения
   * Выводит информацию о запуске и настраивает graceful shutdown
   * 
   * @example
   * const bot = new TelegramBotHandler();
   * bot.start();
   */
  start() {
    console.log('🤖 Telegram бот запущен');
    console.log(`🔗 API URL: ${config.qwen.apiUrl}`);
    console.log(`🤖 Модель по умолчанию: ${config.telegram.defaultModel}`);
    
    // Добавляем обработчики для graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Получен сигнал SIGINT, останавливаю бота...');
      this.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\n🛑 Получен сигнал SIGTERM, останавливаю бота...');
      this.stop();
      process.exit(0);
    });
  }

  /**
   * Перезапуск polling
   */
  async restartPolling() {
    try {
      console.log('🔄 Перезапуск polling...');
      await this.bot.stopPolling();
      
      // Небольшая пауза перед перезапуском
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await this.bot.startPolling();
      console.log('✅ Polling успешно перезапущен');
    } catch (error) {
      console.error('❌ Ошибка при перезапуске polling:', error);
      
      // Пробуем еще раз через 30 секунд
      setTimeout(() => {
        this.restartPolling();
      }, 30000);
    }
  }

  /**
   * Остановка бота
   */
  stop() {
    this.bot.stopPolling();
    console.log('🤖 Telegram бот остановлен');
  }
}

module.exports = TelegramBotHandler;
