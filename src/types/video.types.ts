/**
 * Tipos TypeScript para o sistema de curadoria de vídeos
 * Isolado do sistema de transações
 */

export type VideoPlatform = 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'twitter' | 'other';
export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Documento completo armazenado no MongoDB
 */
export interface VideoMessage {
  _id?: string;
  url: string;
  texto: string;
  sugeridoPor: string;
  senderJid: string;
  status: VideoStatus;
  createdAt: Date;
  processedAt?: Date;
  metadata?: VideoMetadata;
  result?: VideoProcessingResult;
}

/**
 * Metadados extraídos da URL
 */
export interface VideoMetadata {
  platform: VideoPlatform;
  videoId?: string;
  originalUrl: string;
}

/**
 * Resultado do processamento (preenchido pelo worker)
 */
export interface VideoProcessingResult {
  title?: string;
  description?: string;
  duration?: number; // em segundos
  thumbnail?: string;
  author?: string;
  publishedAt?: Date;
  tags?: string[];
  downloadedPath?: string;
  processedBy?: string;
  error?: string;
}

/**
 * Payload mínimo enviado para a fila RabbitMQ
 * Segue regra: apenas url, texto, sugeridoPor + campos técnicos
 */
export interface VideoQueueMessage {
  url: string;
  texto: string;
  sugeridoPor: string;
  // Campos técnicos permitidos
  messageId: string;
  timestamp: number;
}

/**
 * Estatísticas de vídeos (para monitoramento)
 */
export interface VideoStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}
