import { WhatsappSocket } from '../types';
import { proto } from '@whiskeysockets/baileys';
import { confirmationHandler } from './commands/confirmation.handler';
import { editHandler } from './commands/edit.handler';
import { cancelHandler } from './commands/cancel.handler';
import { statusHandler } from './commands/status.handler';


interface TextMessageRequest {
  msg: proto.IWebMessageInfo;
  sock: WhatsappSocket;
}

export const textMessageHandler = {
  async handle({ msg, sock }: TextMessageRequest): Promise<void> {
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const senderJid = msg.key.participant || msg.key.remoteJid || '';
    const lowerText = text.toLowerCase().trim();

    // Route to appropriate command handler
    if (lowerText.startsWith('1')) {
      await confirmationHandler.handle(senderJid, sock, msg);
      return;
    }

    if (lowerText.startsWith('3') || lowerText.startsWith('editar')) {
      await editHandler.handle(text, senderJid, sock, msg);
      return;
    }

    if (lowerText.startsWith('2')) {
      await cancelHandler.handle(senderJid, sock, msg);
      return;
    }

    if (lowerText.startsWith('status') || lowerText.startsWith('meus cartoes')) {
      await statusHandler.handle(senderJid, sock, msg);
      return;
    }
  }
};
