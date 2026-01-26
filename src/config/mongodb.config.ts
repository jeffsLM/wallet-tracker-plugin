/**
 * Configuração do MongoDB
 * Reutiliza a mesma conexão para transações e vídeos
 */

import dotenv from 'dotenv';
dotenv.config();

export const MONGODB_CONFIG = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-processor',
  options: {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  },
  collections: {
    VIDEOS: 'video_messages',
  }
} as const;
