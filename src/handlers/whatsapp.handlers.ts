import type {
  ConnectionUpdate,
  WhatsappSocket,
} from '../types';
import { Boom } from '@hapi/boom';
import { DisconnectReason } from '@whiskeysockets/baileys';
import { generateQRCode } from '../utils/whatsapp.utils';
import { whatsappMessage } from '../services/whatappMessage.service';

import dotenv from 'dotenv';
import { createLogger } from '../utils/logger.utils';
dotenv.config();

interface IWhatsAppHandlers {

  update: ConnectionUpdate,
  reconnectCallback: () => void,
}

export function handleConnectionUpdate({ update, reconnectCallback }: IWhatsAppHandlers): void {
  if (update.qr) {
    generateQRCode(update.qr);
  }

  const { connection, lastDisconnect } = update;

  if (connection === 'open') {
    createLogger('info').success('✅ Conectado ao WhatsApp!');
    return;
  }

  if (connection === 'close') {
    const shouldReconnect =
      lastDisconnect?.error instanceof Boom &&
      lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;

    createLogger('info').error('Conexão fechada:', lastDisconnect?.error, ', reconectando:', shouldReconnect);
    if (shouldReconnect) reconnectCallback();
  }
}

export const handleMessagesToSend = async (message: string, sock: WhatsappSocket, connectionUpdate: ConnectionUpdate) => {
  if (connectionUpdate.connection !== 'open') return;

  await whatsappMessage.sendText(sock, { text: message, jid: process.env.TARGET_GROUP_ID || '' });
};
