import { WhatsappSocket } from '../../types';
import { proto } from '@whiskeysockets/baileys';
import { cardManagementService } from '../../services/cardManagement.service';
import { whatsappMessage } from '../../services/whatappMessage.service';
import { messageFormatter } from '../../utils/message.formatter.utils';

export const confirmationHandler = {
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

      const result = await cardManagementService.confirmCard(pendingCard.id);

      if (result.success) {
        await whatsappMessage.sendText(sock, {
          jid: msg.key.remoteJid || '',
          text: messageFormatter.createConfirmedCardMessage(result.card!),
          ...(msg.message ? { quoted: msg.message } : {})
        });
      } else {
        await whatsappMessage.sendText(sock, {
          jid: msg.key.remoteJid || '',
          text: messageFormatter.createErrorMessage('ERRO AO CONFIRMAR', result.error, 'Tente novamente ou entre em contato com o suporte.'),
          ...(msg.message ? { quoted: msg.message } : {})
        });
      }
    } catch (error) {
      console.error('Erro ao confirmar comprovante:', error);
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: messageFormatter.createErrorMessage('ERRO INTERNO', 'Falha ao confirmar comprovante.', 'Tente novamente em alguns instantes.'),
        ...(msg.message ? { quoted: msg.message } : {})
      });
    }
  }
};
