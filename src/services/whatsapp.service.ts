import P from 'pino';
import * as baileys from '@whiskeysockets/baileys';
import type { WhatsappSocket } from '../types';
import {
  handleConnectionUpdate,
  handleMessagesToSend,
} from '../handlers/whatsapp.handlers';
import { WHATSAPP_CONFIG } from '../config/whatsapp.config';
import { handleMessagesUpsert } from '../handlers/message.handlers';
import { handleMessagesToSendFromQueue } from './rabbitMQ.service';

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
    handleConnectionUpdate({ update, reconnectCallback: () => connectToWhatsApp() });

    handleMessagesToSendFromQueue({
      connectionUpdate: update,
      callback: async (messageData) => {
        await handleMessagesToSend(messageData, sock, update);
      }
    });
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('messages.upsert', async (messages) => {
    await handleMessagesUpsert({ sock, ...messages });
  });

  return sock;
}
