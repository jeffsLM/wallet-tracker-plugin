/**
 * Schema Mongoose para mensagens de vídeo
 * Collection isolada do sistema de transações
 */

import { VideoMessage, VideoStatus, VideoPlatform } from '../types/video.types';

// Estrutura do documento (não usa Mongoose para manter flexibilidade)
// Implementação com MongoDB driver nativo no videoStorage.service.ts

/**
 * Schema de validação para MongoDB
 */
export const VideoMessageSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['url', 'texto', 'sugeridoPor', 'senderJid', 'status', 'createdAt'],
      properties: {
        url: {
          bsonType: 'string',
          description: 'URL do vídeo - obrigatório'
        },
        texto: {
          bsonType: 'string',
          description: 'Texto da mensagem enviada - obrigatório'
        },
        sugeridoPor: {
          bsonType: 'string',
          description: 'Nome do remetente - obrigatório'
        },
        senderJid: {
          bsonType: 'string',
          description: 'JID do remetente WhatsApp - obrigatório'
        },
        status: {
          enum: ['pending', 'processing', 'completed', 'failed'],
          description: 'Status do processamento - obrigatório'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Data de criação - obrigatório'
        },
        processedAt: {
          bsonType: 'date',
          description: 'Data de processamento - opcional'
        },
        metadata: {
          bsonType: 'object',
          properties: {
            platform: {
              enum: ['youtube', 'tiktok', 'instagram', 'facebook', 'twitter', 'other']
            },
            videoId: {
              bsonType: 'string'
            },
            originalUrl: {
              bsonType: 'string'
            }
          }
        },
        result: {
          bsonType: 'object',
          description: 'Resultado do processamento pelo worker'
        }
      }
    }
  }
};

/**
 * Índices para otimização de queries
 */
export const VideoMessageIndexes: Array<{
  key: { [key: string]: 1 | -1 };
  expireAfterSeconds?: number;
}> = [
  // Index para TTL (remove documentos após 90 dias)
  { key: { createdAt: 1 }, expireAfterSeconds: 7776000 },
  
  // Index para queries por status
  { key: { status: 1, createdAt: -1 } },
  
  // Index para queries por usuário
  { key: { senderJid: 1, createdAt: -1 } },
  
  // Index composto para retry de mensagens falhas
  { key: { status: 1, processedAt: 1 } }
];

/**
 * Helper para criar documento válido
 */
export function createVideoDocument(data: Partial<VideoMessage>): VideoMessage {
  return {
    url: data.url!,
    texto: data.texto || '',
    sugeridoPor: data.sugeridoPor!,
    senderJid: data.senderJid!,
    status: data.status || 'pending',
    createdAt: data.createdAt || new Date(),
    ...(data.processedAt && { processedAt: data.processedAt }),
    ...(data.metadata && { metadata: data.metadata }),
    ...(data.result && { result: data.result })
  };
}
