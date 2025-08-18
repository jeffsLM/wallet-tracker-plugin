import P from 'pino';
import * as baileys from '@whiskeysockets/baileys';
import type { WhatsappSocket } from '../types';
import {
  handleConnectionUpdate,
  handleMessagesUpsert,
} from '../handlers/whatsapp.handlers';
import { WHATSAPP_CONFIG } from '../config/whatsapp.config';
import { handleMessagesUpsertFiles } from '../handlers/message.handlers';

const makeWASocket = baileys.makeWASocket;
const { useMultiFileAuthState } = baileys;

export async function connectToWhatsApp(): Promise<WhatsappSocket> {
  const { state, saveCreds } = await useMultiFileAuthState(WHATSAPP_CONFIG.authStatePath);

  const sock: WhatsappSocket = makeWASocket({
    logger: P({ level: WHATSAPP_CONFIG.loggerLevel }),
    auth: state,
    printQRInTerminal: false,
    browser: WHATSAPP_CONFIG.browser,
    syncFullHistory: true,
    markOnlineOnConnect: false,
    emitOwnEvents: false,
  });

  sock.ev.on('connection.update', (update) => {
    handleConnectionUpdate(
      update,
      () => connectToWhatsApp(),
      async () => {
        console.log('Número conectado:', sock.user?.id);
      }
    );
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('messages.upsert', async (messages) => {
    await handleMessagesUpsert({ sock, ...messages });
    await handleMessagesUpsertFiles({ sock, ...messages });

  });

  return sock;
}
