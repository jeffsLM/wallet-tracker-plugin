export const VISION_CONFIG = {
  defaultLanguage: 'pt',
  apiUrl: 'https://vision.googleapis.com/v1/images:annotate',
  features: [{ type: 'TEXT_DETECTION' }],
  imageContext: {
    languageHints: ['pt']
  }
} as const;
