import { Client } from "@upstash/qstash";
import { createLogger } from '../utils/logger.utils';

const API_TOKEN = process.env.API_TOKEN || '';
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';

const client = new Client({
  token: process.env.QSTASH_TOKEN,
});

interface QStashResult {
  success: boolean;
  messageId?: string;
  error?: string;
  processingTime?: number;
}

export async function sendMessage(payload: any): Promise<QStashResult> {
  const startTime = Date.now();

  try {
    createLogger('info').info(`🚀 Iniciando envio via QStash`);
    createLogger('info').info(`🎯 Webhook: ${WEBHOOK_URL}`);
    createLogger('info').info(`📦 Payload: ${JSON.stringify({ ...payload })}`);
    createLogger('info').info(`🔐 Auth configurado: ${API_TOKEN ? 'Sim' : 'Não'}`);

    await client.publish({
      body: JSON.stringify({ ...payload }),
      headers: {
        'Content-Type': 'application/json'
      },
      url: WEBHOOK_URL,
    });

    createLogger('info').info(`✅ Mensagem enviada!`);

    return {
      success: true,
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    createLogger('error').error(`❌ Erro ao enviar via QStash:`, errorMessage);
    createLogger('error').error(`❌ Detalhes do erro:`, error);

    return {
      success: false,
      error: errorMessage,
      processingTime: Date.now() - startTime
    };
  }
}

export const qstashService = {
  sendMessage,
};
