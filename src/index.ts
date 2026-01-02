import { connectToWhatsApp } from './services/whatsapp.service';
import { createLogger } from './utils/logger.utils';

async function main(): Promise<void> {
  try {
    createLogger('info').info('Iniciando conexão com WhatsApp...');
    await connectToWhatsApp();


    process.on('SIGINT', () => {
      createLogger('info').info('\n👋 Saindo...');
      process.exit(0);
    });
  } catch (error) {
    createLogger('error').error('❌ Erro ao conectar:', error);
  }
}

main();
