import Tesseract from 'tesseract.js';
import fs from 'fs';

const OCR_CONFIG = {
  defaultLanguage: 'por',
  recognizeOptions: {
    tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    preserve_interword_spaces: '1'
  }
} as const;

// Interfaces - mantidas exatamente iguais
interface OCRResponse {
  ParsedResults?: Array<{
    TextOverlay: {
      Lines: Array<{
        LineText: string;
      }>;
    };
    ParsedText: string;
  }>;
  OCRExitCode: number;
  IsErroredOnProcessing: boolean;
  ErrorMessage?: string;
  ErrorDetails?: string;
}

interface OCRResult {
  success: boolean;
  text?: string;
  error?: string;
  confidence?: number;
  processingTime?: number;
}

interface OCROptions {
  language?: string;
  detectOrientation?: boolean;
  isTable?: boolean;
  scale?: boolean;
}

function parseResponse(response: OCRResponse): OCRResult {
  if (response.OCRExitCode === 1 && response.ParsedResults) {
    const result = response.ParsedResults[0];
    const extractedText = result?.ParsedText?.trim() || '';

    if (extractedText) {
      return {
        success: true,
        text: extractedText,
        confidence: calculateConfidence(result)
      };
    } else {
      return {
        success: false,
        error: 'Nenhum texto foi encontrado na imagem'
      };
    }
  }

  return {
    success: false,
    error: response.ErrorMessage || response.ErrorDetails || 'Erro desconhecido no processamento'
  };
}

function calculateConfidence(result: any): number {
  const lines = result?.TextOverlay?.Lines?.length || 0;
  const textLength = result?.ParsedText?.length || 0;

  if (textLength === 0) return 0;
  if (textLength > 100 && lines > 5) return 0.9;
  if (textLength > 50 && lines > 3) return 0.7;
  if (textLength > 20) return 0.5;

  return 0.3;
}

function validateImagePath(imagePath: string): boolean {
  try {
    return fs.existsSync(imagePath) && fs.statSync(imagePath).isFile();
  } catch {
    return false;
  }
}

async function processTesseractImage(imagePath: string, options?: OCROptions): Promise<OCRResponse> {
  const language = options?.language || OCR_CONFIG.defaultLanguage;

  const worker = await Tesseract.createWorker(language, 1);

  try {
    const result = await worker.recognize(imagePath);

    const extractedText = result.data.text.trim();
    if (!extractedText) return {
      OCRExitCode: 0,
      IsErroredOnProcessing: true,
      ErrorMessage: 'Nenhum texto foi encontrado na imagem'
    }

    const lines = extractedText.split('\n').filter(line => line.trim().length > 0);
    const mockLines = lines.map(line => ({ LineText: line }));

    return {
      OCRExitCode: 1,
      IsErroredOnProcessing: false,
      ParsedResults: [{
        TextOverlay: {
          Lines: mockLines
        },
        ParsedText: extractedText
      }]
    };

  } finally {
    await worker.terminate();
  }
}

export async function processImage(imagePath: string, options?: OCROptions): Promise<OCRResult> {
  const startTime = Date.now();

  try {
    console.log(`🔍 Iniciando OCR para: ${imagePath}`);
    if (!validateImagePath(imagePath)) {
      return {
        success: false,
        error: 'Arquivo de imagem não encontrado ou inválido'
      };
    }

    const response = await processTesseractImage(imagePath, options);
    const result = parseResponse(response);
    const processingTime = Date.now() - startTime;

    result.processingTime = processingTime;

    if (result.success) {
      console.log(`✅ OCR processado com sucesso em ${processingTime}ms`);
      console.log(`📊 Confiança: ${((result.confidence || 0) * 100).toFixed(1)}%`);
      console.log(`📝 Texto extraído: ${result.text?.length} caracteres`);
    } else {
      console.error(`❌ Falha no OCR (${processingTime}ms): ${result.error}`);
    }

    return result;

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`❌ Erro ao conectar com OCR.space (${processingTime}ms):`, errorMessage);

    return {
      success: false,
      error: `Erro de conexão: ${errorMessage}`,
      processingTime
    };
  }
}

// Função para processar múltiplas imagens
export async function processMultipleImages(imagePaths: string[], options?: OCROptions): Promise<OCRResult[]> {
  console.log(`🔍 Processando ${imagePaths.length} imagens...`);

  const results: OCRResult[] = [];

  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];
    console.log(`📷 Processando imagem ${i + 1}/${imagePaths.length}: ${imagePath}`);

    const result = await processImage(imagePath, options);
    results.push(result);

    if (i < imagePaths.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const successful = results.filter(r => r.success).length;
  console.log(`✅ OCR concluído: ${successful}/${imagePaths.length} imagens processadas com sucesso`);

  return results;
}

// Objeto com as funções do serviço de OCR
export const ocrService = {
  processImage,
  processMultipleImages,
};
