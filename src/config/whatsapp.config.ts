import * as baileys from '@whiskeysockets/baileys';

export const WHATSAPP_CONFIG = {
  authStatePath: 'auth',
  loggerLevel: 'silent' as const,
  browser: baileys.Browsers.ubuntu('Chrome'),
  targetJid: '5519987428185@s.whatsapp.net',
  initialMessage: 'Olá! Mensagem enviada pelo bot do Baileys.',
};
