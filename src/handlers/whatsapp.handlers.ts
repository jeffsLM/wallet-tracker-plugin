import type {
  ConnectionUpdate,
  MessagesUpsert,
  WhatsappSocket,
} from '../types';
import { Boom } from '@hapi/boom';
import { DisconnectReason } from '@whiskeysockets/baileys';
import { generateQRCode } from '../utils/whatsapp.utils';

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
