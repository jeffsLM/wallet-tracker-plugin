/**
 * Handler para mensagens de vídeo
 * Processa links de vídeos de forma isolada do sistema de transações
 */

import { WhatsappSocket } from '../types';
import { proto } from '@whiskeysockets/baileys';
import { urlValidator } from '../utils/urlValidator.utils';
import { videoStorage } from '../services/videoStorage.service';
import { videoQueue } from '../services/videoQueue.service';
import { whatsappMessage } from '../services/whatappMessage.service';
import { userUtils } from '../utils/user.utils';
import { createLogger } from '../utils/logger.utils';

interface VideoMessageRequest {
  msg: proto.IWebMessageInfo;
  sock: WhatsappSocket;
}

const logger = createLogger('VideoHandler');

export const videoMessageHandler = {
  async handle({ msg, sock }: VideoMessageRequest): Promise<void> {
    try {
      const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      const senderJid = msg.key.participant || msg.key.remoteJid || '';
      const senderName = await userUtils.getSenderName(sock, senderJid, msg.key.remoteJid || '');

      // 1. Extrair e validar URL
      const videoUrl = urlValidator.extractVideoUrl(messageText);
      if (!videoUrl) {
        // SEM link de vídeo válido → ignora silenciosamente, NÃO envia mensagem
        logger.info(`Mensagem sem link válido ignorada de ${senderName}: ${messageText.substring(0, 50)}`);
        return;
      }

      logger.info(`📹 Link de vídeo válido detectado de ${senderName}: ${videoUrl}`);

      // 2. Parse metadados da URL
      const metadata = urlValidator.parseVideoUrl(videoUrl);
      const normalizedUrl = urlValidator.normalizeVideoUrl(videoUrl);

      // 3. Salvar no MongoDB (fonte da verdade)
      const videoDoc = await videoStorage.create({
        url: normalizedUrl,
        texto: messageText,
        sugeridoPor: senderName,
        senderJid,
        status: 'pending',
        createdAt: new Date(),
        ...(metadata && { metadata })
      });

      // 4. Publicar na fila (payload mínimo)
      const published = await videoQueue.publish({
        url: normalizedUrl,
        texto: messageText,
        sugeridoPor: senderName,
        messageId: videoDoc._id!,
        timestamp: Date.now()
      });

      if (!published) {
        logger.error('Falha ao publicar na fila após retries');
        // ⚠️ Reação de aviso
        await whatsappMessage.sendReaction(sock, {
          messageKey: msg.key,
          emoji: '⚠️'
        });
        return;
      }

      // 5. Confirmação via reação ✅
      await whatsappMessage.sendReaction(sock, {
        messageKey: msg.key,
        emoji: '✅'
      });

      logger.success(`✅ Vídeo ${videoDoc._id} salvo e publicado com sucesso`);

    } catch (error) {
      // Erro REAL no processamento (banco caiu, fila inacessível, etc)
      logger.error('❌ Erro crítico ao processar vídeo:', error);

      // ❌ Reação de erro
      await whatsappMessage.sendReaction(sock, {
        messageKey: msg.key,
        emoji: '❌'
      });
    }
  }
};
