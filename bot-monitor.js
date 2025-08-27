const { spawn } = require('child_process');
const path = require('path');

class BotMonitor {
  constructor() {
    this.botProcess = null;
    this.restartCount = 0;
    this.maxRestarts = 10;
    this.restartDelay = 5000; // 5 секунд
  }

  start() {
    console.log('🤖 Запуск монитора бота...');
    this.spawnBot();
  }

  spawnBot() {
    console.log(`🔄 Запуск бота (попытка ${this.restartCount + 1}/${this.maxRestarts})...`);
    
    // Запускаем основной файл бота
    this.botProcess = spawn('node', ['index.js'], {
      stdio: 'inherit',
      cwd: __dirname
    });

    this.botProcess.on('error', (error) => {
      console.error('❌ Ошибка запуска бота:', error);
      this.handleRestart();
    });

    this.botProcess.on('exit', (code, signal) => {
      console.log(`📤 Бот завершился с кодом ${code} и сигналом ${signal}`);
      
      if (code !== 0 && this.restartCount < this.maxRestarts) {
        this.handleRestart();
      } else if (this.restartCount >= this.maxRestarts) {
        console.error('❌ Превышено максимальное количество перезапусков. Остановка монитора.');
        process.exit(1);
      }
    });

    // Обработка сигналов для graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Получен сигнал SIGINT, останавливаю бота и монитор...');
      this.stop();
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Получен сигнал SIGTERM, останавливаю бота и монитор...');
      this.stop();
    });
  }

  handleRestart() {
    this.restartCount++;
    
    if (this.restartCount <= this.maxRestarts) {
      console.log(`⏳ Перезапуск бота через ${this.restartDelay / 1000} секунд...`);
      
      setTimeout(() => {
        this.spawnBot();
      }, this.restartDelay);
    } else {
      console.error('❌ Превышено максимальное количество перезапусков. Остановка монитора.');
      process.exit(1);
    }
  }

  stop() {
    if (this.botProcess) {
      this.botProcess.kill('SIGTERM');
    }
    process.exit(0);
  }
}

// Запускаем монитор
const monitor = new BotMonitor();
monitor.start();
