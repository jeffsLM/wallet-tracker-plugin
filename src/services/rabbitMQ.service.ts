import amqp from 'amqplib';
import { QUEUE_CONFIG, RABBITMQ_CONFIG } from '../config/rabbitmq.config';
import { createLogger } from '../utils/logger.utils';
import { ConnectionUpdate } from '../types';



export interface FromWhatsAppMessage {
  id: string;
  purchaseType: string;
  amount: string;
  parcelas: number;
  lastFourDigits: string;
  user: string;
  ocrText: string;
  timestamp: number;
  status: string;
}

interface RabbitMQConnection {
  connection: amqp.ChannelModel;
  channel: amqp.Channel;
}

let cachedConnection: RabbitMQConnection | null = null;
let isConnecting = false;
let connectionRetries = 0;



const logger = createLogger('RabbitMQ');

function validateFromWhatsAppMessage(messageData: FromWhatsAppMessage) {
  const requiredFields: (keyof FromWhatsAppMessage)[] = [
    'id', 'purchaseType', 'amount', 'parcelas',
    'lastFourDigits', 'user', 'ocrText', 'timestamp', 'status'
  ];

  const missingFields = requiredFields.filter(field =>
    messageData[field] === undefined || messageData[field] === null || messageData[field] === ''
  );

  if (missingFields.length > 0) {
    return {
      success: false,
      message: `Campos obrigatórios ausentes: ${missingFields.join(', ')}`
    };
  }

  return {
    success: true,
    message: 'Mensagem validada com sucesso'
  };
}


async function createConnection(): Promise<RabbitMQConnection> {
  const connection = await amqp.connect(RABBITMQ_CONFIG.url);
  const channel = await connection.createChannel();

  await channel.prefetch(QUEUE_CONFIG.prefetch || 1);

  await channel.assertQueue(RABBITMQ_CONFIG.queues.TO_WHATSAPP, {
    durable: QUEUE_CONFIG.durable
  });
  await channel.assertQueue(RABBITMQ_CONFIG.queues.FROM_WHATSAPP, {
    durable: QUEUE_CONFIG.durable
  });

  // Configurar listeners para reconexão
  connection.on('error', (error) => {
    logger.error('Erro na conexão:', error);
    cachedConnection = null;
  });

  connection.on('close', () => {
    logger.warn('Conexão fechada');
    cachedConnection = null;
  });

  channel.on('error', (error) => {
    logger.error('Erro no canal:', error);
    cachedConnection = null;
  });

  channel.on('close', () => {
    logger.warn('Canal fechado');
    cachedConnection = null;
  });

  return { connection, channel };
}

async function getLazyConnection(): Promise<RabbitMQConnection> {
  if (cachedConnection) {
    return cachedConnection;
  }

  // Se já está conectando, aguarda
  if (isConnecting) {
    while (isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (cachedConnection) {
      return cachedConnection;
    }
  }

  isConnecting = true;

  try {
    logger.info(`Conectando ao RabbitMQ... (tentativa ${connectionRetries + 1}/${RABBITMQ_CONFIG.maxRetries})`);

    cachedConnection = await createConnection();
    connectionRetries = 0;
    isConnecting = false;

    logger.success('Conectado ao RabbitMQ via Lazy Loading');
    return cachedConnection;

  } catch (error) {
    isConnecting = false;
    connectionRetries++;

    if (connectionRetries >= RABBITMQ_CONFIG.maxRetries) {
      logger.error(`Falha ao conectar após ${RABBITMQ_CONFIG.maxRetries} tentativas:`, error);
      connectionRetries = 0;
      throw error;
    }

    logger.warn(`Tentativa ${connectionRetries} falhou, tentando novamente em ${RABBITMQ_CONFIG.reconnectDelay}ms...`);
    await new Promise(resolve => setTimeout(resolve, RABBITMQ_CONFIG.reconnectDelay));

    return getLazyConnection();
  }
}


export async function publishToWhatsApp(message: string): Promise<void> {
  if (!message || message.trim().length === 0) {
    throw new Error('Mensagem não pode estar vazia');
  }

  try {
    const { channel } = await getLazyConnection();
    const messageBuffer = Buffer.from(message.trim());

    const success = channel.sendToQueue(
      RABBITMQ_CONFIG.queues.TO_WHATSAPP,
      messageBuffer,
      { persistent: QUEUE_CONFIG.persistent }
    );

    if (!success) {
      throw new Error('Falha ao enviar mensagem para a fila');
    }

    logger.info(`📤 Mensagem enviada para ${RABBITMQ_CONFIG.queues.TO_WHATSAPP}:`, message.substring(0, 50) + '...');

  } catch (error) {
    logger.error('Erro ao publicar mensagem to-whatsapp:', error);
    throw error;
  }
}

export async function publishFromWhatsApp(messageData: FromWhatsAppMessage): Promise<void> {
  try {
    // Validar dados
    const validationResult = validateFromWhatsAppMessage(messageData);
    if (!validationResult.success) {
      return logger.error(validationResult.message);
    }

    const { channel } = await getLazyConnection();
    const messageJson = JSON.stringify(messageData);
    const messageBuffer = Buffer.from(messageJson);

    const success = channel.sendToQueue(
      RABBITMQ_CONFIG.queues.FROM_WHATSAPP,
      messageBuffer,
      { persistent: QUEUE_CONFIG.persistent }
    );

    if (!success) {
      throw new Error('Falha ao enviar dados para a fila');
    }

    logger.info(`📤 Dados enviados para ${RABBITMQ_CONFIG.queues.FROM_WHATSAPP}:`, messageData.id);

  } catch (error) {
    logger.error('Erro ao publicar dados from-whatsapp:', error);
    throw error;
  }
}

interface IHandleMessagesToSendFromQueue {
  connectionUpdate: ConnectionUpdate;
  callback: (message: string) => Promise<void>;
}

export async function handleMessagesToSendFromQueue(
  { connectionUpdate, callback }: IHandleMessagesToSendFromQueue
): Promise<void> {
  if (connectionUpdate.connection !== 'open') return;

  try {
    const { channel } = await getLazyConnection();

    await channel.consume(RABBITMQ_CONFIG.queues.TO_WHATSAPP, async (msg) => {
      if (!msg) return;

      const messageContent = msg.content.toString();
      logger.info(`📥 Processando mensagem de ${RABBITMQ_CONFIG.queues.TO_WHATSAPP}`);

      try {
        await callback(messageContent);
        channel.ack(msg);
        logger.success('✅ Mensagem processada com sucesso');
      } catch (error) {
        logger.error('❌ Erro ao processar mensagem:', error);
        channel.nack(msg, false, true); // Rejeitar e reenviar para fila
      }
    });

    logger.info(`👂 Aguardando mensagens de ${RABBITMQ_CONFIG.queues.TO_WHATSAPP}...`);

  } catch (error) {
    logger.error('Erro ao consumir to-whatsapp:', error);
    throw error;
  }
}

export async function consumeFromWhatsApp(
  callback: (messageData: FromWhatsAppMessage) => Promise<void>
): Promise<void> {
  try {
    const { channel } = await getLazyConnection();

    await channel.consume(RABBITMQ_CONFIG.queues.FROM_WHATSAPP, async (msg) => {
      if (!msg) return;

      logger.info(`📥 Processando dados de ${RABBITMQ_CONFIG.queues.FROM_WHATSAPP}`);

      try {
        const messageData: FromWhatsAppMessage = JSON.parse(msg.content.toString());
        await callback(messageData);
        channel.ack(msg);
        logger.success(`✅ Dados processados com sucesso: ${messageData.id}`);
      } catch (error) {
        logger.error('❌ Erro ao processar dados:', error);
        channel.nack(msg, false, true);
      }
    });

    logger.info(`👂 Aguardando dados de ${RABBITMQ_CONFIG.queues.FROM_WHATSAPP}...`);

  } catch (error) {
    logger.error('Erro ao consumir from-whatsapp:', error);
    throw error;
  }
}

export async function getQueueStatus(): Promise<{
  toWhatsApp: amqp.Replies.AssertQueue;
  fromWhatsApp: amqp.Replies.AssertQueue;
}> {
  try {
    const { channel } = await getLazyConnection();

    const toWhatsAppStatus = await channel.checkQueue(RABBITMQ_CONFIG.queues.TO_WHATSAPP);
    const fromWhatsAppStatus = await channel.checkQueue(RABBITMQ_CONFIG.queues.FROM_WHATSAPP);

    return {
      toWhatsApp: toWhatsAppStatus,
      fromWhatsApp: fromWhatsAppStatus
    };
  } catch (error) {
    logger.error('Erro ao verificar status das filas:', error);
    throw error;
  }
}

export function isConnected(): boolean {
  return cachedConnection !== null && !isConnecting;
}

export async function closeConnection(): Promise<void> {
  if (cachedConnection) {
    try {
      await cachedConnection.channel.close();
      await cachedConnection.connection.close();
      cachedConnection = null;
      logger.success('Conexão fechada com sucesso');
    } catch (error) {
      logger.error('Erro ao fechar conexão:', error);
      cachedConnection = null; // Reset mesmo com erro
    }
  }
}

