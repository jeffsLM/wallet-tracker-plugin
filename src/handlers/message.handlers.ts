import { MessagesUpsert } from '../types';
import { imageMessageHandler } from './imageMessage.handler';
import { textMessageHandler } from './textMessage.handler';
import dotenv from 'dotenv';

dotenv.config();

const TARGET_GROUP_ID = process.env.TARGET_GROUP_ID;

const processedMessages = new Map<string, number>();
const CACHE_DURATION = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of processedMessages.entries()) {
    if (now - timestamp > CACHE_DURATION) {
      processedMessages.delete(key);
    }
  }
}, 60 * 1000);

export async function handleMessagesUpsert({ messages, sock }: MessagesUpsert): Promise<void> {
  for (const msg of messages) {
    if (!msg.message || msg.key.remoteJid !== TARGET_GROUP_ID) {
      continue;
    }

    const messageId = `${msg.key.remoteJid}_${msg.key.id}`;

    if (processedMessages.has(messageId)) {
      console.log(`Mensagem duplicada ignorada: ${messageId}`);
      continue;
    }

    processedMessages.set(messageId, Date.now());

    if (msg.message.imageMessage) {
      await imageMessageHandler.handle({ msg, sock });
    }

    if (msg.message.conversation || msg.message.extendedTextMessage) {
      await textMessageHandler.handle({ msg, sock });
    }
  }
}
