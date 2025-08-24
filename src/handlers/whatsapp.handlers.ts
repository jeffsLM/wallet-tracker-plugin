import type {
  ConnectionUpdate,
  WhatsappSocket,
} from '../types';
import { Boom } from '@hapi/boom';
import { DisconnectReason } from '@whiskeysockets/baileys';
import { generateQRCode } from '../utils/whatsapp.utils';
import { whatsappMessage } from '../services/whatappMessage.service';

import dotenv from 'dotenv';
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

  if (connection === 'open') return console.log('✅ Conectado ao WhatsApp!');

  if (connection === 'close') {
    const shouldReconnect =
      lastDisconnect?.error instanceof Boom &&
      lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;

    console.log('Conexão fechada:', lastDisconnect?.error, ', reconectando:', shouldReconnect);
    if (shouldReconnect) reconnectCallback();
  }
}

export const handleMessagesToSend = async (message: string, sock: WhatsappSocket, connectionUpdate: ConnectionUpdate) => {
  if (connectionUpdate.connection !== 'open') return;

  await whatsappMessage.sendText(sock, { text: message, jid: process.env.TARGET_GROUP_ID || '' });
};
