import { connectToWhatsApp } from './services/whatsapp.service';

async function main(): Promise<void> {
  try {
    console.log('🔄 Iniciando conexão com WhatsApp...');
    await connectToWhatsApp();


    process.on('SIGINT', () => {
      console.log('\n👋 Saindo...');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Erro ao conectar:', error);
  }
}

main();
