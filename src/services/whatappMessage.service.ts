import { WASocket, proto } from '@whiskeysockets/baileys';
import { createLogger } from '../utils/logger.utils';

const logger = createLogger('WhatsAppMessage');

interface WhatsAppMessageData {
  jid: string;
  text: string;
  quotedMessage?: proto.IMessage; // mensagem a ser respondida
}

interface ReactionData {
  messageKey: proto.IMessageKey;
  emoji: string;
}

export async function sendText(sock: WASocket, { jid, text, quotedMessage }: WhatsAppMessageData) {
  try {
    await sock.sendMessage(jid, {
      text,
      // se houver mensagem a ser respondida, inclui como quoted
      ...(quotedMessage ? { quoted: quotedMessage } : {})
    });
    logger.info(`✅ Mensagem enviada para ${jid}`);
  } catch (err: any) {
    // Erro de sender key corrompido
    if (err.message?.includes('senderMessageKeys') || err.message?.includes('SenderKeyState')) {
      logger.error(`❌ Erro de SenderKey corrompido para ${jid}. Necessário reconexão ou limpeza de sessão.`);
      logger.error(`💡 Sugestão: Limpe a pasta 'auth' e reconecte o bot.`);
    } else {
      logger.error(`❌ Erro ao enviar mensagem para ${jid}:`, err);
    }
    throw err; // Re-throw para que o handler saiba que falhou
  }
}

export async function sendReaction(sock: WASocket, { messageKey, emoji }: ReactionData) {
  try {
    await sock.sendMessage(messageKey.remoteJid!, {
      react: {
        text: emoji,
        key: messageKey
      }
    });
    logger.info(`✅ Reação ${emoji} enviada para mensagem ${messageKey.id}`);
  } catch (err: any) {
    // Erro de sender key corrompido
    if (err.message?.includes('senderMessageKeys') || err.message?.includes('SenderKeyState')) {
      logger.error(`❌ Erro de SenderKey corrompido. Necessário reconexão ou limpeza de sessão.`);
    } else {
      logger.error(`❌ Erro ao enviar reação:`, err);
    }
    // Não re-throw para reações, são menos críticas
  }
}

export const whatsappMessage = {
  sendText,
  sendReaction
};
