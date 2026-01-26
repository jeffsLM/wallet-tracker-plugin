/**
 * Configuração do MongoDB
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
  }
} as const;
