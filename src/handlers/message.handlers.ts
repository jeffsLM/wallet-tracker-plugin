import { MessagesUpsert } from '../types';
import { createLogger } from '../utils/logger.utils';
import { imageMessageHandler } from './imageMessage.handler';
import { textMessageHandler } from './textMessage.handler';
import dotenv from 'dotenv';

dotenv.config();

const logger = createLogger('MessageHandler');

const TARGET_GROUP_ID = process.env.TARGET_GROUP_ID;

const processedMessages = new Map<string, number>();
const CACHE_DURATION = 5 * 60 * 1000;
const CLEANUP_INTERVAL = 60 * 1000;

// Limpa cache de mensagens antigas
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of processedMessages.entries()) {
    if (now - timestamp > CACHE_DURATION) {
      processedMessages.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

function isAllowedGroup(remoteJid: string | null | undefined): boolean {
  return remoteJid === TARGET_GROUP_ID;
}

function isDuplicateMessage(messageId: string): boolean {
  if (processedMessages.has(messageId)) {
    logger.info(`Mensagem duplicada ignorada: ${messageId}`);
    return true;
  }
  processedMessages.set(messageId, Date.now());
  return false;
}

export async function handleMessagesUpsert({ messages, sock }: MessagesUpsert): Promise<void> {
  for (const msg of messages) {
    const remoteJid = msg.key.remoteJid;

    logger.info(`📨 Mensagem recebida de: ${remoteJid}`);
    logger.info(`🎯 TARGET_GROUP_ID: ${TARGET_GROUP_ID}`);

    if (!msg.message) {
      logger.info('⚠️ Mensagem sem conteúdo, ignorando');
      continue;
    }

    const messageId = `${remoteJid}_${msg.key.id}`;
    if (isDuplicateMessage(messageId)) {
      continue;
    }

    // === CANAL DE TRANSAÇÕES (TARGET_GROUP_ID) ===
    if (isAllowedGroup(remoteJid)) {
      logger.info(`💰 Mensagem do canal de TRANSAÇÕES`);

      // Imagens (transações)
      if (msg.message.imageMessage) {
        logger.info(`🖼️ Processando imagem...`);
        await imageMessageHandler.handle({ msg, sock });
        continue;
      }

      // Texto (comandos de transações)
      if (msg.message.conversation || msg.message.extendedTextMessage) {
        logger.info(`💬 Processando comando de transação...`);
        await textMessageHandler.handle({ msg, sock });
        continue;
      }

      logger.info(`⚠️ Tipo de mensagem não suportado no canal de transações`);
      continue;
    }

    // === GRUPO NÃO AUTORIZADO ===
    logger.info(`🚫 Grupo não autorizado - ignorando: ${remoteJid}`);
  }
}
