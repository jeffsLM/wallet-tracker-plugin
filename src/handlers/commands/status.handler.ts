import { WhatsappSocket } from '../../types';
import { proto } from '@whiskeysockets/baileys';
import { cardManagementService } from '../../services/cardManagement.service';
import { whatsappMessage } from '../../services/whatappMessage.service';
import { messageFormatter } from '../../utils/message.formatter.utils';

export const statusHandler = {
  async handle(senderJid: string, sock: WhatsappSocket, msg: proto.IWebMessageInfo): Promise<void> {
    try {
      const pendingCard = cardManagementService.getPendingCardByUser(senderJid);
      const stats = cardManagementService.getStats();

      const statusText = messageFormatter.createStatusMessage(stats, pendingCard);

      await whatsappMessage.sendText(sock, {
        jid: msg?.key?.remoteJid || '',
        text: statusText,
        ...(msg.message ? { quoted: msg.message } : {})
      });
    } catch (error) {
      console.error('Erro ao consultar status:', error);
    }
  }
};
