/**
 * Utilitário para validação e extração de URLs de vídeo
 * Suporta: YouTube, TikTok, Instagram, Facebook, Twitter
 */

import { VideoPlatform, VideoMetadata } from '../types/video.types';

// Regex patterns para cada plataforma
const URL_PATTERNS = {
  youtube: [
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|shorts\/)?([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/i
  ],
  tiktok: [
    /(?:https?:\/\/)?(?:www\.|vm\.|vt\.)?tiktok\.com\/(?:@[\w.-]+\/video\/)?(\d+)/i,
    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/v\/(\w+)/i
  ],
  instagram: [
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i
  ],
  facebook: [
    /(?:https?:\/\/)?(?:www\.)?facebook\.com\/(?:watch\/\?v=|[\w.-]+\/videos\/)(\d+)/i,
    /(?:https?:\/\/)?(?:www\.)?fb\.watch\/([a-zA-Z0-9_-]+)/i
  ],
  twitter: [
    /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/[\w]+\/status\/(\d+)/i
  ]
};

/**
 * Verifica se o texto contém algum padrão de URL de vídeo
 * Usado para roteamento rápido no message.handlers.ts
 */
export function containsVideoUrl(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  // Verifica padrões comuns de domínio
  const domainPatterns = [
    /youtube\.com/i,
    /youtu\.be/i,
    /tiktok\.com/i,
    /instagram\.com/i,
    /facebook\.com/i,
    /fb\.watch/i,
    /twitter\.com/i,
    /x\.com/i
  ];
  
  return domainPatterns.some(pattern => pattern.test(text));
}

/**
 * Extrai e valida URL de vídeo do texto
 * Retorna URL limpa ou null se inválida
 */
export function extractVideoUrl(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  
  // Tenta extrair URL de cada plataforma
  for (const [platform, patterns] of Object.entries(URL_PATTERNS)) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[0]) {
        // Retorna a URL completa encontrada
        return match[0];
      }
    }
  }
  
  return null;
}

/**
 * Identifica a plataforma e extrai metadados da URL
 */
export function parseVideoUrl(url: string): VideoMetadata | null {
  if (!url || typeof url !== 'string') return null;
  
  // Tenta identificar a plataforma
  for (const [platformName, patterns] of Object.entries(URL_PATTERNS)) {
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        const videoId = match[1] || undefined;
        
        return {
          platform: platformName as VideoPlatform,
          videoId,
          originalUrl: url
        };
      }
    }
  }
  
  // URL contém padrão mas não identificamos plataforma específica
  if (containsVideoUrl(url)) {
    return {
      platform: 'other',
      originalUrl: url
    };
  }
  
  return null;
}

/**
 * Normaliza URL de vídeo (remove parâmetros desnecessários)
 */
export function normalizeVideoUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // YouTube: manter apenas parâmetro 'v'
    if (urlObj.hostname.includes('youtube.com')) {
      const videoId = urlObj.searchParams.get('v');
      if (videoId) {
        return `https://youtube.com/watch?v=${videoId}`;
      }
    }
    
    // TikTok, Instagram, etc: remover query params
    if (urlObj.hostname.includes('tiktok.com') || 
        urlObj.hostname.includes('instagram.com')) {
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    }
    
    return url;
  } catch {
    // URL inválida, retorna original
    return url;
  }
}

export const urlValidator = {
  containsVideoUrl,
  extractVideoUrl,
  parseVideoUrl,
  normalizeVideoUrl
};
