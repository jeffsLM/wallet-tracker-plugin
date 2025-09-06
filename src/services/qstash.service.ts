import { Client } from "@upstash/qstash";

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
    console.log(`🚀 Iniciando envio via QStash`);
    console.log(`🎯 Webhook: ${WEBHOOK_URL}`);
    console.log(`📦 Payload:`, { ...payload });
    console.log(`🔐 Auth configurado: ${API_TOKEN ? 'Sim' : 'Não'}`);

    await client.publish({
      body: { ...payload },
      headers: {
        'Content-Type': 'application/json'
      },
      url: WEBHOOK_URL,
    });

    console.log(`✅ Mensagem enviada!`);

    return {
      success: true,
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`❌ Erro ao enviar via QStash:`, errorMessage);
    console.error(`❌ Detalhes do erro:`, error);

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
