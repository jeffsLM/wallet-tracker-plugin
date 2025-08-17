// whatsappMessage.service.ts
import { WASocket, proto } from '@whiskeysockets/baileys';

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
    console.log(`✅ Mensagem enviada para ${jid}`);
  } catch (err) {
    console.error(`❌ Erro ao enviar mensagem para ${jid}:`, err);
  }
}

export const whatsappMessage = {
  sendText
};
