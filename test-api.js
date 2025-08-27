const QwenApi = require('./bot/core/qwenApi');
const config = require('./bot/utils/config');

async function testApi() {
  console.log('🧪 Тестирование API...\n');
  
  const api = new QwenApi();
  
  // Тест 1: Проверка статуса
  console.log('1️⃣ Проверка статуса API...');
  const status = await api.checkStatus();
  if (status.success) {
    console.log('✅ API доступен');
    console.log('📊 Статус:', status.data);
  } else {
    console.log('❌ API недоступен:', status.error);
    return;
  }
  console.log();
  
  // Тест 2: Получение списка моделей
  console.log('2️⃣ Получение списка моделей...');
  const models = await api.getModels();
  if (models.success) {
    console.log('✅ Модели получены');
    console.log('🤖 Доступные модели:', models.data);
  } else {
    console.log('❌ Ошибка получения моделей:', models.error);
  }
  console.log();
  
  // Тест 3: Генерация комментариев
  console.log('3️⃣ Тест генерации комментариев...');
  const testText = 'Новый iPhone 15 Pro Max вышел! Цена 150 тысяч рублей';
  console.log('📝 Тестовый текст:', testText);
  
  const comments = await api.generateComments(testText);
  if (comments.success) {
    console.log('✅ Комментарии сгенерированы');
    console.log('💬 Результат:');
    console.log(comments.data);
  } else {
    console.log('❌ Ошибка генерации:', comments.error);
  }
  console.log();
  
  console.log('🎉 Тестирование завершено!');
}

// Запуск теста
if (require.main === module) {
  testApi().catch(console.error);
}

module.exports = { testApi };
