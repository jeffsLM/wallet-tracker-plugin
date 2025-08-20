import { WhatsappSocket } from '../../types';
import { proto } from '@whiskeysockets/baileys';
import { cardManagementService } from '../../services/cardManagement.service';
import { whatsappMessage } from '../../services/whatappMessage.service';
import { commandParser } from '../../utils/commandParser.utils';
import { messageFormatter } from '../../utils/message.formatter.utils';

export const editHandler = {
  async handle(text: string, senderJid: string, sock: WhatsappSocket, msg: proto.IWebMessageInfo): Promise<void> {
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

      const editCommand = commandParser.parseEditCommand(text);
      if (!editCommand) {
        await whatsappMessage.sendText(sock, {
          jid: msg.key.remoteJid || '',
          text: messageFormatter.createEditHelpMessage(),
          ...(msg.message ? { quoted: msg.message } : {})
        });
        return;
      }

      const result = await cardManagementService.editPendingCard(pendingCard.id, editCommand.updates);

      if (!result.success) return await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: messageFormatter.createErrorMessage('ERRO AO EDITAR', result.error, 'Verifique o formato e tente novamente.'),
        ...(msg.message ? { quoted: msg.message } : {})
      });

      return await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: messageFormatter.createEditSuccessMessage(result.card!),
        ...(msg.message ? { quoted: msg.message } : {})
      });

    } catch (error) {
      console.error('Erro ao editar comprovante:', error);
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: messageFormatter.createErrorMessage('ERRO INTERNO', 'Falha ao editar comprovante.', 'Tente novamente em alguns instantes.'),
        ...(msg.message ? { quoted: msg.message } : {})
      });
    }
  }
};
