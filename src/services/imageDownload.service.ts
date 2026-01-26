import { downloadMediaMessage, WAMessage } from '@whiskeysockets/baileys';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { createLogger } from '../utils/logger.utils';

const IMAGE_CONFIG = {
  destinationFolder: 'images',
  maxSizeKB: 100,
  defaultQuality: 80,
  minQuality: 10,
  qualityStep: 5
} as const;

interface DownloadResult {
  success: boolean;
  filePath?: string;
  error?: string;
  fileSize?: number;
}

function ensureDestinationFolder(): string {
  const destinationFolder = path.join(__dirname, '../../', IMAGE_CONFIG.destinationFolder);

  if (!fs.existsSync(destinationFolder)) {
    fs.mkdirSync(destinationFolder, { recursive: true });
    createLogger('info').info(`📁 Pasta criada: ${destinationFolder}`);
  }

  return destinationFolder;
}

function generateFileName(mimeType: string): string {
  const extension = mimeType.split('/')[1] || 'jpg';
  return `img_${Date.now()}.${extension}`;
}

async function compressImage(buffer: Buffer, maxSizeKB: number = IMAGE_CONFIG.maxSizeKB): Promise<Buffer> {
  let quality = IMAGE_CONFIG.defaultQuality;
  let compressedBuffer = await sharp(buffer)
    .jpeg({ quality })
    .toBuffer();

  while (compressedBuffer.length > maxSizeKB * 1024 && quality > IMAGE_CONFIG.minQuality) {
    quality -= IMAGE_CONFIG.qualityStep;
    compressedBuffer = await sharp(buffer)
      .jpeg({ quality })
      .toBuffer();
  }

  return compressedBuffer;
}

export async function downloadAndSaveImage(msg: WAMessage): Promise<DownloadResult> {
  try {
    createLogger('info').info('📥 Iniciando download da imagem...');

    // Log detalhado da mensagem recebida
    createLogger('info').info('🔍 ========== DADOS COMPLETOS DA MENSAGEM ==========');
    createLogger('info').info('📋 Message Key:');
    createLogger('info').info(JSON.stringify(msg.key, null, 2));

    createLogger('info').info('📸 Image Message COMPLETO (para debug/download manual):');
    createLogger('info').info(JSON.stringify(msg.message, null, 2));

    createLogger('info').info('🔐 Dados de criptografia e download:');
    if (msg.message?.imageMessage) {
      const img = msg.message.imageMessage;
      createLogger('info').info(JSON.stringify({
        url: img.url,
        directPath: img.directPath,
        mediaKey: img.mediaKey ? Buffer.from(img.mediaKey).toString('base64') : null,
        fileEncSha256: img.fileEncSha256 ? Buffer.from(img.fileEncSha256).toString('base64') : null,
        fileSha256: img.fileSha256 ? Buffer.from(img.fileSha256).toString('base64') : null,
        jpegThumbnail: img.jpegThumbnail ? `<Buffer ${img.jpegThumbnail.length} bytes>` : null,
        fileLength: img.fileLength,
        mimetype: img.mimetype,
        caption: img.caption,
        width: img.width,
        height: img.height,
        scanLengths: img.scanLengths,
        scansSidecar: img.scansSidecar ? `<Buffer ${img.scansSidecar.length} bytes>` : null,
        midQualityFileSha256: img.midQualityFileSha256 ? Buffer.from(img.midQualityFileSha256).toString('base64') : null,
        contextInfo: img.contextInfo
      }, null, 2));
    }

    createLogger('info').info('🔍 =================================================');

    // Verifica se há mensagem de imagem
    if (!msg.message?.imageMessage) {
      createLogger('error').error('❌ Mensagem não contém imageMessage');
      return {
        success: false,
        error: 'Mensagem não contém imagem'
      };
    }

    // Download do buffer da imagem
    createLogger('info').info('⏳ Chamando downloadMediaMessage...');

    const buffer = await downloadMediaMessage(
      msg,
      'buffer',
      {}
    ) as Buffer;

    createLogger('info').info(`✅ downloadMediaMessage concluído. Buffer recebido: ${buffer ? 'SIM' : 'NÃO'}`);

    if (!buffer || buffer.length === 0) {
      createLogger('error').error('❌ Buffer vazio ou nulo');
      return {
        success: false,
        error: 'Nenhum dado de imagem encontrado na mensagem'
      };
    }

    createLogger('info').info(`📊 Buffer original: ${(buffer.length / 1024).toFixed(1)} KB`);

    const mimeType = msg.message.imageMessage.mimetype || 'image/jpeg';
    const fileName = generateFileName(mimeType);

    const destinationFolder = ensureDestinationFolder();
    const fullPath = path.join(destinationFolder, fileName);

    const compressedBuffer = await compressImage(buffer);

    fs.writeFileSync(fullPath, compressedBuffer);

    const fileSizeKB = compressedBuffer.length / 1024;

    createLogger('info').info(`✅ Imagem salva: ${fileName} (${fileSizeKB.toFixed(1)} KB)`);

    return {
      success: true,
      filePath: fullPath,
      fileSize: fileSizeKB
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

    createLogger('error').error('❌ Erro no download da imagem:', errorMessage);
    createLogger('error').error('🔍 Detalhes do erro:', JSON.stringify({
      name: error instanceof Error ? error.name : 'Unknown',
      message: errorMessage,
      stack: error instanceof Error ? error.stack : 'No stack trace'
    }, null, 2));

    return {
      success: false,
      error: `Falha no download: ${errorMessage}`
    };
  }
}

export async function cleanupOldImages(maxAgeHours: number = 24): Promise<void> {
  try {
    const destinationFolder = ensureDestinationFolder();
    const files = fs.readdirSync(destinationFolder);
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;

    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(destinationFolder, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      createLogger('info').info(`🗑️  ${deletedCount} imagem(ns) antiga(s) removida(s)`);
    }

  } catch (error) {
    createLogger('error').error('⚠️  Erro na limpeza de imagens antigas:', error);
  }
}

export async function validateImageFile(filePath: string): Promise<boolean> {
  try {
    await sharp(filePath).metadata();
    return true;
  } catch {
    return false;
  }
}

export const imageDownloadService = {
  downloadAndSaveImage,
  cleanupOldImages,
  validateImageFile
};
