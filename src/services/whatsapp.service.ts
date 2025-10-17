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
  try {
    const { state, saveCreds } = await useMultiFileAuthState(WHATSAPP_CONFIG.authStatePath);

    const sock: WhatsappSocket = makeWASocket({
      logger: P({ level: WHATSAPP_CONFIG.loggerLevel }),
      auth: state,
      version: [2, 3000, 1027934701],
      printQRInTerminal: false,
      connectTimeoutMs: 60000,
      browser: WHATSAPP_CONFIG.browser,
      syncFullHistory: false, // ⚠️ Mude para false
      markOnlineOnConnect: false,
      emitOwnEvents: false,
      // Adicione estas opções:
      getMessage: async (key) => {
        return { conversation: '' };
      },
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;

        // Erro 405 - limpar sessão e reconectar
        if (statusCode === 405) {
          console.log('Erro 405 detectado - limpando sessão...');
          await clearAuthState();
          setTimeout(() => connectToWhatsApp(), 3000);
          return;
        }

        // Outros erros de reconexão
        const shouldReconnect = statusCode !== 401;
        if (shouldReconnect) {
          console.log('Reconectando...');
          setTimeout(() => connectToWhatsApp(), 5000);
        }
      }

      handleConnectionUpdate({
        update,
        reconnectCallback: () => connectToWhatsApp()
      });

      if (connection === 'open') {
        handleMessagesToSendFromQueue({
          connectionUpdate: update,
          callback: async (messageData) => {
            await handleMessagesToSend(messageData, sock, update);
          }
        });
      }
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async (messages) => {
      await handleMessagesUpsert({ sock, ...messages });
    });

    return sock;
  } catch (error) {
    console.error('Erro ao conectar:', error);
    throw error;
  }
}

// Função para limpar o estado de autenticação
async function clearAuthState() {
  const fs = require('fs').promises;
  const path = require('path');

  try {
    const authPath = WHATSAPP_CONFIG.authStatePath;
    const files = await fs.readdir(authPath);

    for (const file of files) {
      await fs.unlink(path.join(authPath, file));
    }

    console.log('Estado de autenticação limpo com sucesso');
  } catch (error) {
    console.error('Erro ao limpar estado:', error);
  }
}
