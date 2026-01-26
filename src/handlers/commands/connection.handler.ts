import { WhatsappSocket } from '../../types';
import { proto } from '@whiskeysockets/baileys';
import { whatsappMessage } from '../../services/whatappMessage.service';
import { getConnectionHealth, getConnectionStats } from '../../services/whatsapp.service';
import { createLogger } from '../../utils/logger.utils';

export const connectionHandler = {
  async handle(senderJid: string, sock: WhatsappSocket, msg: proto.IWebMessageInfo): Promise<void> {
    try {
      createLogger('info').info(`📊 Comando de status de conexão recebido de ${senderJid}`);
      
      // Obter informações de saúde da conexão
      const health = getConnectionHealth();
      const stats = getConnectionStats();
      
      // Criar mensagem formatada com o status
      let statusEmoji = '✅';
      let statusText = 'Conectado';
      
      if (health.status === 'reconnecting') {
        statusEmoji = '🔄';
        statusText = 'Reconectando';
      } else if (health.status === 'disconnected') {
        statusEmoji = '❌';
        statusText = 'Desconectado';
      }
      
      // Formatar tempo de uptime
      const uptimeHours = Math.floor(health.uptime / 3600);
      const uptimeMinutes = Math.floor((health.uptime % 3600) / 60);
      const uptimeSeconds = health.uptime % 60;
      const uptimeFormatted = `${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`;
      
      // Formatar última conexão
      const lastConnection = health.lastConnection 
        ? new Date(health.lastConnection).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        : 'Nunca';
      
      const message = `${statusEmoji} *STATUS DA CONEXÃO*\n\n` +
        `📡 *Status:* ${statusText}\n` +
        `⏱️ *Uptime:* ${uptimeFormatted}\n` +
        `🕐 *Última Conexão:* ${lastConnection}\n\n` +
        `📊 *Estatísticas:*\n` +
        `   • Total de Reconexões: ${stats.totalReconnects}\n` +
        `   • Erros 503: ${stats.error503Count}\n` +
        `   • Erros 500: ${stats.error500Count}\n` +
        `   • Timeouts: ${stats.errorTimeoutCount}\n` +
        `   • Taxa de Erro: ${health.errorRate}\n\n` +
        `${stats.isConnecting ? '🔄 *Reconexão em andamento...*\n' : ''}` +
        `${stats.currentReconnectAttempts > 0 ? `⚠️ *Tentativas de reconexão:* ${stats.currentReconnectAttempts}\n` : ''}` +
        `\n💡 _Use este comando a qualquer momento para verificar o status_`;
      
      // Verificar se temos o jid para responder
      const remoteJid = msg.key?.remoteJid;
      if (!remoteJid) {
        createLogger('error').error('❌ RemoteJid não encontrado na mensagem');
        return;
      }

      // Enviar mensagem de resposta
      await whatsappMessage.sendText(sock, {
        text: message,
        jid: remoteJid,
      });
      
      createLogger('info').success(`✅ Status de conexão enviado para ${senderJid}`);
    } catch (error) {
      createLogger('error').error('❌ Erro ao processar comando de status de conexão:', error);
      
      // Tentar enviar mensagem de erro
      try {
        const remoteJid = msg.key?.remoteJid;
        if (remoteJid) {
          await whatsappMessage.sendText(sock, {
            text: '❌ Erro ao obter status da conexão. Tente novamente.',
            jid: remoteJid,
          });
        }
      } catch (sendError) {
        createLogger('error').error('❌ Erro ao enviar mensagem de erro:', sendError);
      }
    }
  }
};
