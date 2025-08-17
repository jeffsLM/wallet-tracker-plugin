import type {
  ConnectionUpdate,
  MessagesUpsert,
  WhatsappSocket,
} from '../types';
import { Boom } from '@hapi/boom';
import { DisconnectReason } from '@whiskeysockets/baileys';
import { generateQRCode, extractTextFromMessage } from '../utils/whatsapp.utils';
import { WHATSAPP_CONFIG } from '../config/whatsapp.config';

export function handleConnectionUpdate(
  update: ConnectionUpdate,
  reconnectCallback: () => void,
  onOpenCallback: (sock: WhatsappSocket) => Promise<void>
): void {
  if (update.qr) {
    generateQRCode(update.qr);
  }

  const { connection, lastDisconnect } = update;

  if (connection === 'close') {
    const shouldReconnect =
      lastDisconnect?.error instanceof Boom &&
      lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;

    console.log('Conexão fechada:', lastDisconnect?.error, ', reconectando:', shouldReconnect);
    if (shouldReconnect) reconnectCallback();
  }

  if (connection === 'open') {
    console.log('✅ Conectado ao WhatsApp!');
  }
}

export async function handleMessagesUpsert(
  { messages, type }: MessagesUpsert
): Promise<void> {
  if (type === 'notify') {
    for (const msg of messages) {
      if (!msg.key.fromMe && msg.message) {
        const text = extractTextFromMessage(msg.message);
        console.log('📩 Nova mensagem de:', msg.key.remoteJid, '\nConteúdo:', text);
      }
    }
  }
}
