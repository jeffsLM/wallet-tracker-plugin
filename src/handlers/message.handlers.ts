import { MessagesUpsert } from '../types';
import { imageMessageHandler } from './imageMessage.handler';
import { textMessageHandler } from './textMessage.handler';

import dotenv from 'dotenv';
dotenv.config();

const TARGET_GROUP_ID = process.env.TARGET_GROUP_ID

export async function handleMessagesUpsert({ messages, sock }: MessagesUpsert): Promise<void> {

  for (const msg of messages) {
    if (msg.message && msg.key.remoteJid === TARGET_GROUP_ID) {
      if (msg.message.imageMessage) await imageMessageHandler.handle({ msg, sock });
      if (msg.message.conversation || msg.message.extendedTextMessage) await textMessageHandler.handle({ msg, sock });
    }
  }
}
