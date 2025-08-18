import { WhatsappSocket } from '../../types';
import { proto } from '@whiskeysockets/baileys';
import { cardManagementService } from '../../services/cardManagement.service';
import { whatsappMessage } from '../../services/whatappMessage.service';
import { messageFormatter } from '../../utils/message.formatter.utils';

export const cancelHandler = {
  async handle(senderJid: string, sock: WhatsappSocket, msg: proto.IWebMessageInfo): Promise<void> {
    try {
      const pendingCard = cardManagementService.getPendingCardByUser(senderJid);

      if (!pendingCard) {
        await whatsappMessage.sendText(sock, {
          jid: msg.key.remoteJid || '',
          text: messageFormatter.createNoPendingCardMessage(),
          ...(msg.message ? { quoted: msg.message } : {})
        });
        return;
      }

      const result = await cardManagementService.cancelCard(pendingCard.id);

      if (result.success) {
        await whatsappMessage.sendText(sock, {
          jid: msg.key.remoteJid || '',
          text: messageFormatter.createCancelledCardMessage(result.card!.id),
          ...(msg.message ? { quoted: msg.message } : {})
        });
      } else {
        await whatsappMessage.sendText(sock, {
          jid: msg.key.remoteJid || '',
          text: messageFormatter.createErrorMessage('ERRO AO CANCELAR', result.error, 'Tente novamente ou entre em contato com o suporte.'),
          ...(msg.message ? { quoted: msg.message } : {})
        });
      }
    } catch (error) {
      console.error('Erro ao cancelar comprovante:', error);
    }
  }
};
