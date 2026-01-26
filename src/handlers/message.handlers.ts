import { MessagesUpsert } from '../types';
import { createLogger } from '../utils/logger.utils';
import { imageMessageHandler } from './imageMessage.handler';
import { textMessageHandler } from './textMessage.handler';
import { videoMessageHandler } from './videoMessage.handler';
import { videoStatusHandler } from './commands/videoStatus.handler';
import { urlValidator } from '../utils/urlValidator.utils';
import dotenv from 'dotenv';

dotenv.config();

const logger = createLogger('MessageHandler');

const TARGET_GROUP_ID = process.env.TARGET_GROUP_ID;
const TARGET_GROUP_ID_TRAVEL = process.env.TARGET_GROUP_ID_TRAVEL;

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

function isVideoAllowedGroup(remoteJid: string | null | undefined): boolean {
  return remoteJid === TARGET_GROUP_ID_TRAVEL;
}

function isDuplicateMessage(messageId: string): boolean {
  if (processedMessages.has(messageId)) {
    logger.info(`Mensagem duplicada ignorada: ${messageId}`);
    return true;
  }
  processedMessages.set(messageId, Date.now());
  return false;
}

function getMessageText(msg: any): string {
  return msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
}

async function handleVideoMessage(msg: any, sock: any): Promise<boolean> {
  const messageText = getMessageText(msg);

  if (!messageText) {
    return false;
  }

  // Verifica se é comando de status
  if (messageText.toLowerCase().trim() === 'status') {
    logger.info(`📊 Comando status detectado`);
    await videoStatusHandler.handle({ msg, sock });
    return true;
  }

  // Verifica se contém link de vídeo
  if (!urlValidator.containsVideoUrl(messageText)) {
    return false;
  }

  logger.info(`🎬 Link de vídeo detectado na mensagem`);
  logger.info(`📍 Grupo atual: ${msg.key.remoteJid}`);
  logger.info(`🧳 Grupo esperado para vídeos: ${TARGET_GROUP_ID_TRAVEL}`);

  if (isVideoAllowedGroup(msg.key.remoteJid)) {
    logger.info(`✅ MATCH! Processando vídeo...`);
    await videoMessageHandler.handle({ msg, sock });
  } else {
    logger.info(`❌ GRUPO INCORRETO! Link de vídeo ignorado`);
  }

  return true;
}

export async function handleMessagesUpsert({ messages, sock }: MessagesUpsert): Promise<void> {
  for (const msg of messages) {
    const remoteJid = msg.key.remoteJid;

    logger.info(`📨 Mensagem recebida de: ${remoteJid}`);
    logger.info(`🎯 TARGET_GROUP_ID: ${TARGET_GROUP_ID}`);
    logger.info(`🧳 TARGET_GROUP_ID_TRAVEL: ${TARGET_GROUP_ID_TRAVEL}`);

    if (!msg.message) {
      logger.info('⚠️ Mensagem sem conteúdo, ignorando');
      continue;
    }

    if (!isAllowedGroup(remoteJid)) {
      logger.info(`🚫 Grupo não autorizado para transações: ${remoteJid}`);

      // Verifica se é o grupo de vídeos
      const messageText = getMessageText(msg);
      if (messageText) {
        // Verifica comando /status primeiro
        if (messageText.toLowerCase().trim() === 'status' && isVideoAllowedGroup(remoteJid)) {
          logger.info(`📊 Comando /status no grupo de vídeos`);
          await videoStatusHandler.handle({ msg, sock });
          continue;
        }

        // Verifica link de vídeo
        if (urlValidator.containsVideoUrl(messageText)) {
          logger.info(`🎬 Mensagem contém link de vídeo`);

          if (isVideoAllowedGroup(remoteJid)) {
            logger.info(`✅ Grupo autorizado para vídeos! Processando...`);
            await videoMessageHandler.handle({ msg, sock });
          } else {
            logger.info(`❌ Grupo NÃO autorizado para vídeos: ${remoteJid}`);
          }
        }
      }
      continue;
    }

    logger.info(`✅ Grupo autorizado para transações: ${remoteJid}`);

    const messageId = `${remoteJid}_${msg.key.id}`;
    if (isDuplicateMessage(messageId)) {
      continue;
    }

    // Vídeos: apenas no canal TARGET_GROUP_ID_TRAVEL
    if (await handleVideoMessage(msg, sock)) {
      logger.info(`🎥 Mensagem processada como vídeo`);
      continue;
    }

    // Transações: imagens e comandos de texto
    if (msg.message.imageMessage) {
      logger.info(`🖼️ Processando imagem...`);
      await imageMessageHandler.handle({ msg, sock });
    }

    if (msg.message.conversation || msg.message.extendedTextMessage) {
      logger.info(`💬 Processando texto...`);
      await textMessageHandler.handle({ msg, sock });
    }
  }
}
