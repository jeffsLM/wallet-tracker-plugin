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

// Rate limiting: máximo 20 vídeos por hora por usuário
const userRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const limit = userRateLimits.get(userId);
  const now = Date.now();

  if (!limit || now > limit.resetAt) {
    userRateLimits.set(userId, {
      count: 1,
      resetAt: now + 60 * 60 * 1000 // 1 hora
    });
    return true;
  }

  if (limit.count >= 20) {
    return false;
  }

  limit.count++;
  return true;
}

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

      // 3. Parse metadados da URL
      const metadata = urlValidator.parseVideoUrl(videoUrl);
      const normalizedUrl = urlValidator.normalizeVideoUrl(videoUrl);

      // 4. Salvar no MongoDB (fonte da verdade)
      const videoDoc = await videoStorage.create({
        url: normalizedUrl,
        texto: messageText,
        sugeridoPor: senderName,
        senderJid,
        status: 'pending',
        createdAt: new Date(),
        ...(metadata && { metadata })
      });

      // 5. Publicar na fila (payload mínimo)
      const published = await videoQueue.publish({
        url: normalizedUrl,
        texto: messageText,
        sugeridoPor: senderName,
        messageId: videoDoc._id!,
        timestamp: Date.now()
      });

      if (!published) {
        logger.error('Falha ao publicar na fila após retries');
        await whatsappMessage.sendText(sock, {
          jid: msg.key.remoteJid || '',
          text: '⚠️ Vídeo salvo mas houve problema ao enviar para processamento. Será reprocessado automaticamente.',
        });
        return;
      }

      // 6. Resposta APENAS quando link válido foi processado com sucesso
      const platformEmoji = {
        youtube: '📺',
        tiktok: '🎵',
        instagram: '📸',
        facebook: '👥',
        twitter: '🐦',
        other: '🎬'
      }[metadata?.platform || 'other'];

      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: `✅ Vídeo adicionado à fila de curadoria!\n\n${platformEmoji} ${normalizedUrl}\n\n📊 ID: ${videoDoc._id}`,
      });

      logger.success(`✅ Vídeo ${videoDoc._id} salvo e publicado com sucesso`);

    } catch (error) {
      // Erro REAL no processamento (banco caiu, fila inacessível, etc)
      logger.error('❌ Erro crítico ao processar vídeo:', error);

      // Só envia mensagem de erro se REALMENTE tentou processar algo
      await whatsappMessage.sendText(sock, {
        jid: msg.key.remoteJid || '',
        text: '❌ Erro ao adicionar vídeo. Tente novamente em alguns instantes.',
      });
    }
  }
};
