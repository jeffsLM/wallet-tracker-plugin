import { WhatsappSocket } from '../../types';
import { proto } from '@whiskeysockets/baileys';
import { whatsappMessage } from '../../services/whatappMessage.service';
import { getConnectionStats, getConnectionHealth } from '../../services/whatsapp.service';
import { createLogger } from '../../utils/logger.utils';

export const connectionHandler = {
  async handle(senderJid: string, sock: WhatsappSocket, msg: proto.IWebMessageInfo): Promise<void> {
    try {
      const stats = getConnectionStats();
      const health = getConnectionHealth();

      const statusText = this.formatConnectionStatus(stats, health);

      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: statusText,
        ...(msg.message ? { quoted: msg.message } : {})
      });
    } catch (error) {
      createLogger('error').error('Erro ao consultar estatísticas de conexão:', error);
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: '❌ Erro ao obter estatísticas de conexão.',
        ...(msg.message ? { quoted: msg.message } : {})
      });
    }
  },

  formatConnectionStatus(stats: any, health: any): string {
    const statusEmoji = health.status === 'connected' ? '🟢' :
      health.status === 'reconnecting' ? '🟡' : '🔴';

    const healthEmoji = health.isHealthy ? '✅' : '⚠️';

    let message = `╔═══════════════════════════╗\n`;
    message += `║  ${statusEmoji} *STATUS DA CONEXÃO* ${healthEmoji}  ║\n`;
    message += `╚═══════════════════════════╝\n\n`;

    message += `📊 *Estado Atual*\n`;
    message += `• Status: ${this.translateStatus(health.status)}\n`;
    message += `• Saúde: ${health.isHealthy ? 'Saudável ✅' : 'Instável ⚠️'}\n`;
    message += `• Taxa de Erro: ${health.errorRate}\n\n`;

    if (stats.lastSuccessfulConnection) {
      const lastConn = new Date(stats.lastSuccessfulConnection);
      message += `🕐 *Última Conexão*\n`;
      message += `• ${lastConn.toLocaleString('pt-BR')}\n`;
      message += `• Uptime: ${this.formatUptime(stats.uptime)}\n\n`;
    }

    message += `📈 *Estatísticas de Reconexão*\n`;
    message += `• Total de reconexões: ${stats.totalReconnects}\n`;
    message += `• Tentativas atuais: ${stats.currentReconnectAttempts}\n\n`;

    message += `⚠️ *Erros Registrados*\n`;
    message += `• Erro 503 (Serviço Indisponível): ${stats.error503Count}\n`;
    message += `• Erro 500 (Erro Interno): ${stats.error500Count}\n`;
    message += `• Timeouts: ${stats.errorTimeoutCount}\n\n`;

    if (stats.lastError) {
      const lastError = stats.lastError;
      const errorTime = new Date(lastError.timestamp);
      message += `🔴 *Último Erro*\n`;
      message += `• Status: ${lastError.statusCode || 'N/A'}\n`;
      message += `• Razão: ${lastError.reason}\n`;
      message += `• Quando: ${errorTime.toLocaleString('pt-BR')}\n\n`;
    }

    if (health.status === 'reconnecting') {
      message += `⏳ *Reconectando...*\n`;
      message += `Tentativa ${stats.currentReconnectAttempts} em andamento.\n`;
      message += `Aguarde enquanto restabelecemos a conexão.\n\n`;
    }

    message += `╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌\n`;
    message += `💡 *Dica*: O sistema reconecta automaticamente\n`;
    message += `em caso de falhas temporárias (503, 500, etc).\n`;

    return message;
  },

  translateStatus(status: string): string {
    const translations: Record<string, string> = {
      'connected': 'Conectado 🟢',
      'reconnecting': 'Reconectando 🟡',
      'disconnected': 'Desconectado 🔴',
    };
    return translations[status] || status;
  },

  formatUptime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
  }
};
