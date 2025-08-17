import { downloadMediaMessage, WAMessage } from '@whiskeysockets/baileys';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

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
    console.log(`📁 Pasta criada: ${destinationFolder}`);
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
    console.log('📥 Iniciando download da imagem...');

    // Download do buffer da imagem
    const buffer = await downloadMediaMessage(msg, 'buffer', {});

    if (!buffer) {
      return {
        success: false,
        error: 'Nenhum dado de imagem encontrado na mensagem'
      };
    }

    console.log(`📊 Buffer original: ${(buffer.length / 1024).toFixed(1)} KB`);

    const mimeType = msg.message?.imageMessage?.mimetype || 'image/jpeg';
    const fileName = generateFileName(mimeType);

    const destinationFolder = ensureDestinationFolder();
    const fullPath = path.join(destinationFolder, fileName);

    const compressedBuffer = await compressImage(buffer);

    fs.writeFileSync(fullPath, compressedBuffer);

    const fileSizeKB = compressedBuffer.length / 1024;

    return {
      success: true,
      filePath: fullPath,
      fileSize: fileSizeKB
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ Erro no download da imagem:', errorMessage);

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
    const maxAge = maxAgeHours * 60 * 60 * 1000; // convertendo para milliseconds

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
      console.log(`🗑️  ${deletedCount} imagem(ns) antiga(s) removida(s)`);
    }

  } catch (error) {
    console.error('⚠️  Erro na limpeza de imagens antigas:', error);
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
