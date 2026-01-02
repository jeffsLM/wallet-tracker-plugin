import { WASocket, proto } from '@whiskeysockets/baileys';
import { createLogger } from '../utils/logger.utils';

interface WhatsAppMessageData {
  jid: string;
  text: string;
  quotedMessage?: proto.IMessage; // mensagem a ser respondida
}

export async function sendText(sock: WASocket, { jid, text, quotedMessage }: WhatsAppMessageData) {
  try {
    await sock.sendMessage(jid, {
      text,
      // se houver mensagem a ser respondida, inclui como quoted
      ...(quotedMessage ? { quoted: quotedMessage } : {})
    });
    createLogger('info').info(`✅ Mensagem enviada para ${jid}`);
  } catch (err) {
    createLogger('error').error(`❌ Erro ao enviar mensagem para ${jid}:`, err);
  }
}

export const whatsappMessage = {
  sendText
};
