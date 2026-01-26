/**
 * Service para publicar mensagens de vídeo na fila RabbitMQ
 * Wrapper específico para fila video-processing
 */

import { VideoQueueMessage } from '../types/video.types';
import { publishVideoMessage } from './rabbitMQ.service';
import { createLogger } from '../utils/logger.utils';

const logger = createLogger('VideoQueue');

/**
 * Publica mensagem de vídeo na fila com retry automático
 */
export async function publish(message: VideoQueueMessage, maxRetries: number = 3): Promise<boolean> {
  // Validar payload conforme regras
  if (!message.url || !message.texto || !message.sugeridoPor) {
    logger.error('Payload inválido: campos obrigatórios ausentes');
    return false;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await publishVideoMessage(message);
      logger.success(`Vídeo publicado na fila: ${message.messageId}`);
      return true;

    } catch (error) {
      logger.warn(`Tentativa ${attempt}/${maxRetries} falhou:`, error);

      if (attempt === maxRetries) {
        logger.error('Falha ao publicar após todas as tentativas');
        return false;
      }

      // Backoff exponencial: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return false;
}

/**
 * Valida se payload está no formato correto
 */
export function validatePayload(message: VideoQueueMessage): boolean {
  const requiredFields: (keyof VideoQueueMessage)[] = [
    'url',
    'texto',
    'sugeridoPor',
    'messageId',
    'timestamp'
  ];

  for (const field of requiredFields) {
    if (!message[field]) {
      logger.error(`Campo obrigatório ausente: ${field}`);
      return false;
    }
  }

  return true;
}

export const videoQueue = {
  publish,
  validatePayload
};
