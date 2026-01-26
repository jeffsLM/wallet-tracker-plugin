/**
 * Handler para comando de status no canal de vídeos
 * Verifica se o bot está funcionando e responde com informações básicas
 */

import { WhatsappSocket } from '../../types';
import { proto } from '@whiskeysockets/baileys';
import { whatsappMessage } from '../../services/whatappMessage.service';
import { videoStorage } from '../../services/videoStorage.service';
import { createLogger } from '../../utils/logger.utils';

interface VideoStatusRequest {
  msg: proto.IWebMessageInfo;
  sock: WhatsappSocket;
}

const logger = createLogger('VideoStatusHandler');

export const videoStatusHandler = {
  async handle({ msg, sock }: VideoStatusRequest): Promise<void> {
    try {
      logger.info('📊 Comando de status recebido');

      // Verifica conexão com MongoDB
      let dbStatus = '❌';
      let videoCount = 0;
      try {
        videoCount = await videoStorage.count({ status: 'pending' });
        dbStatus = '✅';
      } catch (error) {
        logger.error('Erro ao verificar MongoDB:', error);
      }

      // Informações do sistema
      const uptime = process.uptime();
      const uptimeMinutes = Math.floor(uptime / 60);
      const uptimeHours = Math.floor(uptimeMinutes / 60);
      const uptimeDisplay = uptimeHours > 0 
        ? `${uptimeHours}h ${uptimeMinutes % 60}m`
        : `${uptimeMinutes}m`;

      const memoryUsage = process.memoryUsage();
      const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

      // Monta mensagem de status
      const statusMessage = `
🤖 *Status do Bot de Vídeos*

✅ Bot Online e Funcionando
⏱️ Tempo ativo: ${uptimeDisplay}
💾 Memória: ${memoryMB} MB
${dbStatus} MongoDB: ${dbStatus === '✅' ? 'Conectado' : 'Desconectado'}

📹 Vídeos pendentes: ${videoCount}

_Envie um link de vídeo para adicionar à fila!_
      `.trim();

      // Envia mensagem de status
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: statusMessage,
      });

      logger.success('✅ Status enviado com sucesso');

    } catch (error) {
      logger.error('❌ Erro ao processar comando de status:', error);
      
      // Envia mensagem de erro
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: '❌ Erro ao obter status do bot.',
      });
    }
  }
};
