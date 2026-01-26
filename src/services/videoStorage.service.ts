/**
 * Service para gerenciar vídeos no MongoDB
 * CRUD isolado para a collection video_messages
 */

import { MongoClient, Db, Collection, ObjectId, WithId, Document } from 'mongodb';
import { MONGODB_CONFIG } from '../config/mongodb.config';
import { VideoMessage, VideoStatus, VideoStats } from '../types/video.types';
import { createVideoDocument, VideoMessageSchema, VideoMessageIndexes } from '../models/VideoMessage.model';
import { createLogger } from '../utils/logger.utils';

const logger = createLogger('VideoStorage');

let client: MongoClient | null = null;
let db: Db | null = null;
let collection: Collection<VideoMessage> | null = null;

/**
 * Conecta ao MongoDB e inicializa a collection
 */
async function connect(): Promise<Collection<VideoMessage>> {
  if (collection) return collection;

  try {
    client = new MongoClient(MONGODB_CONFIG.uri, MONGODB_CONFIG.options);
    await client.connect();
    
    db = client.db();
    collection = db.collection<VideoMessage>(MONGODB_CONFIG.collections.VIDEOS);

    // Criar collection com validação se não existir
    const collections = await db.listCollections({ name: MONGODB_CONFIG.collections.VIDEOS }).toArray();
    
    if (collections.length === 0) {
      await db.createCollection(MONGODB_CONFIG.collections.VIDEOS, VideoMessageSchema);
      logger.info(`Collection ${MONGODB_CONFIG.collections.VIDEOS} criada com validação`);
    }

    // Criar índices
    for (const index of VideoMessageIndexes) {
      if (index.expireAfterSeconds) {
        await collection.createIndex(index.key, { expireAfterSeconds: index.expireAfterSeconds });
      } else {
        await collection.createIndex(index.key);
      }
    }

    logger.success('Conectado ao MongoDB - video_messages');
    return collection;

  } catch (error) {
    logger.error('Erro ao conectar ao MongoDB:', error);
    throw error;
  }
}

/**
 * Cria novo documento de vídeo
 */
export async function create(data: Partial<VideoMessage>): Promise<WithId<VideoMessage>> {
  const coll = await connect();
  
  const document = createVideoDocument(data);
  const result = await coll.insertOne(document as any);
  
  logger.info(`Vídeo criado: ${result.insertedId}`);
  
  return {
    _id: result.insertedId.toString(),
    ...document
  } as WithId<VideoMessage>;
}

/**
 * Busca vídeo por ID
 */
export async function findById(id: string): Promise<WithId<VideoMessage> | null> {
  const coll = await connect();
  
  try {
    const objectId = new ObjectId(id);
    const document = await coll.findOne({ _id: objectId } as any);
    
    if (!document) return null;
    
    return {
      ...document,
      _id: document._id.toString()
    } as WithId<VideoMessage>;
  } catch (error) {
    logger.error(`Erro ao buscar vídeo ${id}:`, error);
    return null;
  }
}

/**
 * Atualiza status do vídeo
 */
export async function updateStatus(
  id: string, 
  status: VideoStatus, 
  additionalData?: Partial<VideoMessage>
): Promise<boolean> {
  const coll = await connect();
  
  try {
    const objectId = new ObjectId(id);
    const updateData: any = {
      status,
      ...(status !== 'pending' && { processedAt: new Date() }),
      ...additionalData
    };
    
    const result = await coll.updateOne(
      { _id: objectId } as any,
      { $set: updateData }
    );
    
    if (result.modifiedCount > 0) {
      logger.info(`Vídeo ${id} atualizado para status: ${status}`);
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error(`Erro ao atualizar vídeo ${id}:`, error);
    return false;
  }
}

/**
 * Busca vídeos pendentes
 */
export async function findPending(limit: number = 10): Promise<WithId<VideoMessage>[]> {
  const coll = await connect();
  
  const documents = await coll
    .find({ status: 'pending' } as any)
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray();
  
  return documents.map(doc => ({
    ...doc,
    _id: doc._id.toString()
  })) as WithId<VideoMessage>[];
}

/**
 * Busca vídeos com falha
 */
export async function findFailed(limit: number = 10): Promise<WithId<VideoMessage>[]> {
  const coll = await connect();
  
  const documents = await coll
    .find({ status: 'failed' } as any)
    .sort({ processedAt: -1 })
    .limit(limit)
    .toArray();
  
  return documents.map(doc => ({
    ...doc,
    _id: doc._id.toString()
  })) as WithId<VideoMessage>[];
}

/**
 * Busca vídeos por usuário
 */
export async function findByUser(senderJid: string, limit: number = 20): Promise<WithId<VideoMessage>[]> {
  const coll = await connect();
  
  const documents = await coll
    .find({ senderJid } as any)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  
  return documents.map(doc => ({
    ...doc,
    _id: doc._id.toString()
  })) as WithId<VideoMessage>[];
}

/**
 * Obtém estatísticas de vídeos
 */
export async function getStats(): Promise<VideoStats> {
  const coll = await connect();
  
  const [pending, processing, completed, failed, total] = await Promise.all([
    coll.countDocuments({ status: 'pending' } as any),
    coll.countDocuments({ status: 'processing' } as any),
    coll.countDocuments({ status: 'completed' } as any),
    coll.countDocuments({ status: 'failed' } as any),
    coll.countDocuments({})
  ]);
  
  return { pending, processing, completed, failed, total };
}

/**
 * Conta vídeos com base em filtros
 */
async function count(filter: Partial<VideoMessage> = {}): Promise<number> {
  try {
    const coll = await connect();
    return await coll.countDocuments(filter as Document);
  } catch (error) {
    logger.error('Erro ao contar vídeos:', error);
    throw error;
  }
}

/**
 * Fecha conexão com MongoDB
 */
export async function closeConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    collection = null;
    logger.info('Conexão MongoDB fechada');
  }
}

export const videoStorage = {
  connect,
  create,
  findById,
  updateStatus,
  findPending,
  findFailed,
  findByUser,
  getStats,
  count,
  closeConnection
};
