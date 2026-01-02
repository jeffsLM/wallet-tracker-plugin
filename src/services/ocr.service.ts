import fs from 'fs';
import axios from 'axios';
import { VISION_CONFIG } from '../config/googleVision.config';
import { createLogger } from '../utils/logger.utils';
const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY || 'SUA_API_KEY_AQUI';

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

interface GoogleVisionResponse {
  responses: Array<{
    textAnnotations?: Array<{
      description: string;
      boundingPoly: any;
    }>;
    fullTextAnnotation?: {
      text: string;
      pages: any[];
    };
    error?: {
      code: number;
      message: string;
    };
  }>;
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

function mapLanguageCode(language?: string): string[] {
  const languageMap: Record<string, string[]> = {
    'por': ['pt'],
    'pt': ['pt'],
    'eng': ['en'],
    'en': ['en'],
    'spa': ['es'],
    'es': ['es'],
    'fra': ['fr'],
    'fr': ['fr']
  };

  return languageMap[language || 'por'] || ['pt', 'en'];
}

async function processGoogleVisionImage(imagePath: string, options?: OCROptions): Promise<OCRResponse> {
  try {
    const languageHints = mapLanguageCode(options?.language);

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const requestBody = {
      requests: [
        {
          image: {
            content: base64Image
          },
          features: [
            {
              type: 'TEXT_DETECTION',
              maxResults: 1
            }
          ],
          imageContext: {
            languageHints
          }
        }
      ]
    };

    const response = await axios.post(
      `${VISION_CONFIG.apiUrl}?key=${GOOGLE_VISION_API_KEY}`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000 // 30 segundos timeout
      }
    );

    const result: GoogleVisionResponse = response.data;
    const visionResult = result.responses[0];

    if (visionResult.error) {
      return {
        OCRExitCode: 0,
        IsErroredOnProcessing: true,
        ErrorMessage: visionResult.error.message || 'Erro na Google Vision API'
      };
    }

    const textAnnotations = visionResult.textAnnotations;

    if (!textAnnotations || textAnnotations.length === 0) {
      return {
        OCRExitCode: 0,
        IsErroredOnProcessing: true,
        ErrorMessage: 'Nenhum texto foi encontrado na imagem'
      };
    }

    const fullText = textAnnotations[0]?.description?.trim() || '';

    if (!fullText) {
      return {
        OCRExitCode: 0,
        IsErroredOnProcessing: true,
        ErrorMessage: 'Nenhum texto foi encontrado na imagem'
      };
    }

    const lines = fullText.split('\n').filter(line => line.trim().length > 0);
    const mockLines = lines.map(line => ({ LineText: line }));

    return {
      OCRExitCode: 1,
      IsErroredOnProcessing: false,
      ParsedResults: [{
        TextOverlay: {
          Lines: mockLines
        },
        ParsedText: fullText
      }]
    };

  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;
      return {
        OCRExitCode: 0,
        IsErroredOnProcessing: true,
        ErrorMessage: `Erro HTTP ${status}: ${message}`
      };
    }

    return {
      OCRExitCode: 0,
      IsErroredOnProcessing: true,
      ErrorMessage: error instanceof Error ? error.message : 'Erro desconhecido na Google Vision API'
    };
  }
}

export async function processImage(imagePath: string, options?: OCROptions): Promise<OCRResult> {
  const startTime = Date.now();

  try {
    createLogger('info').info(`🔍 Iniciando OCR com Google Vision para: ${imagePath}`);
    if (!validateImagePath(imagePath)) {
      return {
        success: false,
        error: 'Arquivo de imagem não encontrado ou inválido'
      };
    }

    const response = await processGoogleVisionImage(imagePath, options);
    const result = parseResponse(response);
    const processingTime = Date.now() - startTime;

    result.processingTime = processingTime;

    if (result.success) {
      createLogger('info').info(`✅ OCR processado com sucesso em ${processingTime}ms`);
      createLogger('info').info(`📊 Confiança: ${((result.confidence || 0) * 100).toFixed(1)}%`);
      createLogger('info').info(`📝 Texto extraído: ${result.text?.length} caracteres`);
    } else {
      createLogger('error').error(`❌ Falha no OCR (${processingTime}ms): ${result.error}`);
    }

    return result;

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    createLogger('error').error(`❌ Erro ao conectar com Google Vision API (${processingTime}ms):`, errorMessage);

    return {
      success: false,
      error: `Erro de conexão: ${errorMessage}`,
      processingTime
    };
  }
}

// Função para processar múltiplas imagens
export async function processMultipleImages(imagePaths: string[], options?: OCROptions): Promise<OCRResult[]> {
  createLogger('info').info(`🔍 Processando ${imagePaths.length} imagens com Google Vision...`);

  const results: OCRResult[] = [];

  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];
    createLogger('info').info(`📷 Processando imagem ${i + 1}/${imagePaths.length}: ${imagePath}`);

    const result = await processImage(imagePath, options);
    results.push(result);

    // Pequeno delay para evitar rate limiting (Google Vision tem limites mais altos que Tesseract)
    if (i < imagePaths.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const successful = results.filter(r => r.success).length;
  createLogger('info').info(`✅ OCR concluído: ${successful}/${imagePaths.length} imagens processadas com sucesso`);

  return results;
}

// Função adicional para OCR com detecção de documentos (mais precisa para textos estruturados)
export async function processDocumentImage(imagePath: string, options?: OCROptions): Promise<OCRResult> {
  const startTime = Date.now();

  try {
    createLogger('info').info(`🔍 Iniciando OCR de documento com Google Vision para: ${imagePath}`);
    if (!validateImagePath(imagePath)) {
      return {
        success: false,
        error: 'Arquivo de imagem não encontrado ou inválido'
      };
    }

    if (!GOOGLE_VISION_API_KEY || GOOGLE_VISION_API_KEY === 'SUA_API_KEY_AQUI') {
      return {
        success: false,
        error: 'Google Vision API Key não configurada. Defina GOOGLE_VISION_API_KEY como variável de ambiente.'
      };
    }

    const languageHints = mapLanguageCode(options?.language);
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const requestBody = {
      requests: [
        {
          image: {
            content: base64Image
          },
          features: [
            {
              type: 'DOCUMENT_TEXT_DETECTION',
              maxResults: 1
            }
          ],
          imageContext: {
            languageHints
          }
        }
      ]
    };

    const response = await axios.post(
      `${VISION_CONFIG.apiUrl}?key=${GOOGLE_VISION_API_KEY}`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000 // 30 segundos timeout
      }
    );

    const result: GoogleVisionResponse = response.data;
    const visionResult = result.responses[0];

    if (visionResult.error) {
      throw new Error(visionResult.error.message || 'Erro na Google Vision API');
    }

    const fullTextAnnotation = visionResult.fullTextAnnotation;

    if (!fullTextAnnotation || !fullTextAnnotation.text) {
      return {
        success: false,
        error: 'Nenhum texto foi encontrado na imagem'
      };
    }

    const extractedText = fullTextAnnotation.text.trim();
    const processingTime = Date.now() - startTime;

    const pages = fullTextAnnotation.pages || [];
    const blocks = pages.reduce((acc, page) => acc + (page.blocks?.length || 0), 0);
    const confidence = blocks > 5 ? 0.95 : blocks > 2 ? 0.8 : 0.6;

    createLogger('info').info(`✅ OCR de documento processado com sucesso em ${processingTime}ms`);
    createLogger('info').info(`📊 Confiança: ${(confidence * 100).toFixed(1)}%`);
    createLogger('info').info(`📝 Texto extraído: ${extractedText.length} caracteres`);

    return {
      success: true,
      text: extractedText,
      confidence,
      processingTime
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;

    // Tratar erros do axios
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;
      const errorMessage = `Erro HTTP ${status}: ${message}`;
      console.error(`❌ Erro ao processar documento (${processingTime}ms):`, errorMessage);

      return {
        success: false,
        error: `Erro de conexão: ${errorMessage}`,
        processingTime
      };
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`❌ Erro ao processar documento (${processingTime}ms):`, errorMessage);

    return {
      success: false,
      error: `Erro de conexão: ${errorMessage}`,
      processingTime
    };
  }
}

export const ocrService = {
  processImage,
  processMultipleImages,
  processDocumentImage,
};
